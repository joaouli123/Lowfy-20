import crypto from "crypto";
import { db } from "../../db";
import { users, sessions, passwordResetTokens, type User, type AccountRecoveryRequest, type AccountChangeRequest } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { storage } from "../../storage";
import { whatsappService } from "../../whatsapp";
import { hashPassword } from "../../auth";
import { sendEmail } from "../../email";
import { getAppUrl } from "@shared/domainConfig";
import { logger } from "../../utils/logger";
import { MSG } from "./prompts";

/**
 * Desfechos do agente de recuperação. Regras:
 * - Caminho normal: link one-time de 30min, enviado ao e-mail cadastrado E pelo
 *   WhatsApp. A senha é criada na página oficial, nunca digitada no chat.
 * - Último recurso (a pessoa confirma que nada chegou): senha provisória pelo
 *   WhatsApp — expira em minutos, obriga troca no primeiro login, derruba todas
 *   as sessões e avisa o e-mail antigo. Desligável em config.allowWhatsappPassword.
 * - Troca de email/telefone nunca é aplicada direto: vira account_change_requests
 *   (auto-approve = agendada +24h com link de contestação ao e-mail antigo).
 * - Todo desfecho notifica o e-mail atual do usuário (mitiga chip reciclado).
 */

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const CHANGE_DELAY_MS = 24 * 60 * 60 * 1000;
const CONTEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : '***';
}

export async function notifyAdmins(message: string, io?: any): Promise<void> {
  try {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
    for (const admin of admins) {
      await storage.createAndEmitNotification({
        userId: admin.id,
        type: 'account_recovery',
        message,
      }, io);
    }
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao notificar admins:', { error: err.message });
  }
}

/**
 * Cria token de reset (30min, invalida anteriores) e envia o link pelo WhatsApp
 * + e-mail de aviso ao endereço atual. Retorna true se o link chegou ao WhatsApp.
 */
export async function deliverResetLink(
  request: AccountRecoveryRequest,
  user: User,
): Promise<{ whatsapp: boolean; email: boolean }> {
  await db
    .update(passwordResetTokens)
    .set({ used: true, usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      eq(passwordResetTokens.used, false),
    ));

  const rawToken = crypto.randomBytes(32).toString('hex');
  const [tokenRow] = await db.insert(passwordResetTokens).values({
    userId: user.id,
    email: user.email,
    token: crypto.createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  }).returning();

  const resetUrl = getAppUrl(`/reset-password?token=${rawToken}`);
  const whatsappMessage =
    `✅ *Lowfy — Recuperação de conta*\n\n` +
    `Sua identidade foi confirmada. Use o link abaixo para criar uma nova senha:\n\n` +
    `${resetUrl}\n\n` +
    `⚠️ O link expira em *30 minutos* e só funciona uma vez. ` +
    `A Lowfy NUNCA pede a sua senha por mensagem — você mesmo define a senha na página oficial.`;

  let delivered = false;
  let emailSent = false;
  try {
    delivered = await whatsappService.sendConversationMessage(request.phone, whatsappMessage);
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao entregar link de reset via WhatsApp:', { requestId: request.id, error: err.message });
  }

  await storage.updateRecoveryRequest(request.id, {
    resetTokenId: tokenRow.id,
    outcomeDelivered: delivered,
  });

  // O e-mail é o canal PRIMÁRIO pedido pelo dono: leva o mesmo link + o aviso
  // de segurança. Se não foi o titular, ele fica sabendo na hora.
  try {
    await sendEmail({
      to: user.email,
      subject: '🔐 Link para criar sua nova senha - Lowfy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #059669;">Lowfy — Recuperação de conta</h2>
          <p>Olá, ${user.name}.</p>
          <p>Sua identidade foi confirmada no nosso atendimento por WhatsApp em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Use o botão abaixo para criar uma nova senha:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="background: #059669; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Criar nova senha</a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">O link expira em <strong>30 minutos</strong> e só funciona uma vez.</p>
          <p><strong>Se NÃO foi você</strong>, sua conta pode estar em risco: ignore este e-mail e entre em contato com o suporte imediatamente.</p>
          <p style="color: #6b7280; font-size: 12px;">A Lowfy nunca pede sua senha por WhatsApp, e-mail ou telefone.</p>
        </div>
      `,
    });
    emailSent = true;
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao enviar link de reset por e-mail:', { requestId: request.id, error: err.message });
  }

  return { whatsapp: delivered, email: emailSent };
}

// Sem caracteres ambíguos (0/O, 1/l/I) — a pessoa vai digitar isso na mão.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateTempPassword(): string {
  const pick = (n: number) => Array.from(crypto.randomBytes(n))
    .map(b => TEMP_ALPHABET[b % TEMP_ALPHABET.length])
    .join('');
  return `Lowfy-${pick(4)}-${pick(4)}`;
}

/**
 * ÚLTIMO RECURSO: define uma senha provisória e entrega na própria conversa.
 * Só é chamado depois que a identidade JÁ foi aprovada pelos mesmos critérios do
 * link — não cria um caminho de acesso mais fraco, só um canal de entrega
 * diferente para quem não recebe e-mail.
 *
 * Contenção: expira em `ttlMinutes`, marca must_change_password, derruba todas
 * as sessões existentes, avisa o e-mail cadastrado e alerta os admins.
 */
export async function deliverTemporaryPassword(
  request: AccountRecoveryRequest,
  user: User,
  ttlMinutes: number,
): Promise<{ delivered: boolean }> {
  const password = generateTempPassword();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Mandamos ANTES de trocar a senha no banco: se o WhatsApp falhar aqui, a
  // conta fica exatamente como estava. Trocar primeiro e não conseguir entregar
  // deixaria a pessoa presa do lado de fora com uma senha que ninguém conhece.
  let delivered = false;
  try {
    delivered = await whatsappService.sendConversationMessage(
      request.phone,
      MSG.tempPasswordMessage(password, ttlMinutes, getAppUrl('/login')),
    );
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao entregar senha provisória via WhatsApp:', { requestId: request.id, error: err.message });
  }
  if (!delivered) return { delivered: false };

  await db.update(users).set({
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    tempPasswordExpiresAt: expiresAt,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  // Quem estivesse logado na conta cai — inclusive um eventual invasor anterior.
  try {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
  } catch (err: any) {
    logger.warn('[RECOVERY] Falha ao invalidar sessões após senha provisória:', { error: err.message });
  }

  // Tokens de reset pendentes perdem a validade (a senha já mudou).
  await db.update(passwordResetTokens)
    .set({ used: true, usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.used, false)));

  await storage.updateRecoveryRequest(request.id, {
    tempPasswordSentAt: new Date(),
    outcomeDelivered: true,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: '⚠️ Senha provisória emitida para sua conta - Lowfy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #dc2626;">Lowfy — Aviso de segurança</h2>
          <p>Olá, ${user.name}.</p>
          <p>Uma <strong>senha provisória</strong> foi emitida para a sua conta no atendimento por WhatsApp em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, porque o link de redefinição não chegou até você.</p>
          <p>Ela expira em <strong>${ttlMinutes} minutos</strong> e precisa ser trocada no primeiro acesso. Todas as sessões abertas foram encerradas.</p>
          <p><strong>Se NÃO foi você</strong>, entre em contato com o suporte agora — sua conta pode estar comprometida.</p>
        </div>
      `,
    });
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao avisar e-mail sobre senha provisória:', { requestId: request.id, error: err.message });
  }

  await notifyAdmins(
    `🔑 Senha provisória enviada por WhatsApp para ${user.name} (${maskEmail(user.email)}) — o link não chegou. ` +
    `Expira em ${ttlMinutes} min e exige troca no login. Solicitação ${request.id}.`,
  );
  logger.warn(`[RECOVERY] Senha provisória entregue via WhatsApp para user ${user.id} (request ${request.id})`);

  return { delivered: true };
}

/**
 * Registra pedido de troca de e-mail/telefone.
 * - autoApproved=true (posse forte): agendada para +24h, com link de contestação ao e-mail ATUAL.
 * - autoApproved=false: fica 'pending' aguardando admin.
 */
export async function createChangeRequest(
  request: AccountRecoveryRequest,
  user: User,
  field: 'email' | 'phone',
  newValue: string,
  autoApproved: boolean,
): Promise<AccountChangeRequest> {
  const oldValue = field === 'email' ? user.email : (user.phone || null);

  if (!autoApproved) {
    return await storage.createAccountChangeRequest({
      recoveryRequestId: request.id,
      userId: user.id,
      field,
      oldValue,
      newValue,
      status: 'pending',
    });
  }

  const rawContestToken = crypto.randomBytes(32).toString('hex');
  const change = await storage.createAccountChangeRequest({
    recoveryRequestId: request.id,
    userId: user.id,
    field,
    oldValue,
    newValue,
    status: 'scheduled',
    contestTokenHash: crypto.createHash('sha256').update(rawContestToken).digest('hex'),
    contestExpiresAt: new Date(Date.now() + CONTEST_TTL_MS),
    applyAfter: new Date(Date.now() + CHANGE_DELAY_MS),
  });

  const fieldLabel = field === 'email' ? 'e-mail' : 'telefone';
  const contestUrl = getAppUrl(`/api/account-changes/contest?token=${rawContestToken}`);
  try {
    await sendEmail({
      to: user.email,
      subject: `⚠️ Alteração de ${fieldLabel} agendada na sua conta - Lowfy`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #059669;">Lowfy — Aviso de segurança</h2>
          <p>Olá, ${user.name}.</p>
          <p>Foi solicitada, via atendimento por WhatsApp, a alteração do <strong>${fieldLabel}</strong> da sua conta para: <strong>${field === 'email' ? maskEmail(newValue) : newValue}</strong>.</p>
          <p>A alteração será aplicada automaticamente em <strong>24 horas</strong>.</p>
          <p><strong>Se NÃO foi você</strong>, clique no botão abaixo para CANCELAR a alteração e congelar o pedido:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${contestUrl}" style="background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Não fui eu — cancelar alteração</a>
          </p>
          <p style="color: #6b7280; font-size: 12px;">Se foi você, nenhuma ação é necessária. A Lowfy nunca pede sua senha por WhatsApp, e-mail ou telefone.</p>
        </div>
      `,
    });
  } catch (err: any) {
    logger.error('[RECOVERY] Falha ao enviar e-mail de contestação:', { changeId: change.id, error: err.message });
  }

  return change;
}

/**
 * Aplica uma troca de email/telefone (chamada pelo scheduler ou pelo approve do admin).
 * Valida unicidade na hora da aplicação — conflito → volta para 'pending' + admins avisados.
 */
export async function applyChangeRequest(change: AccountChangeRequest, io?: any): Promise<{ applied: boolean; reason?: string }> {
  const user = await storage.getUser(change.userId);
  if (!user) {
    await storage.updateAccountChangeRequest(change.id, { status: 'rejected' });
    return { applied: false, reason: 'user_not_found' };
  }

  if (change.field === 'email') {
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, change.newValue.toLowerCase()), ne(users.id, user.id)))
      .limit(1);
    if (conflict) {
      await storage.updateAccountChangeRequest(change.id, { status: 'pending', applyAfter: null });
      await notifyAdmins(`Recuperação de conta: troca de e-mail de ${user.name} conflita com outra conta — requer análise manual.`, io);
      return { applied: false, reason: 'email_in_use' };
    }
    await db.update(users)
      .set({ email: change.newValue.toLowerCase(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } else if (change.field === 'phone') {
    const digits = change.newValue.replace(/\D/g, '');
    const normalized = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, normalized), ne(users.id, user.id)))
      .limit(1);
    if (conflict) {
      await storage.updateAccountChangeRequest(change.id, { status: 'pending', applyAfter: null });
      await notifyAdmins(`Recuperação de conta: troca de telefone de ${user.name} conflita com outra conta — requer análise manual.`, io);
      return { applied: false, reason: 'phone_in_use' };
    }
    // Telefone trocado por recuperação nasce NÃO verificado (verificação normal depois)
    await db.update(users)
      .set({ phone: normalized, phoneVerified: false, phoneVerifiedAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } else {
    await storage.updateAccountChangeRequest(change.id, { status: 'rejected' });
    return { applied: false, reason: 'invalid_field' };
  }

  await storage.updateAccountChangeRequest(change.id, { status: 'applied', appliedAt: new Date() });
  logger.info(`[RECOVERY] Change request ${change.id} aplicada (${change.field}) para user ${user.id}`);
  return { applied: true };
}

/**
 * Contestação: congela o pedido, notifica admins. Chamada pelo endpoint público de contest.
 */
export async function contestChangeRequest(rawToken: string, io?: any): Promise<{ ok: boolean; message: string }> {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const change = await storage.getAccountChangeRequestByContestHash(hash);

  if (!change || !change.contestExpiresAt || change.contestExpiresAt < new Date()) {
    return { ok: false, message: 'Link de contestação inválido ou expirado.' };
  }
  if (change.status === 'applied') {
    await notifyAdmins(`⚠️ Contestação recebida APÓS aplicação da troca de ${change.field} (pedido ${change.id}) — possível invasão, verificar urgente.`, io);
    return { ok: true, message: 'Contestação registrada. Nossa equipe foi alertada e vai revisar sua conta imediatamente.' };
  }
  if (change.status === 'contested') {
    return { ok: true, message: 'Esta alteração já estava contestada e não será aplicada.' };
  }

  await storage.updateAccountChangeRequest(change.id, { status: 'contested', applyAfter: null });
  await notifyAdmins(`🚨 Contestação de troca de ${change.field} (pedido ${change.id}) — alteração congelada, revisar possível tentativa de invasão.`, io);
  logger.warn(`[RECOVERY] Change request ${change.id} contestada pelo dono do e-mail.`);
  return { ok: true, message: 'Alteração cancelada com sucesso. Nenhuma mudança será feita na sua conta.' };
}
