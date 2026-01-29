import { logger } from './utils/logger';
import { storage } from './storage';
import { whatsappService } from './whatsapp';
import { ObjectStorageService } from './objectStorage';
import type { WhatsappCampaign, WhatsappCampaignRecipient } from '@shared/schema';
import { getNowSaoPaulo } from '@shared/dateUtils';

interface CampaignDispatcherStatus {
  campaignId: string | null;
  isRunning: boolean;
  currentRecipient: number;
  totalRecipients: number;
  sentCount: number;
  errorCount: number;
  lastError: string | null;
}

type StatusCallback = (status: CampaignDispatcherStatus) => void;

class WhatsAppCampaignDispatcher {
  private status: CampaignDispatcherStatus = {
    campaignId: null,
    isRunning: false,
    currentRecipient: 0,
    totalRecipients: 0,
    sentCount: 0,
    errorCount: 0,
    lastError: null,
  };
  private statusCallbacks: StatusCallback[] = [];
  private abortController: AbortController | null = null;
  private isPaused = false;

  onStatusUpdate(callback: StatusCallback) {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusUpdate() {
    this.statusCallbacks.forEach(cb => cb({ ...this.status }));
  }

  getStatus(): CampaignDispatcherStatus {
    return { ...this.status };
  }

  isRunning(): boolean {
    return this.status.isRunning;
  }

  private getRandomInterval(minSec: number, maxSec: number): number {
    return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
  }

  private async delay(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(true), ms);
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      }
    });
  }

  async startCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    if (this.status.isRunning) {
      return { success: false, message: 'Já existe uma campanha em execução' };
    }

    if (!whatsappService.isConnected()) {
      return { success: false, message: 'WhatsApp não está conectado' };
    }

    const campaign = await storage.getWhatsappCampaign(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campanha não encontrada' };
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return { success: false, message: 'Campanha já foi finalizada ou cancelada' };
    }

    const existingRecipients = await storage.getCampaignRecipients(campaignId);
    const pendingRecipients = await storage.getPendingCampaignRecipients(campaignId);
    
    let totalRecipients = existingRecipients.length;
    
    if (existingRecipients.length === 0) {
      const eligibleRecipients = await storage.getEligibleRecipientsForCampaign();
      if (eligibleRecipients.length === 0) {
        return { success: false, message: 'Nenhum destinatário elegível encontrado' };
      }

      const recipientData = eligibleRecipients.map(r => ({
        campaignId,
        userId: r.userId,
        phone: r.phone.replace(/\D/g, ''),
        userName: r.userName,
        status: 'pending' as const,
      }));
      await storage.createWhatsappCampaignRecipients(recipientData);
      totalRecipients = recipientData.length;

      await storage.updateWhatsappCampaign(campaignId, {
        totalRecipients: recipientData.length,
      });
    } else if (pendingRecipients.length === 0) {
      return { success: false, message: 'Todos os destinatários já foram processados' };
    }

    await storage.updateWhatsappCampaign(campaignId, {
      status: 'running',
      startedAt: campaign.startedAt || getNowSaoPaulo(),
    });

    this.abortController = new AbortController();
    this.isPaused = false;
    this.status = {
      campaignId,
      isRunning: true,
      currentRecipient: campaign.currentRecipientIndex || 0,
      totalRecipients: campaign.totalRecipients || totalRecipients,
      sentCount: campaign.sentCount || 0,
      errorCount: campaign.errorCount || 0,
      lastError: null,
    };
    this.notifyStatusUpdate();

    this.runCampaignLoop(campaignId);

    return { success: true, message: 'Campanha iniciada com sucesso' };
  }

  private async runCampaignLoop(campaignId: string) {
    try {
      while (true) {
        if (this.abortController?.signal.aborted) {
          logger.info(`[Campaign ${campaignId}] Campaign aborted`);
          break;
        }

        if (this.isPaused) {
          await this.delay(1000);
          continue;
        }

        const campaign = await storage.getWhatsappCampaign(campaignId);
        if (!campaign || campaign.status !== 'running') {
          logger.info(`[Campaign ${campaignId}] Campaign status changed, stopping`);
          break;
        }

        const pendingRecipients = await storage.getPendingCampaignRecipients(campaignId);
        if (pendingRecipients.length === 0) {
          logger.info(`[Campaign ${campaignId}] All recipients processed`);
          await this.completeCampaign(campaignId, campaign);
          break;
        }

        const recipient = pendingRecipients[0];
        await this.sendToRecipient(campaignId, campaign, recipient);

        const interval = this.getRandomInterval(
          campaign.intervalMinSec || 30,
          campaign.intervalMaxSec || 60
        );
        logger.info(`[Campaign ${campaignId}] Waiting ${interval / 1000}s before next message`);

        const shouldContinue = await this.delay(interval);
        if (!shouldContinue) {
          break;
        }
      }
    } catch (error: any) {
      logger.error(`[Campaign ${campaignId}] Error in campaign loop:`, error);
      this.status.lastError = error.message;
      this.notifyStatusUpdate();
    } finally {
      this.status.isRunning = false;
      this.notifyStatusUpdate();
    }
  }

  private async sendToRecipient(
    campaignId: string,
    campaign: WhatsappCampaign,
    recipient: WhatsappCampaignRecipient
  ) {
    try {
      const isOptedOut = await storage.isPhoneOptedOut(recipient.phone);
      if (isOptedOut) {
        await storage.updateCampaignRecipient(recipient.id, {
          status: 'skipped',
          errorMessage: 'Número optou por não receber campanhas',
        });
        await storage.updateWhatsappCampaign(campaignId, {
          skippedCount: (campaign.skippedCount || 0) + 1,
          currentRecipientIndex: (campaign.currentRecipientIndex || 0) + 1,
        });
        this.status.currentRecipient++;
        this.notifyStatusUpdate();
        return;
      }

      let success = false;
      const objectStorageService = new ObjectStorageService();
      const medias: Array<{ buffer: Buffer; type: 'image' | 'video' | 'audio' | 'document'; fileName?: string }> = [];

      if (campaign.imageUrl) {
        const buffer = await objectStorageService.getObjectBuffer(campaign.imageUrl);
        if (buffer) medias.push({ buffer, type: 'image', fileName: campaign.imageFileName || undefined });
      }
      if (campaign.videoUrl) {
        const buffer = await objectStorageService.getObjectBuffer(campaign.videoUrl);
        if (buffer) medias.push({ buffer, type: 'video', fileName: campaign.videoFileName || undefined });
      }
      if (campaign.audioUrl) {
        const buffer = await objectStorageService.getObjectBuffer(campaign.audioUrl);
        if (buffer) medias.push({ buffer, type: 'audio', fileName: campaign.audioFileName || undefined });
      }
      if (campaign.documentUrl) {
        const buffer = await objectStorageService.getObjectBuffer(campaign.documentUrl);
        if (buffer) medias.push({ buffer, type: 'document', fileName: campaign.documentFileName || undefined });
      }

      if (campaign.mediaUrl && campaign.mediaType) {
        const buffer = await objectStorageService.getObjectBuffer(campaign.mediaUrl);
        if (buffer) medias.push({ buffer, type: campaign.mediaType as 'image' | 'video' | 'audio' | 'document', fileName: campaign.mediaFileName || undefined });
      }

      if (medias.length > 0) {
        logger.info(`[Campaign ${campaignId}] Sending ${medias.length} media(s) to ${recipient.phone}`);
        success = await whatsappService.sendMultipleMedia(recipient.phone, medias, campaign.message, campaign.optOutMessage || undefined);
      } else {
        success = await whatsappService.sendMessage(recipient.phone, campaign.message);
        if (campaign.optOutMessage) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await whatsappService.sendMessage(recipient.phone, campaign.optOutMessage);
        }
      }

      if (success) {
        await storage.updateCampaignRecipient(recipient.id, {
          status: 'sent',
          sentAt: getNowSaoPaulo(),
          attemptCount: (recipient.attemptCount || 0) + 1,
        });
        await storage.incrementCampaignSentCount(campaignId);
        this.status.sentCount++;
        logger.info(`[Campaign ${campaignId}] Message sent to ${recipient.phone}`);
      } else {
        throw new Error('Falha ao enviar mensagem');
      }
    } catch (error: any) {
      logger.error(`[Campaign ${campaignId}] Error sending to ${recipient.phone}:`, error.message);
      await storage.updateCampaignRecipient(recipient.id, {
        status: 'error',
        errorMessage: error.message,
        attemptCount: (recipient.attemptCount || 0) + 1,
      });
      await storage.incrementCampaignErrorCount(campaignId);
      this.status.errorCount++;
      this.status.lastError = error.message;
    }

    this.status.currentRecipient++;
    this.notifyStatusUpdate();
  }

  private async completeCampaign(campaignId: string, campaign: WhatsappCampaign) {
    await storage.updateWhatsappCampaign(campaignId, {
      status: 'completed',
      completedAt: getNowSaoPaulo(),
    });

    const stats = await storage.getCampaignRecipientStats(campaignId);
    logger.info(`[Campaign ${campaignId}] Completed. Stats:`, stats);

    this.status.isRunning = false;
    this.notifyStatusUpdate();
  }

  async pauseCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    if (!this.status.isRunning || this.status.campaignId !== campaignId) {
      return { success: false, message: 'Campanha não está em execução' };
    }

    this.isPaused = true;
    await storage.updateWhatsappCampaign(campaignId, {
      status: 'paused',
      pausedAt: getNowSaoPaulo(),
    });

    logger.info(`[Campaign ${campaignId}] Paused`);
    return { success: true, message: 'Campanha pausada' };
  }

  async resumeCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    const campaign = await storage.getWhatsappCampaign(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campanha não encontrada' };
    }

    if (campaign.status !== 'paused') {
      return { success: false, message: 'Campanha não está pausada' };
    }

    if (!whatsappService.isConnected()) {
      return { success: false, message: 'WhatsApp não está conectado' };
    }

    if (this.status.isRunning && this.status.campaignId === campaignId) {
      this.isPaused = false;
      await storage.updateWhatsappCampaign(campaignId, {
        status: 'running',
      });
      return { success: true, message: 'Campanha retomada' };
    }

    return this.startCampaign(campaignId);
  }

  async cancelCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    const campaign = await storage.getWhatsappCampaign(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campanha não encontrada' };
    }

    if (this.status.campaignId === campaignId) {
      this.abortController?.abort();
    }

    await storage.updateWhatsappCampaign(campaignId, {
      status: 'cancelled',
      completedAt: getNowSaoPaulo(),
    });

    this.status.isRunning = false;
    this.status.campaignId = null;
    this.notifyStatusUpdate();

    logger.info(`[Campaign ${campaignId}] Cancelled`);
    return { success: true, message: 'Campanha cancelada' };
  }
}

export const campaignDispatcher = new WhatsAppCampaignDispatcher();
