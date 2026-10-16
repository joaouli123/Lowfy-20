import { apiRequest } from "@/lib/queryClient";
import type { Brief } from "./types";
import { ratioSpec } from "./types";

// Chamadas puras aos endpoints do Estúdio. Ficam separadas do store para que tanto os
// botões das abas quanto o motor de fluxo usem exatamente o mesmo caminho.

const post = async <T,>(url: string, body: any): Promise<T> => {
  const r = await apiRequest("POST", url, body);
  return (await r.json()) as T;
};

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
  post<{ url: string }>("/api/ai-studio/image", {
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
  post<{ url: string }>("/api/ai-studio/avatar", {
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
  post<{ url: string }>("/api/ai-studio/video", {
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
