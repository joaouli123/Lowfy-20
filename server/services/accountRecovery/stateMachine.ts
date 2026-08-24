import { db } from "../../db";
import { emailVerifications, type AccountRecoveryRequest, type User } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../../storage";
import { whatsappService, MEDIA_PLACEHOLDER } from "../../whatsapp";
import { hashPassword, verifyPassword } from "../../auth";
import { generateOTP } from "../../comtele";
import { sendEmail } from "../../email";
import { logger } from "../../utils/logger";
import { MSG } from "./prompts";
import { runLlmTurn, runDeterministicTurn, extractOtpCode, isCancelMessage, type AgentTurn, type ExtractedFields } from "./agent";
import { verifyIdentity, hasMinimumData, type CollectedData } from "./verifier";
import { deliverResetLink, deliverTemporaryPassword, createChangeRequest, notifyAdmins, maskCpf } from "./outcomes";
import { isHelpRequest, saysDeliveryFailed, saysDeliverySucceeded, isAffirmative, isNegative, type RecoveryField } from "./fuzzy";

/**
 * Máquina de estados do agente de recuperação de conta via WhatsApp.
 * Estados: collecting → awaiting_email_otp | awaiting_admin | approved →
 *          completed | denied | expired | cancelled
 * A LLM opera DENTRO do estado (interpreta/redige); transições e decisões
 * são exclusivamente deste arquivo + verifier.ts.
 */

// 30min: gente procurando CPF em gaveta demora mais que 15.
const SESSION_TTL_MS = 30 * 60 * 1000;
const DELIVERY_TTL_MS = 60 * 60 * 1000; // esperando a pessoa dizer se o link funcionou
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_MESSAGES_PER_SESSION = 45; // conversa com confirmação e correções é mais longa
const MAX_VERIFY_ATTEMPTS = 4;
const MAX_OTP_ATTEMPTS = 3;
const GLOBAL_CIRCUIT_SESSIONS_PER_HOUR = 20;
// Quem desistiu no meio e voltou no mesmo dia retoma os dados já informados.
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

const TRIGGER_RE = /recuperar\s+(minha\s+)?conta|esqueci\s+(a\s+|minha\s+)?senha|perdi\s+(o\s+)?acesso|n[ãa]o\s+consigo\s+(entrar|logar|acessar|fazer\s+login)|(trocar|mudar|alterar)\s+(o\s+)?(meu\s+)?e-?mail|e-?mail\s+(antigo|errado|n[ãa]o\s+(uso|tenho))|^recuperar$|^recupera[çc][ãa]o$/i;

// Mutex por telefone — inbound só chega na instância que segura o socket Baileys.
const phoneLocks = new Map<string, Promise<void>>();

function withPhoneLock(phone: string, fn: () => Promise<boolean>): Promise<boolean> {
  const prev = phoneLocks.get(phone) || Promise.resolve();
  let result: Promise<boolean>;
  const next = prev.then(async () => {
    result = fn();
    await result.catch(() => {});
  });
  phoneLocks.set(phone, next.finally(() => {
    if (phoneLocks.get(phone) === next) phoneLocks.delete(phone);
  }));
  return prev.then(() => result!);
}

function todayBucket(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}

function maskSensitive(text: string): string {
  return text.replace(/\b(\d{3})[.\s]?\d{3}[.\s]?\d{3}[-.\s]?(\d{2})\b/g, '$1.***.***-$2');
}

async function sendReply(phone: string, message: string): Promise<boolean> {
  try {
    return await whatsappService.sendConversationMessage(phone, message);
  } catch (err: any) {
    logger.error(`[RECOVERY] Falha ao responder ${phone.slice(0, 6)}***: ${err.message}`);
    return false;
  }
}

function appendConversation(request: AccountRecoveryRequest, role: 'user' | 'agent', text: string): any[] {
  const conv = Array.isArray(request.conversation) ? [...(request.conversation as any[])] : [];
  conv.push({ role, text: maskSensitive(text).slice(0, 1000), at: new Date().toISOString() });
  return conv.slice(-60);
}

function getPendingQuestion(request: AccountRecoveryRequest): string | null {
  const details = request.matchDetails as any;
  return details?.pendingQuestion || null;
}

async function applyProgressiveLockout(phone: string): Promise<void> {
  const lock = await storage.getRecoveryLock(phone);
  const failedCount = (lock?.failedCount || 0) + 1;
  let lockedUntil: Date | null = lock?.lockedUntil || null;
  if (failedCount >= 10) lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  else if (failedCount >= 6) lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  else if (failedCount >= 3) lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
  await storage.upsertRecoveryLock(phone, { failedCount, lockedUntil });
}

// ============================================================
// Entrada única (registrada como inbound handler no whatsapp.ts)
// ============================================================

export async function handleRecoveryInbound(phone: string, rawText: string): Promise<boolean> {
  if (process.env.ACCOUNT_RECOVERY_AGENT_ENABLED === 'false') return false;
  if (!rawText || !rawText.trim()) return false;

  return withPhoneLock(phone, async () => {
    try {
      return await processInbound(phone, rawText.trim());
    } catch (err: any) {
      logger.error(`[RECOVERY] Erro no processamento inbound: ${err.message}`, { stack: err.stack });
      // Erro interno nunca vaza detalhes; não consome para não engolir opt-out
      return false;
    }
  });
}

async function processInbound(phone: string, text: string): Promise<boolean> {
  const active = await storage.getActiveRecoveryRequestByPhone(phone);

  // Áudio/foto/figurinha: só respondemos a quem já está em atendimento — e sem
  // deixar a sessão avançar (não dá para extrair dado de mídia).
  if (text === MEDIA_PLACEHOLDER) {
    if (!active || !['collecting', 'awaiting_email_otp', 'awaiting_delivery'].includes(active.state)) return false;
    await storage.updateRecoveryRequest(active.id, {
      lastMessageAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    await sendReply(phone, MSG.mediaNotSupported);
    return true;
  }

  if (!active) {
    if (!TRIGGER_RE.test(text)) return false; // silêncio total sem gatilho
    return await startSession(phone, text);
  }

  const config = await storage.getRecoveryConfig();
  if (!config.enabled) {
    await sendReply(phone, MSG.serviceOff);
    await storage.updateRecoveryRequest(active.id, { state: 'cancelled' });
    return true;
  }

  // Expiração por inatividade
  if (active.expiresAt && active.expiresAt < new Date()) {
    if (active.state === 'awaiting_delivery') {
      // O desfecho já saiu; só não sabemos se funcionou. Encerra sem alarde.
      await storage.transitionRecoveryRequest(active.id, ['awaiting_delivery'], { state: 'completed' });
      return false;
    }
    await storage.transitionRecoveryRequest(active.id, ['collecting', 'awaiting_email_otp'], { state: 'expired' });
    if (['collecting', 'awaiting_email_otp'].includes(active.state)) {
      await sendReply(phone, MSG.expired);
      return true;
    }
  }

  // Cancelamento explícito dentro da sessão (NÃO é opt-out de campanha)
  if (isCancelMessage(text)) {
    await storage.transitionRecoveryRequest(active.id, ['collecting', 'awaiting_email_otp', 'awaiting_admin', 'awaiting_delivery'], {
      state: 'cancelled',
      conversation: appendConversation(active, 'user', text),
    });
    await sendReply(phone, MSG.cancelled);
    return true;
  }

  // Anti-flood por sessão
  if ((active.messageCount || 0) >= MAX_MESSAGES_PER_SESSION) {
    await storage.transitionRecoveryRequest(active.id, ['collecting', 'awaiting_email_otp'], { state: 'expired' });
    await applyProgressiveLockout(phone);
    await sendReply(phone, MSG.genericUnavailable);
    return true;
  }

  switch (active.state) {
    case 'collecting':
      return await handleCollecting(active, text, config);
    case 'awaiting_email_otp':
      return await handleAwaitingOtp(active, text);
    case 'awaiting_delivery':
      return await handleAwaitingDelivery(active, text, config);
    case 'awaiting_admin':
      await storage.updateRecoveryRequest(active.id, {
        conversation: appendConversation(active, 'user', text),
        messageCount: (active.messageCount || 0) + 1,
        lastMessageAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // aguardando admin não expira em 15min
      });
      await sendReply(active.phone, MSG.awaitingAdminReminder);
      return true;
    case 'approved':
      await sendReply(active.phone, active.outcomeDelivered ? MSG.completed :
        'Estamos finalizando seu atendimento — você receberá a mensagem de conclusão em instantes. 🙂');
      return true;
    default:
      return false;
  }
}

// ============================================================
// Início de sessão (gatilho reconhecido, sem sessão ativa)
// ============================================================

async function startSession(phone: string, text: string): Promise<boolean> {
  const config = await storage.getRecoveryConfig();
  if (!config.enabled) {
    await sendReply(phone, MSG.serviceOff);
    return true;
  }

  // Locks persistentes por telefone
  const lock = await storage.getRecoveryLock(phone);
  const bucket = todayBucket();
  const sessionsToday = lock?.dayBucket === bucket ? (lock.sessionsToday || 0) : 0;
  if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
    await sendReply(phone, MSG.genericUnavailable);
    return true;
  }
  if (sessionsToday >= (config.maxSessionsPerDay || 3)) {
    await sendReply(phone, MSG.genericUnavailable);
    return true;
  }

  // Circuito global anti-abuso: pico anômalo de sessões → auto-desliga + alerta
  const recentCount = await storage.countRecentRecoveryRequests(new Date(Date.now() - 60 * 60 * 1000));
  if (recentCount >= GLOBAL_CIRCUIT_SESSIONS_PER_HOUR) {
    await storage.updateRecoveryConfig({ enabled: false });
    await notifyAdmins(`🚨 Circuito de segurança: ${recentCount} sessões de recuperação na última hora. Agente AUTO-DESLIGADO — reative no painel após verificar.`);
    logger.warn(`[RECOVERY] Circuito global disparado (${recentCount} sessões/hora). Agente desligado.`);
    await sendReply(phone, MSG.serviceOff);
    return true;
  }

  // Retomada: se a pessoa começou nas últimas 24h e a sessão expirou/foi
  // cancelada, reaproveitamos o que ela já digitou em vez de pedir tudo de
  // novo. Nada é dispensado por isso — a verificação roda igual.
  const history = await storage.listRecoveryRequestsByPhone(phone, 3);
  const resumable = history.find(r =>
    ['expired', 'cancelled'].includes(r.state) &&
    r.createdAt && (Date.now() - new Date(r.createdAt).getTime()) < RESUME_WINDOW_MS &&
    (r.collectedName || r.collectedCpf || r.collectedEmail));

  const request = await storage.createRecoveryRequest({
    phone,
    normalizedPhone: phone.replace(/\D/g, ''),
    state: 'collecting',
    collectedName: resumable?.collectedName ?? null,
    collectedEmail: resumable?.collectedEmail ?? null,
    collectedCpf: resumable?.collectedCpf ?? null,
    collectedPhone: resumable?.collectedPhone ?? null,
    unknownFields: (resumable?.unknownFields as any) ?? [],
    conversation: [{ role: 'user', text: maskSensitive(text).slice(0, 1000), at: new Date().toISOString() }],
    messageCount: 1,
    lastMessageAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  await storage.upsertRecoveryLock(phone, {
    sessionsToday: sessionsToday + 1,
    dayBucket: bucket,
    failedCount: lock?.dayBucket === bucket ? (lock?.failedCount || 0) : 0,
  });

  const welcome = MSG.welcome;
  await sendReply(phone, welcome);
  await storage.updateRecoveryRequest(request.id, {
    conversation: appendConversation({ ...request, conversation: request.conversation } as AccountRecoveryRequest, 'agent', welcome),
  });
  logger.info(`[RECOVERY] Nova sessão ${request.id} para ${phone.slice(0, 6)}***`);
  return true;
}

// ============================================================
// Estado: collecting
// ============================================================

// Heurística p/ nome no modo sem LLM: sobra alfabética após remover dados estruturados
function extractNameHeuristic(text: string, extracted: ExtractedFields): string | null {
  let residue = text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
    .replace(/[\d().+-]/g, ' ')
    .replace(/\b(meu|nome|completo|é|e|eh|sou|o|a|cpf|email|e-mail|telefone|celular|numero|número|novo|nova|senha|conta|recuperar|esqueci|opç[aã]o)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = residue.split(' ').filter(w => /^[a-zA-ZÀ-ÿ]{2,}$/.test(w));
  if (words.length >= 2 && words.length <= 8) return words.join(' ');
  return null;
}

/** Campos que a pessoa já declarou não lembrar (persistidos na sessão). */
function unknownOf(request: AccountRecoveryRequest): RecoveryField[] {
  const raw = request.unknownFields;
  return Array.isArray(raw) ? (raw as RecoveryField[]) : [];
}

/**
 * O que ainda falta perguntar, considerando o que a pessoa disse não lembrar.
 * `blocking` = sem isso não dá para nem tentar verificar.
 */
function missingFields(
  request: AccountRecoveryRequest,
  senderIsRegistered: boolean,
): { labels: string[]; unresolvable: boolean } {
  const unknown = unknownOf(request);
  const labels: string[] = [];

  if (!request.collectedName && !unknown.includes('name')) labels.push('nome completo');
  if (!request.collectedCpf && !unknown.includes('cpf')) labels.push('CPF');
  if (!request.collectedPhone && !senderIsRegistered && !unknown.includes('phone')) {
    labels.push('telefone cadastrado na conta (com DDD)');
  }
  if (!request.collectedEmail && !unknown.includes('email')) labels.push('e-mail cadastrado');

  // Já perguntamos tudo que dava e ainda assim não há material suficiente para
  // uma verificação honesta → não adianta insistir, vai para análise humana.
  const identifiers = [
    request.collectedEmail,
    request.collectedCpf,
    request.collectedPhone || (senderIsRegistered ? request.normalizedPhone : null),
  ].filter(Boolean).length;
  const unresolvable = labels.length === 0 && (!request.collectedName || identifiers < 2);

  return { labels, unresolvable };
}

/** Resumo do que a PESSOA digitou (nunca do banco), para ela conferir. */
function confirmationLines(request: AccountRecoveryRequest, senderIsRegistered: boolean): string[] {
  const lines: string[] = [];
  const goalLabel = request.goal === 'change_email' ? 'trocar o e-mail da conta'
    : request.goal === 'change_phone' ? 'trocar o telefone da conta'
    : request.goal === 'combo' ? 'trocar o e-mail e redefinir a senha'
    : 'redefinir a senha';
  lines.push(`• Você quer: *${goalLabel}*`);
  if (request.collectedName) lines.push(`• Nome: *${request.collectedName}*`);
  if (request.collectedCpf) lines.push(`• CPF: *${maskCpf(request.collectedCpf)}*`);
  if (request.collectedPhone) lines.push(`• Telefone: *${request.collectedPhone}*`);
  else if (senderIsRegistered) lines.push(`• Telefone: *este número*`);
  if (request.collectedEmail) lines.push(`• E-mail: *${request.collectedEmail}*`);
  if (request.requestedNewEmail) lines.push(`• Novo e-mail: *${request.requestedNewEmail}*`);
  if (request.requestedNewPhone) lines.push(`• Novo telefone: *${request.requestedNewPhone}*`);
  return lines;
}

/**
 * Campo que estávamos perguntando agora — é a ele que se aplica um
 * "não lembro" solto, sem o nome do dado.
 */
function firstMissingField(
  request: AccountRecoveryRequest,
  senderIsRegistered: boolean,
): RecoveryField | null {
  const unknown = unknownOf(request);
  if (!request.collectedName && !unknown.includes('name')) return 'name';
  if (!request.collectedCpf && !unknown.includes('cpf')) return 'cpf';
  if (!request.collectedPhone && !senderIsRegistered && !unknown.includes('phone')) return 'phone';
  if (!request.collectedEmail && !unknown.includes('email')) return 'email';
  return null;
}

/** Responde sem mudar de estado, gravando a conversa e o que foi coletado. */
async function replyAndStay(
  request: AccountRecoveryRequest,
  text: string,
  updates: Partial<AccountRecoveryRequest>,
  reply: string,
): Promise<boolean> {
  let conv = appendConversation(request, 'user', text);
  conv = [...conv, { role: 'agent', text: reply.slice(0, 1000), at: new Date().toISOString() }];
  const patch: Partial<AccountRecoveryRequest> = { ...updates, conversation: conv as any };
  if (patch.messageCount === undefined) {
    patch.messageCount = (request.messageCount || 0) + 1;
    patch.lastMessageAt = new Date();
    patch.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  }
  await storage.updateRecoveryRequest(request.id, patch);
  await sendReply(request.phone, reply);
  return true;
}

async function handleCollecting(request: AccountRecoveryRequest, text: string, config: any): Promise<boolean> {
  const pendingQuestion = getPendingQuestion(request);

  // Se a mensagem vem de um número que não está em nenhuma conta, a pessoa precisa
  // declarar o telefone cadastrado — é ele que, junto do CPF, confirma a identidade.
  const senderIsRegistered = !!(await storage.getUserByPhoneFlexible(request.normalizedPhone));

  // "Ajuda"/"não entendi" não avança o fluxo, só explica e repete a pergunta.
  if (isHelpRequest(text)) {
    return await replyAndStay(request, text, {}, MSG.help);
  }

  const missing = missingFields(request, senderIsRegistered).labels;

  let turn: AgentTurn | null = await runLlmTurn(request, text, missing, pendingQuestion);
  if (!turn) turn = runDeterministicTurn(text);

  if (turn.userWantsCancel) {
    await storage.transitionRecoveryRequest(request.id, ['collecting'], {
      state: 'cancelled',
      conversation: appendConversation(request, 'user', text),
    });
    await sendReply(request.phone, MSG.cancelled);
    return true;
  }

  const ex = turn.extracted;
  if (!ex.fullName) ex.fullName = extractNameHeuristic(text, ex);

  const updates: Partial<AccountRecoveryRequest> = {
    messageCount: (request.messageCount || 0) + 1,
    lastMessageAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };

  // Objetivo: o primeiro declarado vale; se um segundo aparecer depois
  // ("ah, e também não sei a senha"), a sessão vira 'combo'.
  if (ex.goal) {
    if (!request.goal) updates.goal = ex.alsoWantsPassword ? 'combo' : ex.goal;
    else if (request.goal !== ex.goal && request.goal !== 'combo') updates.goal = 'combo';
  } else if (ex.alsoWantsPassword && request.goal === 'change_email') {
    updates.goal = 'combo';
  }

  if (ex.fullName) updates.collectedName = ex.fullName.slice(0, 120);
  if (ex.email) updates.collectedEmail = ex.email.slice(0, 200);
  if (ex.cpf) updates.collectedCpf = ex.cpf;
  if (ex.phone && ex.phone !== request.normalizedPhone) updates.collectedPhone = ex.phone;
  if (ex.newEmail) updates.requestedNewEmail = ex.newEmail.slice(0, 200);
  if (ex.newPhone) updates.requestedNewPhone = ex.newPhone;

  // "Não lembro": marca o campo para pararmos de insistir. Se ela disser só
  // "não lembro", aplicamos ao campo que estávamos perguntando.
  const unknown = new Set<RecoveryField>(unknownOf(request));
  for (const f of ex.unknownFields || []) unknown.add(f);
  if (ex.unknownGeneric) {
    const asked = firstMissingField(request, senderIsRegistered);
    if (asked) unknown.add(asked);
  }
  // Informar o dado depois cancela o "não lembro" — a pessoa achou.
  if (ex.fullName) unknown.delete('name');
  if (ex.email) unknown.delete('email');
  if (ex.cpf) unknown.delete('cpf');
  if (ex.phone) unknown.delete('phone');
  updates.unknownFields = Array.from(unknown) as any;

  const merged: AccountRecoveryRequest = { ...request, ...updates } as AccountRecoveryRequest;

  // Digitou um CPF que reprovou nos dígitos verificadores: avisa e NÃO gasta
  // tentativa de verificação (o erro é de digitação, não de identidade).
  if (ex.cpfInvalidAttempt && !merged.collectedCpf) {
    return await replyAndStay(request, text, updates, MSG.cpfInvalid);
  }

  // Resposta pendente sobre acesso ao e-mail (decide OTP vs admin)
  if (pendingQuestion === 'email_access' && ex.emailAccessAnswer !== null && ex.emailAccessAnswer !== undefined) {
    if (ex.emailAccessAnswer === true && merged.matchedUserId) {
      return await startEmailOtp(merged, text, updates);
    }
    // Perdeu o e-mail e não tem posse do telefone → análise humana
    return await sendToAdmin(merged, text, updates, 'sem posse: perdeu acesso ao e-mail cadastrado');
  }

  // Etapa de conferência: a pessoa precisa confirmar o que digitou antes de
  // gastarmos uma tentativa de verificação com um dado torto.
  const correctedSomething = !!(ex.fullName || ex.email || ex.cpf || ex.phone || ex.newEmail || ex.newPhone);
  let confirmed = false;
  if (pendingQuestion === 'confirm_data') {
    if (correctedSomething) {
      confirmed = false; // mandou correção → confere de novo com o dado novo
    } else if (ex.confirmAnswer === true) {
      confirmed = true;
    } else if (ex.confirmAnswer === false) {
      return await replyAndStay(request, text, updates, MSG.confirmRedo);
    }
  }

  // Faltando objetivo ou dados → continua coletando
  const goal = merged.goal;
  const needsNewEmail = goal === 'change_email' && !merged.requestedNewEmail;
  const needsNewPhone = goal === 'change_phone' && !merged.requestedNewPhone;
  const pending = missingFields(merged, senderIsRegistered);

  // Perguntamos tudo o que dava e a pessoa não lembra o suficiente: insistir só
  // gasta as tentativas dela. Vai para análise humana com o que temos.
  if (pending.unresolvable) {
    return await sendToAdmin(merged, text, updates,
      `dados insuficientes (não lembra: ${Array.from(unknown).join(', ') || '—'})`);
  }

  if (!goal || pending.labels.length > 0 || needsNewEmail || needsNewPhone) {
    let reply = turn.reply;
    if (!reply) {
      if (!goal) reply = (merged.messageCount || 0) <= 1 ? MSG.welcome : MSG.invalidOption;
      else if (needsNewEmail) reply = MSG.askNewEmail;
      else if (needsNewPhone) reply = MSG.askNewPhone;
      else if (pending.labels.length && pending.labels.length < 4) reply = MSG.askDataPartial(pending.labels);
      else reply = MSG.askData;
    }
    return await replyAndStay(request, text, updates, reply);
  }

  if (!confirmed) {
    updates.matchDetails = { ...(request.matchDetails as any || {}), pendingQuestion: 'confirm_data' } as any;
    return await replyAndStay(request, text, updates,
      MSG.confirmData(confirmationLines(merged, senderIsRegistered)));
  }

  // Dados completos e confirmados → verificação determinística
  await sendReply(request.phone, MSG.verifying);
  const match = await verifyIdentity(request.phone, collectedOf(merged));

  updates.matchScore = match.score;
  updates.matchDetails = { ...match.details, pendingQuestion: null } as any;
  updates.possessionFactor = match.possessionFactor;
  updates.riskFlags = match.riskFlags as any;
  updates.matchedUserId = match.user?.id || null;

  // Casos que vão direto para o admin, com resposta genérica idêntica (anti-enumeração)
  if (match.riskFlags.includes('multiple_users') || match.riskFlags.includes('account_blocked')) {
    return await sendToAdmin(merged, text, updates, `flags: ${match.riskFlags.join(',')}`);
  }

  const thresholdAuto = config.thresholdAuto ?? 55;
  const thresholdMin = config.thresholdMin ?? 40;

  if (match.user && match.possessionFactor === 'whatsapp_phone' && match.score >= thresholdAuto && config.autoApproveEnabled) {
    return await approveAndDeliver(merged, text, updates, match.user, 'auto_approved',
      `posse whatsapp_phone + score ${match.score} >= ${thresholdAuto}`);
  }

  // Regra do dono: CPF exato + telefone cadastrado batendo confirmam a identidade,
  // mesmo que a mensagem venha de um número novo (é o mesmo critério que ele usa
  // hoje na mão). Trocas seguem protegidas: delay de 24h + link de contestação ao
  // e-mail antigo, e a conta recebe aviso por e-mail em qualquer desfecho.
  if (match.user && match.details.cpfMatch && match.details.phoneMatch && config.autoApproveEnabled) {
    return await approveAndDeliver(merged, text, updates, match.user, 'auto_approved',
      `CPF + telefone cadastrado conferem (score ${match.score}, posse ${match.possessionFactor})`);
  }

  // Telefone quase batendo (um dígito de diferença): quase sempre é digitação.
  // Pedimos para conferir uma única vez, sem revelar o número cadastrado e sem
  // gastar tentativa — se corrigir, cai na regra CPF + telefone acima.
  if (match.user && match.details.phoneNearMiss && !match.details.phoneMatch
      && (request.matchDetails as any)?.phoneNearMissAsked !== true) {
    updates.matchDetails = { ...match.details, pendingQuestion: null, phoneNearMissAsked: true } as any;
    return await replyAndStay(request, text, updates, MSG.phoneNearMiss);
  }

  if (match.user && match.possessionFactor === 'whatsapp_phone') {
    // Número certo mas dados fracos (chip reciclado?) → humano decide
    return await sendToAdmin(merged, text, updates, `posse whatsapp mas score ${match.score} < ${thresholdAuto}`);
  }

  if (match.user && match.score >= thresholdMin) {
    // Sem posse do telefone: oferecer OTP no e-mail cadastrado
    updates.matchDetails = { ...match.details, pendingQuestion: 'email_access' } as any;
    let conv = appendConversation(request, 'user', text);
    conv = [...conv, { role: 'agent', text: MSG.askEmailAccess, at: new Date().toISOString() }];
    await storage.updateRecoveryRequest(request.id, { ...updates, conversation: conv });
    await sendReply(request.phone, MSG.askEmailAccess);
    return true;
  }

  // Score insuficiente OU nenhum candidato — mesma resposta nos dois casos
  const attempts = (request.verifyAttempts || 0) + 1;
  updates.verifyAttempts = attempts;
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    await applyProgressiveLockout(request.phone);
    return await sendToAdmin(merged, text, updates, `${attempts} verificações sem match suficiente (score ${match.score})`);
  }
  let conv = appendConversation(request, 'user', text);
  conv = [...conv, { role: 'agent', text: MSG.dataMismatch, at: new Date().toISOString() }];
  await storage.updateRecoveryRequest(request.id, { ...updates, conversation: conv });
  await sendReply(request.phone, MSG.dataMismatch);
  return true;
}

function collectedOf(r: AccountRecoveryRequest): CollectedData {
  return {
    name: r.collectedName,
    email: r.collectedEmail,
    cpf: r.collectedCpf,
    phone: r.collectedPhone || r.normalizedPhone,
  };
}

// ============================================================
// OTP por e-mail (posse do e-mail cadastrado)
// ============================================================

async function startEmailOtp(request: AccountRecoveryRequest, userText: string, updates: Partial<AccountRecoveryRequest>): Promise<boolean> {
  const user = request.matchedUserId ? await storage.getUser(request.matchedUserId) : null;
  if (!user) return await sendToAdmin(request, userText, updates, 'usuário do match não encontrado');

  const code = generateOTP();
  const codeHash = await hashPassword(code);
  const [verification] = await db.insert(emailVerifications).values({
    userId: user.id,
    email: user.email,
    codeHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attemptCount: 0,
    status: 'pending',
  }).returning();

  try {
    await sendEmail({
      to: user.email,
      subject: '🔐 Código de verificação - Recuperação de conta Lowfy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #059669;">Lowfy — Recuperação de conta</h2>
          <p>Você (ou alguém) está tentando recuperar o acesso à sua conta pelo WhatsApp.</p>
          <p>Seu código de verificação é:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #059669;">${code}</p>
          <p>O código expira em <strong>10 minutos</strong>.</p>
          <p><strong>Se não foi você</strong>, ignore este e-mail — nada será alterado sem este código.</p>
        </div>
      `,
    });
  } catch (err: any) {
    logger.error(`[RECOVERY] Falha ao enviar OTP por e-mail: ${err.message}`);
    return await sendToAdmin(request, userText, updates, 'falha no envio do OTP por e-mail');
  }

  const result = await storage.transitionRecoveryRequest(request.id, ['collecting'], {
    ...updates,
    state: 'awaiting_email_otp',
    otpVerificationId: verification.id,
    matchDetails: { ...(updates.matchDetails as any || request.matchDetails as any || {}), pendingQuestion: null },
    conversation: [
      ...appendConversation(request, 'user', userText),
      { role: 'agent', text: MSG.otpSent, at: new Date().toISOString() },
    ],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  if (!result) return true; // outra transição venceu — descarta
  await sendReply(request.phone, MSG.otpSent);
  return true;
}

async function handleAwaitingOtp(request: AccountRecoveryRequest, text: string): Promise<boolean> {
  const code = extractOtpCode(text);
  const baseUpdates: Partial<AccountRecoveryRequest> = {
    messageCount: (request.messageCount || 0) + 1,
    lastMessageAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    conversation: appendConversation(request, 'user', text),
  };

  if (!code) {
    await storage.updateRecoveryRequest(request.id, baseUpdates);
    await sendReply(request.phone, 'Digite o código de *6 dígitos* enviado ao e-mail cadastrado (vale 10 minutos). Não recebeu? Confira o spam. 🙂');
    return true;
  }

  if (!request.otpVerificationId) {
    return await sendToAdmin(request, text, baseUpdates, 'sessão OTP sem verificação associada');
  }
  const [verification] = await db.select().from(emailVerifications).where(eq(emailVerifications.id, request.otpVerificationId));

  if (!verification || verification.status !== 'pending' || verification.expiresAt < new Date()) {
    await db.update(emailVerifications).set({ status: 'expired' }).where(eq(emailVerifications.id, request.otpVerificationId));
    return await sendToAdmin(request, text, baseUpdates, 'OTP expirado');
  }

  const valid = await verifyPassword(code, verification.codeHash);
  if (!valid) {
    const attempts = (verification.attemptCount || 0) + 1;
    await db.update(emailVerifications).set({ attemptCount: attempts, status: attempts >= MAX_OTP_ATTEMPTS ? 'failed' : 'pending' })
      .where(eq(emailVerifications.id, verification.id));
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await applyProgressiveLockout(request.phone);
      const updates = { ...baseUpdates };
      const consumed = await sendToAdmin(request, text, updates, `OTP falhou ${attempts}x`);
      await sendReply(request.phone, MSG.otpFailed);
      return consumed;
    }
    await storage.updateRecoveryRequest(request.id, baseUpdates);
    await sendReply(request.phone, MSG.otpWrong);
    return true;
  }

  await db.update(emailVerifications).set({ status: 'verified' }).where(eq(emailVerifications.id, verification.id));
  const user = request.matchedUserId ? await storage.getUser(request.matchedUserId) : null;
  if (!user) return await sendToAdmin(request, text, baseUpdates, 'usuário sumiu após OTP');

  baseUpdates.possessionFactor = 'email_otp';
  return await approveAndDeliver(request, text, baseUpdates, user, 'auto_approved', 'posse email_otp validada');
}

// ============================================================
// Estado: awaiting_delivery (o link saiu — funcionou?)
// ============================================================

/**
 * A conta já foi aprovada; aqui só resolvemos ENTREGA. Se o link não chega
 * (e-mail errado, caixa cheia, spam), tentamos um link novo e, na insistência,
 * mandamos uma senha provisória pelo próprio WhatsApp — como o dono pediu.
 * Não é um caminho mais fraco: a identidade passou pelos mesmos critérios do
 * link, a senha expira sozinha, obriga troca no primeiro login, derruba todas
 * as sessões e avisa o e-mail cadastrado + os admins.
 */
async function handleAwaitingDelivery(request: AccountRecoveryRequest, text: string, config: any): Promise<boolean> {
  const updates: Partial<AccountRecoveryRequest> = {
    messageCount: (request.messageCount || 0) + 1,
    lastMessageAt: new Date(),
    expiresAt: new Date(Date.now() + DELIVERY_TTL_MS),
  };

  const failed = saysDeliveryFailed(text) || isNegative(text);
  const succeeded = !failed && (saysDeliverySucceeded(text) || isAffirmative(text));

  if (succeeded) {
    await storage.transitionRecoveryRequest(request.id, ['awaiting_delivery'], {
      ...updates,
      state: 'completed',
      outcomeDelivered: true,
      conversation: [
        ...appendConversation(request, 'user', text),
        { role: 'agent', text: MSG.deliveryDone, at: new Date().toISOString() },
      ],
    });
    await sendReply(request.phone, MSG.deliveryDone);
    return true;
  }

  if (!failed) {
    // Resposta ambígua ("oi?", "e aí") → repete a pergunta sem decidir nada.
    return await replyAndStay(request, text, updates, MSG.askDeliveryWorked);
  }

  const user = request.matchedUserId ? await storage.getUser(request.matchedUserId) : null;
  if (!user) return await sendToAdmin(request, text, updates, 'usuário sumiu na etapa de entrega');

  const attempts = (request.deliveryAttempts || 1) + 1;
  updates.deliveryAttempts = attempts;

  // Primeira reclamação: link novo (o anterior pode ter expirado) + dica de spam.
  if (attempts <= 2 && !request.tempPasswordSentAt) {
    await deliverResetLink(request, user);
    return await replyAndStay(request, text, updates, MSG.deliveryRetryHint);
  }

  if (request.tempPasswordSentAt) {
    return await sendToAdmin(request, text, updates, 'senha provisória enviada e pessoa segue sem acesso');
  }
  if (config.allowWhatsappPassword === false) {
    await sendReply(request.phone, MSG.tempPasswordUnavailable);
    return await sendToAdmin(request, text, updates, 'link não chegou e senha provisória está desativada');
  }

  await sendReply(request.phone, MSG.tempPasswordIntro);
  const { delivered } = await deliverTemporaryPassword(request, user, config.tempPasswordTtlMinutes ?? 60);
  if (!delivered) {
    return await sendToAdmin(request, text, updates, 'falha ao enviar a senha provisória pelo WhatsApp');
  }

  await storage.transitionRecoveryRequest(request.id, ['awaiting_delivery'], {
    ...updates,
    state: 'completed',
    outcomeDelivered: true,
    conversation: [
      ...appendConversation(request, 'user', text),
      // A senha NUNCA entra no transcript.
      { role: 'agent', text: '[senha provisória enviada pelo WhatsApp]', at: new Date().toISOString() },
    ],
  });
  return true;
}

// ============================================================
// Desfechos (aprovar/encaminhar)
// ============================================================

async function approveAndDeliver(
  request: AccountRecoveryRequest,
  userText: string,
  updates: Partial<AccountRecoveryRequest>,
  user: User,
  decision: string,
  reason: string,
): Promise<boolean> {
  const transitioned = await storage.transitionRecoveryRequest(request.id, ['collecting', 'awaiting_email_otp'], {
    ...updates,
    state: 'approved',
    decision,
    decisionReason: reason,
    decidedAt: new Date(),
    conversation: appendConversation(request, 'user', userText),
  });
  if (!transitioned) return true; // corrida perdida — outra transição já decidiu

  const goal = request.goal || updates.goal || 'reset_password';
  const newEmail = request.requestedNewEmail || updates.requestedNewEmail;
  const newPhone = request.requestedNewPhone || updates.requestedNewPhone;
  let delivered = false;
  let changeDone = false;

  if ((goal === 'change_email' || goal === 'combo') && newEmail) {
    await createChangeRequest(transitioned, user, 'email', newEmail, true);
    delivered = await sendReply(request.phone, MSG.changeScheduled('email'));
    changeDone = true;
  }
  if ((goal === 'change_phone' || goal === 'combo') && newPhone) {
    await createChangeRequest(transitioned, user, 'phone', newPhone, true);
    delivered = await sendReply(request.phone, MSG.changeScheduled('phone')) || delivered;
    changeDone = true;
  }

  // 'combo' também redefine a senha; e se a troca não pôde ser montada, o
  // link de reset é sempre o desfecho mínimo de uma aprovação.
  let linkSent = false;
  if (goal === 'reset_password' || goal === 'combo' || !changeDone) {
    const res = await deliverResetLink(transitioned, user);
    linkSent = res.whatsapp || res.email;
    delivered = delivered || linkSent;
  }

  await storage.updateRecoveryRequest(request.id, { outcomeDelivered: delivered });

  if (linkSent) {
    // Não encerramos aqui: perguntamos se o link chegou e funcionou. Se não
    // funcionar, entra a senha provisória pelo WhatsApp (último recurso).
    await storage.updateRecoveryRequest(request.id, {
      state: 'awaiting_delivery',
      expiresAt: new Date(Date.now() + DELIVERY_TTL_MS),
      deliveryAttempts: (request.deliveryAttempts || 0) + 1,
    });
    await sendReply(request.phone, MSG.askDeliveryWorked);
  } else if (delivered) {
    await storage.updateRecoveryRequest(request.id, { state: 'completed' });
  }
  // Falha de entrega mantém 'approved' + outcomeDelivered=false → scheduler reentrega

  await notifyAdmins(`✅ Recuperação de conta ${decision === 'auto_approved' ? 'auto-aprovada' : 'aprovada'} para ${user.name} (score ${updates.matchScore ?? request.matchScore}, posse ${updates.possessionFactor || request.possessionFactor}). Objetivo: ${goal}.`);
  logger.info(`[RECOVERY] Sessão ${request.id} aprovada (${reason}), delivered=${delivered}`);
  return true;
}

async function sendToAdmin(
  request: AccountRecoveryRequest,
  userText: string,
  updates: Partial<AccountRecoveryRequest>,
  internalReason: string,
): Promise<boolean> {
  const transitioned = await storage.transitionRecoveryRequest(request.id, ['collecting', 'awaiting_email_otp', 'awaiting_delivery'], {
    ...updates,
    state: 'awaiting_admin',
    decisionReason: internalReason,
    conversation: [
      ...appendConversation(request, 'user', userText),
      { role: 'agent', text: MSG.sentToAdmin, at: new Date().toISOString() },
    ],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // fila admin vive 7 dias
  });
  if (!transitioned) return true;

  await sendReply(request.phone, MSG.sentToAdmin);
  await notifyAdmins(`🔔 Nova solicitação de recuperação de conta aguardando análise (${request.collectedName || 'sem nome'}, CPF ${request.collectedCpf ? maskCpf(request.collectedCpf) : '—'}). Motivo: ${internalReason}.`);
  logger.info(`[RECOVERY] Sessão ${request.id} → admin (${internalReason})`);
  return true;
}
