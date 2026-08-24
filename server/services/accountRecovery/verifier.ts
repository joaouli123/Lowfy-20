import { db } from "../../db";
import { lowfySubscriptions, caktoOrders, type User } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { storage, DatabaseStorage } from "../../storage";
import { emailCandidates, isNearEmail, fuzzyNameSimilarity, levenshtein } from "./fuzzy";

/**
 * Verificação determinística de identidade do agente de recuperação.
 * A LLM NUNCA participa daqui — só código, só comparação one-way.
 * O resultado (score, flags) jamais é revelado ao interlocutor.
 */

export interface CollectedData {
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  phone?: string | null;
}

export interface MatchResult {
  user: User | null;
  score: number;
  details: {
    cpfMatch: boolean;
    emailMatch: boolean;
    emailTypoTolerated: boolean; // bateu só depois de corrigir digitação
    phoneMatch: boolean;
    phoneNearMiss: boolean; // 1 dígito de diferença — pedir p/ reenviar, não reprovar calado
    nameSimilarity: number;
    historyMatch: boolean;
    multipleCandidates: boolean;
  };
  possessionFactor: 'whatsapp_phone' | 'none';
  riskFlags: string[];
}

export function isValidCpf(raw: string): boolean {
  const cpf = String(raw).replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

function normalizeName(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Similaridade de Jaccard entre tokens dos nomes (0..1)
export function nameSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeName(a));
  const tokensB = new Set(normalizeName(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union;
}

// Dados mínimos para rodar a verificação: nome + pelo menos 2 identificadores
export function hasMinimumData(data: CollectedData): boolean {
  const identifiers = [data.email, data.cpf, data.phone].filter(Boolean).length;
  return !!data.name && identifiers >= 2;
}

async function hasHistoryMatch(userId: string, email?: string | null, cpf?: string | null): Promise<boolean> {
  const emailLower = email?.toLowerCase().trim();
  const cpfDigits = cpf?.replace(/\D/g, '');

  if (emailLower || cpfDigits) {
    const conditions = [];
    if (emailLower) conditions.push(eq(lowfySubscriptions.buyerEmail, emailLower));
    if (cpfDigits) conditions.push(eq(lowfySubscriptions.buyerCpf, cpfDigits));
    const subs = await db
      .select({ id: lowfySubscriptions.id, userId: lowfySubscriptions.userId })
      .from(lowfySubscriptions)
      .where(or(...conditions))
      .limit(10);
    if (subs.some(s => s.userId === userId)) return true;
  }

  if (emailLower) {
    const orders = await db
      .select({ id: caktoOrders.id, userId: caktoOrders.userId })
      .from(caktoOrders)
      .where(eq(caktoOrders.customerEmail, emailLower))
      .limit(10);
    if (orders.some(o => o.userId === userId)) return true;
  }

  return false;
}

/**
 * Compara os dados coletados contra o banco e calcula o score.
 * @param senderPhone número de onde a mensagem veio (com 55, do Baileys)
 */
export async function verifyIdentity(senderPhone: string, data: CollectedData): Promise<MatchResult> {
  const riskFlags: string[] = [];
  const details = {
    cpfMatch: false,
    emailMatch: false,
    emailTypoTolerated: false,
    phoneMatch: false,
    phoneNearMiss: false,
    nameSimilarity: 0,
    historyMatch: false,
    multipleCandidates: false,
  };

  const emailLower = data.email?.toLowerCase().trim();
  const cpfDigits = data.cpf?.replace(/\D/g, '');

  // Candidatos por cada identificador
  const candidates = new Map<string, User>();
  if (emailLower) {
    // Tenta o e-mail como veio e, se não achar, as correções de digitação mais
    // comuns (gmial→gmail, .con→.com). Só busca — não conta como match ainda.
    for (const candidate of emailCandidates(emailLower)) {
      const byEmail = await storage.getUserByEmail(candidate);
      if (byEmail) { candidates.set(byEmail.id, byEmail); break; }
    }
  }
  if (cpfDigits && cpfDigits.length === 11) {
    const byCpf = await storage.getUserByCpf(cpfDigits);
    if (byCpf) candidates.set(byCpf.id, byCpf);
  }
  if (data.phone) {
    const byPhone = await storage.getUserByPhoneFlexible(data.phone);
    if (byPhone) candidates.set(byPhone.id, byPhone);
  }

  if (candidates.size === 0) {
    return { user: null, score: 0, details, possessionFactor: 'none', riskFlags: ['no_candidate'] };
  }

  if (candidates.size > 1) {
    details.multipleCandidates = true;
    riskFlags.push('multiple_users');
    // Não escolhe entre candidatos — decisão vai para o admin
    return { user: null, score: 0, details, possessionFactor: 'none', riskFlags };
  }

  const user = Array.from(candidates.values())[0];
  let score = 0;

  if (cpfDigits && user.cpf && user.cpf.replace(/\D/g, '') === cpfDigits) {
    details.cpfMatch = true;
    score += 40;
  }
  if (emailLower) {
    if (user.email.toLowerCase() === emailLower) {
      details.emailMatch = true;
      score += 30;
    } else if (isNearEmail(emailLower, user.email)) {
      // Errou a digitação mas claramente conhece o endereço: vale menos que o
      // exato e fica registrado como flag para o admin enxergar.
      details.emailMatch = true;
      details.emailTypoTolerated = true;
      riskFlags.push('email_typo_tolerated');
      score += 20;
    }
  }
  if (data.phone && user.phone) {
    const declaredVariants = DatabaseStorage.phoneVariants(data.phone);
    if (declaredVariants.includes(user.phone)) {
      details.phoneMatch = true;
      score += 15;
    } else {
      // Um dígito trocado/faltando: não pontua (a regra CPF+telefone é exata),
      // mas sinaliza para o agente pedir o número de novo em vez de reprovar.
      const registeredDigits = user.phone.replace(/\D/g, '');
      const declaredDigits = data.phone.replace(/\D/g, '');
      const localReg = registeredDigits.replace(/^55/, '');
      const localDec = declaredDigits.replace(/^55/, '');
      if (localReg.length >= 10 && Math.abs(localReg.length - localDec.length) <= 1) {
        details.phoneNearMiss = levenshtein(localReg, localDec, 1) <= 1;
      }
    }
  }
  if (data.name) {
    details.nameSimilarity = fuzzyNameSimilarity(data.name, user.name);
    if (details.nameSimilarity >= 0.7) score += 15;
    else if (details.nameSimilarity >= 0.5) score += 7; // nome parcial (só o primeiro nome, casou depois)
  }

  try {
    details.historyMatch = await hasHistoryMatch(user.id, emailLower, cpfDigits);
    if (details.historyMatch) score += 10;
  } catch {
    // histórico é bônus — falha de consulta não bloqueia
  }

  // Posse: a mensagem veio do próprio número cadastrado?
  // A entrega do WhatsApp a partir daquele número já prova controle da linha —
  // users.phoneVerified só indica se passamos pelo NOSSO fluxo de verificação
  // (a maioria da base não passou), então ele vira apenas flag de auditoria.
  let possessionFactor: MatchResult['possessionFactor'] = 'none';
  if (user.phone) {
    const senderVariants = DatabaseStorage.phoneVariants(senderPhone);
    if (senderVariants.includes(user.phone)) {
      possessionFactor = 'whatsapp_phone';
      if (!user.phoneVerified) riskFlags.push('phone_not_verified');
    }
  }

  if (user.accountStatus === 'blocked') riskFlags.push('account_blocked');

  return { user, score, details, possessionFactor, riskFlags };
}
