/**
 * Tolerância a erro humano no agente de recuperação.
 *
 * Regra de ouro deste arquivo: fuzziness serve para ENTENDER a pessoa e para
 * pontuar, NUNCA para afrouxar a chave de identidade. CPF e telefone continuam
 * comparados de forma exata em verifier.ts — só o e-mail e o nome aceitam
 * aproximação, porque são os campos que as pessoas erram ao digitar sem que
 * isso signifique que não são donas da conta.
 */

/** Distância de Levenshtein com corte: para de calcular acima de `max`. */
export function levenshtein(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

// Domínios que a base real usa, para corrigir digitação por proximidade
const KNOWN_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
  'icloud.com', 'live.com', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'globo.com', 'me.com', 'msn.com', 'protonmail.com', 'gmail.com.br',
  'hotmail.com.br', 'outlook.com.br', 'yandex.com', 'aol.com',
];

/**
 * Variantes plausíveis do e-mail digitado, em ordem de confiança.
 * Cobre: espaço no meio, vírgula no lugar do ponto, "@@", domínio próximo de
 * um conhecido (gmial/gmai/gnail → gmail) e ".con"/".cm" → ".com".
 */
export function emailCandidates(raw: string): string[] {
  const out: string[] = [];
  const push = (e: string) => {
    const v = e.trim().toLowerCase();
    if (v && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v) && !out.includes(v)) out.push(v);
  };

  const base = raw.trim().toLowerCase()
    .replace(/\s+/g, '')
    .replace(/@{2,}/g, '@')
    .replace(/\.{2,}/g, '.');
  push(base);

  const at = base.lastIndexOf('@');
  if (at <= 0) return out;
  const local = base.slice(0, at);
  let domain = base.slice(at + 1);

  // Vírgula digitada no lugar do ponto (teclado numérico do celular)
  if (domain.includes(',')) push(`${local}@${domain.replace(/,/g, '.')}`);
  domain = domain.replace(/,/g, '.');

  // Terminações truncadas/erradas mais comuns
  const tailFixes: Record<string, string> = {
    '.con': '.com', '.cm': '.com', '.como': '.com', '.comm': '.com',
    '.co': '.com', '.cpm': '.com', '.vom': '.com', '.xom': '.com',
  };
  for (const [bad, good] of Object.entries(tailFixes)) {
    if (domain.endsWith(bad)) push(`${local}@${domain.slice(0, -bad.length)}${good}`);
  }

  // Domínio próximo de um conhecido (1-2 edições)
  for (const known of KNOWN_DOMAINS) {
    if (domain === known) continue;
    const d = levenshtein(domain, known, 2);
    if (d <= 2) push(`${local}@${known}`);
  }

  return out;
}

/**
 * O e-mail declarado é "quase" o cadastrado? Aceita até 2 edições no endereço
 * inteiro, ou parte local igual com domínio próximo (e vice-versa).
 */
export function isNearEmail(declared: string, registered: string): boolean {
  const a = declared.trim().toLowerCase();
  const b = registered.trim().toLowerCase();
  if (a === b) return true;
  if (emailCandidates(a).includes(b)) return true;

  const [aLocal, aDomain] = a.split('@');
  const [bLocal, bDomain] = b.split('@');
  if (!aDomain || !bDomain) return false;

  if (aLocal === bLocal && levenshtein(aDomain, bDomain, 2) <= 2) return true;
  if (aDomain === bDomain && levenshtein(aLocal, bLocal, 2) <= 2) return true;
  return levenshtein(a, b, 2) <= 2;
}

function normalizeTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Similaridade de nome tolerante a digitação: um token conta como igual se for
 * idêntico OU estiver a 1 edição de distância (2 para tokens longos).
 * "Joao Lucaz Siva" continua batendo com "João Lucas Silva".
 */
export function fuzzyNameSimilarity(a: string, b: string): number {
  const tokensA = normalizeTokens(a);
  const tokensB = normalizeTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const usedB = new Set<number>();
  let matched = 0;
  for (const ta of tokensA) {
    for (let j = 0; j < tokensB.length; j++) {
      if (usedB.has(j)) continue;
      const tb = tokensB[j];
      const tolerance = Math.min(ta.length, tb.length) >= 6 ? 2 : 1;
      if (ta === tb || levenshtein(ta, tb, tolerance) <= tolerance) {
        usedB.add(j);
        matched++;
        break;
      }
    }
  }
  const union = tokensA.length + tokensB.length - matched;
  return union > 0 ? matched / union : 0;
}

export type RecoveryField = 'name' | 'email' | 'cpf' | 'phone';

const DONT_KNOW_RE = /\b(n[ãa]o\s+(sei|lembro|tenho|consigo|me\s+lembro|recordo)|esqueci|sem\s+acesso|perdi|n[ãa]o\s+fa[çc]o\s+ideia|nem\s+lembro)\b/i;

/**
 * Detecta "não lembro o e-mail", "não tenho mais esse email", "esqueci o CPF".
 * Se a pessoa disser que não sabe sem citar o campo, devolve `null` — quem
 * chama decide (normalmente aplica ao campo que acabou de ser perguntado).
 */
export function detectUnknownFields(text: string): { fields: RecoveryField[]; generic: boolean } {
  if (!DONT_KNOW_RE.test(text)) return { fields: [], generic: false };

  const fields: RecoveryField[] = [];
  if (/\be-?mail\b/i.test(text)) fields.push('email');
  if (/\bcpf\b/i.test(text)) fields.push('cpf');
  if (/\b(telefone|celular|n[uú]mero|whats)\b/i.test(text)) fields.push('phone');
  if (/\bnome\b/i.test(text)) fields.push('name');

  return { fields, generic: fields.length === 0 };
}

const AFFIRMATIVE_RE = /^(sim|s|isso|isso\s+mesmo|correto|corretos?|certo|ta\s+certo|t[áa]\s+certo|confirmo|confirmado|positivo|ok|okay|blz|beleza|pode\s+ser|exato|exatamente|perfeito|[ée]\s+isso|uhum|aham|👍|✅)\b/i;
const NEGATIVE_RE = /^(n[ãa]o|n|nao|negativo|errado|t[áa]\s+errado|ta\s+errado|incorreto|nada\s+a\s+ver|n[ãa]o\s+[ée]|❌|👎)\b/i;

export function isAffirmative(text: string): boolean {
  return AFFIRMATIVE_RE.test(text.trim());
}

export function isNegative(text: string): boolean {
  return NEGATIVE_RE.test(text.trim());
}

/** "não recebi", "não chegou", "o link não funciona", "deu erro", "expirou". */
export function saysDeliveryFailed(text: string): boolean {
  return /n[ãa]o\s+(recebi|chegou|veio|abre|abriu|funciona|funcionou|consigo|deu)|nada\s+chegou|sem\s+e-?mail|link\s+(expirou|venceu|quebrado|inv[áa]lido|n[ãa]o)|deu\s+erro|erro\s+no\s+link|expirou/i.test(text);
}

/** "consegui", "deu certo", "já entrei" — encerra o atendimento com sucesso. */
export function saysDeliverySucceeded(text: string): boolean {
  return /consegui|deu\s+certo|funcionou|j[áa]\s+(entrei|troquei|mudei|acessei)|resolvido|obrigad|valeu|show|perfeito/i.test(text);
}

export function isHelpRequest(text: string): boolean {
  return /^(ajuda|help|\?|como\s+funciona|n[ãa]o\s+entendi|oi\?|que\s+dados)/i.test(text.trim());
}
