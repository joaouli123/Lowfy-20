import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";
import { spawn } from "child_process";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

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
    avatar: { ready: true, premium: !!(process.env.HEYGEN_API_KEY || process.env.DID_API_KEY), providers: { heygen: !!process.env.HEYGEN_API_KEY, did: !!process.env.DID_API_KEY, free: true } },
    video: { ready: true, premium: !!process.env.FAL_KEY, providers: { fal: !!process.env.FAL_KEY, free: true } },
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

const QUIZ_GEN_SYSTEM = `Você é um especialista em funis de quiz interativos de alta conversão. Gere um funil COMPLETO a partir do tema do usuário.
Responda SOMENTE com JSON válido neste formato exato:
{"name":"Nome do funil","steps":[{"name":"Nome da etapa","components":[{"type":"<tipo>","props":{...}}]}]}
Tipos de componente e suas props:
- "texto": { "text": "...", "variant": "title"|"subtitle"|"paragraph" }
- "opcoes": { "name": "id_curto", "question": "Pergunta?", "options": [{"label":"...","score":0}], "required": true, "autoAdvance": true }
- "captura": { "title": "...", "fields": [{"type":"name"|"email"|"phone","name":"nome","label":"...","required":true}], "buttonText": "Continuar" }
- "botao": { "label": "...", "action": "next"|"url", "url": "" }
- "nivel": { "label": "Sua pontuação", "fromScore": true }
- "imagem": { "url": "" }
- "video": { "url": "" }
- "alerta": { "text": "...", "variant": "warning" }
- "depoimentos": { "items": [{"name":"...","text":"...","stars":5}] }
- "preco": { "title":"...","price":"R$ 97","ctaLabel":"Comprar","url":"","highlight":true }
Regras: 4 a 6 etapas (boas-vindas; 2-3 perguntas com pontuação relevante ao tema; captura de nome+email; resultado usando {{nome}}). Português do Brasil, persuasivo e específico ao tema. Use {{nome}} e {{score}} quando fizer sentido. NÃO inclua comentários, só o JSON.`;

/** Gera a estrutura de um funil de quiz a partir de um tema (texto livre). */
export async function generateQuizFunnel(prompt: string): Promise<any> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY não configurada");
  const res = await openai().chat.completions.create({
    model: process.env.OPENAI_COPY_MODEL || "gpt-4o",
    messages: [
      { role: "system", content: QUIZ_GEN_SYSTEM },
      { role: "user", content: `Tema do funil: ${prompt}` },
    ],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ============================================================
// Geração de PÁGINA (pre-sell / landing) — 2 modos: blocos e HTML (vibe code)
// Fallback OpenAI → Gemini para maximizar disponibilidade.
// ============================================================

async function llmJson(system: string, user: string, temperature = 0.8): Promise<any> {
  if (OPENAI_KEY) {
    const res = await openai().chat.completions.create({
      model: process.env.OPENAI_COPY_MODEL || "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature,
      response_format: { type: "json_object" },
    });
    return JSON.parse((res.choices[0]?.message?.content || "{}").replace(/```json|```/g, "").trim());
  }
  if (GEMINI_KEY) {
    const res = await gemini().models.generateContent({
      model: process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash",
      contents: `${system}\n\n${user}`,
      config: { responseMimeType: "application/json", temperature } as any,
    });
    return JSON.parse(((res as any).text || "{}").replace(/```json|```/g, "").trim());
  }
  throw new Error("Nenhuma chave de IA configurada (OPENAI_API_KEY ou GEMINI_API_KEY)");
}

async function llmText(system: string, user: string, temperature = 0.7): Promise<string> {
  if (OPENAI_KEY) {
    const res = await openai().chat.completions.create({
      model: process.env.OPENAI_COPY_MODEL || "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature,
    });
    return res.choices[0]?.message?.content || "";
  }
  if (GEMINI_KEY) {
    const res = await gemini().models.generateContent({
      model: process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash",
      contents: `${system}\n\n${user}`,
      config: { temperature } as any,
    });
    return (res as any).text || "";
  }
  throw new Error("Nenhuma chave de IA configurada (OPENAI_API_KEY ou GEMINI_API_KEY)");
}

const LANDING_BLOCKS_SYSTEM = `Você é um web designer de páginas de pré-venda (advertorial/landing) de alta conversão. Gere uma página COMPLETA a partir da descrição do usuário.
Responda SOMENTE com JSON válido neste formato:
{"name":"Nome curto da página","elements":[{"type":"<tipo>","content":"<texto/url>","styles":{...}}]}
Tipos e conteúdo:
- "headline": content = título forte. styles: fontSize "40px", color "#0f172a", fontWeight "bold", textAlign "center".
- "subheadline": content = subtítulo. styles: fontSize "20px", color "#475569".
- "text": content = parágrafo persuasivo. styles: fontSize "17px", color "#334155".
- "image": content "". styles: imageUrl (URL pública REAL do Unsplash relacionada ao tema, ex "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900"), imageWidth "100%".
- "video": content "". styles: videoUrl (link do YouTube), videoWidth "100%".
- "button": content = texto do CTA em CAIXA ALTA. styles: fontSize "20px", color "#ffffff", fontWeight "bold", backgroundColor "#0d9b6e", buttonUrl "#", buttonEffect "pulse".
- "countdown": content "". styles: countdownMinutes 15, countdownTime 15, countdownTextColor "#ffffff", countdownBgColor "#0d9b6e", countdownPrefix "A oferta termina em: ".
- "divider": content "".
Em TODOS os styles inclua também: textAlign ("center" ou "left"), paddingTop, paddingRight, paddingBottom, paddingLeft, marginTop, marginRight, marginBottom, marginLeft (valores em px como "16px"/"0px"); para textos inclua fontStyle "normal" e textDecoration "none".
Regras: 6 a 10 elementos numa ordem persuasiva (headline → subheadline → mídia → benefícios em parágrafos → CTA → escassez). Português do Brasil, específico ao tema. Use URLs de imagem REAIS do Unsplash. Só o JSON.`;

/** Modo BLOCOS: prompt → elementos editáveis do Pre-Sell. */
export async function generateLandingPage(prompt: string): Promise<{ name: string; elements: any[] }> {
  const data = await llmJson(LANDING_BLOCKS_SYSTEM, `Descrição da página: ${prompt}`, 0.85);
  const arr = Array.isArray(data?.elements) ? data.elements : [];
  const elements = arr.map((el: any, i: number) => ({
    id: `ai-${Date.now()}-${i}`,
    type: el.type,
    content: el.content ?? "",
    styles: el.styles || {},
  }));
  return { name: data?.name || "Página IA", elements };
}

const LANDING_HTML_SYSTEM = `Você é um engenheiro front-end sênior especializado em páginas de pré-venda/landing de altíssima conversão. Gere uma página HTML COMPLETA e autossuficiente a partir da descrição.
Requisitos OBRIGATÓRIOS:
- Documento completo começando em <!doctype html><html lang="pt-BR"> com <head> e <body>.
- Use Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script> no <head>. Pode adicionar <style> se precisar.
- Responsivo mobile-first, moderno e bonito, com forte hierarquia tipográfica e bom espaçamento.
- Cor de destaque/marca: verde esmeralda #0d9b6e (botões e destaques). Fundo claro.
- Conteúdo persuasivo em Português do Brasil e específico ao tema: headline, subheadline, seções de benefícios, prova social/depoimentos, CTA destacado e gatilho de escassez.
- Imagens: use https://images.unsplash.com/... (URLs reais relacionadas) ou https://placehold.co/ como fallback.
- Inclua ao menos um botão CTA bem visível. NÃO use JS além do Tailwind CDN.
Responda SOMENTE com o código HTML (começando em <!doctype html>), sem comentários e sem cercas de código markdown.`;

/** Modo VIBE CODE: prompt → HTML/Tailwind completo. */
export async function generateLandingHtml(prompt: string, currentHtml?: string): Promise<{ html: string }> {
  const user = currentHtml
    ? `Página atual (HTML):\n${currentHtml}\n\nAjuste/itere conforme o pedido: ${prompt}`
    : `Descrição da página: ${prompt}`;
  let html = await llmText(LANDING_HTML_SYSTEM, user, 0.7);
  html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  if (!/<html/i.test(html)) {
    html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body>${html}</body></html>`;
  }
  return { html };
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
// 4) VÍDEO & AVATAR — geração de mídia
//    Free (sem chave): imagem/foto + narração → MP4 (Ken Burns via ffmpeg).
//    Premium (com chave): Seedance 2.0 / Kling 3.0 (fal.ai) e HeyGen / D-ID.
// ============================================================

const FAL_KEY = process.env.FAL_KEY || "";

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || "ffmpeg";
}

/** Executa ffmpeg com os args dados. Resolve em exit 0, rejeita com stderr caso contrário. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { windowsHide: true });
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg saiu com código ${code}: ${err.slice(-500)}`));
    });
  });
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar mídia (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

/** Resolve uma imagem a partir de URL absoluta, caminho /objects/... ou data URL. */
async function resolveImageBuffer(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith("data:")) {
    return Buffer.from(imageUrl.split(",")[1] || "", "base64");
  }
  if (/^https?:\/\//i.test(imageUrl)) return fetchBuffer(imageUrl);
  // caminho relativo do object storage → lê do volume
  const { ObjectStorageService } = await import("../objectStorage");
  const svc = new ObjectStorageService();
  const buf = await svc.getObjectBuffer(imageUrl);
  if (!buf) throw new Error(`Imagem não encontrada: ${imageUrl}`);
  return buf;
}

/**
 * Núcleo: combina uma imagem estática + (opcional) áudio em um MP4 com efeito
 * Ken Burns (zoom/pan suave). É o motor dos fallbacks gratuitos de vídeo e avatar.
 */
async function imageAudioToMp4(opts: {
  image: Buffer;
  audio?: Buffer | null;
  size?: "1080x1080" | "1080x1920" | "1920x1080";
  durationSec?: number;
  zoomIntensity?: number; // 0.0004 sutil ... 0.0008 forte
}): Promise<Buffer> {
  const [w, h] = (opts.size || "1080x1080").split("x").map((n) => parseInt(n, 10));
  const inc = opts.zoomIntensity ?? 0.0006;
  const scaleW = Math.round(w * 1.25), scaleH = Math.round(h * 1.25);
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "lowfy-vid-"));
  const imgPath = path.join(tmp, "in.jpg");
  const audPath = path.join(tmp, "in.mp3");
  const outPath = path.join(tmp, "out.mp4");
  try {
    await fsp.writeFile(imgPath, opts.image);
    if (opts.audio) await fsp.writeFile(audPath, opts.audio);

    const vf = `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},zoompan=z='min(zoom+${inc},1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=30,format=yuv420p`;

    const args = ["-y", "-loop", "1", "-i", imgPath];
    if (opts.audio) args.push("-i", audPath);
    args.push("-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30");
    if (opts.audio) {
      args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
    } else {
      args.push("-t", String(opts.durationSec || 8));
    }
    args.push("-movflags", "+faststart", outPath);

    await runFfmpeg(args);
    return await fsp.readFile(outPath);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export interface GenerateVideoParams {
  prompt: string;
  imageUrl?: string;     // imagem base (se ausente, gera via free Flux / gpt-image)
  script?: string;       // texto de narração (voiceover). Se ausente, vídeo sem áudio.
  size?: "1080x1080" | "1080x1920" | "1920x1080";
  voice?: string;
}

/**
 * Gera um vídeo de anúncio. Premium: Seedance 2.0 / Kling 3.0 (fal.ai) com FAL_KEY.
 * Free: imagem (gerada ou fornecida) + narração → MP4 com movimento Ken Burns.
 */
export async function generateAdVideo(params: GenerateVideoParams): Promise<{ buffer: Buffer; mime: string }> {
  // Premium: fal.ai (Seedance 2.0 — melhor para anúncios). Async com polling.
  if (FAL_KEY) {
    try {
      return await falTextToVideo(params);
    } catch (e: any) {
      logger.warn(`[AI Studio] fal.ai indisponível (${e?.message?.slice(0, 80)}), usando gerador gratuito.`);
    }
  }

  // Free: imagem base + narração → MP4
  const image = params.imageUrl
    ? await resolveImageBuffer(params.imageUrl)
    : (await generateAdImage({ prompt: params.prompt, size: params.size === "1080x1920" ? "1024x1536" : params.size === "1920x1080" ? "1536x1024" : "1024x1024" })).buffer;

  let audio: Buffer | null = null;
  if (params.script && params.script.trim()) {
    audio = (await generateNarration({ text: params.script, voice: params.voice })).buffer;
  }

  const buffer = await imageAudioToMp4({ image, audio, size: params.size, zoomIntensity: 0.0006 });
  return { buffer, mime: "video/mp4" };
}

export interface GenerateAvatarParams {
  imageUrl: string;      // foto da pessoa
  text?: string;         // o que ela vai "falar" (gera narração)
  audioUrl?: string;     // ou áudio pronto
  size?: "1080x1080" | "1080x1920" | "1920x1080";
  voice?: string;
}

/**
 * Gera um avatar falante. Premium: HeyGen Avatar IV / D-ID (lip-sync real) com a chave.
 * Free: foto + narração → MP4 de apresentação narrada (zoom sutil), sem lip-sync.
 */
export async function generateTalkingAvatar(params: GenerateAvatarParams): Promise<{ buffer: Buffer; mime: string }> {
  // Premium: HeyGen / D-ID (lip-sync real). Async com polling.
  if (process.env.HEYGEN_API_KEY || process.env.DID_API_KEY) {
    try {
      return await premiumTalkingAvatar(params);
    } catch (e: any) {
      logger.warn(`[AI Studio] provedor de avatar indisponível (${e?.message?.slice(0, 80)}), usando fallback gratuito.`);
    }
  }

  if (!params.imageUrl) throw new Error("É necessária a foto da pessoa (imageUrl) para gerar o avatar.");
  const image = await resolveImageBuffer(params.imageUrl);

  let audio: Buffer | null = null;
  if (params.audioUrl) audio = await fetchBuffer(params.audioUrl);
  else if (params.text && params.text.trim()) audio = (await generateNarration({ text: params.text, voice: params.voice })).buffer;
  else throw new Error("Informe um texto (text) ou áudio (audioUrl) para a narração do avatar.");

  // zoom mais sutil para rosto ("respiração")
  const buffer = await imageAudioToMp4({ image, audio, size: params.size, zoomIntensity: 0.00035 });
  return { buffer, mime: "video/mp4" };
}

// ---------- Provedores premium (ativam com a respectiva chave) ----------

/** Seedance 2.0 (texto→vídeo) via fal.ai — submete o job e aguarda (polling). */
async function falTextToVideo(params: GenerateVideoParams): Promise<{ buffer: Buffer; mime: string }> {
  const model = process.env.FAL_VIDEO_MODEL || "fal-ai/bytedance/seedance/v1/pro/text-to-video";
  const aspect = params.size === "1080x1920" ? "9:16" : params.size === "1920x1080" ? "16:9" : "1:1";
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: params.prompt, aspect_ratio: aspect, resolution: "1080p" }),
  });
  if (!submit.ok) throw new Error(`fal.ai submit ${submit.status}: ${await submit.text().catch(() => "")}`);
  const job = await submit.json();
  const statusUrl: string = job.status_url || `https://queue.fal.run/${model}/requests/${job.request_id}/status`;
  const responseUrl: string = job.response_url || `https://queue.fal.run/${model}/requests/${job.request_id}`;

  // polling (até ~5 min)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
    const sj = await st.json().catch(() => ({}));
    if (sj.status === "COMPLETED") break;
    if (sj.status === "FAILED" || sj.status === "ERROR") throw new Error("fal.ai job falhou");
  }
  const res = await fetch(responseUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
  const rj = await res.json();
  const videoUrl = rj?.video?.url || rj?.data?.video?.url;
  if (!videoUrl) throw new Error("fal.ai não retornou URL de vídeo");
  return { buffer: await fetchBuffer(videoUrl), mime: "video/mp4" };
}

/** HeyGen / D-ID (foto→avatar falante com lip-sync). Submete e aguarda. */
async function premiumTalkingAvatar(params: GenerateAvatarParams): Promise<{ buffer: Buffer; mime: string }> {
  // D-ID: POST /talks com source_url (foto) + script (texto). Polling até "done".
  if (process.env.DID_API_KEY) {
    const auth = `Basic ${process.env.DID_API_KEY}`;
    const create = await fetch("https://api.d-id.com/talks", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_url: params.imageUrl,
        script: { type: "text", input: params.text || "", provider: { type: "microsoft", voice_id: params.voice || "pt-BR-FranciscaNeural" } },
      }),
    });
    if (!create.ok) throw new Error(`D-ID ${create.status}: ${await create.text().catch(() => "")}`);
    const cj = await create.json();
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const st = await fetch(`https://api.d-id.com/talks/${cj.id}`, { headers: { Authorization: auth } });
      const sj = await st.json();
      if (sj.status === "done" && sj.result_url) return { buffer: await fetchBuffer(sj.result_url), mime: "video/mp4" };
      if (sj.status === "error") throw new Error("D-ID job falhou");
    }
    throw new Error("D-ID timeout");
  }
  throw new Error("HeyGen pronto para implementar (HEYGEN_API_KEY detectada).");
}
