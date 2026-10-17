import Anthropic from "@anthropic-ai/sdk";
import * as kie from "./kie";
import { langName, llmJson, kieFirst, visionJson } from "./aiStudio";
import { recordUsage } from "./usage";
import { ensureVoice, paraFala, conferirPronuncia, type Checagem } from "./motionAudio";
import { withKit, withoutKit, kitDoc, kitExample } from "./motionKit";
import { logger } from "../utils/logger";

/**
 * Motion — vídeo de motion graphics narrado, em 5 passos:
 * 1) briefing livre + anexos → 2) "Entendi assim" (resumo, dúvidas, pronúncias) →
 * 3) roteiro em cenas (texto da tela + fala) → 4) dublagem conferida por transcrição →
 * 5) o Claude dirige a animação usando o kit de motion (server/motion-kit), como função do tempo.
 */

export interface MotionScene { tela?: string; fala?: string; texto?: string; visual: string; anexo?: number | null; start?: number; end?: number }
export interface MotionWord { w: string; start: number; end: number }
export interface MotionAsset { url: string; tipo?: string; descricao?: string; legenda?: string }

const FORMATOS: Record<string, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
};
export const motionSize = (f: string) => FORMATOS[f] || FORMATOS["9:16"];

// ~2,6 palavras por segundo numa narração de redes sociais (medido nas referências: 2,5–2,7).
const palavrasPara = (seg: number) => Math.round(seg * 2.6);
const falaDe = (c: MotionScene) => String(c.fala ?? c.texto ?? "").trim();

// ---------------- 2) Entendi assim ----------------

export interface Entendimento {
  titulo: string;
  resumo: { produto: string; publico: string; oferta: string; diferenciais: string[]; contato: string; cta: string; tom: string };
  roteiroCliente: { tem: boolean; texto: string };
  perguntas: { id: string; pergunta: string; dica: string }[];
  pronuncias: { termo: string; fala: string }[];
  anexos: { tipo: string; descricao: string }[];
  cores: string[];
  estilo: "produto" | "premium";
}

const BRIEF_SYSTEM = `Você é diretor de criação de uma produtora de vídeos curtos (Reels/TikTok) de alto nível. Lê o briefing que o cliente escreveu com as palavras dele e os anexos (logo, prints, fotos) e devolve o entendimento organizado, para o cliente confirmar antes de qualquer criação.
Regras:
- Use SÓ o que o cliente disse ou o que aparece nos anexos. Nunca invente preço, número, prazo, garantia, contato ou depoimento.
- "perguntas": no máximo 3, só o que é ESSENCIAL e está faltando para um vídeo de venda (ex.: como o cliente quer ser contatado, preço/condição, o diferencial principal). Se já está claro, deixe vazio.
- "pronuncias": nomes de marca, siglas ou palavras estrangeiras que um locutor brasileiro pode ler errado, com a forma de falar em português (ex.: {"termo":"UXcode","fala":"iú éks code"}). Vazio se não houver.
- "roteiroCliente": se o cliente já escreveu um roteiro/texto para ser narrado, copie-o em "texto".
- "anexos": um item por imagem, na mesma ordem: tipo = logo | print_site | print_app | foto_produto | foto_pessoa | outro, e uma descrição curta do que aparece.
- "cores": cores da marca em hex, tiradas do logo/prints (máximo 2, a principal primeiro). Vazio se não houver anexos.
- "estilo": "produto" (claro, interfaces, serviços, SaaS, clínicas) ou "premium" (escuro e cinematográfico: cursos, lançamentos, infoprodutos, luxo).
Responda SOMENTE com JSON:
{"titulo":"nome curto do projeto","resumo":{"produto":"","publico":"","oferta":"","diferenciais":[""],"contato":"","cta":"","tom":""},"roteiroCliente":{"tem":false,"texto":""},"perguntas":[{"id":"p1","pergunta":"","dica":"exemplo de resposta"}],"pronuncias":[{"termo":"","fala":""}],"anexos":[{"tipo":"","descricao":""}],"cores":["#hex"],"estilo":"produto"}`;

export async function motionBrief(p: { texto: string; anexos: { img: string; legenda?: string }[]; duracao: number; formato: string; idioma?: string }): Promise<Entendimento> {
  const leg = p.anexos.map((a, i) => `Anexo ${i + 1}${a.legenda ? ` (o cliente disse: "${a.legenda}")` : ""}`).join("\n");
  const user = `Briefing do cliente (palavras dele):
"""${p.texto}"""
${p.anexos.length ? `\nAnexos enviados, na ordem:\n${leg}` : "\nSem anexos."}
Vídeo de ~${p.duracao}s no formato ${p.formato}. Idioma: ${langName(p.idioma)}.`;
  const j = await visionJson(BRIEF_SYSTEM, user, p.anexos.map((a) => a.img).filter(Boolean));
  const s = (v: any, n = 300) => String(v ?? "").trim().slice(0, n);
  const hex = (v: any) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : null);
  return {
    titulo: s(j?.titulo, 80) || "Meu vídeo",
    resumo: {
      produto: s(j?.resumo?.produto), publico: s(j?.resumo?.publico), oferta: s(j?.resumo?.oferta),
      diferenciais: (Array.isArray(j?.resumo?.diferenciais) ? j.resumo.diferenciais : []).map((x: any) => s(x, 160)).filter(Boolean).slice(0, 6),
      contato: s(j?.resumo?.contato), cta: s(j?.resumo?.cta), tom: s(j?.resumo?.tom, 120),
    },
    roteiroCliente: { tem: !!j?.roteiroCliente?.tem && !!s(j?.roteiroCliente?.texto, 4000), texto: s(j?.roteiroCliente?.texto, 4000) },
    perguntas: (Array.isArray(j?.perguntas) ? j.perguntas : []).map((q: any, i: number) => ({ id: s(q?.id, 20) || `p${i + 1}`, pergunta: s(q?.pergunta, 200), dica: s(q?.dica, 160) })).filter((q: any) => q.pergunta).slice(0, 3),
    pronuncias: (Array.isArray(j?.pronuncias) ? j.pronuncias : []).map((x: any) => ({ termo: s(x?.termo, 60), fala: s(x?.fala, 80) })).filter((x: any) => x.termo && x.fala).slice(0, 8),
    anexos: p.anexos.map((_, i) => ({ tipo: s(j?.anexos?.[i]?.tipo, 20) || "outro", descricao: s(j?.anexos?.[i]?.descricao, 200) })),
    cores: (Array.isArray(j?.cores) ? j.cores : []).map(hex).filter(Boolean).slice(0, 2) as string[],
    estilo: j?.estilo === "premium" ? "premium" : "produto",
  };
}

// ---------------- 3) Roteiro ----------------

export async function motionScript(p: {
  briefing: string; entendimento?: Partial<Entendimento>; respostas?: Record<string, string>; duracao: number; idioma?: string;
  modo?: "melhorar" | "exato"; anterior?: MotionScene[]; anexos?: { tipo?: string; descricao?: string }[];
}): Promise<MotionScene[]> {
  const seg = Math.max(10, Math.min(90, p.duracao || 30));
  const cenas = seg <= 15 ? 4 : seg <= 30 ? 6 : seg <= 45 ? 8 : 10;
  const e = p.entendimento || {};
  const r = e.resumo;
  const respostas = Object.entries(p.respostas || {}).filter(([, v]) => String(v || "").trim()).map(([k, v]) => `- ${(e.perguntas || []).find((q) => q.id === k)?.pergunta || k}: ${v}`).join("\n");
  const pron = (e.pronuncias || []).map((x) => `"${x.termo}" → fale "${x.fala}"`).join("; ");
  const anexos = (p.anexos || e.anexos || []).map((a, i) => `${i}: ${a.tipo || "imagem"} — ${a.descricao || ""}`).join("\n");
  const exato = p.modo === "exato" && e.roteiroCliente?.tem;

  const system = `Você é roteirista e diretor de motion graphics de vídeos curtos virais (Reels/TikTok) para marcas brasileiras, no nível das melhores produtoras.
Estrutura que prende e vende: GANCHO nos 2 primeiros segundos (uma dor ou pergunta direta) → agravar o problema com situações concretas → virada com a solução (a marca) → o que entrega/diferenciais → prova (números, anos, clientes — só se o cliente informou) → chamada final clara.
Para cada cena devolva:
- "tela": o texto curto que aparece GRANDE na tela (máx. 7 palavras), tirado da própria fala, com UMA palavra-chave marcada assim: *palavra*. Pode usar números e símbolos (R$ 150, 12x, +1.600).
- "fala": exatamente o que o locutor fala, natural e falado, frases curtas. NÚMEROS, VALORES, PORCENTAGENS E SÍMBOLOS SEMPRE POR EXTENSO (ex.: "cento e cinquenta reais por mês", "mil e seiscentos", "doze vezes", "trinta por cento"). Nada de abreviação, sigla soletrável ou emoji.
- "visual": a cena em 1–2 frases concretas para o animador, usando elementos realistas: janela de navegador com o site, iPhone, notebook, cartões de interface (listas, checks, gráficos, medidores), cursor clicando, carimbo, anotação à mão com seta, contador grande, etiquetas de preço, selo de garantia, conversa de WhatsApp, faixa de nichos rolando. Diga qual anexo usar quando fizer sentido ("usar anexo 0").
- "anexo": índice do anexo usado na cena ou null.
Nunca invente fatos (preço, número, prazo, garantia, depoimento) que não estejam no briefing.`;

  const user = `Briefing do cliente:
"""${p.briefing}"""
${r ? `\nEntendimento confirmado pelo cliente:\n- Produto: ${r.produto}\n- Público: ${r.publico}\n- Oferta: ${r.oferta}\n- Diferenciais: ${(r.diferenciais || []).join("; ")}\n- Contato: ${r.contato}\n- Chamada final: ${r.cta}\n- Tom: ${r.tom}` : ""}
${respostas ? `\nRespostas do cliente:\n${respostas}` : ""}
${pron ? `\nPronúncia obrigatória na "fala": ${pron}` : ""}
${anexos ? `\nAnexos disponíveis (índice: o que é):\n${anexos}` : ""}
${exato ? `\nO cliente quer o TEXTO DELE narrado do jeito que está (só ajuste números para extenso e aplique as pronúncias). Divida-o em cenas sem reescrever:\n"""${e.roteiroCliente!.texto}"""` : `\nVídeo de ~${seg} segundos: ${palavrasPara(seg)} palavras faladas no total (no máximo), em ${cenas} cenas.${e.roteiroCliente?.tem ? `\nO cliente sugeriu este texto, use como base e melhore:\n"""${e.roteiroCliente.texto}"""` : ""}`}
${p.anterior?.length ? `\nO cliente NÃO gostou deste roteiro; faça outro, com gancho e abordagem diferentes: ${p.anterior.map((c) => falaDe(c)).join(" / ")}` : ""}
Idioma: ${langName(p.idioma)}.
Responda SOMENTE com JSON: {"cenas":[{"tela":"...","fala":"...","visual":"...","anexo":null}]}`;

  const j = await (kieFirst() ? kie.kieChat(system, user, { json: true, temperature: 0.85 }).catch(() => llmJson(system, user, 0.85)) : llmJson(system, user, 0.85));
  const out: MotionScene[] = (Array.isArray(j?.cenas) ? j.cenas : [])
    .map((c: any) => ({
      tela: String(c?.tela || "").trim().slice(0, 120),
      fala: String(c?.fala || c?.texto || "").trim().slice(0, 600),
      visual: String(c?.visual || "").trim().slice(0, 600),
      anexo: Number.isInteger(c?.anexo) ? c.anexo : null,
    }))
    .filter((c: MotionScene) => c.fala);
  if (out.length < 2) throw new Error("A IA não conseguiu montar o roteiro. Tente de novo.");
  return out;
}

// ---------------- 4) Dublagem conferida ----------------

async function tts(voice: string, text: string, take: number) {
  const key = process.env.ELEVENLABS_API_KEY || "";
  const model = process.env.ELEVENLABS_MOTION_MODEL || "eleven_multilingual_v2";
  // 2ª tentativa: voz mais estável (menos "criativa"), que costuma acertar a leitura.
  const settings = take === 1
    ? { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
    : { stability: 0.65, similarity_boost: 0.85, style: 0.1, use_speaker_boost: true };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.audio_base64) throw new Error(`ElevenLabs (${r.status}): ${JSON.stringify(j?.detail || j).slice(0, 160)}`);
  recordUsage({ provider: "elevenlabs", model, kind: "tts", chars: text.length, meta: { voice, take } });
  return j;
}

/** Dublagem: ElevenLabs com o tempo de cada caractere → palavras e janela de cada cena; depois confere a pronúncia. */
export async function motionVoice(p: { cenas: MotionScene[]; voice?: string }): Promise<{ audio: Buffer; mime: string; words: MotionWord[]; scenes: MotionScene[]; duration: number; checagem: Checagem | null }> {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("A dublagem do Motion precisa da ElevenLabs configurada.");
  const textos = p.cenas.map((c) => paraFala(falaDe(c)));
  const full = textos.join(" ");
  const voice = p.voice || process.env.ELEVENLABS_VOICE_ID || "rpNe0HOx7heUulPiOEaG";
  await ensureVoice(voice);

  let j = await tts(voice, full, 1);
  let checagem = await conferirPronuncia(Buffer.from(j.audio_base64, "base64"), full);
  if (checagem && !checagem.ok) {
    logger.warn(`[Motion] pronúncia ${checagem.score} (faltou: ${checagem.faltando.join(", ")}); gravando de novo`);
    const j2 = await tts(voice, full, 2);
    const c2 = await conferirPronuncia(Buffer.from(j2.audio_base64, "base64"), full);
    if (c2 && c2.score >= checagem.score) { j = j2; checagem = c2; }
  }

  const chars: string[] = j.alignment?.characters || [];
  const st: number[] = j.alignment?.character_start_times_seconds || [];
  const en: number[] = j.alignment?.character_end_times_seconds || [];
  const duration = en.length ? en[en.length - 1] + 0.5 : 0;

  const words: MotionWord[] = [];
  let cur = "", s0 = 0, e0 = 0;
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) words.push({ w: cur, start: s0, end: e0 }); cur = ""; return; }
    if (!cur) s0 = st[i];
    cur += ch; e0 = en[i];
  });
  if (cur) words.push({ w: cur, start: s0, end: e0 });

  let offset = 0;
  const scenes = p.cenas.map((c, k) => {
    const a = offset, b = offset + textos[k].length - 1;
    offset += textos[k].length + 1;
    return { ...c, fala: textos[k], texto: textos[k], start: st[a] ?? 0, end: en[Math.min(b, en.length - 1)] ?? duration };
  });
  scenes.forEach((s, k) => { if (k < scenes.length - 1) s.end = scenes[k + 1].start; else s.end = duration; });
  if (scenes[0]) scenes[0].start = 0;

  return { audio: Buffer.from(j.audio_base64, "base64"), mime: "audio/mpeg", words, scenes, duration, checagem };
}

// ---------------- 5) Animação ----------------

const ESTILOS: Record<string, string> = {
  produto: `"produto" (claro): fundo cinza-claro com grade de pontos, tipografia Inter Tight escura, interfaces realistas em cartões brancos com sombra em camadas, cursor clicando, acento na cor da marca. Referência: vídeos de agência de tecnologia que mostram o produto funcionando.`,
  premium: `"premium" (escuro): fundo quase preto com brilho quente que respira, vinheta e granulado; tipografia enorme (k-h1/k-giant) com a palavra-chave em serifada itálica (_palavra_) na cor de destaque; botão "glow" com reflexo; etiquetas de preço; telas em perspectiva 3D. Referência: anúncios de curso/lançamento de alto padrão.`,
};
// estilos antigos → novos
const ESTILO_ALIAS: Record<string, string> = { bold: "premium", neon: "premium", clean: "produto", corporativo: "produto" };

function motionSystem() {
  return `Você é um motion designer sênior (nível After Effects / estúdio de Reels premium) que anima em HTML. Cria vídeos de motion graphics como UMA página HTML renderizada quadro a quadro, usando o KIT DE MOTION já carregado na página.

CONTRATO TÉCNICO (obrigatório):
- Entregue SOMENTE um documento HTML completo (<!doctype html> … </html>), sem explicações e sem markdown.
- NÃO inclua o kit (ele é injetado automaticamente). Sem bibliotecas externas, sem imagens externas (só os anexos via K.asset/K.img). Sem <link> de fontes (já carregadas).
- Os dados chegam em window.MOTION = { duration, width, height, scenes:[{start,end,tela,fala,visual,anexo}], words:[{w,start,end}], assets:[{url,tipo,descricao}], palette:[cores], theme }.
- Estrutura: <div id="stage"> com um <section class="k-scene" id="sN"> por cena. Monte o DOM e o conteúdo dos K.ui UMA vez no carregamento; exponha window.renderFrame = function(t){…} que deixa a tela EXATAMENTE no estado do tempo t (determinística: renderFrame(3.2) sempre dá o mesmo quadro, em qualquer ordem). Chame window.renderFrame(0) no fim do script.
- PROIBIDO: setTimeout, setInterval, requestAnimationFrame, Date, Math.random, animações/transições CSS por tempo real (@keyframes, transition). Todo movimento sai de t via K.
- No começo do script: K.theme(MOTION.theme || "produto", MOTION.palette); K.background(); e em todo renderFrame: K.backgroundFrame(t).
- Para cada cena: var c = K.scene(el, t, i); if (c.on) { … }. A manchete da cena é K.headline(h1, t, i) num <h1 class="k-headline"> (o texto vem de MOTION.scenes[i].tela, sincronizado com a voz) — o texto da narração É o design; não existe legenda separada.

DIREÇÃO DE ARTE (o que separa um motion profissional de "cara de IA"):
- Uma ideia por cena; hierarquia clara (manchete + composição principal). Siga À RISCA o layout e a área segura do FORMATO informado no pedido (9:16, 1:1 e 16:9 têm composições diferentes).
- NADA se sobrepõe a texto: manchete, números e legendas ficam em áreas próprias, separadas das telas/cartões (calcule as caixas pelo tamanho do palco). Peças decorativas podem se sobrepor só a outras peças, nunca a texto.
- Elementos realistas e com profundidade: telas (browser/phone/laptop) com K.tiltS + K.floatS, cartões .k-card com sombra, números grandes com K.count, cursor real clicando com K.cursor, checks com K.popS em sequência (stagger de 0,12–0,2s), carimbos com K.stampS, anotações à mão com seta desenhada.
- Movimento contínuo: nada fica parado — entradas com K.enterS (desfoque → nítido, ease outExpo), flutuação sutil, câmera lenta (K.cameraS) em cenas de impacto. Coreografe: entrada principal ~0,1–0,3s depois do começo da cena, detalhes depois, clímax sincronizado com a palavra-chave da fala (use os tempos de MOTION.words).
- Use os anexos do cliente (logo, prints) dentro das telas (K.ui.browser({asset:i}), K.ui.phone({asset:i}), K.img(i)) quando o roteiro indicar.
- Tipografia: no máximo 2 tamanhos por cena; números enormes (k-stat-value / k-giant) para provas; acentuação correta em ${"pt-BR"}.
- Proibido: emoji, cliparts, gradiente roxo genérico, cartões todos iguais centralizados, ícones quicando sem motivo, texto longo na tela, elementos fora do palco.

${kitDoc()}

EXEMPLO de animação bem feita com o kit, em 9:16 (estrutura e estilo a seguir; NÃO copie o conteúdo; em 1:1 e 16:9 reposicione tudo conforme o layout do formato):
${kitExample()}`;
}

// Layout e área segura de cada formato (o kit vem calibrado para 1080 de largura).
const LAYOUT: Record<string, string> = {
  "9:16": `9:16 vertical (1080x1920 — Reels, TikTok, Stories). Manchete no topo (.k-headline padrão, top ~9%). Composição principal em UMA coluna, entre 24% e 76% da altura. Deixe livres os 18% de baixo e ~10% da direita (botões e legenda do app). Peças grandes: navegador ~880px, iPhone ~420px.`,
  "1:1": `1:1 quadrado (1080x1080 — feed). Espaço vertical curto: manchete no topo (top ~7%, font-size ~60px via style), composição entre 24% e 92% da altura, margens laterais de 6%. Diminua as peças: navegador ~760px de largura e ~420px de altura, iPhone ~280px, números grandes até ~200px. Sem área de interface do app.`,
  "16:9": `16:9 horizontal (1920x1080 — YouTube, apresentações, anúncios em feed horizontal). Composição em DUAS COLUNAS: texto à esquerda (left 7%, largura ~40%, manchete com font-size ~84px via style, centralizada na vertical ou a partir de top 16%) e o visual à direita (right 6%, telas grandes: navegador ~920px, notebook ~980px, iPhone ~400px). Margens de 5%. NÃO empilhe tudo no centro nem use a manchete no topo ocupando a largura inteira. Números grandes podem ocupar a coluna da esquerda.`,
};

export async function motionAnimate(p: {
  scenes: MotionScene[]; duration: number; formato: string; estilo: string; cores?: string[]; idioma?: string;
  assets?: MotionAsset[]; instrucao?: string; htmlAnterior?: string;
}): Promise<string> {
  const { w, h } = motionSize(p.formato);
  const estilo = ESTILOS[p.estilo] ? p.estilo : ESTILO_ALIAS[p.estilo] || "produto";
  const cenas = p.scenes.map((s, i) => `Cena ${i} [${(s.start ?? 0).toFixed(2)}s → ${(s.end ?? 0).toFixed(2)}s]\n  Tela: "${s.tela || ""}"\n  Fala: "${falaDe(s)}"\n  Visual pedido: ${s.visual}${s.anexo != null ? `\n  Anexo: ${s.anexo}` : ""}`).join("\n");
  const anexos = (p.assets || []).map((a, i) => `${i}: ${a.tipo || "imagem"} — ${a.descricao || a.legenda || ""}`).join("\n");
  const base = `Palco: ${w}x${h}px (${p.formato}). Duração total: ${p.duration.toFixed(2)}s.
Layout do formato (obrigatório): ${LAYOUT[p.formato] || LAYOUT["9:16"]}
Tema: ${ESTILOS[estilo]} (MOTION.theme = "${estilo}")
${p.cores?.length ? `Cores da marca (MOTION.palette): ${p.cores.join(", ")}.` : ""}
${anexos ? `Anexos do cliente (MOTION.assets, por índice):\n${anexos}` : "Sem anexos: use telas genéricas realistas (K.ui.siteMock / appMock) com o nome e a cor da marca."}
Textos na tela em ${langName(p.idioma)}, com acentuação correta.

Cenas (sincronize cada visual com a janela de tempo e com as palavras faladas):
${cenas}`;
  const user = p.htmlAnterior && p.instrucao
    ? `${base}\n\nAnimação atual:\n${withoutKit(p.htmlAnterior)}\n\nO cliente pediu esta mudança: "${p.instrucao}". Devolva o HTML COMPLETO atualizado, mantendo o contrato técnico e tudo o que não foi pedido para mudar.`
    : `${base}\n\nCrie a animação completa.`;
  const text = await claude(motionSystem(), user, 32000);
  const html = withoutKit(extractHtml(text));
  if (!/renderFrame/.test(html)) {
    logger.warn("[Motion] HTML sem renderFrame");
    throw new Error("A animação veio incompleta. Tente gerar de novo.");
  }
  return withKit(html);
}

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const i = raw.search(/<!doctype html|<html/i);
  const j = raw.toLowerCase().lastIndexOf("</html>");
  return i >= 0 ? raw.slice(i, j > i ? j + 7 : undefined) : raw;
}

/**
 * Claude: SDK oficial da Anthropic (ANTHROPIC_API_KEY) ou, sem ela, pela Kie.
 * Opus 5.5 sempre raciocina antes de responder (não dá para desligar): o controle é o
 * effort. Com saída longa (HTML de 10-15k tokens) precisa de max_tokens alto e streaming,
 * senão o raciocínio consome o limite e o texto volta vazio. O system (kit + exemplo) é fixo
 * e vai em cache para baratear as próximas animações.
 */
let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Chave criada fora de um workspace exige o ID do workspace.
      defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
    });
  }
  return _anthropic;
}

async function claude(system: string, user: string, maxTokens: number): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return kie.kieClaude(system, user, { maxTokens });
  const stream = anthropic().beta.messages.stream({
    model: process.env.ANTHROPIC_MOTION_MODEL || "claude-opus-5-5",
    max_tokens: Math.max(maxTokens, 64000),
    output_config: { effort: process.env.ANTHROPIC_MOTION_EFFORT || "medium" },
    // Se o filtro de segurança recusar, a própria API refaz em outro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  } as any);
  const msg: any = await stream.finalMessage();
  const u = msg.usage || {};
  recordUsage({
    provider: "anthropic", model: msg.model || "claude-opus-5-5", kind: "text",
    // leitura de cache custa ~10% da entrada normal
    inputTokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1,
    outputTokens: u.output_tokens || 0,
  });
  if (msg.stop_reason === "refusal") throw new Error("O Claude recusou gerar esta animação. Ajuste o roteiro e tente de novo.");
  const text = (msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  if (!text) throw new Error(`Claude não devolveu a animação (motivo: ${msg.stop_reason}).`);
  if (msg.stop_reason === "max_tokens") logger.warn("[Motion] resposta cortada por max_tokens");
  return text;
}
