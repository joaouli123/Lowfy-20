import cron from 'node-cron';
import { db } from './db';
import { sessions, passwordResetTokens, emailVerifications, phoneVerifications } from '@shared/schema';
import { lt } from 'drizzle-orm';
import { logger } from './utils/logger';
import { exclusive } from './utils/cron-lock';

/**
 * Remove dados de autenticação expirados que, de outra forma, cresceriam sem
 * limite (sessões, tokens de reset, OTPs de email/telefone). Usa o índice
 * IDX_session_expires existente para a varredura de sessões.
 */
export async function cleanupExpiredAuthData(): Promise<void> {
  const now = new Date();

  try {
    const deletedSessions = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    if (deletedSessions.length > 0) {
      logger.info(`[AuthCleanup] ${deletedSessions.length} sessão(ões) expirada(s) removida(s)`);
    }
  } catch (err) {
    logger.error('[AuthCleanup] Erro ao limpar sessões expiradas:', err);
  }

  try {
    // Tokens de reset já usados ou expirados há mais de 7 dias
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, cutoff));
  } catch (err) {
    logger.error('[AuthCleanup] Erro ao limpar tokens de reset:', err);
  }

  try {
    // OTPs de email expirados (mantém histórico curto)
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await db.delete(emailVerifications).where(lt(emailVerifications.expiresAt, cutoff));
    await db.delete(phoneVerifications).where(lt(phoneVerifications.expiresAt, cutoff));
  } catch (err) {
    logger.error('[AuthCleanup] Erro ao limpar OTPs expirados:', err);
  }
}

export function startSessionCleanupScheduler(): void {
  // Executa diariamente às 04:00 (horário de Brasília), com proteção de overlap.
  cron.schedule('0 4 * * *', exclusive('auth-cleanup', cleanupExpiredAuthData), {
    timezone: 'America/Sao_Paulo',
  });

  // Primeira limpeza ~1min após o boot para já reduzir acúmulo existente.
  setTimeout(() => {
    void cleanupExpiredAuthData();
  }, 60_000);

  logger.info('[AuthCleanup] Agendador de limpeza de sessões/tokens ativo (diário às 04:00).');
}
