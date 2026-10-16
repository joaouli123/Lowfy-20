import OpenAI, { toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";
import * as kie from "./kie";
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
  const K = kie.kieReady();
  return {
    kie: { ready: K },
    image: { ready: true, premium: K || !!OPENAI_KEY, providers: { openai: !!OPENAI_KEY, ideogram: !!process.env.IDEOGRAM_API_KEY, free: true } },
    copy: { ready: K || !!(GEMINI_KEY || OPENAI_KEY), providers: { gemini: !!GEMINI_KEY, openai: !!OPENAI_KEY } },
    tts: { ready: true, premium: K || !!ELEVENLABS_KEY, providers: { elevenlabs: !!ELEVENLABS_KEY, free: true } },
    voiceClone: { ready: !!ELEVENLABS_KEY, provider: "elevenlabs" },
    avatar: { ready: true, premium: K || !!(process.env.HEYGEN_API_KEY || process.env.DID_API_KEY), providers: { heygen: !!process.env.HEYGEN_API_KEY, did: !!process.env.DID_API_KEY, free: true } },
    video: { ready: true, premium: K || !!process.env.FAL_KEY, providers: { fal: !!process.env.FAL_KEY, seedance: "2.0", free: true } },
    canva: { ready: !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET) },
  };
}

// ============================================================
// 1) IMAGEM — geração de criativo de anúncio
// ============================================================

export interface GenerateImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  background?: "transparent" | "opaque" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number; // 0-100 (jpeg/webp)
  provider?: "openai" | "gemini";
  /** Imagem de referência (data URL) para guiar estilo/composição. */
  reference?: string;
  /** Proporção exata (ex.: "4:5"). Sem ela, deriva do size. */
  aspect?: string;
}

/**
 * Gera uma imagem de criativo. Usa OpenAI gpt-image (preferência do usuário —
 * Gemini foi descartado para IMAGENS por qualidade inferior). Provedores premium
 * de texto-em-imagem (Ideogram / FLUX.2 / Recraft) habilitam ao configurar a chave.
 */
export async function generateAdImage(params: GenerateImageParams): Promise<{ buffer: Buffer; mime: string }> {
  // Kie.ai (GPT Image 2) — bem mais barato que a OpenAI direto.
  if (kie.kieReady()) {
    const ref = params.reference ? await kie.kieFileUrl(params.reference, { folder: "referencias" }) : null;
    const input: Record<string, any> = {
      prompt: params.prompt.slice(0, 20000),
      aspect_ratio: kie.kieAspect(params.aspect || params.size),
      resolution: "1K",
    };
    if (params.background && params.background !== "auto") input.background = params.background;
    if (ref) input.input_urls = [ref];
    const r = await kie.kieRun(ref ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image", input, { timeoutMs: 4 * 60_000 });
    return kie.kieDownload(r.urls[0]);
  }

  // Ideogram (melhor texto-em-imagem) se configurado
  if (process.env.IDEOGRAM_API_KEY && (params.provider as any) === "ideogram") {
    throw new Error("Integração Ideogram pronta para implementar (IDEOGRAM_API_KEY detectada).");
  }

  // Premium: OpenAI gpt-image (quando a chave é válida). Em falha/ausência,
  // cai para um gerador GRATUITO (Flux via Pollinations) para o recurso funcionar
  // sem chave — o gpt-image assume automaticamente quando a chave válida é configurada.
  if (OPENAI_KEY) {
    try {
      const fmt = params.format || "png";
      const body: any = {
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt: params.prompt,
        size: params.size || "1024x1024",
        quality: params.quality || "high",
        background: params.background || "auto",
        output_format: fmt,
        n: 1,
      };
      if ((fmt === "jpeg" || fmt === "webp") && typeof params.compression === "number") {
        body.output_compression = Math.max(0, Math.min(100, params.compression));
      }
      const ref = parseDataUrl(params.reference);
      const res = ref
        ? await openai().images.edit({ ...body, background: undefined, image: await toFile(ref.buffer, `ref.${ref.ext}`, { type: ref.mime }) })
        : await openai().images.generate(body);
      const b64 = (res as any).data?.[0]?.b64_json;
      if (b64) {
        const mime = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
        return { buffer: Buffer.from(b64, "base64"), mime };
      }
    } catch (e: any) {
      throw new Error(`Falha na geração de imagem premium (gpt-image): ${e?.message?.slice(0, 90)}`);
    }
  }

  throw new Error("Geração de imagem requer a chave premium OPENAI_API_KEY (gpt-image).");
}

function parseDataUrl(dataUrl?: string): { buffer: Buffer; mime: string; ext: string } | null {
  const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  return { buffer: Buffer.from(m[3], "base64"), mime: m[1], ext: m[2].replace("jpeg", "jpg") };
}

/** Nome do idioma para instruções aos modelos (padrão pt-BR). */
export function langName(code?: string): string {
  const c = code || "pt-BR";
  const names: Record<string, string> = { "pt-BR": "português do Brasil", en: "inglês", es: "espanhol", fr: "francês", it: "italiano", de: "alemão" };
  return names[c] || names[c.slice(0, 2)] || "português do Brasil";
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
  idioma?: string;
  objetivo?: string;
  texto?: string;
  cta?: string;
  cores?: string[];
  observacoes?: string;
  temReferencia?: boolean;
}): string {
  const partes = [
    `Crie um criativo publicitário profissional e fotorrealista para anúncio de: ${opts.produto}.`,
    opts.publico ? `Público-alvo: ${opts.publico}.` : "",
    opts.estilo ? `Estilo visual: ${opts.estilo}.` : "Estilo moderno, alto contraste, com foco no produto.",
    opts.headline
      ? `Inclua o texto em destaque, perfeitamente legível e sem erros de ortografia: "${opts.headline}".`
      : `Crie e inclua uma headline curta e chamativa (até 5 palavras) em ${langName(opts.idioma)}, perfeitamente legível e sem erros de ortografia.`,
    opts.objetivo ? `Objetivo do anúncio: ${opts.objetivo}.` : "",
    opts.texto ? `Texto de apoio (menor que a headline): "${opts.texto}".` : "",
    opts.cta ? `Inclua um botão de chamada para ação com o texto "${opts.cta}".` : "",
    opts.cores?.length ? `Use a paleta de cores da marca: ${opts.cores.join(", ")}.` : "",
    opts.temReferencia ? "Use a imagem enviada como referência de estilo, composição e produto." : "",
    opts.observacoes ? `Observações extras: ${opts.observacoes}.` : "",
    opts.idioma && opts.idioma !== "pt-BR" ? `Qualquer texto na imagem deve estar em ${langName(opts.idioma)}.` : "",
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
  idioma?: string;
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
Escreva TODO o conteúdo no idioma: ${langName(params.idioma)}.
Devolva como JSON: {"variacoes": ["...", "..."]}. Cada variação deve ser ${tamanhoPorTipo(params.tipo)}.`;

  // Kie.ai primeiro (mais barato); OpenAI/Gemini direto como reserva.
  if (kie.kieReady()) {
    try {
      const j = await kie.kieChat(COPY_SYSTEM, userPrompt, { json: true, temperature: 0.9 });
      return { variacoes: parseVariacoes(JSON.stringify(j), n), tokens: 0 };
    } catch (e: any) {
      if (!OPENAI_KEY && !GEMINI_KEY) throw e;
    }
  }
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

export async function llmJson(system: string, user: string, temperature = 0.8): Promise<any> {
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
  if (kie.kieReady()) return kie.kieChat(system, user, { json: true, temperature });
  throw new Error("Nenhuma chave de IA configurada (OPENAI_API_KEY, GEMINI_API_KEY ou KIE_API_KEY)");
}

// Variante de llmJson que também devolve o uso de tokens (p/ logTokenUsage nos call sites).
export async function llmJsonWithUsage(
  system: string,
  user: string,
  temperature = 0.8,
): Promise<{ data: any; model: string; promptTokens: number; completionTokens: number }> {
  if (OPENAI_KEY) {
    const model = process.env.OPENAI_COPY_MODEL || "gpt-4o";
    const res = await openai().chat.completions.create({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature,
      response_format: { type: "json_object" },
    });
    const data = JSON.parse((res.choices[0]?.message?.content || "{}").replace(/```json|```/g, "").trim());
    return {
      data,
      model,
      promptTokens: res.usage?.prompt_tokens || 0,
      completionTokens: res.usage?.completion_tokens || 0,
    };
  }
  if (GEMINI_KEY) {
    const model = process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash";
    const res = await gemini().models.generateContent({
      model,
      contents: `${system}\n\n${user}`,
      config: { responseMimeType: "application/json", temperature } as any,
    });
    const data = JSON.parse(((res as any).text || "{}").replace(/```json|```/g, "").trim());
    const usage = (res as any).usageMetadata;
    return {
      data,
      model,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
    };
  }
  if (kie.kieReady()) return { data: await kie.kieChat(system, user, { json: true, temperature }), model: "kie/gemini-3-8-flash", promptTokens: 0, completionTokens: 0 };
  throw new Error("Nenhuma chave de IA configurada (OPENAI_API_KEY, GEMINI_API_KEY ou KIE_API_KEY)");
}

export async function llmText(system: string, user: string, temperature = 0.7): Promise<string> {
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
  if (kie.kieReady()) return kie.kieChat(system, user, { temperature });
  throw new Error("Nenhuma chave de IA configurada (OPENAI_API_KEY, GEMINI_API_KEY ou KIE_API_KEY)");
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
  instructions?: string;     // tom/emoção (OpenAI steerable)
  modelId?: string;          // ElevenLabs: eleven_v3 | eleven_multilingual_v2 | eleven_flash_v2_5 | eleven_turbo_v2_5
  stability?: number;        // 0..1
  similarityBoost?: number;  // 0..1
  style?: number;            // 0..1
  speed?: number;            // 0.7..1.2
  idioma?: string;           // idioma (ex.: pt-BR); usado na narração grátis
}

export async function generateNarration(params: GenerateTTSParams): Promise<{ buffer: Buffer; mime: string }> {
  const r = await narrationUrl(params);
  if (r) return kie.kieDownload(r);
  return elevenNarration(params);
}

/** Narração pela Kie (ElevenLabs Multilingual v2). Devolve a URL do MP3 ou null se a Kie não estiver configurada. */
export async function narrationUrl(params: GenerateTTSParams): Promise<string | null> {
  if (!kie.kieReady()) return null;
  const input: Record<string, any> = {
    text: String(params.text || "").slice(0, 5000),
    voice: kie.kieVoice(params.voice),
  };
  if (params.stability != null) input.stability = params.stability;
  if (params.similarityBoost != null) input.similarity_boost = params.similarityBoost;
  if (params.style != null) input.style = params.style;
  if (params.speed != null) input.speed = Math.max(0.7, Math.min(1.2, params.speed));
  try {
    const r = await kie.kieRun("elevenlabs/text-to-speech-multilingual-v2", input, { timeoutMs: 3 * 60_000, intervalMs: 2500 });
    return r.urls[0];
  } catch (e: any) {
    // ElevenLabs da Kie fora do ar: cai no TTS do Gemini (também na Kie) com voz do mesmo gênero.
    logger.warn(`[Kie] ElevenLabs falhou, usando Gemini TTS: ${e?.message}`);
    const fem = kie.KIE_VOICES.find((v) => v.voiceId === input.voice)?.gender !== "masc";
    const r = await kie.kieRun("google/gemini-3-1-flash-tts", {
      sample_context: `Locução comercial em ${langName(params.idioma)}, tom natural, claro e confiante.`,
      speakers: [{ speaker_id: "Speaker 1", voice_name: fem ? "Aoede" : "Charon" }],
      dialogue_turns: [{ speaker_id: "Speaker 1", text: input.text.replace(/<break[^>]*>/g, " ") }],
    }, { timeoutMs: 3 * 60_000, intervalMs: 2500 });
    return r.urls[0];
  }
}

async function elevenNarration(params: GenerateTTSParams): Promise<{ buffer: Buffer; mime: string }> {
  // Narração é ElevenLabs-only (decisão do produto: OpenAI fica restrito a copy/criativos).
  if (!ELEVENLABS_KEY) {
    throw new Error("Narração premium requer a chave ElevenLabs configurada.");
  }

  const voiceId = params.voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const vs: any = {};
  if (params.stability != null) vs.stability = params.stability;
  if (params.similarityBoost != null) vs.similarity_boost = params.similarityBoost;
  if (params.style != null) vs.style = params.style;
  if (params.speed != null) vs.speed = params.speed;
  vs.use_speaker_boost = true;
  const body: any = {
    text: params.text,
    model_id: params.modelId || process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    voice_settings: vs,
  };
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (r.ok) return { buffer: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg" };
    const errText = await r.text().catch(() => "");
    throw new Error(`ElevenLabs (${r.status}): ${errText.slice(0, 120)}`);
  } catch (e: any) {
    throw new Error(`Falha na narração (ElevenLabs): ${e?.message?.slice(0, 120)}`);
  }
}

// ---------- Clonagem de voz (ElevenLabs Instant Voice Cloning) ----------

export interface CloneVoiceInput {
  name: string;
  files: { buffer: Buffer; filename: string; type?: string }[];
  description?: string;
  removeNoise?: boolean;
}

/** Clona uma voz a partir de amostras de áudio (ElevenLabs IVC — ~1 min de áudio). */
export async function cloneVoice(input: CloneVoiceInput): Promise<{ voiceId: string; requiresVerification?: boolean }> {
  if (!ELEVENLABS_KEY) throw new Error("Clonagem de voz requer a chave ElevenLabs (ELEVENLABS_API_KEY).");
  if (!input.files?.length) throw new Error("Envie ao menos uma amostra de áudio.");
  const form = new FormData();
  form.append("name", input.name || "Voz clonada");
  if (input.description) form.append("description", input.description);
  if (input.removeNoise) form.append("remove_background_noise", "true");
  for (const f of input.files) {
    form.append("files", new Blob([new Uint8Array(f.buffer)], { type: f.type || "audio/mpeg" }), f.filename || "amostra.mp3");
  }
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_KEY },
    body: form as any,
  });
  if (!r.ok) throw new Error(`ElevenLabs clonagem ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const j: any = await r.json();
  return { voiceId: j.voice_id, requiresVerification: j.requires_verification };
}

/** Lista as vozes disponíveis na conta ElevenLabs (incluindo clonadas). */
export async function listVoices(): Promise<{ voices: { voiceId: string; name: string; category?: string }[] }> {
  // Com a Kie, só as vozes da lista dela funcionam na narração.
  if (kie.kieReady()) {
    return { voices: kie.KIE_VOICES.map((v) => ({ voiceId: v.voiceId, name: v.name, category: "premade", gender: v.gender, tag: v.tag, previewUrl: kie.kieVoicePreview(v.voiceId) })) };
  }
  if (!ELEVENLABS_KEY) return { voices: [] };
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": ELEVENLABS_KEY } });
    if (!r.ok) return { voices: [] };
    const j: any = await r.json();
    return { voices: (j.voices || []).map((v: any) => ({ voiceId: v.voice_id, name: v.name, category: v.category, previewUrl: v.preview_url })) };
  } catch { return { voices: [] }; }
}

/** Remove uma voz clonada da conta. */
export async function deleteVoice(voiceId: string): Promise<void> {
  if (!ELEVENLABS_KEY) return;
  await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { method: "DELETE", headers: { "xi-api-key": ELEVENLABS_KEY } }).catch(() => {});
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
  imageUrl?: string;     // imagem base. Se for URL pública → Seedance image-to-video.
  script?: string;       // texto de narração (voiceover) no fallback gratuito.
  size?: "1080x1080" | "1080x1920" | "1920x1080";
  voice?: string;
  resolution?: "480p" | "720p" | "1080p";  // Seedance 2.0
  duration?: string;     // "auto" ou "4".."15" (Seedance 2.0)
  generateAudio?: boolean; // Seedance 2.0 gera áudio nativo (default true)
}

/**
 * Gera um vídeo de anúncio. Premium: Seedance 2.0 / Kling 3.0 (fal.ai) com FAL_KEY.
 * Free: imagem (gerada ou fornecida) + narração → MP4 com movimento Ken Burns.
 */
export async function generateAdVideo(params: GenerateVideoParams): Promise<{ buffer: Buffer; mime: string }> {
  // Kie.ai — Seedance 2.0 (Fast por padrão, mais barato).
  if (kie.kieReady()) {
    const aspect = params.size === "1080x1920" ? "9:16" : params.size === "1920x1080" ? "16:9" : "1:1";
    const dur = Math.max(4, Math.min(15, parseInt(String(params.duration || "5"), 10) || 5));
    const input: Record<string, any> = {
      prompt: String(params.prompt || "").slice(0, 20000),
      aspect_ratio: aspect,
      resolution: "720p",
      duration: dur,
      generate_audio: params.generateAudio !== false,
    };
    if (params.imageUrl) input.first_frame_url = await kie.kieFileUrl(params.imageUrl, { folder: "video-base" });
    const model = process.env.KIE_VIDEO_MODEL || "bytedance/seedance-2-fast";
    const r = await kie.kieRun(model, input, { timeoutMs: 10 * 60_000, intervalMs: 6000 });
    return kie.kieDownload(r.urls[0]);
  }

  // Premium: fal.ai (Seedance 2.0 — melhor para anúncios). Async com polling.
  if (FAL_KEY) {
    try {
      return await falTextToVideo(params);
    } catch (e: any) {
      throw new Error(`Falha na geração de vídeo premium (Seedance): ${e?.message?.slice(0, 100)}`);
    }
  }

  throw new Error("Geração de vídeo requer a chave premium FAL_KEY (Seedance 2.0).");
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
  // Kie.ai — Kling AI Avatar: foto + áudio (narração gerada antes) → vídeo com lip-sync.
  if (kie.kieReady()) {
    const audio = params.audioUrl || (await narrationUrl({ text: params.text || "", voice: params.voice } as GenerateTTSParams));
    if (!audio) throw new Error("Não foi possível gerar a fala do avatar");
    const image = await kie.kieFileUrl(params.imageUrl, { folder: "avatar" });
    const model = process.env.KIE_AVATAR_MODEL || "kling/ai-avatar-standard";
    const r = await kie.kieRun(model, {
      image_url: image,
      audio_url: await kie.kieFileUrl(audio, { folder: "avatar" }),
      prompt: "Apresentador(a) falando de forma natural e confiante, olhando para a câmera, gestos sutis, câmera estável.",
    }, { timeoutMs: 12 * 60_000, intervalMs: 6000 });
    return kie.kieDownload(r.urls[0]);
  }

  // Premium: HeyGen / D-ID (lip-sync real). Async com polling.
  if (process.env.HEYGEN_API_KEY || process.env.DID_API_KEY) {
    try {
      return await premiumTalkingAvatar(params);
    } catch (e: any) {
      throw new Error(`Falha na geração de avatar premium (HeyGen/D-ID): ${e?.message?.slice(0, 100)}`);
    }
  }

  throw new Error("Avatar com lip-sync real requer a chave premium HeyGen (HEYGEN_API_KEY) ou D-ID (DID_API_KEY).");
}

// ---------- Provedores premium (ativam com a respectiva chave) ----------

/**
 * Seedance 2.0 (ByteDance) via fal.ai — submete o job e aguarda (polling).
 * Usa image-to-video quando há uma imagem base por URL pública; senão text-to-video.
 * Seedance 2.0 gera ÁUDIO nativo (generate_audio).
 */
async function falTextToVideo(params: GenerateVideoParams): Promise<{ buffer: Buffer; mime: string }> {
  const isI2V = !!params.imageUrl && /^https?:\/\//i.test(params.imageUrl);
  const model = process.env.FAL_VIDEO_MODEL || (isI2V ? "bytedance/seedance-2.0/image-to-video" : "bytedance/seedance-2.0/text-to-video");
  const aspect = params.size === "1080x1920" ? "9:16" : params.size === "1920x1080" ? "16:9" : "1:1";
  const input: any = {
    prompt: params.prompt,
    aspect_ratio: aspect,
    resolution: params.resolution || "720p",
    duration: params.duration || "auto",
    generate_audio: params.generateAudio !== false,
  };
  if (isI2V) input.image_url = params.imageUrl;

  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
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

// ---------- Página de Copy: kit estruturado ----------

export interface CopyKitParams {
  produto: string; objetivo?: string; publico?: string; oferta?: string; beneficios?: string;
  tom?: string; canal?: string; cta?: string; tamanho?: string; observacoes?: string; idioma?: string;
}

const CANAL_LABEL: Record<string, string> = { instagram: "legenda de Instagram", whatsapp: "mensagem de WhatsApp", landing: "seção de landing page", anuncio: "anúncio pago (Meta/Google)" };
const TAMANHO_LABEL: Record<string, string> = { curto: "curto (2 a 3 frases)", medio: "médio (1 parágrafo de 4 a 6 frases)", longo: "longo (2 a 3 parágrafos)" };

export async function generateCopyKit(p: CopyKitParams): Promise<{ headline: string; subheadline: string; texto: string; cta: string; variacoes: string[] }> {
  const user = `Escreva a copy de um(a) ${CANAL_LABEL[p.canal || ""] || "anúncio"}.
- Produto/serviço: ${p.produto}
${p.objetivo ? `- Objetivo: ${p.objetivo}` : ""}
${p.publico ? `- Público-alvo: ${p.publico}` : ""}
${p.oferta ? `- Oferta: ${p.oferta}` : ""}
${p.beneficios ? `- Benefícios/diferenciais: ${p.beneficios}` : ""}
${p.tom ? `- Tom de voz: ${p.tom}` : ""}
${p.cta ? `- Chamada para ação desejada: ${p.cta}` : ""}
${p.observacoes ? `- Observações: ${p.observacoes}` : ""}
O texto principal deve ser ${TAMANHO_LABEL[p.tamanho || ""] || TAMANHO_LABEL.curto}.
Escreva TODO o conteúdo no idioma: ${langName(p.idioma)}.
Responda SOMENTE com JSON: {"headline":"até 8 palavras","subheadline":"1 frase curta reforçando a oferta","texto":"texto principal","cta":"chamada para ação curta","variacoes":["3 headlines alternativas"]}`;
  let j: any;
  if (kie.kieReady()) {
    try { j = await kie.kieChat(COPY_SYSTEM, user, { json: true, temperature: 0.85 }); }
    catch (e) { if (!OPENAI_KEY && !GEMINI_KEY) throw e; }
  }
  if (!j) j = await llmJson(COPY_SYSTEM, user, 0.85);
  const str = (v: any) => (typeof v === "string" ? v.trim() : "");
  return {
    headline: str(j?.headline),
    subheadline: str(j?.subheadline),
    texto: str(j?.texto),
    cta: str(j?.cta) || p.cta || "",
    variacoes: Array.isArray(j?.variacoes) ? j.variacoes.map(str).filter(Boolean).slice(0, 5) : [],
  };
}

// ---------- Avatar sem foto: retrato do apresentador ----------

const ESTILO_AVATAR: Record<string, string> = {
  profissional: "roupa social elegante, postura confiante.",
  casual: "roupa casual moderna, expressão simpática e descontraída.",
  elegante: "visual sofisticado e elegante, cabelo e maquiagem impecáveis.",
  vendedor: "visual de apresentador de vendas, sorriso aberto e energia alta.",
};
const CENARIO_AVATAR: Record<string, string> = {
  estudio: "estúdio de gravação com iluminação profissional suave e fundo desfocado",
  clean: "fundo liso claro e minimalista",
  escritorio: "escritório moderno desfocado ao fundo",
  produto: "ambiente com o produto em destaque ao lado, fundo desfocado",
};

export function buildPresenterPrompt(a: { produto?: string; publico?: string; estilo?: string; cenario?: string; observacoes?: string }): string {
  return [
    "Retrato fotorrealista de um(a) apresentador(a) brasileiro(a) olhando diretamente para a câmera, enquadramento do peito para cima, rosto bem iluminado e nítido, expressão natural.",
    ESTILO_AVATAR[a.estilo || ""] || ESTILO_AVATAR.profissional,
    `Cenário: ${CENARIO_AVATAR[a.cenario || ""] || CENARIO_AVATAR.estudio}.`,
    a.produto ? `Contexto: vai apresentar ${a.produto}${a.publico ? ` para ${a.publico}` : ""}.` : "",
    a.observacoes ? `Detalhes: ${a.observacoes}.` : "",
    "Sem texto, sem logotipos, sem marcas d'água. Qualidade de foto profissional.",
  ].filter(Boolean).join(" ");
}

// ---------- Vídeo: prompt a partir do formulário ----------

const ESTILO_VIDEO: Record<string, string> = {
  clean: "Visual clean e minimalista, fundo claro, movimentos de câmera suaves.",
  moderno: "Visual moderno e dinâmico, transições rápidas, cores vivas.",
  promocional: "Estilo promocional chamativo, energia alta, destaque para a oferta.",
  cinematografico: "Estilo cinematográfico, iluminação dramática, câmera lenta e profundidade de campo.",
};

export function buildAdVideoPrompt(b: { produto?: string; objetivo?: string; publico?: string; mensagem?: string; estilo?: string; cta?: string; observacoes?: string; idioma?: string }): string {
  return [
    `Vídeo publicitário curto de ${b.produto}.`,
    b.objetivo ? `Objetivo: ${b.objetivo}.` : "",
    b.publico ? `Público-alvo: ${b.publico}.` : "",
    b.mensagem ? `Mensagem principal: "${b.mensagem}".` : "",
    ESTILO_VIDEO[b.estilo || ""] || ESTILO_VIDEO.clean,
    b.cta ? `Termine com a chamada para ação "${b.cta}".` : "",
    b.observacoes ? `Observações: ${b.observacoes}.` : "",
    `Qualquer fala ou texto em ${langName(b.idioma)}.`,
    "Produto sempre em foco, qualidade de comercial de TV.",
  ].filter(Boolean).join(" ");
}
