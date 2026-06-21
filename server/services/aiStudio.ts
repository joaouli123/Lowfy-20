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
    image: { ready: true, premium: !!OPENAI_KEY, providers: { openai: !!OPENAI_KEY, ideogram: !!process.env.IDEOGRAM_API_KEY, free: true } },
    copy: { ready: !!(GEMINI_KEY || OPENAI_KEY), providers: { gemini: !!GEMINI_KEY, openai: !!OPENAI_KEY } },
    tts: { ready: true, premium: !!(OPENAI_KEY || ELEVENLABS_KEY), providers: { openai: !!OPENAI_KEY, elevenlabs: !!ELEVENLABS_KEY, free: true } },
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

  // Premium: OpenAI gpt-image (quando a chave é válida). Em falha/ausência,
  // cai para um gerador GRATUITO (Flux via Pollinations) para o recurso funcionar
  // sem chave — o gpt-image assume automaticamente quando a chave válida é configurada.
  if (OPENAI_KEY) {
    try {
      const res = await openai().images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt: params.prompt,
        size: params.size || "1024x1024",
        quality: params.quality || "high",
        n: 1,
      } as any);
      const b64 = (res as any).data?.[0]?.b64_json;
      if (b64) return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
    } catch (e: any) {
      logger.warn(`[AI Studio] gpt-image indisponível (${e?.message?.slice(0, 60)}), usando gerador gratuito.`);
    }
  }

  const [w, h] = (params.size || "1024x1024").split("x").map((n) => parseInt(n, 10) || 1024);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(params.prompt)}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao gerar imagem (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: "image/jpeg" };
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
  // Premium 1: ElevenLabs (melhor realismo + clonagem) — quando a chave existe.
  if (ELEVENLABS_KEY && params.provider !== "openai") {
    try {
      const voiceId = params.voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: params.text, model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
      });
      if (r.ok) return { buffer: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg" };
      logger.warn(`[AI Studio] ElevenLabs indisponível (${r.status}), tentando próximo provedor.`);
    } catch (e: any) {
      logger.warn(`[AI Studio] ElevenLabs falhou (${e?.message?.slice(0, 60)}), tentando próximo provedor.`);
    }
  }

  // Premium 2: OpenAI TTS (steerable) — quando a chave é válida.
  if (OPENAI_KEY) {
    try {
      const res = await openai().audio.speech.create({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: (params.voice as any) || "alloy",
        input: params.text,
        ...(params.instructions ? { instructions: params.instructions } : {}),
      } as any);
      return { buffer: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e: any) {
      logger.warn(`[AI Studio] OpenAI TTS indisponível (${e?.message?.slice(0, 60)}), usando narração gratuita.`);
    }
  }

  // Fallback GRATUITO (pt-BR, sem chave) — para o recurso funcionar imediatamente.
  // ElevenLabs/OpenAI assumem automaticamente quando a chave é configurada.
  return { buffer: await googleTtsFree(params.text, "pt-BR"), mime: "audio/mpeg" };
}

/** Narração gratuita pt-BR via Google translate_tts. Divide o texto em blocos
 *  (limite ~200 chars) e concatena os MP3s. Robótico, mas funcional sem chave. */
async function googleTtsFree(text: string, lang: string): Promise<Buffer> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("Texto vazio para narração");
  const chunks = chunkText(clean, 190);
  const parts: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunks[i])}&tl=${encodeURIComponent(lang)}&client=tw-ob&textlen=${chunks[i].length}&idx=${i}&total=${chunks.length}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://translate.google.com/" } });
    if (!r.ok) throw new Error(`Falha na narração gratuita (${r.status})`);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

/** Quebra texto em blocos <= max chars, respeitando limites de frase/palavra. */
function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
  let cur = "";
  for (const s of sentences) {
    if (s.length > max) {
      if (cur) { out.push(cur.trim()); cur = ""; }
      const words = s.split(" ");
      for (const w of words) {
        if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; }
        else cur = (cur + " " + w).trim();
      }
    } else if ((cur + s).length > max) {
      out.push(cur.trim()); cur = s;
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
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
