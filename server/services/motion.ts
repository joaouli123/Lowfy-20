import * as kie from "./kie";
import { langName, llmJson } from "./aiStudio";
import { logger } from "../utils/logger";

/**
 * Motion — vídeo de motion graphics narrado.
 * 1) roteiro em cenas  2) dublagem com o tempo de cada palavra  3) o Claude escreve a
 * animação em HTML/JS como função do tempo (renderFrame(t)), sincronizada com a fala.
 * A legenda é desenhada pelo player do Lowfy (não pelo Claude), para sair sempre certa.
 */

export interface MotionScene { texto: string; visual: string; start?: number; end?: number }
export interface MotionWord { w: string; start: number; end: number }

const FORMATOS: Record<string, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
};
export const motionSize = (f: string) => FORMATOS[f] || FORMATOS["9:16"];

// ~2,6 palavras por segundo numa narração de redes sociais.
const palavrasPara = (seg: number) => Math.round(seg * 2.6);

export async function motionScript(p: { ideia: string; duracao: number; idioma?: string; anterior?: MotionScene[] }): Promise<MotionScene[]> {
  const seg = Math.max(10, Math.min(90, p.duracao || 30));
  const cenas = seg <= 15 ? 3 : seg <= 30 ? 5 : 7;
  const system = "Você é roteirista de vídeos curtos virais para Instagram e TikTok (motion graphics narrados). Escreve frases curtas, faladas, com gancho forte.";
  const user = `Crie o roteiro de um vídeo de motion graphics narrado de ~${seg} segundos (${palavrasPara(seg)} palavras no total, no máximo).
Ideia do cliente: ${p.ideia}
Divida em ${cenas} cenas. Cena 1 = gancho que prende nos 2 primeiros segundos; última cena = chamada para ação.
Para cada cena: "texto" = o que o narrador fala (frases curtas e naturais para ouvir), "visual" = o que aparece animado na tela (ícones, números grandes, palavras-chave, gráficos, transição) — concreto e visual.
${p.anterior?.length ? `O cliente NÃO gostou deste roteiro, faça outro com abordagem e gancho diferentes: ${p.anterior.map((c) => c.texto).join(" / ")}` : ""}
Idioma da narração: ${langName(p.idioma)}.
Responda SOMENTE com JSON: {"cenas":[{"texto":"...","visual":"..."}]}`;
  const j = kie.kieReady() ? await kie.kieChat(system, user, { json: true, temperature: 0.9 }) : await llmJson(system, user, 0.9);
  const out = (Array.isArray(j?.cenas) ? j.cenas : [])
    .map((c: any) => ({ texto: String(c?.texto || "").trim(), visual: String(c?.visual || "").trim() }))
    .filter((c: MotionScene) => c.texto);
  if (out.length < 2) throw new Error("A IA não conseguiu montar o roteiro. Tente de novo.");
  return out;
}

/** Dublagem: ElevenLabs com o tempo de cada caractere → palavras e janela de cada cena. */
export async function motionVoice(p: { cenas: MotionScene[]; voice?: string }): Promise<{ audio: Buffer; mime: string; words: MotionWord[]; scenes: MotionScene[]; duration: number }> {
  const key = process.env.ELEVENLABS_API_KEY || "";
  if (!key) throw new Error("A dublagem do Motion precisa da ElevenLabs configurada.");
  const textos = p.cenas.map((c) => c.texto.trim());
  const full = textos.join(" ");
  const voice = p.voice || process.env.ELEVENLABS_VOICE_ID || "nPczCjzI2devNBz1zQrb";
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: full, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.audio_base64) throw new Error(`ElevenLabs (${r.status}): ${JSON.stringify(j?.detail || j).slice(0, 160)}`);

  const chars: string[] = j.alignment?.characters || [];
  const st: number[] = j.alignment?.character_start_times_seconds || [];
  const en: number[] = j.alignment?.character_end_times_seconds || [];
  const duration = en.length ? en[en.length - 1] + 0.4 : 0;

  // Palavras a partir dos caracteres.
  const words: MotionWord[] = [];
  let cur = "", s0 = 0, e0 = 0;
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) words.push({ w: cur, start: s0, end: e0 }); cur = ""; return; }
    if (!cur) s0 = st[i];
    cur += ch; e0 = en[i];
  });
  if (cur) words.push({ w: cur, start: s0, end: e0 });

  // Janela de cada cena pelo índice do caractere onde ela começa no texto completo.
  let offset = 0;
  const scenes = p.cenas.map((c, k) => {
    const a = offset, b = offset + textos[k].length - 1;
    offset += textos[k].length + 1;
    return { ...c, start: st[a] ?? 0, end: en[Math.min(b, en.length - 1)] ?? duration };
  });
  scenes.forEach((s, k) => { if (k < scenes.length - 1) s.end = scenes[k + 1].start; else s.end = duration; });
  if (scenes[0]) scenes[0].start = 0;

  return { audio: Buffer.from(j.audio_base64, "base64"), mime: "audio/mpeg", words, scenes, duration };
}

const ESTILOS: Record<string, string> = {
  clean: "Clean e minimalista: fundo claro (off-white), tipografia sans-serif bold escura, um acento de cor, muito respiro, ícones de linha.",
  bold: "Bold de Reels: fundo escuro, palavras-chave GIGANTES, cores vibrantes, cortes rápidos, zoom e shake sutis, energia alta.",
  neon: "Neon/tech: fundo quase preto, brilhos neon (glow), gradientes ciano/magenta, grids e partículas, visual futurista.",
  corporativo: "Corporativo premium: azul-marinho e branco, gráficos e números animados, transições elegantes, aparência de apresentação de empresa.",
};

const MOTION_SYSTEM = `Você é um motion designer e desenvolvedor front-end de elite. Você cria vídeos de motion graphics como UMA página HTML que é renderizada quadro a quadro.

CONTRATO TÉCNICO (obrigatório):
- Entregue SOMENTE um documento HTML completo (<!doctype html> … </html>), sem explicações, sem markdown.
- Sem bibliotecas externas e sem imagens externas. Pode usar Google Fonts via <link>. Desenhe com HTML/CSS/SVG/Canvas, emojis ou SVG inline para ícones.
- O palco tem tamanho fixo em pixels (informado) — <body> com margin 0, overflow hidden, e um elemento raiz com exatamente essa largura/altura.
- Os dados chegam em window.MOTION = { duration, width, height, scenes:[{start,end,texto,visual}], palette:[cores] } (já definido antes do seu script).
- Exponha window.renderFrame = function(t) { … } que coloca a tela EXATAMENTE no estado do tempo t (segundos). Deve ser determinística e idempotente: chamar renderFrame(3.2) sempre dá o mesmo quadro, em qualquer ordem.
- PROIBIDO: setTimeout, setInterval, requestAnimationFrame, Date, Math.random sem semente, transições/animações CSS baseadas em tempo real. Toda animação = função de t (use easing manual: easeOutCubic etc. e progresso p = (t - start)/dur).
- Chame window.renderFrame(0) ao carregar.
- NÃO desenhe legenda/texto da narração: o sistema sobrepõe a legenda. Deixe livres os 24% inferiores do palco (sem texto importante ali).
- Cada cena ocupa a sua janela [start,end]; faça transições de entrada/saída nas bordas (~0,35s). Mostre palavras-chave curtas (não frases longas), números grandes, ícones, setas, gráficos que crescem, contadores.
- Movimento contínuo dentro de cada cena (nada parado): micro-animações, flutuação suave, elementos entrando em sequência (stagger).
- Visual de altíssimo nível, estilo dos motions virais do Instagram.`;

export async function motionAnimate(p: {
  scenes: MotionScene[]; duration: number; formato: string; estilo: string; cores?: string[]; idioma?: string;
  instrucao?: string; htmlAnterior?: string;
}): Promise<string> {
  const { w, h } = motionSize(p.formato);
  const cenas = p.scenes.map((s, i) => `Cena ${i + 1} [${(s.start ?? 0).toFixed(2)}s → ${(s.end ?? 0).toFixed(2)}s]\n  Fala: "${s.texto}"\n  Visual pedido: ${s.visual}`).join("\n");
  const base = `Palco: ${w}x${h}px (${p.formato}). Duração total: ${p.duration.toFixed(2)}s.
Estilo: ${ESTILOS[p.estilo] || ESTILOS.bold}
${p.cores?.length ? `Paleta obrigatória da marca: ${p.cores.join(", ")}.` : ""}
Textos na tela em ${langName(p.idioma)}, com acentuação correta.

Cenas (sincronize cada visual com a janela de tempo dela):
${cenas}`;
  const user = p.htmlAnterior && p.instrucao
    ? `${base}\n\nAqui está a animação atual:\n${p.htmlAnterior}\n\nO cliente pediu esta mudança: "${p.instrucao}". Devolva o HTML COMPLETO atualizado, mantendo o contrato técnico e o que não foi pedido para mudar.`
    : `${base}\n\nCrie a animação completa.`;
  const text = await claude(MOTION_SYSTEM, user, 16000);
  const html = extractHtml(text);
  if (!/renderFrame/.test(html)) {
    logger.warn("[Motion] HTML sem renderFrame");
    throw new Error("A animação veio incompleta. Tente gerar de novo.");
  }
  return html;
}

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const i = raw.search(/<!doctype html|<html/i);
  const j = raw.toLowerCase().lastIndexOf("</html>");
  return i >= 0 ? raw.slice(i, j > i ? j + 7 : undefined) : raw;
}

/** Claude: API da Anthropic direto (ANTHROPIC_API_KEY) ou, sem ela, pela Kie. */
async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY || "";
  if (!key) return kie.kieClaude(system, user, { maxTokens });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MOTION_MODEL || "claude-opus-5-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(5 * 60_000),
  });
  const j: any = await r.json().catch(() => ({}));
  const text = Array.isArray(j?.content) ? j.content.map((c: any) => c?.text || "").join("") : "";
  if (!text) throw new Error(`Claude (Anthropic) ${r.status}: ${String(j?.error?.message || "sem resposta").slice(0, 160)}`);
  return text;
}
