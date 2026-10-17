import { AsyncLocalStorage } from "async_hooks";
import { pool } from "../db";
import { logger } from "../utils/logger";

/**
 * Consumo de IA: cada chamada paga (OpenAI, Kie, ElevenLabs, Claude, Gemini) vira uma linha em
 * ai_usage com o custo estimado em dólar. O usuário e a ferramenta vêm do pedido HTTP em curso
 * (AsyncLocalStorage), então os serviços só precisam chamar recordUsage().
 *
 * Os preços são estimativas editáveis no admin (/admin/ai-usage). O custo real de cada conta
 * fica no painel de cada provedor; com OPENAI_ADMIN_KEY o admin mostra o gasto real da OpenAI.
 */

type Ctx = { req?: any; tool?: string };
const ctx = new AsyncLocalStorage<Ctx>();

/** "/api/ai-studio/motion/animate" → "motion/animate"; "/api/ebook/v2/build" → "ebook/build". */
export function toolFromPath(p: string): string {
  return String(p || "")
    .split("?")[0]
    .replace(/^\/api\//, "")
    .replace(/^ai-studio\//, "")
    .replace(/\/v2\//, "/")
    .replace(/\/[0-9a-f-]{16,}$/i, "")
    .slice(0, 40) || "sistema";
}

/** Middleware global: dá contexto (usuário + ferramenta) a tudo que o pedido disparar. */
export function usageMiddleware(req: any, _res: any, next: any) {
  if (!String(req.path || "").startsWith("/api/")) return next();
  ctx.run({ req, tool: toolFromPath(req.path) }, next);
}

/** Roda fn com uma ferramenta/usuário explícitos (tarefas fora de um pedido HTTP). */
export function withUsage<T>(c: { userId?: string; tool: string }, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ req: { user: { id: c.userId } }, tool: c.tool }, fn);
}

// ---------------- Preços (US$) ----------------

export interface Prices {
  /** US$ por crédito da Kie (1.000 créditos = US$ 5). */
  kieCredit: number;
  /** US$ por 1.000 caracteres na ElevenLabs (plano ÷ caracteres do plano). */
  eleven1kChars: number;
  /** US$ por 1M de tokens [entrada, saída]. A chave é o começo do nome do modelo. */
  tokens: Record<string, [number, number]>;
  /** gpt-image: US$ por 1M tokens de imagem na entrada (referência). */
  imageInput1M: number;
  /** Imagem da OpenAI sem contagem de tokens: preço por imagem conforme a qualidade. */
  imagePerQuality: Record<string, number>;
}

export const DEFAULT_PRICES: Prices = {
  kieCredit: 0.005,
  eleven1kChars: 0.2,
  tokens: {
    "gpt-image": [5, 40],
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4o": [2.5, 10],
    "gpt-5-mini": [0.25, 2],
    "gpt-5": [1.25, 10],
    "gemini-2.5-flash": [0.3, 2.5],
    "gemini": [0.3, 2.5],
    "claude-opus": [5, 25],
    "claude-sonnet": [3, 15],
    "claude-haiku": [1, 5],
    "gpt-5-6-luna": [0.3, 1.2],
    "gemini-3": [0.3, 2.5],
  },
  imageInput1M: 10,
  imagePerQuality: { low: 0.02, medium: 0.06, high: 0.2, auto: 0.06 },
};

export interface CostSettings {
  /** Quem gera primeiro quando os dois estão configurados. */
  preferProvider: "openai" | "kie";
  /** Cotação fixa; vazio = cotação do dia. */
  usdBrl?: number | null;
  prices: Prices;
  /** Taxa média do gateway de pagamento (%) para estimar a receita líquida. */
  paymentFeePct: number;
  /** Alerta quando um usuário passa desse custo (US$) no período. */
  alertUserUsd: number;
}

const DEFAULT_SETTINGS: CostSettings = {
  preferProvider: "openai",
  usdBrl: null,
  prices: DEFAULT_PRICES,
  paymentFeePct: 5,
  alertUserUsd: 5,
};

let settingsCache: CostSettings = DEFAULT_SETTINGS;
let settingsAt = 0;

function merge(v: any): CostSettings {
  const p = v?.prices || {};
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    prices: {
      ...DEFAULT_PRICES,
      ...p,
      tokens: { ...DEFAULT_PRICES.tokens, ...(p.tokens || {}) },
      imagePerQuality: { ...DEFAULT_PRICES.imagePerQuality, ...(p.imagePerQuality || {}) },
    },
  };
}

export async function loadSettings(force = false): Promise<CostSettings> {
  if (!force && Date.now() - settingsAt < 60_000) return settingsCache;
  try {
    const r = await pool.query("SELECT value FROM platform_settings WHERE key = 'ai_costs'");
    settingsCache = merge(r.rows[0]?.value || {});
  } catch {
    settingsCache = merge({});
  }
  settingsAt = Date.now();
  return settingsCache;
}

export async function saveSettings(v: Partial<CostSettings>): Promise<CostSettings> {
  const next = merge({ ...(await loadSettings(true)), ...v });
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ('ai_costs', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  settingsCache = next;
  settingsAt = Date.now();
  return next;
}

/** Leitura síncrona (cache); atualiza em segundo plano. */
export function settingsNow(): CostSettings {
  if (Date.now() - settingsAt > 60_000) void loadSettings();
  return settingsCache;
}

// ---------------- Cotação do dólar ----------------

let fx = { rate: 5.4, at: 0, source: "padrão" };
export async function usdBrl(): Promise<{ rate: number; source: string }> {
  const s = await loadSettings();
  if (s.usdBrl && s.usdBrl > 0) return { rate: s.usdBrl, source: "fixa (configurada)" };
  if (Date.now() - fx.at > 6 * 60 * 60_000) {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
      const j: any = await r.json();
      const rate = Number(j?.rates?.BRL);
      if (rate > 1) fx = { rate, at: Date.now(), source: "cotação do dia" };
      else fx.at = Date.now() - 5 * 60 * 60_000; // tenta de novo em 1h
    } catch { fx.at = Date.now() - 5 * 60 * 60_000; }
  }
  return { rate: fx.rate, source: fx.source };
}

// ---------------- Registro ----------------

function tokenPrice(model: string, prices: Prices): [number, number] {
  const m = String(model || "").toLowerCase();
  const key = Object.keys(prices.tokens).sort((a, b) => b.length - a.length).find((k) => m.startsWith(k));
  return key ? prices.tokens[key] : [0, 0];
}

export interface UsageEvent {
  provider: "openai" | "kie" | "elevenlabs" | "anthropic" | "gemini" | "outro";
  model?: string;
  kind: "image" | "text" | "tts" | "video" | "avatar" | "stt" | "music" | "sfx" | "outro";
  inputTokens?: number;
  outputTokens?: number;
  /** Tokens de imagem na entrada (gpt-image com referência). */
  imageInputTokens?: number;
  credits?: number;
  chars?: number;
  quality?: string;
  costUsd?: number;
  tool?: string;
  userId?: string;
  meta?: Record<string, any>;
}

export function estimateCost(e: UsageEvent, prices = settingsNow().prices): number {
  if (e.costUsd != null) return e.costUsd;
  if (e.credits != null) return e.credits * prices.kieCredit;
  if (e.chars != null) return (e.chars / 1000) * prices.eleven1kChars;
  if (e.kind === "image" && e.provider === "openai" && !e.outputTokens) return prices.imagePerQuality[e.quality || "medium"] ?? prices.imagePerQuality.medium;
  const [pin, pout] = tokenPrice(e.model || "", prices);
  return ((e.inputTokens || 0) * pin + (e.outputTokens || 0) * pout + (e.imageInputTokens || 0) * (e.kind === "image" ? prices.imageInput1M : pin)) / 1e6;
}

/** Anota uma chamada paga. Nunca derruba a geração: falha de registro só vira aviso no log. */
export function recordUsage(e: UsageEvent): void {
  const c = ctx.getStore();
  const userId = e.userId ?? c?.req?.user?.id ?? null;
  const tool = (e.tool || c?.tool || "sistema").slice(0, 40);
  const cost = estimateCost(e);
  const units = e.credits ?? e.chars ?? ((e.inputTokens || 0) + (e.outputTokens || 0) + (e.imageInputTokens || 0));
  const unit = e.credits != null ? "créditos" : e.chars != null ? "caracteres" : units ? "tokens" : e.kind === "image" ? "imagens" : null;
  pool.query(
    `INSERT INTO ai_usage (user_id, tool, provider, model, kind, units, unit, input_tokens, output_tokens, cost_usd, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [userId, tool, e.provider, (e.model || "").slice(0, 60) || null, e.kind, units || (e.kind === "image" ? 1 : 0), unit,
      Math.round(e.inputTokens || 0), Math.round(e.outputTokens || 0), Number(cost.toFixed(6)), e.meta ? JSON.stringify(e.meta) : null],
  ).catch((err) => logger.warn(`[Consumo] não registrou ${e.provider}/${tool}: ${err?.message}`));
}

/** Kie primeiro? Só quando escolhida no admin e com crédito (sem crédito, cai direto na OpenAI). */
export function preferKie(): boolean {
  return settingsNow().preferProvider === "kie";
}

/** Tipo de geração pelo nome do modelo da Kie. */
export function kieKind(model: string): UsageEvent["kind"] {
  const m = model.toLowerCase();
  if (/infinitalk|avatar|lip|talking/.test(m)) return "avatar";
  if (/tts|speech|voice/.test(m)) return "tts";
  if (/music|suno/.test(m)) return "music";
  if (/video|veo|kling|seedance|hailuo|wan|runway|sora/.test(m)) return "video";
  if (/image|flux|seedream|ideogram|imagen|nano/.test(m)) return "image";
  return "outro";
}

void loadSettings(true);
