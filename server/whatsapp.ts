import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import type { ConnectionState } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { logger } from './utils/logger';
import path from 'path';
import fs from 'fs';
import { whatsappQueue, QueueMetrics } from './whatsappQueue';

interface WhatsAppStatus {
  connected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnected: Date | null;
  connecting: boolean;
  error: string | null;
}

type OptOutHandler = (phone: string, message: string) => Promise<void>;

class WhatsAppService {
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private status: WhatsAppStatus = {
    connected: false,
    qrCode: null,
    phoneNumber: null,
    lastConnected: null,
    connecting: false,
    error: null,
  };
  private qrUpdateCallbacks: ((qr: string | null) => void)[] = [];
  private statusUpdateCallbacks: ((status: WhatsAppStatus) => void)[] = [];
  private sessionPath: string;
  private initializationPromise: Promise<void> | null = null;
  private optOutHandler: OptOutHandler | null = null;
  
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 3000;
  private maxReconnectDelay: number = 300000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private consecutiveConflicts: number = 0;
  private maxConsecutiveConflicts: number = 3;

  constructor() {
    this.sessionPath = path.join(process.cwd(), '.baileys_auth');
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
    
    whatsappQueue.setSendFunction(this.sendMessageDirect.bind(this));
    
    this.autoInitializeFromSession();
  }
  
  private async autoInitializeFromSession(): Promise<void> {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (!isProduction) {
        logger.info('[WhatsApp] Dev mode - WhatsApp auto-connect DISABLED. Production has priority. Use manual connect if needed.');
        return;
      }
      
      const credsPath = path.join(this.sessionPath, 'creds.json');
      if (fs.existsSync(credsPath)) {
        logger.info('[WhatsApp] Production mode - auto-initializing WhatsApp in 3s...');
        setTimeout(async () => {
          try {
            await this.initialize();
          } catch (err: any) {
            logger.warn('[WhatsApp] Auto-initialization failed:', err.message);
          }
        }, 3000);
      }
    } catch (err) {
      logger.warn('[WhatsApp] Error checking for existing session:', err);
    }
  }
  
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      if (this.status.connected && this.socket) {
        try {
          const socketState = this.socket.ws?.readyState;
          if (socketState !== 1) {
            logger.warn(`[WhatsApp] Health check failed: WebSocket state is ${socketState}`);
            this.handleConnectionLoss('Health check falhou');
          }
        } catch (err) {
          logger.warn('[WhatsApp] Health check error:', err);
        }
      }
    }, 30000);
    
    logger.debug('[WhatsApp] Health check started (every 30s)');
  }
  
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  private async handleConnectionLoss(reason: string): Promise<void> {
    logger.warn(`[WhatsApp] Connection lost: ${reason}`);
    this.stopHealthCheck();
    await this.cleanupSocket();
    this.status.connected = false;
    this.status.connecting = false;
    this.status.error = reason;
    this.initializationPromise = null;
    this.notifyStatusUpdate();
    this.scheduleReconnect();
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`[WhatsApp] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Will retry after cooldown.`);
      this.status.error = 'Máximo de tentativas atingido. Tentando novamente em 10 minutos...';
      this.notifyStatusUpdate();
      
      this.reconnectTimeout = setTimeout(() => {
        logger.info('[WhatsApp] Cooldown finished, resetting reconnect attempts...');
        this.reconnectAttempts = 0;
        this.scheduleReconnect();
      }, 600000);
      return;
    }
    
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    logger.info(`[WhatsApp] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);
    
    this.reconnectTimeout = setTimeout(async () => {
      if (!this.status.connected && !this.status.connecting) {
        try {
          await this.cleanupSocket();
          this.initializationPromise = null;
          await this.initialize();
        } catch (err: any) {
          logger.error('[WhatsApp] Reconnect attempt failed:', err.message);
          this.scheduleReconnect();
        }
      }
    }, delay);
  }
  
  private resetReconnectState(): void {
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private notifyQRUpdate(qr: string | null) {
    this.qrUpdateCallbacks.forEach(cb => cb(qr));
  }

  private notifyStatusUpdate() {
    this.statusUpdateCallbacks.forEach(cb => cb(this.status));
  }

  onQRUpdate(callback: (qr: string | null) => void) {
    this.qrUpdateCallbacks.push(callback);
    return () => {
      this.qrUpdateCallbacks = this.qrUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  onStatusUpdate(callback: (status: WhatsAppStatus) => void) {
    this.statusUpdateCallbacks.push(callback);
    return () => {
      this.statusUpdateCallbacks = this.statusUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  getQueueMetrics() {
    return whatsappQueue.getMetrics();
  }

  getQueueLength(): number {
    return whatsappQueue.getQueueLength();
  }

  setOptOutHandler(handler: OptOutHandler) {
    this.optOutHandler = handler;
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.status.connected || this.status.connecting) {
      logger.info('[WhatsApp] Already connected or connecting');
      return;
    }

    this.resetReconnectState();
    
    await this.cleanupSocket();

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }
  
  private async cleanupSocket(): Promise<void> {
    if (this.socket) {
      try {
        logger.debug('[WhatsApp] Cleaning up old socket...');
        this.socket.ev.removeAllListeners();
        this.socket.ws?.close();
        this.socket.end(undefined);
      } catch (err) {
        logger.warn('[WhatsApp] Error cleaning up socket:', err);
      }
      this.socket = null;
    }
  }

  private async _initialize(): Promise<void> {
    logger.info('[WhatsApp] Initializing WhatsApp client with Baileys...');
    
    this.status.connecting = true;
    this.status.error = null;
    this.notifyStatusUpdate();

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Lowfy', 'Desktop', '1.0.0'],
        syncFullHistory: false,
      });

      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info('[WhatsApp] QR Code received');
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              width: 300,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
            this.status.qrCode = qrDataUrl;
            this.notifyQRUpdate(qrDataUrl);
            this.notifyStatusUpdate();
          } catch (err) {
            logger.error('[WhatsApp] Error generating QR code:', err);
          }
        }

        if (connection === 'open') {
          logger.info('[WhatsApp] Client is ready');
          this.status.connected = true;
          this.status.connecting = false;
          this.status.qrCode = null;
          this.status.lastConnected = new Date();
          this.status.error = null;
          this.consecutiveConflicts = 0;
          
          this.resetReconnectState();
          this.startHealthCheck();
          
          try {
            const user = this.socket?.user;
            if (user) {
              this.status.phoneNumber = user.id.split(':')[0];
              logger.info(`[WhatsApp] Connected as: ${this.status.phoneNumber}`);
            }
          } catch (err) {
            logger.warn('[WhatsApp] Could not get phone info:', err);
          }
          
          this.notifyQRUpdate(null);
          this.notifyStatusUpdate();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const errorMessage = (lastDisconnect?.error as any)?.message || 'Conexão fechada';
          const isConflict = statusCode === 440;
          
          logger.warn(`[WhatsApp] Connection closed. Status: ${statusCode}, Reason: ${errorMessage}, Conflict: ${isConflict}, Should reconnect: ${shouldReconnect}`);
          
          this.stopHealthCheck();
          this.status.connected = false;
          this.status.connecting = false;
          this.status.phoneNumber = null;
          this.initializationPromise = null;
          
          if (isConflict) {
            this.consecutiveConflicts++;
            logger.warn(`[WhatsApp] Consecutive conflicts: ${this.consecutiveConflicts}/${this.maxConsecutiveConflicts}`);
            
            if (this.consecutiveConflicts >= this.maxConsecutiveConflicts) {
              this.status.error = 'CONFLITO PERSISTENTE: Outra sessão do WhatsApp Web está ativa. Feche todas as outras sessões do WhatsApp Web (navegadores, outros computadores) e no celular vá em Configurações > Dispositivos Vinculados e desconecte sessões extras. Depois clique em "Conectar" novamente.';
              this.resetReconnectState();
              logger.error('[WhatsApp] Too many consecutive conflicts - stopping auto-reconnect. User must manually reconnect.');
              this.notifyStatusUpdate();
              return;
            } else {
              this.status.error = `Conflito de sessão detectado (${this.consecutiveConflicts}/${this.maxConsecutiveConflicts}). Tentando reconectar...`;
            }
          } else {
            this.consecutiveConflicts = 0;
            this.status.error = errorMessage;
          }
          
          this.notifyStatusUpdate();
          
          if (shouldReconnect) {
            if (isConflict) {
              logger.info('[WhatsApp] Conflict detected - waiting 30s before reconnecting...');
              setTimeout(() => this.scheduleReconnect(), 30000);
            } else {
              this.scheduleReconnect();
            }
          } else {
            logger.info('[WhatsApp] User logged out. Clearing session...');
            this.resetReconnectState();
          }
        }
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('messages.upsert', async (m: any) => {
        try {
          if (!m.messages || m.messages.length === 0) return;
          
          for (const msg of m.messages) {
            if (msg.key.fromMe) continue;
            
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || '';
            
            if (!text) continue;
            
            const normalizedText = text.trim().toUpperCase();
            const senderJid = msg.key.remoteJid;
            const senderPhone = senderJid?.replace('@s.whatsapp.net', '') || '';
            
            if (this.optOutHandler && senderPhone) {
              await this.optOutHandler(senderPhone, normalizedText);
            }
          }
        } catch (err) {
          logger.error('[WhatsApp] Error processing incoming message:', err);
        }
      });

    } catch (error: any) {
      logger.error('[WhatsApp] Failed to initialize:', error);
      this.status.connecting = false;
      this.status.error = error.message || 'Erro ao inicializar WhatsApp';
      this.initializationPromise = null;
      this.notifyStatusUpdate();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    logger.info('[WhatsApp] Disconnecting...');
    
    this.stopHealthCheck();
    this.resetReconnectState();
    
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (err) {
        logger.warn('[WhatsApp] Error during logout:', err);
      }
      
      this.socket = null;
    }
    
    this.status = {
      connected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnected: null,
      connecting: false,
      error: null,
    };
    this.initializationPromise = null;
    
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
    } catch (err) {
      logger.warn('[WhatsApp] Error cleaning session:', err);
    }
    
    this.notifyStatusUpdate();
    logger.info('[WhatsApp] Disconnected successfully');
  }

  async forceReconnect(): Promise<void> {
    logger.info('[WhatsApp] Force reconnecting - clearing session and starting fresh...');
    
    this.stopHealthCheck();
    this.resetReconnectState();
    
    await this.cleanupSocket();
    
    this.status = {
      connected: false,
      qrCode: null,
      phoneNumber: null,
      lastConnected: null,
      connecting: false,
      error: null,
    };
    this.initializationPromise = null;
    this.consecutiveConflicts = 0;
    
    try {
      if (fs.existsSync(this.sessionPath)) {
        logger.info('[WhatsApp] Clearing old session files...');
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
    } catch (err) {
      logger.warn('[WhatsApp] Error cleaning session:', err);
    }
    
    this.notifyStatusUpdate();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('[WhatsApp] Starting fresh connection...');
    await this.initialize();
  }

  private formatPhone(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (!cleanPhone.startsWith('55')) {
      formattedPhone = '55' + cleanPhone;
    }
    return formattedPhone;
  }

  private async sendMessageDirect(phone: string, message: string): Promise<boolean> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('WhatsApp não está conectado');
    }

    const jid = `${phone}@s.whatsapp.net`;
    
    logger.info(`[WhatsApp] Checking if ${phone} exists on WhatsApp...`);
    const results = await this.socket.onWhatsApp(jid);
    logger.info(`[WhatsApp] onWhatsApp result for ${jid}:`, JSON.stringify(results));
    
    if (!results || results.length === 0 || !results[0].exists) {
      const phoneWithout9 = this.tryRemove9thDigit(phone);
      if (phoneWithout9 !== phone) {
        logger.info(`[WhatsApp] Number not found, trying without 9th digit: ${phoneWithout9}`);
        const altJid = `${phoneWithout9}@s.whatsapp.net`;
        const altResults = await this.socket.onWhatsApp(altJid);
        
        if (altResults && altResults.length > 0 && altResults[0].exists) {
          logger.info(`[WhatsApp] Found with alternate format: ${phoneWithout9}`);
          await this.socket.sendMessage(altJid, { text: message });
          logger.info(`[WhatsApp] Message sent to ${phoneWithout9}`);
          return true;
        }
      }
      throw new Error(`Número ${phone} não está registrado no WhatsApp`);
    }

    const correctJid = results[0].jid;
    logger.info(`[WhatsApp] Number ${phone} exists with JID: ${correctJid}, sending message...`);
    await this.socket.sendMessage(correctJid, { text: message });
    logger.info(`[WhatsApp] Message sent to ${correctJid}`);
    return true;
  }
  
  private tryRemove9thDigit(phone: string): string {
    if (phone.startsWith('55') && phone.length === 13) {
      const ddd = phone.substring(2, 4);
      const number = phone.substring(4);
      if (number.startsWith('9') && number.length === 9) {
        return `55${ddd}${number.substring(1)}`;
      }
    }
    return phone;
  }

  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);
    const message = `🔐 *Código de Verificação Lowfy*\n\nSeu código de acesso é: *${code}*\n\n⏱️ Este código expira em 10 minutos.\n⚠️ Não compartilhe este código com ninguém.\n\n_Se você não solicitou este código, ignore esta mensagem._`;

    return new Promise((resolve, reject) => {
      whatsappQueue.enqueue(formattedPhone, message, 'verification', (success, error) => {
        if (success) {
          resolve(true);
        } else {
          reject(new Error(error || 'Falha ao enviar código'));
        }
      });
    });
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);

    return new Promise((resolve, reject) => {
      whatsappQueue.enqueue(formattedPhone, message, 'notification', (success, error) => {
        if (success) {
          resolve(true);
        } else {
          reject(new Error(error || 'Falha ao enviar mensagem'));
        }
      });
    });
  }

  async sendTestMessage(phone: string, message: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);

    return new Promise((resolve, reject) => {
      whatsappQueue.enqueue(formattedPhone, message, 'test', (success, error) => {
        if (success) {
          resolve(true);
        } else {
          reject(new Error(error || 'Falha ao enviar mensagem de teste'));
        }
      });
    });
  }

  async checkNumberRegistered(phone: string): Promise<boolean> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;

    try {
      const results = await this.socket.onWhatsApp(jid);
      return results?.[0]?.exists === true;
    } catch (error) {
      logger.error('[WhatsApp] Error checking number registration:', error);
      return false;
    }
  }

  async sendMediaMessage(
    phone: string,
    mediaSource: string | Buffer,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    fileName?: string
  ): Promise<boolean> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;

    logger.info(`[WhatsApp] Checking if ${formattedPhone} exists on WhatsApp for media message...`);
    const results = await this.socket.onWhatsApp(jid);
    
    if (!results || results.length === 0 || !results[0].exists) {
      const phoneWithout9 = this.tryRemove9thDigit(formattedPhone);
      if (phoneWithout9 !== formattedPhone) {
        const altJid = `${phoneWithout9}@s.whatsapp.net`;
        const altResults = await this.socket.onWhatsApp(altJid);
        
        if (altResults && altResults.length > 0 && altResults[0].exists) {
          return this.sendMediaToJid(altJid, mediaSource, mediaType, caption, fileName);
        }
      }
      throw new Error(`Número ${formattedPhone} não está registrado no WhatsApp`);
    }

    const correctJid = results[0].jid;
    return this.sendMediaToJid(correctJid, mediaSource, mediaType, caption, fileName);
  }

  private async sendMediaToJid(
    jid: string,
    mediaSource: string | Buffer,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    fileName?: string
  ): Promise<boolean> {
    if (!this.socket) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      let buffer: Buffer;
      
      if (Buffer.isBuffer(mediaSource)) {
        buffer = mediaSource;
        logger.info(`[WhatsApp] Using provided buffer for media (${buffer.length} bytes)`);
      } else {
        logger.info(`[WhatsApp] Fetching media from URL: ${mediaSource}`);
        const response = await fetch(mediaSource);
        if (!response.ok) {
          throw new Error(`Failed to fetch media: ${response.status}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }

      let messageContent: any;
      
      switch (mediaType) {
        case 'image':
          messageContent = {
            image: buffer,
            caption: caption || undefined,
          };
          break;
        case 'video':
          messageContent = {
            video: buffer,
            caption: caption || undefined,
          };
          break;
        case 'audio':
          messageContent = {
            audio: buffer,
            mimetype: 'audio/mp4',
            ptt: false,
          };
          break;
        case 'document':
          messageContent = {
            document: buffer,
            mimetype: 'application/octet-stream',
            fileName: fileName || 'document',
            caption: caption || undefined,
          };
          break;
        default:
          throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
      }

      await this.socket.sendMessage(jid, messageContent);
      logger.info(`[WhatsApp] Media message (${mediaType}) sent to ${jid}`);
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error);
      logger.error(`[WhatsApp] Error sending media to ${jid}: ${errorMessage}`);
      throw new Error(`Falha ao enviar mídia: ${errorMessage}`);
    }
  }

  async sendMultipleMedia(
    phone: string,
    medias: Array<{ buffer: Buffer; type: 'image' | 'video' | 'audio' | 'document'; fileName?: string }>,
    textMessage?: string,
    optOutMessage?: string
  ): Promise<boolean> {
    if (!this.isConnected() || !this.socket) {
      throw new Error('WhatsApp não está conectado');
    }

    const formattedPhone = this.formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;

    logger.info(`[WhatsApp] Checking if ${formattedPhone} exists on WhatsApp for multiple media...`);
    const results = await this.socket.onWhatsApp(jid);
    
    let correctJid = jid;
    if (!results || results.length === 0 || !results[0].exists) {
      const phoneWithout9 = this.tryRemove9thDigit(formattedPhone);
      if (phoneWithout9 !== formattedPhone) {
        const altJid = `${phoneWithout9}@s.whatsapp.net`;
        const altResults = await this.socket.onWhatsApp(altJid);
        
        if (altResults && altResults.length > 0 && altResults[0].exists) {
          correctJid = altResults[0].jid;
        } else {
          throw new Error(`Número ${formattedPhone} não está registrado no WhatsApp`);
        }
      } else {
        throw new Error(`Número ${formattedPhone} não está registrado no WhatsApp`);
      }
    } else {
      correctJid = results[0].jid;
    }

    if (textMessage) {
      await this.socket.sendMessage(correctJid, { text: textMessage });
      logger.info(`[WhatsApp] Text message sent to ${correctJid}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    for (const media of medias) {
      await this.sendMediaToJid(correctJid, media.buffer, media.type, undefined, media.fileName);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (optOutMessage) {
      if (!this.isConnected() || !this.socket) {
        logger.warn(`[WhatsApp] Connection lost before sending opt-out message, waiting for reconnect...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!this.isConnected() || !this.socket) {
          throw new Error('Conexão perdida durante o envio. Tente novamente.');
        }
      }
      await this.socket.sendMessage(correctJid, { text: optOutMessage });
      logger.info(`[WhatsApp] Opt-out message sent to ${correctJid}`);
    }

    return true;
  }
}

export const whatsappService = new WhatsAppService();
