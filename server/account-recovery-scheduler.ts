import cron from 'node-cron';
import { storage } from './storage';
import { whatsappService } from './whatsapp';
import { logger } from './utils/logger';
import { exclusive } from './utils/cron-lock';

/**
 * Scheduler do agente de recuperação de conta:
 * - 5/5min: expira sessões inativas, aplica trocas de email/telefone agendadas
 *   (janela de 24h vencida) e reentrega desfechos aprovados não entregues.
 * - Diário 04:10: reseta contadores diários de sessão, limpa locks vencidos e
 *   anonimiza transcripts/CPFs com mais de 90 dias (LGPD).
 */

export async function runRecoveryMaintenanceTick(): Promise<void> {
  const now = new Date();

  // 1. Expirar sessões inativas (despedida best-effort)
  try {
    const expired = await storage.getExpiredActiveRecoveryRequests(now);
    for (const request of expired) {
      // Em awaiting_delivery o desfecho já saiu (link/senha); só não sabemos se
      // funcionou. Encerra sem alarde — dizer "expirou" confundiria quem já resolveu.
      if (request.state === 'awaiting_delivery') {
        await storage.transitionRecoveryRequest(request.id, ['awaiting_delivery'], { state: 'completed' });
        continue;
      }
      const transitioned = await storage.transitionRecoveryRequest(request.id, ['collecting', 'awaiting_email_otp'], {
        state: 'expired',
      });
      if (transitioned && whatsappService.isConnected()) {
        try {
          await whatsappService.sendConversationMessage(request.phone,
            '⏰ Sua sessão de recuperação de conta expirou por inatividade. Para recomeçar, envie *RECUPERAR CONTA*.');
        } catch { /* best-effort */ }
      }
    }
    if (expired.length > 0) {
      const closed = expired.filter(r => r.state === 'awaiting_delivery').length;
      logger.info(`[RecoveryScheduler] ${expired.length - closed} sessão(ões) expirada(s), ${closed} encerrada(s) pós-entrega`);
    }
  } catch (err) {
    logger.error('[RecoveryScheduler] Erro ao expirar sessões:', err);
  }

  // 2. Aplicar trocas agendadas vencidas (24h sem contestação)
  try {
    const due = await storage.getDueScheduledChangeRequests(now);
    if (due.length > 0) {
      const { applyChangeRequest } = await import('./services/accountRecovery/outcomes');
      for (const change of due) {
        const result = await applyChangeRequest(change);
        logger.info(`[RecoveryScheduler] Change ${change.id} (${change.field}): applied=${result.applied}${result.reason ? ` (${result.reason})` : ''}`);
        if (result.applied && whatsappService.isConnected()) {
          const recovery = change.recoveryRequestId ? await storage.getRecoveryRequest(change.recoveryRequestId) : null;
          if (recovery) {
            try {
              await whatsappService.sendConversationMessage(recovery.phone,
                `✅ A troca de ${change.field === 'email' ? 'e-mail' : 'telefone'} da sua conta Lowfy foi concluída.`);
            } catch { /* best-effort */ }
          }
        }
      }
    }
  } catch (err) {
    logger.error('[RecoveryScheduler] Erro ao aplicar trocas agendadas:', err);
  }

  // 3. Reentregar desfechos aprovados que falharam na entrega (WhatsApp caiu etc.)
  try {
    const undelivered = await storage.getUndeliveredApprovedRecoveryRequests();
    if (undelivered.length > 0 && whatsappService.isConnected()) {
      const { deliverResetLink } = await import('./services/accountRecovery/outcomes');
      for (const request of undelivered) {
        if (!request.matchedUserId) continue;
        // Desfecho ficou aprovado há mais de 24h sem entrega → expira (link teria vencido de qualquer forma)
        if (request.decidedAt && now.getTime() - request.decidedAt.getTime() > 24 * 60 * 60 * 1000) {
          await storage.updateRecoveryRequest(request.id, { state: 'expired' });
          continue;
        }
        const user = await storage.getUser(request.matchedUserId);
        if (!user) continue;
        const { whatsapp, email } = await deliverResetLink(request, user);
        if (whatsapp || email) {
          // Mesmo fluxo do envio original: perguntamos se o link funcionou antes
          // de encerrar (é aí que entra a senha provisória, se precisar).
          const { MSG } = await import('./services/accountRecovery/prompts');
          await storage.updateRecoveryRequest(request.id, {
            state: 'awaiting_delivery',
            outcomeDelivered: true,
            deliveryAttempts: (request.deliveryAttempts || 0) + 1,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          });
          try {
            await whatsappService.sendConversationMessage(request.phone, MSG.askDeliveryWorked);
          } catch { /* best-effort */ }
          logger.info(`[RecoveryScheduler] Desfecho reentregue para sessão ${request.id}`);
        }
      }
    }
  } catch (err) {
    logger.error('[RecoveryScheduler] Erro ao reentregar desfechos:', err);
  }
}

export async function runRecoveryDailyMaintenance(): Promise<void> {
  try {
    await storage.resetDailyRecoveryLocks();
    logger.info('[RecoveryScheduler] Contadores diários de sessão resetados');
  } catch (err) {
    logger.error('[RecoveryScheduler] Erro ao resetar locks diários:', err);
  }

  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const anonymized = await storage.anonymizeOldRecoveryRequests(cutoff);
    if (anonymized > 0) logger.info(`[RecoveryScheduler] LGPD: ${anonymized} solicitação(ões) anonimizada(s) (>90 dias)`);
  } catch (err) {
    logger.error('[RecoveryScheduler] Erro na anonimização LGPD:', err);
  }
}

export function startAccountRecoveryScheduler(): void {
  cron.schedule('*/5 * * * *', exclusive('account-recovery-tick', runRecoveryMaintenanceTick), {
    timezone: 'America/Sao_Paulo',
  });

  cron.schedule('10 4 * * *', exclusive('account-recovery-daily', runRecoveryDailyMaintenance), {
    timezone: 'America/Sao_Paulo',
  });

  logger.info('[RecoveryScheduler] Agendador de recuperação de conta ativo (tick 5min, diário 04:10).');
}
