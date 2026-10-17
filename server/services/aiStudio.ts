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
  const aspect = kie.kieAspect(params.aspect || params.size);
  let kieErr: any = null;

  // 1) Kie.ai (GPT Image 2) — bem mais barato que a OpenAI direto.
  if (kie.kieReady() && !(OPENAI_KEY && kie.kieSemCredito())) {
    try {
      const ref = params.reference ? await kie.kieFileUrl(params.reference, { folder: "referencias" }) : null;
      const input: Record<string, any> = { prompt: params.prompt.slice(0, 20000), aspect_ratio: aspect, resolution: "1K" };
      if (params.background && params.background !== "auto") input.background = params.background;
      if (ref) input.input_urls = [ref];
      const r = await kie.kieRun(ref ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image", input, { timeoutMs: 4 * 60_000 });
      return await kie.kieDownload(r.urls[0]);
    } catch (e: any) {
      kieErr = e;
      logger.warn(`[Imagem] Kie falhou, tentando OpenAI: ${e?.message}`);
      if (!OPENAI_KEY) throw e;
    }
  }

  // 2) OpenAI direto (reserva). gpt-image-2: o gpt-image-1 foi desligado em 23/10/2026.
  if (OPENAI_KEY) {
    try {
      const fmt = params.format || "png";
      const [w, h] = aspect.split(":").map(Number);
      const ratio = w && h ? w / h : 1;
      // gpt-image-2 aceita tamanho personalizado: gera já no formato exato (sem recorte).
      const SIZES: Record<string, string> = { "1:1": "1024x1024", "4:5": "1024x1280", "9:16": "864x1536", "16:9": "1536x864", "3:2": "1536x1024", "2:3": "1024x1536", "3:4": "1152x1536", "4:3": "1536x1152" };
      const size = SIZES[aspect] || (Math.abs(ratio - 1) < 0.05 ? "1024x1024" : ratio > 1 ? "1536x1024" : "1024x1536");
      const body: any = {
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: params.prompt,
        size,
        // "medium" sai ~3x mais rápido (35s vs 100s) com resultado equivalente nos criativos.
        quality: params.quality || "medium",
        output_format: fmt,
        n: 1,
      };
      if (params.background && params.background !== "auto") body.background = params.background;
      const ref = await referenceBuffer(params.reference);
      const res = ref
        ? await openai().images.edit({ ...body, image: await toFile(ref.buffer, `ref.${ref.ext}`, { type: ref.mime }) })
        : await openai().images.generate(body);
      const b64 = (res as any).data?.[0]?.b64_json;
      if (!b64) throw new Error("a OpenAI não devolveu a imagem");
      const mime = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      // Garantia: se vier em outro formato, recorta no centro.
      return { buffer: await cropToAspect(Buffer.from(b64, "base64"), ratio, fmt), mime };
    } catch (e: any) {
      const msg = `Falha na geração de imagem (OpenAI): ${String(e?.message || e).slice(0, 120)}`;
      throw new Error(kieErr ? `${msg} | Kie: ${String(kieErr?.message || "").slice(0, 80)}` : msg);
    }
  }

  throw new Error("Geração de imagem requer KIE_API_KEY ou OPENAI_API_KEY.");
}

/** Referência em data URL ou URL pública → buffer para a OpenAI. */
async function referenceBuffer(ref?: string): Promise<{ buffer: Buffer; mime: string; ext: string } | null> {
  if (!ref) return null;
  const parsed = parseDataUrl(ref);
  if (parsed) return parsed;
  if (/^https?:\/\//i.test(ref)) {
    const r = await fetch(ref);
    if (!r.ok) return null;
    const mime = (r.headers.get("content-type") || "image/png").split(";")[0];
    return { buffer: Buffer.from(await r.arrayBuffer()), mime, ext: mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png" };
  }
  return null;
}

async function cropToAspect(buf: Buffer, ratio: number, fmt: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const img = sharp(buf);
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height || Math.abs(width / height - ratio) < 0.02) return buf;
  let w = width, h = height;
  if (width / height > ratio) w = Math.round(height * ratio); else h = Math.round(width / ratio);
  const out = img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h });
  return fmt === "jpeg" ? out.jpeg({ quality: 92 }).toBuffer() : fmt === "webp" ? out.webp({ quality: 92 }).toBuffer() : out.png().toBuffer();
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
const ESTILO_CRIATIVO: Record<string, string> = {
  minimalista: "Estilo MINIMALISTA: fundo limpo de cor sólida ou gradiente suave, poucos elementos, muito espaço vazio, tipografia sans-serif fina e elegante.",
  "fotográfico": "Estilo FOTOGRÁFICO: foto realista do produto em ambiente real, iluminação de estúdio, profundidade de campo, aparência de campanha publicitária.",
  fotografico: "Estilo FOTOGRÁFICO: foto realista do produto em ambiente real, iluminação de estúdio, profundidade de campo, aparência de campanha publicitária.",
  moderno: "Estilo MODERNO: composição dinâmica, formas geométricas, gradientes, tipografia bold, visual atual de redes sociais.",
  elegante: "Estilo ELEGANTE / PREMIUM: tons sóbrios, contraste refinado, tipografia serifada sofisticada, acabamento de marca de luxo.",
  vibrante: "Estilo VIBRANTE: cores saturadas e alegres, alto contraste, elementos gráficos chamativos, energia alta.",
};
// Estrutura padrão de cada tipo de criativo. Cada objetivo tem um "jeitão" próprio de anúncio de Instagram.
const OBJETIVO_CRIATIVO: Record<string, string> = {
  "Vender um produto":
    "TIPO DE CRIATIVO: ANÚNCIO DE VENDA DIRETA. Estrutura obrigatória: o PRODUTO é o herói, grande e muito bem iluminado, ocupando boa parte da imagem; título curto de desejo/benefício; se houver preço ou condição, destaque em selo ou etiqueta; botão de compra bem visível na parte de baixo. Sensação: desejo imediato, \"eu quero isso agora\".",
  "Divulgar promoção":
    "TIPO DE CRIATIVO: PROMOÇÃO / OFERTA DE INSTAGRAM, com cara de liquidação de verdade. Estrutura obrigatória: o DESCONTO é o maior elemento da peça (ex.: número gigante \"50% OFF\" ou preço riscado + preço novo) dentro de um selo, etiqueta, faixa diagonal ou explosão; cores quentes e de alto contraste (vermelho, amarelo, laranja ou as cores da marca bem saturadas); urgência transmitida pelo VISUAL (raios, faixas diagonais, explosões, setas, brilho) — NÃO escreva frases de urgência ou escassez (\"só hoje\", \"últimas unidades\", prazos) que o cliente não informou, porque podem não ser verdade; produto visível ao lado do desconto; botão de compra chamativo. Energia de Black Friday/queima de estoque — nada discreto.",
  "Lançamento":
    "TIPO DE CRIATIVO: LANÇAMENTO / NOVIDADE. Estrutura obrigatória: selo ou faixa \"NOVO\" / \"LANÇAMENTO\" bem visível; produto revelado de forma dramática (luz de destaque, brilho, fundo escuro ou gradiente premium, efeito de revelação); título que gera curiosidade e exclusividade; sensação de evento e de \"chegou\". Visual premium e impactante.",
  "Gerar leads":
    "TIPO DE CRIATIVO: CAPTAÇÃO DE LEADS (isca gratuita). Estrutura obrigatória: deixe claro o que a pessoa GANHA de graça (e-book, aula, consultoria, diagnóstico, cupom), de preferência mostrando o material (mockup de e-book/celular/tela); palavra \"GRÁTIS\" ou \"GRATUITO\" em destaque; benefício principal em uma linha; botão de ação do tipo \"Quero receber\" / \"Baixar agora\". Sensação: confiável, útil e sem risco.",
  "Reconhecimento de marca":
    "TIPO DE CRIATIVO: BRANDING / RECONHECIMENTO DE MARCA. Estrutura obrigatória: foco no estilo de vida e na sensação que a marca transmite, não no preço; composição limpa e sofisticada, muito respiro; poucas palavras (uma frase de impacto ou slogan); fotografia aspiracional com pessoas ou ambiente; nada de selos de desconto. Sensação: memorável, bonito, de marca grande.",
  "Tráfego para o site":
    "TIPO DE CRIATIVO: TRÁFEGO / CLIQUE PARA O SITE. Estrutura obrigatória: título que desperta curiosidade ou promete uma informação útil (\"Descubra…\", \"Veja como…\"); o produto bem apresentado; uma seta ou indicação sutil de \"clique\"; chamada clara do tipo \"Saiba mais\" / \"Acesse o site\" em botão destacado. Não desenhe celular, tela ou aplicativo a menos que o produto SEJA um aplicativo. Sensação: \"preciso clicar para ver\".",
};
// Sem objetivo escolhido: criativo de venda, que é o caso mais comum.
const OBJETIVO_PADRAO = OBJETIVO_CRIATIVO["Vender um produto"];

// Zonas seguras do Instagram/Facebook por formato (onde a interface do app cobre a imagem).
export function safeZone(aspect?: string): string {
  if (aspect === "9:16") return "ZONA SEGURA (Stories/Reels 9:16): NADA importante (textos, produto, botão) nos 14% de cima nem nos 20% de baixo da imagem — ali ficam o perfil e os botões do Instagram. Margem lateral mínima de 6%. Concentre tudo na faixa central.";
  if (aspect === "16:9") return "ZONA SEGURA (16:9): margem mínima de 5% em todas as bordas; título no terço superior ou à esquerda, produto bem enquadrado sem encostar nas bordas.";
  if (aspect === "4:5") return "ZONA SEGURA (Feed 4:5): margem mínima de 6% em todas as bordas; nada de texto encostado nos cantos; o botão fica acima dos 8% inferiores.";
  return "ZONA SEGURA (Feed 1:1): margem mínima de 6% em todas as bordas; nada de texto ou produto cortado ou encostado nos cantos.";
}

// Produto digital aparece como produto (capa 3D, mockup), não como um app inventado.
const REGRAS_PRODUTO = "Mostre o produto de forma fiel ao que ele é: e-book/livro digital como capa de livro em 3D (ou tablet com a capa), curso como certificado/aulas, serviço com pessoas ou resultado. NUNCA invente um aplicativo, interface ou tela de celular que não existe.";

// Saúde, crianças, deficiência, finanças pessoais: linguagem respeitosa e dentro das regras da Meta.
const REGRAS_SENSIVEL = "TEMA SENSÍVEL: use linguagem respeitosa, acolhedora e informativa. NÃO prometa cura, transformação ou resultado garantido; não trate condição de saúde ou deficiência como problema a ser corrigido; não aponte características pessoais do leitor (\"seu filho tem…\", \"você está acima do peso\"). Prefira títulos de apoio e informação (ex.: \"Guia prático para pais\", \"Entenda e acolha\"). Imagens com pessoas reais e diversas em clima positivo e acolhedor.";
const SENSIVEL = /(autis|tdah|tea|defici[eê]n|s[ií]ndrome|doen[çc]a|sa[uú]de mental|depress|ansiedad|diabet|c[aâ]ncer|emagrec|dieta|obesi|gravidez|gestant|beb[eê]|crian[çc]|filh[oa]s?|terapia|tratamento|cura|d[ií]vida|cr[eé]dito|empr[eé]stimo)/i;
export const temaSensivel = (txt: string) => SENSIVEL.test(txt || "");

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
  aspect?: string;
}): string {
  const lang = langName(opts.idioma);
  const estilo = ESTILO_CRIATIVO[(opts.estilo || "").toLowerCase()] || (opts.estilo ? `Estilo visual: ${opts.estilo}.` : ESTILO_CRIATIVO.moderno);
  const objetivo = OBJETIVO_CRIATIVO[opts.objetivo || ""] || (opts.objetivo ? `Objetivo: ${opts.objetivo}.` : OBJETIVO_PADRAO);

  // Textos que vão estampados: exatamente estes, nada além.
  const textos: string[] = [];
  if (opts.headline) textos.push(`TÍTULO (maior destaque): "${opts.headline}"`);
  if (opts.texto) textos.push(`TEXTO DE APOIO (menor que o título): "${opts.texto}"`);
  if (opts.cta) textos.push(`BOTÃO de chamada para ação: "${opts.cta}"`);

  const partes = [
    `Crie um criativo de anúncio para redes sociais, com qualidade de agência de publicidade, para: ${opts.produto}.`,
    REGRAS_PRODUTO,
    temaSensivel(`${opts.produto} ${opts.publico || ""} ${opts.observacoes || ""}`) ? REGRAS_SENSIVEL : "",
    opts.publico ? `Público-alvo: ${opts.publico} — a imagem precisa falar com essas pessoas.` : "",
    objetivo,
    "Siga a ESTRUTURA DO TIPO DE CRIATIVO acima à risca — ela é a prioridade da composição. O estilo visual abaixo só define a estética.",
    estilo,
    opts.cores?.length
      ? `PALETA OBRIGATÓRIA (cores da marca): ${opts.cores.join(", ")}. Use essas cores como dominantes no fundo, nos elementos gráficos e no botão.`
      : "",
    opts.temReferencia
      ? "A imagem enviada é a REFERÊNCIA: mantenha o produto exatamente como aparece nela (forma, cor, rótulo e detalhes) e use-a como guia de estilo."
      : "",
    textos.length
      ? `TEXTOS NA IMAGEM — escreva exatamente estes, em ${lang}, com ortografia e acentuação corretas, perfeitamente legíveis, e NÃO adicione nenhum outro texto (no máximo o percentual de desconto calculado a partir dos preços informados): ${textos.join(" | ")}.`
      : `Crie um título curto e chamativo (até 5 palavras) em ${lang}, com ortografia e acentuação corretas, e não adicione outros textos.`,
    opts.observacoes ? `Instruções extras do cliente (siga à risca): ${opts.observacoes}.` : "",
    safeZone(opts.aspect),
    "Hierarquia visual clara: produto em destaque, título fácil de ler no celular, respiro nas margens (nada colado na borda). Sem marcas d'água, sem logotipos inventados.",
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
  return llmJson(QUIZ_GEN_SYSTEM, `Tema do funil: ${prompt}`, 0.8);
}

// ============================================================
// Geração de PÁGINA (pre-sell / landing) — 2 modos: blocos e HTML (vibe code)
// Fallback OpenAI → Gemini para maximizar disponibilidade.
// ============================================================

// Fornecedores de texto em cadeia: se um falhar (chave inválida, cota, fora do ar), tenta o próximo.
// Uma chave recusada (401/403) fica "de castigo" por 10 min para não atrasar toda chamada.
const providerDown: Record<string, number> = {};
const usable = (name: string, key: string) => !!key && (providerDown[name] || 0) < Date.now();
function markDown(name: string, e: any) {
  const st = e?.status ?? e?.response?.status;
  if (st === 401 || st === 403 || st === 429) providerDown[name] = Date.now() + 10 * 60_000;
  logger.warn(`[LLM] ${name} falhou (${st || "erro"}): ${String(e?.message || e).slice(0, 120)}`);
}
const parseJson = (t: string) => JSON.parse((t || "{}").replace(/```json|```/g, "").trim());

async function llmChain<T>(steps: { name: string; key: string; run: () => Promise<T> }[]): Promise<T> {
  let last: any;
  for (const st of steps) {
    if (!usable(st.name, st.key)) continue;
    try { return await st.run(); } catch (e) { last = e; markDown(st.name, e); }
  }
  throw new Error(last ? `IA de texto indisponível: ${String(last?.message || last).slice(0, 140)}` : "Nenhuma chave de IA configurada (OPENAI_API_KEY, GEMINI_API_KEY ou KIE_API_KEY)");
}

export async function llmJson(system: string, user: string, temperature = 0.8): Promise<any> {
  return (await llmJsonWithUsage(system, user, temperature)).data;
}

// Variante de llmJson que também devolve o uso de tokens (p/ logTokenUsage nos call sites).
export async function llmJsonWithUsage(
  system: string,
  user: string,
  temperature = 0.8,
): Promise<{ data: any; model: string; promptTokens: number; completionTokens: number }> {
  return llmChain([
    {
      name: "openai", key: OPENAI_KEY, run: async () => {
        const model = process.env.OPENAI_COPY_MODEL || "gpt-4o";
        const res = await openai().chat.completions.create({
          model, temperature, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        });
        return { data: parseJson(res.choices[0]?.message?.content || "{}"), model, promptTokens: res.usage?.prompt_tokens || 0, completionTokens: res.usage?.completion_tokens || 0 };
      },
    },
    {
      name: "gemini", key: GEMINI_KEY, run: async () => {
        const model = process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash";
        const res = await gemini().models.generateContent({ model, contents: `${system}

${user}`, config: { responseMimeType: "application/json", temperature } as any });
        const usage = (res as any).usageMetadata;
        return { data: parseJson((res as any).text || "{}"), model, promptTokens: usage?.promptTokenCount || 0, completionTokens: usage?.candidatesTokenCount || 0 };
      },
    },
    {
      name: "kie", key: kie.kieKey(), run: async () => ({ data: await kie.kieChat(system, user, { json: true, temperature }), model: "kie", promptTokens: 0, completionTokens: 0 }),
    },
  ]);
}

export async function llmText(system: string, user: string, temperature = 0.7): Promise<string> {
  return llmChain([
    {
      name: "openai", key: OPENAI_KEY, run: async () => {
        const res = await openai().chat.completions.create({ model: process.env.OPENAI_COPY_MODEL || "gpt-4o", temperature, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
        return res.choices[0]?.message?.content || "";
      },
    },
    {
      name: "gemini", key: GEMINI_KEY, run: async () => {
        const res = await gemini().models.generateContent({ model: process.env.GEMINI_COPY_MODEL || "gemini-2.5-flash", contents: `${system}

${user}`, config: { temperature } as any });
        return (res as any).text || "";
      },
    },
    { name: "kie", key: kie.kieKey(), run: () => kie.kieChat(system, user, { temperature }) },
  ]);
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
  // ElevenLabs direto primeiro: todas as vozes da conta (inclusive clonadas). Kie como reserva.
  if (ELEVENLABS_KEY) {
    try { return await elevenNarration(params); }
    catch (e: any) { if (!kie.kieReady()) throw e; logger.warn(`[TTS] ElevenLabs falhou, usando Kie: ${e?.message}`); }
  }
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
  // Sem ElevenLabs direto, só as vozes da lista da Kie funcionam na narração.
  if (!ELEVENLABS_KEY && kie.kieReady()) {
    return { voices: kie.KIE_VOICES.map((v) => ({ voiceId: v.voiceId, name: v.name, category: "premade", gender: v.gender, tag: v.tag, previewUrl: kie.kieVoicePreview(v.voiceId) })) };
  }
  if (!ELEVENLABS_KEY) return { voices: [] };
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": ELEVENLABS_KEY } });
    if (!r.ok) return { voices: [] };
    const j: any = await r.json();
    return {
      voices: (j.voices || []).map((v: any) => ({
        voiceId: v.voice_id, name: v.name, category: v.category, previewUrl: v.preview_url,
        // Gênero e descrição curta: a página de Narração filtra por Feminina/Masculina.
        gender: v.labels?.gender, tag: [v.labels?.descriptive || v.labels?.description, v.labels?.use_case].filter(Boolean).join(", ").replace(/_/g, " "),
      })),
    };
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
    let audio = params.audioUrl || null;
    if (!audio && ELEVENLABS_KEY) {
      try {
        const a = await elevenNarration({ text: params.text || "", voice: params.voice } as GenerateTTSParams);
        audio = await kie.kieFileUrl(a.buffer, { mime: a.mime, folder: "avatar", name: `fala-${Date.now()}.mp3` });
      } catch (e: any) { logger.warn(`[Avatar] ElevenLabs falhou, usando Kie: ${e?.message}`); }
    }
    if (!audio) audio = await narrationUrl({ text: params.text || "", voice: params.voice } as GenerateTTSParams);
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
  /** Modo simples: tudo o que a pessoa escreveu com as próprias palavras. */
  descricao?: string;
  produto: string; objetivo?: string; publico?: string; oferta?: string; beneficios?: string;
  tom?: string; canal?: string; cta?: string; tamanho?: string; observacoes?: string; idioma?: string;
}

const TAMANHO_LABEL: Record<string, string> = { curto: "curto (2 a 3 frases)", medio: "médio (1 parágrafo de 4 a 6 frases)", longo: "longo (2 a 3 parágrafos)" };

export async function generateCopyKit(p: CopyKitParams): Promise<Record<string, any>> {
  const canal = CANAIS_COPY[p.canal || ""] ? (p.canal as string) : "social";
  const c = CANAIS_COPY[canal];
  const tamanho = canal === "landing" ? "" : `Tamanho: ${TAMANHO_LABEL[p.tamanho || ""] || TAMANHO_LABEL.curto}.`;
  const user = `Escreva a copy para: ${c.nome}.
${p.descricao ? `- O que o cliente precisa (nas palavras dele; extraia daqui produto, público, oferta e objetivo): ${p.descricao}` : ""}
${p.produto ? `- Produto/serviço: ${p.produto}` : ""}
${p.objetivo ? `- Objetivo: ${p.objetivo}` : ""}
${p.publico ? `- Público-alvo: ${p.publico}` : ""}
${p.oferta ? `- Oferta: ${p.oferta}` : ""}
${p.beneficios ? `- Benefícios/diferenciais: ${p.beneficios}` : ""}
${p.tom ? `- Tom de voz: ${p.tom}` : ""}
${p.cta ? `- Chamada para ação desejada: ${p.cta}` : ""}
${p.observacoes ? `- Observações: ${p.observacoes}` : ""}
Regras do canal: ${c.regras}
${tamanho}
${temaSensivel(`${p.descricao || ""} ${p.produto} ${p.publico || ""}`) ? "TEMA SENSÍVEL (saúde, crianças, deficiência ou finanças): linguagem respeitosa e acolhedora; não prometa cura, transformação ou resultado garantido; não aponte características pessoais do leitor; siga as políticas de anúncios da Meta. " : ""}NUNCA invente depoimentos, números de clientes, prêmios, prazos ou garantias que o cliente não informou — onde precisar, use um marcador entre colchetes como [depoimento de cliente] ou [prazo da garantia].
Escreva TODO o conteúdo no idioma: ${langName(p.idioma)}.
Responda SOMENTE com JSON neste formato: ${c.formato}`;
  let j: any;
  if (kie.kieReady()) {
    try { j = await kie.kieChat(COPY_SYSTEM, user, { json: true, temperature: 0.85 }); }
    catch (e) { if (!OPENAI_KEY && !GEMINI_KEY) throw e; }
  }
  if (!j) j = await llmJson(COPY_SYSTEM, user, 0.85);
  return { canal, ...clean(j) };
}

/** Remove espaços sobrando em todo o JSON (strings, listas e objetos). */
function clean(v: any): any {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(clean).filter((x) => x !== "" && x != null);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
  return v;
}

const CANAIS_COPY: Record<string, { nome: string; regras: string; formato: string }> = {
  social: {
    nome: "legenda de post para redes sociais (Instagram/Facebook/TikTok)",
    regras: "A primeira linha é um GANCHO que aparece antes do \"…mais\" e faz parar o scroll. Parágrafos curtos, quebras de linha, emojis com moderação, chamada para ação clara no fim (comentar, salvar, clicar no link da bio). 5 a 10 hashtags relevantes.",
    formato: '{"gancho":"primeira linha","legenda":"resto da legenda (sem o gancho e sem as hashtags)","cta":"chamada final","hashtags":["#tag"],"variacoes":["3 ganchos alternativos"]}',
  },
  meta: {
    nome: "anúncio de Meta Ads (Facebook/Instagram)",
    regras: "Texto principal: as 2 primeiras linhas precisam vender sozinhas (o resto fica escondido). Título: no máximo 40 caracteres. Descrição: no máximo 30 caracteres. Botão: escolha UM dos botões oficiais da Meta: Saiba mais, Comprar agora, Cadastre-se, Enviar mensagem, Baixar, Reservar agora, Obter oferta. Evite promessas proibidas pelas políticas da Meta (resultados garantidos, atributos pessoais do tipo \"você que está acima do peso\").",
    formato: '{"texto_principal":"...","titulo":"até 40 caracteres","descricao":"até 30 caracteres","botao":"Saiba mais","variacoes":[{"texto_principal":"...","titulo":"..."}, {"texto_principal":"...","titulo":"..."}]}',
  },
  whatsapp: {
    nome: "mensagem de WhatsApp (lista de transmissão / atendimento)",
    regras: "Curta e direta, como uma pessoa falando. Use *negrito* do WhatsApp nos pontos-chave e emojis com moderação. No máximo 4 parágrafos curtos. Termine com uma pergunta ou chamada que gere resposta.",
    formato: '{"mensagem":"...","variacoes":["2 versões alternativas, ainda mais curtas"]}',
  },
  landing: {
    nome: "landing page de vendas COMPLETA (copy longa, estruturada em seções)",
    regras: "Copy longa e persuasiva, seção por seção, seguindo a jornada: atenção → problema → solução → benefícios → como funciona → oferta → garantia → objeções (FAQ) → chamada final. Títulos fortes em cada seção. 4 benefícios, 3 passos, 4 perguntas frequentes.",
    formato: '{"hero":{"titulo":"...","subtitulo":"...","botao":"..."},"problema":{"titulo":"...","texto":"..."},"solucao":{"titulo":"...","texto":"..."},"beneficios":[{"titulo":"...","texto":"..."}],"como_funciona":[{"titulo":"...","texto":"..."}],"oferta":{"titulo":"...","texto":"...","preco":"se informado, senão vazio","botao":"..."},"garantia":{"titulo":"...","texto":"..."},"faq":[{"pergunta":"...","resposta":"..."}],"cta_final":{"titulo":"...","texto":"...","botao":"..."}}',
  },
  email: {
    nome: "e-mail de vendas/marketing",
    regras: "Assunto curto e curioso (até 50 caracteres) e pré-cabeçalho que complementa o assunto. Corpo em parágrafos curtos, conversando com a pessoa pelo nome ({{nome}}), uma única chamada para ação. Termine com um P.S. que reforça a oferta ou a urgência real informada.",
    formato: '{"assunto":"...","preheader":"...","corpo":"...","botao":"...","ps":"...","variacoes_assunto":["3 assuntos alternativos"]}',
  },
};

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

// ---------- Carrossel: roteiro + slides com o mesmo visual ----------

export interface CarouselParams {
  tema: string;
  produto?: string;
  publico?: string;
  objetivo?: string;
  estilo?: string;
  cores?: string[];
  cta?: string;
  observacoes?: string;
  slides: number;
  aspect: string;
  idioma?: string;
  referencia?: string;
}

export interface CarouselSlide { titulo: string; texto: string; url?: string; erro?: string }

/** A IA escreve o roteiro: slide 1 = gancho, meio = conteúdo, último = chamada para ação. */
export async function planCarousel(p: CarouselParams): Promise<CarouselSlide[]> {
  const n = Math.max(3, Math.min(10, p.slides));
  const system = "Você é um estrategista de conteúdo e copywriter de redes sociais especializado em carrosséis que prendem atenção e convertem.";
  const user = `Crie o roteiro de um carrossel de ${n} slides para Instagram.
- Tema: ${p.tema}
${p.produto ? `- Produto/marca: ${p.produto}` : ""}
${p.publico ? `- Público-alvo: ${p.publico}` : ""}
${p.objetivo ? `- Objetivo: ${p.objetivo}` : ""}
${p.cta ? `- Chamada final desejada: ${p.cta}` : ""}
${p.observacoes ? `- Observações: ${p.observacoes}` : ""}
Regras:
- Slide 1 é a CAPA: um GANCHO forte que faz a pessoa arrastar.
- Os slides 2 a ${n - 1} entregam o conteúdo: exatamente ${n - 2} itens, 1 ideia por slide, numerados quando for lista.
- O slide ${n} é SÓ a chamada para ação (não coloque conteúdo novo nele).
- Se a capa prometer um número ("5 erros", "3 dicas"...), esse número TEM que ser ${n - 2}: ajuste a promessa da capa para bater com os slides de conteúdo.
Títulos com no máximo 7 palavras, textos com no máximo 22 palavras (precisam caber legíveis numa imagem). Idioma: ${langName(p.idioma)}.
Responda SOMENTE com JSON: {"slides":[{"titulo":"...","texto":"..."}]} com exatamente ${n} itens.`;
  const j = kie.kieReady() ? await kie.kieChat(system, user, { json: true, temperature: 0.8 }) : await llmJson(system, user, 0.8);
  const slides = (Array.isArray(j?.slides) ? j.slides : [])
    .map((s: any) => ({ titulo: String(s?.titulo || "").trim(), texto: String(s?.texto || "").trim() }))
    .filter((s: CarouselSlide) => s.titulo || s.texto)
    .slice(0, n);
  if (slides.length < 2) throw new Error("A IA não conseguiu montar o roteiro do carrossel. Tente de novo.");
  return slides;
}

export function buildCarouselSlidePrompt(p: CarouselParams, s: CarouselSlide, i: number, total: number, temBase: boolean): string {
  const lang = langName(p.idioma);
  const estilo = ESTILO_CRIATIVO[(p.estilo || "").toLowerCase()] || (p.estilo ? `Estilo visual: ${p.estilo}.` : ESTILO_CRIATIVO.moderno);
  const papel = i === 0 ? "CAPA do carrossel (gancho, título bem grande)" : i === total - 1 ? "ÚLTIMO slide (chamada para ação, com botão)" : `slide ${i + 1} de ${total} (conteúdo)`;
  return [
    `Slide de carrossel de Instagram — ${papel}. Tema: ${p.tema}.${p.produto ? ` Produto/marca: ${p.produto}.` : ""}`,
    temBase
      ? "A imagem enviada é a CAPA deste mesmo carrossel. Mantenha a MESMA identidade visual: paleta de cores, tipografia, estilo gráfico, margens e posição do título e do texto. MAS crie uma imagem/ilustração NOVA que represente o assunto deste slide — não repita a mesma foto, pessoa ou cena da capa."
      : estilo,
    p.cores?.length ? `PALETA OBRIGATÓRIA: ${p.cores.join(", ")}.` : "",
    `TEXTOS NA IMAGEM — escreva exatamente estes, em ${lang}, com ortografia e acentuação corretas, legíveis no celular, e NÃO adicione nenhum outro texto: TÍTULO: "${s.titulo}"${s.texto ? ` | TEXTO: "${s.texto}"` : ""}${i === total - 1 && p.cta ? ` | BOTÃO: "${p.cta}"` : ""}.`,
    `Mostre um pequeno indicador "${i + 1}/${total}" discreto no canto.`,
    i === 0 && !temBase ? "Inclua uma seta ou sinal sutil indicando para arrastar para o lado." : "",
    p.observacoes ? `Instruções extras do cliente (siga à risca): ${p.observacoes}.` : "",
    safeZone(p.aspect),
    "Respiro nas margens, hierarquia clara, nada colado na borda. Sem marcas d'água.",
  ].filter(Boolean).join(" ");
}
