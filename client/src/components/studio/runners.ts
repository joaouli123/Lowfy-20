import { apiRequest } from "@/lib/queryClient";
import type { Brief } from "./types";
import { ratioSpec } from "./types";

// Chamadas puras aos endpoints do Estúdio. Ficam separadas do store para que tanto os
// botões das abas quanto o motor de fluxo usem exatamente o mesmo caminho.

const post = async <T,>(url: string, body: any): Promise<T> => {
  const r = await apiRequest("POST", url, body);
  return (await r.json()) as T;
};

/**
 * Geração longa (imagem, vídeo, avatar, motion): roda em segundo plano no servidor,
 * porque o Cloudflare corta pedidos com mais de 100s. Envia, recebe o jobId e consulta
 * até ficar pronto.
 */
export async function postLong<T>(url: string, body: any, maxMs = 15 * 60_000): Promise<T> {
  const first = await post<any>(url, { ...body, async: true });
  if (!first?.jobId) return first as T; // rota sem segundo plano: já veio o resultado
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`/api/ai-studio/jobs/${first.jobId}`, { credentials: "include" });
    if (r.status === 404) throw new Error("O sistema foi atualizado enquanto gerava. Tente de novo.");
    if (!r.ok) continue; // oscilação de rede: tenta de novo
    const j = await r.json();
    if (j.status === "done") return j.result as T;
    if (j.status === "error") throw new Error(j.error || "Erro na geração");
  }
  throw new Error("A geração demorou demais. Tente de novo.");
}

export interface CopyParams {
  tipo: string;
  framework: string;
  variacoes: number;
}

export const genCopy = (brief: Brief, p: CopyParams) =>
  post<{ variacoes: string[] }>("/api/ai-studio/copy", {
    produto: brief.produto,
    publico: brief.publico,
    dor: brief.dor,
    beneficios: brief.beneficios,
    oferta: brief.oferta,
    tom: brief.tom,
    tipo: p.tipo,
    framework: p.framework,
    variacoes: p.variacoes,
    idioma: brief.lang,
  });

export interface ImageParams {
  quality: string;
  format: string;
  background: string;
  /** Sobrescreve a headline do briefing (o fluxo usa a copy gerada). */
  headline?: string;
  objetivo?: string;
  texto?: string;
  cta?: string;
  cores?: string[];
  observacoes?: string;
  /** Imagem de referência em data URL. */
  referencia?: string;
}

export const genImage = (brief: Brief, p: ImageParams) =>
  postLong<{ url: string }>("/api/ai-studio/image", {
    produto: brief.produto,
    estilo: brief.estilo,
    headline: p.headline ?? brief.headline,
    publico: brief.publico,
    size: ratioSpec(brief.ratio).imageSize,
    aspect: brief.ratio,
    quality: p.quality,
    format: p.format,
    background: p.background,
    objetivo: p.objetivo,
    texto: p.texto,
    cta: p.cta,
    cores: p.cores,
    observacoes: p.observacoes,
    referencia: p.referencia || undefined,
    idioma: brief.lang,
  });

export interface TtsParams {
  text: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export const genTts = (brief: Brief, p: TtsParams) =>
  post<{ url: string }>("/api/ai-studio/tts", {
    text: p.text,
    voice: brief.voice,
    provider: "elevenlabs",
    modelId: p.modelId,
    stability: p.stability,
    similarityBoost: p.similarityBoost,
    style: p.style,
    speed: p.speed,
    idioma: brief.lang,
  });

export const genAvatar = (brief: Brief, p: { text: string; photo?: string }) =>
  postLong<{ url: string }>("/api/ai-studio/avatar", {
    imageUrl: p.photo ?? brief.photo,
    text: p.text,
    voice: brief.voice,
    size: ratioSpec(brief.ratio).videoSize,
    idioma: brief.lang,
  });

export interface VideoParams {
  prompt: string;
  script: string;
  resolution: string;
  duration: string;
  imageUrl: string;
}

export const genVideo = (brief: Brief, p: VideoParams) =>
  postLong<{ url: string }>("/api/ai-studio/video", {
    prompt: p.prompt || `${brief.produto}${brief.estilo ? `, ${brief.estilo}` : ""}`,
    script: p.script,
    imageUrl: p.imageUrl,
    voice: brief.voice,
    size: ratioSpec(brief.ratio).videoSize,
    resolution: p.resolution,
    duration: p.duration,
    idioma: brief.lang,
  });

/**
 * Extrai uma headline curta de um bloco de copy — usada para estampar o criativo
 * quando o fluxo gera o texto antes da imagem.
 */
export function pickHeadline(variacoes: string[], fallback: string): string {
  const flat = variacoes
    .flatMap((v) => v.split(/\n+/))
    .map((l) => l.replace(/^\s*(\d+[).\-]|[-•*])\s*/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter((l) => l.length >= 8);
  const short = flat.filter((l) => l.length <= 60).sort((a, b) => a.length - b.length);
  if (short.length) return short[Math.floor(short.length / 2)];
  const first = flat[0] || "";
  if (!first) return fallback;
  const m = first.match(/^[^.!?]{8,}[.!?]?/);
  const sentence = (m ? m[0] : first).trim();
  return sentence.length > 70 ? `${sentence.slice(0, 67)}…` : sentence;
}
