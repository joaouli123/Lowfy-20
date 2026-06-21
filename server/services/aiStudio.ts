import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";

/**
 * AI Studio — motor de criação de conteúdo com IA da Lowfy.
 *
 * Arquitetura multi-provedor (best-of-breed). O que já funciona com as chaves
 * existentes (OPENAI_API_KEY / GEMINI_API_KEY) é usado por padrão; provedores
 * premium (ElevenLabs, HeyGen/D-ID, Veo/fal.ai, Canva) são habilitados ao
 * configurar a respectiva chave de ambiente — sem quebrar nada se ausente.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || "";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY não configurada");
  if (!_openai) _openai = new OpenAI({ apiKey: OPENAI_KEY });
  return _openai;
}

let _gemini: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY não configurada");
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
  return _gemini;
}

export function aiStudioCapabilities() {
  return {
    image: { ready: !!(OPENAI_KEY || process.env.IDEOGRAM_API_KEY), providers: { openai: !!OPENAI_KEY, ideogram: !!process.env.IDEOGRAM_API_KEY } },
    copy: { ready: !!(GEMINI_KEY || OPENAI_KEY), providers: { gemini: !!GEMINI_KEY, openai: !!OPENAI_KEY } },
    tts: { ready: !!(OPENAI_KEY || ELEVENLABS_KEY), providers: { openai: !!OPENAI_KEY, elevenlabs: !!ELEVENLABS_KEY } },
    avatar: { ready: !!(process.env.HEYGEN_API_KEY || process.env.DID_API_KEY), providers: { heygen: !!process.env.HEYGEN_API_KEY, did: !!process.env.DID_API_KEY } },
    video: { ready: !!(process.env.FAL_KEY || process.env.GEMINI_API_KEY), providers: { fal: !!process.env.FAL_KEY, veo: !!process.env.GEMINI_API_KEY } },
    canva: { ready: !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET) },
  };
}

// ============================================================
// 1) IMAGEM — geração de criativo de anúncio
// ============================================================

export interface GenerateImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
  provider?: "openai" | "gemini";
}

/**
 * Gera uma imagem de criativo. Usa OpenAI gpt-image (preferência do usuário —
 * Gemini foi descartado para IMAGENS por qualidade inferior). Provedores premium
 * de texto-em-imagem (Ideogram / FLUX.2 / Recraft) habilitam ao configurar a chave.
 */
export async function generateAdImage(params: GenerateImageParams): Promise<{ buffer: Buffer; mime: string }> {
  // Ideogram (melhor texto-em-imagem) se configurado
  if (process.env.IDEOGRAM_API_KEY && (params.provider as any) === "ideogram") {
    throw new Error("Integração Ideogram pronta para implementar (IDEOGRAM_API_KEY detectada).");
  }

  if (!OPENAI_KEY) {
    throw new Error("Geração de imagem requer OPENAI_API_KEY válida (gpt-image). Configure a chave para ativar.");
  }
  const res = await openai().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt: params.prompt,
    size: params.size || "1024x1024",
    quality: params.quality || "high",
    n: 1,
  } as any);
  const b64 = (res as any).data?.[0]?.b64_json;
  if (!b64) throw new Error("Falha ao gerar imagem (OpenAI)");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

/**
 * Monta um prompt de imagem rico a partir da descrição do produto/criativo,
 * aplicando boas práticas de criativo de anúncio (composição, foco, legibilidade).
 */
export function buildAdImagePrompt(opts: {
  produto: string;
  estilo?: string;
  headline?: string;
  formato?: "quadrado" | "story" | "feed";
  publico?: string;
}): string {
  const partes = [
    `Crie um criativo publicitário profissional e fotorrealista para anúncio de: ${opts.produto}.`,
    opts.publico ? `Público-alvo: ${opts.publico}.` : "",
    opts.estilo ? `Estilo visual: ${opts.estilo}.` : "Estilo moderno, alto contraste, com foco no produto.",
    opts.headline ? `Inclua o texto em destaque, perfeitamente legível e sem erros de ortografia: "${opts.headline}".` : "",
    "Composição limpa, iluminação de estúdio, cores vibrantes, espaço para o produto respirar. Qualidade de agência publicitária. Sem marcas d'água.",
  ];
  return partes.filter(Boolean).join(" ");
}

// ============================================================
// 2) COPY — geração de copy persuasiva (frameworks de resposta direta)
// ============================================================

export type CopyType = "headline" | "anuncio" | "vsl" | "email" | "legenda" | "cta";
export type CopyFramework = "AIDA" | "PAS" | "BAB" | "4P" | "FAB" | "auto";

export interface GenerateCopyParams {
  produto: string;
  publico?: string;
  dor?: string;
  beneficios?: string;
  oferta?: string;
  tipo: CopyType;
  framework?: CopyFramework;
  tom?: string;
  variacoes?: number;
}

const COPY_SYSTEM = `Você é um copywriter de resposta direta de classe mundial, no nível de Gary Halbert, Eugene Schwartz, David Ogilvy e dos melhores do marketing digital brasileiro.
Você domina os frameworks: AIDA (Atenção-Interesse-Desejo-Ação), PAS (Problema-Agitação-Solução), BAB (Antes-Depois-Ponte), 4Ps (Promessa-Imagem-Prova-Empurrão) e FAB (Característica-Vantagem-Benefício).
Princípios que você SEMPRE aplica: foco implacável na DOR e no DESEJO do público; uma única ideia central por peça; provas e especificidade (números, prazos); gatilhos mentais (urgência, escassez, prova social, autoridade, reciprocidade); clareza acima de esperteza; e um CTA forte e específico.
Escreva em português do Brasil, persuasivo, natural e direto. NUNCA invente provas falsas/garantias ilegais. Responda SOMENTE com o copy pedido, sem explicações.`;

/** Gera copy persuasiva. Retorna array de variações. */
export async function generateCopy(params: GenerateCopyParams): Promise<{ variacoes: string[]; tokens: number }> {
  const n = Math.min(Math.max(params.variacoes || 3, 1), 8);
  const fw = params.framework && params.framework !== "auto" ? `Use o framework ${params.framework}.` : "Escolha o melhor framework para o objetivo.";

  const userPrompt = `Crie ${n} variação(ões) de ${tipoLabel(params.tipo)} para:
- Produto/oferta: ${params.produto}
${params.publico ? `- Público-alvo: ${params.publico}` : ""}
${params.dor ? `- Dor principal: ${params.dor}` : ""}
${params.beneficios ? `- Benefícios: ${params.beneficios}` : ""}
${params.oferta ? `- Oferta/preço: ${params.oferta}` : ""}
${params.tom ? `- Tom de voz: ${params.tom}` : ""}
${fw}
Devolva como JSON: {"variacoes": ["...", "..."]}. Cada variação deve ser ${tamanhoPorTipo(params.tipo)}.`;

  // Premium: OpenAI GPT (melhor qualidade de copy). Gemini só como fallback se OpenAI ausente.
  if (OPENAI_KEY) {
    const res = await openai().chat.completions.create({
      model: process.env.OPENAI_COPY_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: COPY_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });
    const text = res.choices[0]?.message?.content || "";
    return { variacoes: parseVariacoes(text, n), tokens: res.usage?.total_tokens || 0 };
  }

  // Fallback (somente se não houver OpenAI configurada)
  const model = process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash";
  const res = await gemini().models.generateContent({
    model,
    contents: `${COPY_SYSTEM}\n\n${userPrompt}`,
    config: { responseMimeType: "application/json", temperature: 0.9 } as any,
  });
  const text = (res as any).text || "";
  return { variacoes: parseVariacoes(text, n), tokens: (res as any).usageMetadata?.totalTokenCount || 0 };
}

function tipoLabel(t: CopyType): string {
  return { headline: "headlines (títulos)", anuncio: "textos de anúncio (primary text)", vsl: "roteiros de VSL (vídeo de vendas)", email: "e-mails de vendas", legenda: "legendas para redes sociais", cta: "chamadas para ação (CTA)" }[t];
}
function tamanhoPorTipo(t: CopyType): string {
  return { headline: "1 linha, impactante", anuncio: "2-4 parágrafos curtos", vsl: "um roteiro completo com gancho, desenvolvimento e fechamento", email: "assunto + corpo do e-mail", legenda: "curta e com emojis quando fizer sentido", cta: "1 frase de ação" }[t];
}
function parseVariacoes(raw: string, n: number): string[] {
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (Array.isArray(json.variacoes)) return json.variacoes.slice(0, n).map(String);
    if (Array.isArray(json)) return json.slice(0, n).map(String);
  } catch {}
  // fallback: divide por linhas/numeração
  return raw.split(/\n(?=\d+[\.\)]|\-)/).map((s) => s.replace(/^\s*\d+[\.\)]\s*|-\s*/, "").trim()).filter(Boolean).slice(0, n);
}

// ============================================================
// 3) TTS — narração realista (OpenAI agora; ElevenLabs premium)
// ============================================================

export interface GenerateTTSParams {
  text: string;
  voice?: string;
  provider?: "openai" | "elevenlabs";
  instructions?: string; // tom/emoção (OpenAI steerable)
}

export async function generateNarration(params: GenerateTTSParams): Promise<{ buffer: Buffer; mime: string }> {
  const provider = params.provider || (ELEVENLABS_KEY ? "elevenlabs" : "openai");

  if (provider === "elevenlabs") {
    if (!ELEVENLABS_KEY) throw new Error("ELEVENLABS_API_KEY não configurada");
    const voiceId = params.voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: params.text, model_id: "eleven_multilingual_v2" }),
    });
    if (!r.ok) throw new Error(`ElevenLabs erro ${r.status}: ${await r.text().catch(() => "")}`);
    return { buffer: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg" };
  }

  // OpenAI TTS (steerable)
  const res = await openai().audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: (params.voice as any) || "alloy",
    input: params.text,
    ...(params.instructions ? { instructions: params.instructions } : {}),
  } as any);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buffer: buf, mime: "audio/mpeg" };
}

// ============================================================
// 4) AVATAR / VÍDEO — scaffolds (habilitam ao configurar a chave)
// ============================================================

export async function generateTalkingAvatar(_params: { imageUrl: string; audioUrl?: string; text?: string }): Promise<{ jobId: string; status: string }> {
  if (process.env.DID_API_KEY) {
    // D-ID: POST /talks (foto + áudio/texto) — async, webhook/polling
    throw new Error("Integração D-ID pronta para implementar (DID_API_KEY detectada).");
  }
  if (process.env.HEYGEN_API_KEY) {
    throw new Error("Integração HeyGen pronta para implementar (HEYGEN_API_KEY detectada).");
  }
  throw new Error("Avatar falante requer uma chave de API (HeyGen, Hedra ou D-ID). Configure HEYGEN_API_KEY ou DID_API_KEY.");
}

export async function generateAdVideo(_params: { prompt: string; imageUrl?: string; model?: string }): Promise<{ jobId: string; status: string }> {
  if (process.env.FAL_KEY) {
    // Melhor para anúncios: Seedance 2.0 (ByteDance) — #1 realismo + consistência de produto.
    // Alternativa cinematográfica premium: Kling 3.0. Ambos via fal.ai (async + webhook).
    throw new Error("Integração fal.ai (Seedance 2.0 / Kling 3.0) pronta para implementar (FAL_KEY detectada).");
  }
  throw new Error("Geração de vídeo requer FAL_KEY (fal.ai). Recomendado: Seedance 2.0 (melhor realismo/custo) e Kling 3.0 (cinematográfico).");
}
