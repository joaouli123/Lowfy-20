import { logger } from "../utils/logger";

/**
 * Kie.ai — agregador de modelos (imagem, vídeo, voz, avatar e chat) numa conta só.
 * Docs: https://docs.kie.ai (llms.txt). Todas as gerações seguem o mesmo fluxo:
 * POST /api/v1/jobs/createTask → polling em /api/v1/jobs/recordInfo até success/fail.
 * Arquivos de entrada (foto, áudio, referência) precisam ser URL: subimos no
 * storage temporário da Kie (expira, mas dura o suficiente para a geração).
 */

const API = "https://api.kie.ai";
const UPLOAD_API = "https://kieai.redpandaai.co";

export const kieKey = () => process.env.KIE_API_KEY || "";
export const kieReady = () => !!kieKey();

const headers = () => ({ Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" });

async function kieJson(url: string, init: RequestInit): Promise<any> {
  const r = await fetch(url, init);
  const j: any = await r.json().catch(() => ({}));
  // A Kie devolve HTTP 200 com o erro no campo "code".
  const code = j?.code ?? r.status;
  if (!r.ok || (code !== 200 && code !== undefined)) {
    const msg = j?.msg || j?.message || `HTTP ${r.status}`;
    if (code === 402) throw new Error("Créditos da Kie.ai esgotados. Recarregue em kie.ai/billing.");
    if (code === 401) throw new Error("Chave da Kie.ai inválida (KIE_API_KEY).");
    throw new Error(`Kie.ai (${code}): ${String(msg).slice(0, 160)}`);
  }
  return j;
}

/** Saldo de créditos da conta (1 crédito ≈ US$ 0,005). */
export async function kieCredits(): Promise<number> {
  const j = await kieJson(`${API}/api/v1/chat/credit`, { headers: headers() });
  return Number(j.data) || 0;
}

/**
 * Garante uma URL pública para a Kie baixar o arquivo. Aceita data URL / base64
 * (sobe no storage temporário deles) ou uma URL http(s) já pública.
 */
export async function kieFileUrl(value: string | Buffer, opts: { mime?: string; name?: string; folder?: string } = {}): Promise<string> {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const base64Data = Buffer.isBuffer(value)
    ? `data:${opts.mime || "application/octet-stream"};base64,${value.toString("base64")}`
    : value;
  const j = await kieJson(`${UPLOAD_API}/api/file-base64-upload`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ base64Data, uploadPath: `lowfy/${opts.folder || "uploads"}`, ...(opts.name ? { fileName: opts.name } : {}) }),
  });
  const url = j?.data?.downloadUrl;
  if (!url) throw new Error("Kie.ai: upload sem URL de retorno");
  return url;
}

export interface KieResult { urls: string[]; raw: any; credits?: number }

/** Cria a tarefa e espera o resultado (polling). */
export async function kieRun(model: string, input: Record<string, any>, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<KieResult> {
  const created = await kieJson(`${API}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, input }),
  });
  const taskId = created?.data?.taskId;
  if (!taskId) throw new Error("Kie.ai: tarefa criada sem taskId");

  const timeout = opts.timeoutMs ?? 8 * 60_000;
  const interval = opts.intervalMs ?? 4000;
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await new Promise((r) => setTimeout(r, interval));
    const j = await kieJson(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: headers() });
    const d = j?.data || {};
    if (d.state === "success") {
      let parsed: any = d.resultJsonParsed;
      if (!parsed && typeof d.resultJson === "string") { try { parsed = JSON.parse(d.resultJson); } catch { parsed = {}; } }
      const urls: string[] = parsed?.resultUrls || parsed?.resultUrl ? [].concat(parsed.resultUrls || parsed.resultUrl) : [];
      if (!urls.length) throw new Error("Kie.ai: tarefa concluída sem arquivo");
      return { urls, raw: parsed, credits: d.creditsConsumed };
    }
    if (d.state === "fail") {
      throw new Error(`Kie.ai recusou a geração: ${String(d.failMsg || d.failCode || "sem detalhe").slice(0, 200)}`);
    }
  }
  logger.warn(`[Kie] timeout na tarefa ${taskId} (${model})`);
  throw new Error("A geração demorou demais. Tente de novo em instantes.");
}

export async function kieDownload(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Kie.ai: falha ao baixar o resultado (${r.status})`);
  let mime = (r.headers.get("content-type") || "").split(";")[0].trim();
  // Alguns CDNs devolvem octet-stream: deduz pelo final da URL.
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
    mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav" } as Record<string, string>)[ext] || "application/octet-stream";
  }
  return { buffer: Buffer.from(await r.arrayBuffer()), mime };
}

/** Proporção aceita pelos modelos da Kie a partir do tamanho que o Estúdio usa. */
export function kieAspect(size?: string, fallback = "1:1"): string {
  if (!size) return fallback;
  if (/^\d+:\d+$/.test(size)) return size;
  const [w, h] = size.split("x").map(Number);
  if (!w || !h) return fallback;
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 16 / 9) < 0.05) return "16:9";
  if (Math.abs(r - 2 / 3) < 0.05) return "2:3";
  if (Math.abs(r - 3 / 2) < 0.05) return "3:2";
  if (Math.abs(r - 4 / 5) < 0.05) return "4:5";
  return r > 1 ? "16:9" : "9:16";
}

// Vozes ElevenLabs aceitas pela Kie (lista fechada na documentação do modelo
// elevenlabs/text-to-speech-multilingual-v2). Voz fora da lista é recusada.
export const KIE_VOICES: { voiceId: string; name: string; gender: "masc" | "fem"; tag: string }[] = [
  { voiceId: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", gender: "fem", tag: "profissional, clara e calorosa" },
  { voiceId: "wJqPPQ618aTW29mptyoc", name: "Ana Rita", gender: "fem", tag: "suave, expressiva e brilhante" },
  { voiceId: "5l5f8iK3YPeGga21rQIX", name: "Adeline", gender: "fem", tag: "feminina e conversacional" },
  { voiceId: "BZgkqPqms7Kj9ulSkVzn", name: "Eve", gender: "fem", tag: "autêntica, enérgica e alegre" },
  { voiceId: "6aDn1KB0hjpdcocrUkmq", name: "Tiffany", gender: "fem", tag: "natural e acolhedora" },
  { voiceId: "56AoDkrOh6qfVPDXZ7Pt", name: "Cassidy", gender: "fem", tag: "nítida, direta e clara" },
  { voiceId: "kPzsL2i3teMYv0FxEYQ6", name: "Brittney", gender: "fem", tag: "redes sociais, jovem e divertida" },
  { voiceId: "1wGbFxmAM3Fgw63G1zZJ", name: "Allison", gender: "fem", tag: "calma e tranquilizante" },
  { voiceId: "lcMyyd2HUfFzxdCaC4Ta", name: "Lucy", gender: "fem", tag: "leve e casual" },
  { voiceId: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "masc", tag: "grave, ressonante e acolhedor" },
  { voiceId: "UgBBYS2sOqTuMpoF3BR0", name: "Mark", gender: "masc", tag: "conversa natural" },
  { voiceId: "EkK5I93UQWFDigLMpZcX", name: "James", gender: "masc", tag: "rouco, envolvente e marcante" },
  { voiceId: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "masc", tag: "enérgico, criador de conteúdo" },
  { voiceId: "x70vRnQBMBu4FAYhjJbO", name: "Nathan", gender: "masc", tag: "locutor de rádio" },
  { voiceId: "gs0tAILXbY5DNrJrsM6F", name: "Jeff", gender: "masc", tag: "elegante e forte" },
  { voiceId: "LruHrtVF6PSyGItzMNHS", name: "Benjamin", gender: "masc", tag: "grave, quente e calmo" },
  { voiceId: "6F5Zhi321D3Oq7v1oNT4", name: "Hank", gender: "masc", tag: "narrador grave e envolvente" },
  { voiceId: "LG95yZDEHg6fCZdQjLqj", name: "Phil", gender: "masc", tag: "anunciante explosivo e apaixonado" },
  { voiceId: "8JVbfL6oEdmuxKn5DK2C", name: "Johnny Kid", gender: "masc", tag: "narrador sério e calmo" },
];
export const KIE_DEFAULT_VOICE = KIE_VOICES[0].voiceId;
const KIE_VOICE_IDS = new Set([
  "EkK5I93UQWFDigLMpZcX", "Z3R5wn05IrDiVCyEkUrK", "NNl6r8mD7vthiJatiJt1", "YOq2y2Up4RgXP2HyXjE5", "B8gJV1IhpuegLxdpXFOE",
  "2zRM7PkgwBPiau2jvVXc", "1SM7GgM6IMuvQlz2BwM3", "5l5f8iK3YPeGga21rQIX", "scOwDtmlUjD3prqpp97I", "NOpBlnGInO9m6vDvFkFC",
  "BZgkqPqms7Kj9ulSkVzn", "DGzg6RaUqxGRTHSBjfgF", "x70vRnQBMBu4FAYhjJbO", "Sm1seazb4gs7RSlUVw7c", "P1bg08DkjqiVEzOn76yG",
  "qDuRKMlYmrm8trt5QyBn", "qXpMhyvQqiRxWQs4qSSB", "TX3LPaxmHKxFdv7VOQHJ", "N2lVS1w4EtoT3dr4eOWO", "FGY2WhTYpPnrIDTdsKH5",
  "kPzsL2i3teMYv0FxEYQ6", "UgBBYS2sOqTuMpoF3BR0", "hpp4J3VqNfWAUOO0d1Us", "nPczCjzI2devNBz1zQrb", "uYXf8XasLslADfZ2MB4u",
  "gs0tAILXbY5DNrJrsM6F", "DTKMou8ccj1ZaWGBiotd", "vBKc2FfBKJfcZNyEt1n6", "DYkrAHD8iwork3YSUBbs", "56AoDkrOh6qfVPDXZ7Pt",
  "eR40ATw9ArzDf9h3v7t7", "g6xIsTj2HwM6VR4iXFCw", "lcMyyd2HUfFzxdCaC4Ta", "6aDn1KB0hjpdcocrUkmq", "Sq93GQT4X1lKDXsQcixO",
  "flHkNRp1BlvT73UL6gyz", "9yzdeviXkFddZ4Oz8Mok", "pPdl9cQBQq4p6mRkZy2Z", "zYcjlYFOd3taleS0gkk3", "nzeAacJi50IvxcyDnMXa",
  "ruirxsoakN0GWmGNIo04", "TC0Zp7WVFzhA8zpTlRqV", "ljo9gAlSqKOvF6D8sOsX", "8JVbfL6oEdmuxKn5DK2C", "iCrDUkL56s3C8sCRl7wb",
  "wJqPPQ618aTW29mptyoc", "EiNlNiXeDU1pqqOPrYMO", "4YYIPFl9wE5c4L2eu2Gb", "6F5Zhi321D3Oq7v1oNT4", "YXpFCvM1S3JbWEJhoskW",
  "LG95yZDEHg6fCZdQjLqj", "CeNX9CMwmxDxUF5Q2Inm", "aD6riP1btT197c6dACmy", "mtrellq69YZsNwzUSyXh", "dHd5gvgSOzSfduK4CvEg",
  "eVItLK1UvXctxuaRV2Oq", "esy0r39YPLQjOczyOib8", "Tsns2HvNFKfGiNjllgqo", "1U02n4nD6AdIZ9CjF053", "AeRdCCKzvd23BpJoofzx",
  "LruHrtVF6PSyGItzMNHS", "1wGbFxmAM3Fgw63G1zZJ", "hqfrgApggtO1785R4Fsn", "MJ0RnG71ty4LH3dvNfSd",
]);
export const kieVoice = (id?: string) => (id && KIE_VOICE_IDS.has(id) ? id : KIE_DEFAULT_VOICE);
export const kieVoicePreview = (id: string) => `https://static.aiquickdraw.com/elevenlabs/voice/${id}.mp3`;

// ---------- Chat (texto) ----------
// Um endpoint por modelo. Ordem = preferência (o 1º que responder vence).
// GPT-5.6 Luna (API "responses") saiu ~6x mais barato que o GPT-5.2 em teste real (out/2026).
const CHAT_MODELS: { path: string; model: string; responses?: boolean }[] = [
  { path: "/codex/v1/responses", model: process.env.KIE_CHAT_MODEL || "gpt-5-6-luna", responses: true },
  { path: "/gemini-3-8-flash-openai/v1/chat/completions", model: "gemini-3-8-flash" },
  { path: "/gpt-5-2/v1/chat/completions", model: "gpt-5-2" },
];

/** Texto da resposta nos dois formatos (chat/completions e responses). O Luna embrulha em <escape>. */
function chatText(j: any): string | undefined {
  const t = j?.choices?.[0]?.message?.content
    ?? j?.output_text
    ?? (Array.isArray(j?.output) ? j.output.flatMap((o: any) => o?.content || []).map((c: any) => c?.text || "").join("") : undefined);
  return typeof t === "string" && t.trim() ? t.replace(/<\/?escape>/g, "").trim() : undefined;
}

/** Gera texto pela Kie. Com json=true, devolve o objeto já parseado. */
export async function kieChat(system: string, user: string, opts: { json?: boolean; temperature?: number } = {}): Promise<any> {
  let lastErr: any;
  const sys = system + (opts.json ? "\nResponda SOMENTE com JSON válido, sem comentários nem markdown." : "");
  for (const m of CHAT_MODELS) {
    try {
      const r = await fetch(`${API}${m.path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(m.responses
          ? { model: m.model, stream: false, instructions: sys, input: user }
          : {
              model: m.model,
              stream: false,
              temperature: opts.temperature ?? 0.8,
              messages: [{ role: "system", content: sys }, { role: "user", content: user }],
              ...(opts.json ? { response_format: { type: "json_object" } } : {}),
            }),
        signal: AbortSignal.timeout(120_000),
      });
      const j: any = await r.json().catch(() => ({}));
      const text = chatText(j);
      if (!text) throw new Error(j?.msg || `HTTP ${r.status}`);
      if (!opts.json) return text;
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("{");
      return JSON.parse(start > 0 ? clean.slice(start, clean.lastIndexOf("}") + 1) : clean);
    } catch (e) {
      lastErr = e;
      logger.warn(`[Kie] chat ${m.model} falhou: ${(e as any)?.message}`);
    }
  }
  throw new Error(`Kie.ai (texto) indisponível: ${lastErr?.message || "sem detalhe"}`);
}

/** Claude pela Kie (API no formato da Anthropic). Usado para gerar código de animação (Motion). */
export async function kieClaude(system: string, user: string, opts: { model?: string; maxTokens?: number } = {}): Promise<string> {
  const r = await fetch(`${API}/claude/v1/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: opts.model || process.env.KIE_MOTION_MODEL || "claude-opus-5-5",
      max_tokens: opts.maxTokens ?? 16000,
      stream: false,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(5 * 60_000),
  });
  const j: any = await r.json().catch(() => ({}));
  const text = Array.isArray(j?.content) ? j.content.map((c: any) => c?.text || "").join("") : "";
  if (!text) {
    if (j?.code === 402) throw new Error("Créditos da Kie.ai esgotados. Recarregue em kie.ai/billing.");
    throw new Error(`Claude (Kie) não respondeu: ${String(j?.msg || j?.error?.message || `HTTP ${r.status}`).slice(0, 160)}`);
  }
  return text;
}
