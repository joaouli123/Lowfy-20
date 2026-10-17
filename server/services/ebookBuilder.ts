import { llmJson, langName, generateAdImage } from "./aiStudio";
import { logger } from "../utils/logger";
import type { Ebook, EbookBlock, EbookPage } from "./ebookStudio";

/**
 * Criador de E-books do Estúdio (v2): briefing → sumário editável → conteúdo + ilustrações
 * → capa e diagramação. Cada tipo de livro tem estrutura e ilustração próprias:
 * guia/ensino, infantil ilustrado, infantil para colorir, receitas e workbook.
 * A capa é só a arte (sem texto): título e autor são tipografia do layout, sempre nítidos.
 */

export type EbookKind = "guia" | "infantil" | "colorir" | "receitas" | "workbook";

export interface EbookBrief {
  kind: EbookKind;
  tema: string;
  publico?: string;
  objetivo?: string;
  tom?: string;
  paginas: number;
  autor?: string;
  idioma?: string;
  estilo?: string;     // tema visual do layout (editorial, moderno, minimal, infantil)
  imagens?: boolean;   // ilustrações no miolo (guia/receitas/workbook)
}

export interface OutlineChapter { title: string; sections: { heading: string; brief: string }[] }
export interface EbookOutline { title: string; subtitle: string; chapters: OutlineChapter[] }

export interface BuildProgress { step: string; done: number; total: number }

const KIND_GUIDE: Record<EbookKind, { outline: string; chapter: string; illustration: string }> = {
  guia: {
    outline: "Livro de ensino/guia prático com progressão lógica (fundamentos → aplicação → avançado → próximos passos).",
    chapter: "Conteúdo real, denso e útil: explique, dê exemplos práticos, passo a passo e dicas. Use callout, list, quote e stats para dar ritmo visual.",
    illustration: "ilustração editorial moderna em estilo flat/semi-realista, limpa, sem texto",
  },
  receitas: {
    outline: "Livro de receitas: cada capítulo é uma categoria (ex.: entradas, pratos principais, sobremesas) e cada seção é uma receita.",
    chapter: "Para cada receita: um heading com o nome, um parágrafo curto de apresentação, stats com tempo/porções/dificuldade, list de ingredientes com quantidades e list de modo de preparo numerado. Callout com dica do chef.",
    illustration: "fotografia gastronômica profissional do prato, luz natural, fundo de mesa bonita, sem texto",
  },
  workbook: {
    outline: "Workbook/caderno de exercícios: cada capítulo ensina um conceito curto e traz exercícios práticos.",
    chapter: "Explique o conceito em poucos parágrafos e traga exercícios: lists com perguntas para responder, callouts 'Exercício' e 'Reflexão', e espaços indicados como '__________'.",
    illustration: "ilustração simples e amigável em estilo flat, cores suaves, sem texto",
  },
  infantil: {
    outline: "Livro infantil ilustrado: uma história com começo, meio e fim (ou um livro educativo infantil). Cada capítulo é uma parte da história e cada seção é UMA página ilustrada.",
    chapter: "Linguagem simples para crianças, frases curtas e acolhedoras. Cada página tem 2 a 4 frases (paragraph) e uma ilustração (image) descrevendo a cena exata daquela página. Personagens consistentes (descreva aparência fixa).",
    illustration: "ilustração de livro infantil em aquarela/digital suave, cores alegres, personagens fofos e consistentes, sem texto",
  },
  colorir: {
    outline: "Livro infantil para colorir: cada capítulo é um tema (ex.: animais da fazenda) e cada seção é UM desenho para colorir.",
    chapter: "Cada página tem um título curto do desenho, 1 frase divertida ou educativa (paragraph) e uma image com o desenho para colorir.",
    illustration: "desenho para colorir em LINHAS PRETAS grossas sobre fundo totalmente branco, sem cores, sem sombras, sem preenchimento, traços limpos e fechados, adequado para crianças, sem texto",
  },
};

const OUTLINE_SYSTEM = `Você é um autor e editor profissional de livros digitais vendidos em lojas e livrarias. Crie a ESTRUTURA (sumário) do livro.
Responda SOMENTE com JSON válido: {"title":"Título forte e vendável","subtitle":"Subtítulo que promete um resultado","chapters":[{"title":"Título do capítulo","sections":[{"heading":"Título da seção/página","brief":"1 frase do que ela cobre"}]}]}
Regras: específico e original ao tema; títulos atraentes; progressão lógica; no idioma pedido. Só o JSON.`;

const CHAPTER_SYSTEM = `Você é um autor profissional escrevendo o CONTEÚDO de um capítulo de livro digital de nível comercial, já diagramado em páginas com blocos.
Responda SOMENTE com JSON válido:
{"pages":[{"title":"Título da página","blocks":[ {"type":"heading","content":"..."}, {"type":"paragraph","content":"..."}, {"type":"list","items":["...","..."]}, {"type":"callout","label":"Dica","content":"..."}, {"type":"quote","content":"...","label":"— autor"}, {"type":"stats","stats":[{"value":"20 min","label":"Preparo"}]}, {"type":"image","imagePrompt":"descrição visual detalhada da cena"} ]}]}
Tipos permitidos: heading, subheading, paragraph, list, callout, quote, stats, image, divider.
NUNCA invente estatísticas, estudos ou citações de pessoas reais; stats só com dados práticos (tempo, porções, passos). Conteúdo real, sem meta-texto ("neste capítulo vamos..."). Só o JSON.`;

/** A IA às vezes numera ("1. Título"); o layout já numera. */
const semNumero = (t: string) => t.replace(/^\s*(cap[ií]tulo\s*)?\d+\s*[.):\-–]\s*/i, "").trim();

function pagesFor(kind: EbookKind, paginas: number) {
  const target = Math.max(6, Math.min(60, Math.round(paginas || 20)));
  const miolo = Math.max(4, target - 3); // capa, sumário e página final
  if (kind === "colorir" || kind === "infantil") {
    const chapters = Math.max(2, Math.min(6, Math.round(miolo / 5)));
    return { chapters, perChapter: Math.max(2, Math.round(miolo / chapters)) };
  }
  const chapters = Math.max(3, Math.min(12, Math.round(miolo / 2.2)));
  return { chapters, perChapter: Math.max(1, Math.round(miolo / chapters)) };
}

export async function ebookOutline(b: EbookBrief): Promise<EbookOutline> {
  const kind = KIND_GUIDE[b.kind] ? b.kind : "guia";
  const { chapters, perChapter } = pagesFor(kind, b.paginas);
  const porSecao = kind === "colorir" || kind === "infantil" ? `exatamente ${perChapter} seções por capítulo (cada seção é uma página)` : "2 a 4 seções por capítulo";
  const j = await llmJson(OUTLINE_SYSTEM, `Tipo de livro: ${KIND_GUIDE[kind].outline}
Tema: ${b.tema}
Público: ${b.publico || "geral"}
Objetivo: ${b.objetivo || "educar e gerar valor real ao leitor"}
Tom: ${b.tom || "didático e acolhedor"}
Idioma: ${langName(b.idioma)}
Número de capítulos: ${chapters}; ${porSecao}.`, 0.8);
  const outline: EbookOutline = {
    title: String(j?.title || b.tema).slice(0, 120),
    subtitle: String(j?.subtitle || "").slice(0, 180),
    chapters: (Array.isArray(j?.chapters) ? j.chapters : []).slice(0, chapters).map((c: any) => ({
      title: semNumero(String(c?.title || "")).slice(0, 120),
      sections: (Array.isArray(c?.sections) ? c.sections : []).slice(0, 12).map((s: any) => ({ heading: semNumero(String(s?.heading || "")).slice(0, 120), brief: String(s?.brief || "").slice(0, 240) })),
    })).filter((c: OutlineChapter) => c.title),
  };
  if (!outline.chapters.length) throw new Error("A IA não conseguiu montar o sumário. Tente de novo.");
  return outline;
}

function sanitizeBlocks(blocks: any): EbookBlock[] {
  const allowed = new Set(["heading", "subheading", "paragraph", "list", "image", "callout", "quote", "stats", "divider"]);
  const out: EbookBlock[] = [];
  for (const b of (Array.isArray(blocks) ? blocks : []).slice(0, 16)) {
    if (!b || !allowed.has(b.type)) continue;
    const block: EbookBlock = { type: b.type };
    if (typeof b.content === "string") block.content = b.content.slice(0, 2400);
    if (Array.isArray(b.items)) block.items = b.items.map((x: any) => String(x).slice(0, 400)).slice(0, 14);
    if (b.type === "image") block.imagePrompt = String(b.imagePrompt || b.content || "").slice(0, 500);
    if ((b.type === "callout" || b.type === "quote") && b.label) block.label = String(b.label).slice(0, 80);
    if (b.type === "stats" && Array.isArray(b.stats)) block.stats = b.stats.slice(0, 4).map((s: any) => ({ value: String(s?.value || "").slice(0, 16), label: String(s?.label || "").slice(0, 60) }));
    out.push(block);
  }
  return out;
}

/**
 * Escreve os capítulos, gera ilustrações e a capa. `onUpdate` recebe o livro parcial e o
 * progresso a cada etapa (o front mostra as páginas aparecendo). `saveImage` grava a imagem
 * e devolve a URL pública.
 */
export async function ebookBuild(
  b: EbookBrief,
  outline: EbookOutline,
  saveImage: (buf: Buffer, mime: string) => Promise<string>,
  onUpdate: (ebook: Ebook, p: BuildProgress) => void,
): Promise<Ebook> {
  const kind: EbookKind = KIND_GUIDE[b.kind] ? b.kind : "guia";
  const guide = KIND_GUIDE[kind];
  const { perChapter } = pagesFor(kind, b.paginas);
  const lang = langName(b.idioma);
  const illustrated = kind === "infantil" || kind === "colorir";
  const withImages = illustrated || b.imagens !== false;

  const ebook: Ebook = {
    title: outline.title, subtitle: outline.subtitle, author: String(b.autor || "").slice(0, 80),
    theme: b.estilo || (illustrated ? "infantil" : "editorial"), withImages, pageCount: 0, pages: [],
  };
  (ebook as any).kind = kind;
  const cover: EbookPage = { type: "cover", title: outline.title, subtitle: outline.subtitle, blocks: [] };
  const toc: EbookPage = { type: "toc", title: "Sumário", blocks: [{ type: "list", items: outline.chapters.map((c, i) => `${i + 1}. ${c.title}`) }] };
  const content: EbookPage[] = [];
  const end: EbookPage = {
    type: "cta", title: illustrated ? "Fim" : "Próximos passos",
    blocks: illustrated
      ? [{ type: "paragraph", content: kind === "colorir" ? "Parabéns! Você coloriu todos os desenhos. Que tal escolher o seu favorito e mostrar para alguém especial?" : "E assim termina a nossa história. Que tal contar para alguém o que você mais gostou?" }]
      : [{ type: "paragraph", content: "Você chegou ao fim — agora é hora de colocar em prática. Revise os pontos principais e dê o primeiro passo hoje mesmo." }],
  };
  const sync = (step: string, done: number, total: number) => {
    ebook.pages = [cover, toc, ...content, end];
    ebook.pageCount = ebook.pages.length;
    onUpdate(ebook, { step, done, total });
  };

  // Quantas imagens no total (capa + miolo) para a barra de progresso.
  const chapterSteps = outline.chapters.length;
  let done = 0;
  let total = chapterSteps + 1;
  sync("Escrevendo o livro…", done, total);

  // 1) Capítulos
  for (let i = 0; i < outline.chapters.length; i++) {
    const ch = outline.chapters[i];
    const data = await llmJson(CHAPTER_SYSTEM, `Livro: "${outline.title}" — ${guide.outline}
Capítulo ${i + 1}: "${ch.title}". Seções: ${JSON.stringify(ch.sections)}.
Instruções do tipo de livro: ${guide.chapter}
Público: ${b.publico || "geral"}. Tom: ${b.tom || "didático e acolhedor"}. Idioma: ${lang}.
Gere ${illustrated ? ch.sections.length || perChapter : perChapter} página(s) para este capítulo.
${illustrated ? "TODA página deve ter exatamente 1 bloco image com imagePrompt detalhado da cena daquela página." : withImages ? "Inclua 1 bloco image (imagePrompt descritivo) só na PRIMEIRA página do capítulo." : "NÃO inclua blocos image."}`, 0.75);
    const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
    pages.slice(0, (illustrated ? ch.sections.length || perChapter : perChapter) + 1).forEach((p, idx) => {
      let blocks = sanitizeBlocks(p?.blocks);
      if (!withImages) blocks = blocks.filter((x) => x.type !== "image");
      else if (!illustrated && idx > 0) blocks = blocks.filter((x) => x.type !== "image");
      content.push({ type: idx === 0 ? "chapter" : "content", title: String(p?.title || ch.title).slice(0, 120), chapter: i + 1, blocks });
    });
    done++;
    total = chapterSteps + 1 + content.reduce((n, pg) => n + pg.blocks.filter((x) => x.type === "image").length, 0);
    sync(`Escrevendo o capítulo ${Math.min(i + 2, outline.chapters.length)} de ${outline.chapters.length}…`, done, total);
  }

  // 2) Ilustrações do miolo (3 por vez)
  const imgs = content.flatMap((pg) => pg.blocks.filter((x) => x.type === "image" && !x.imageUrl));
  const aspect = kind === "colorir" ? "3:4" : kind === "infantil" ? "4:3" : "16:9";
  const stylePrefix = b.estilo === "minimal" ? "visual minimalista" : b.estilo === "moderno" ? "visual moderno e vibrante" : "visual elegante";
  for (let k = 0; k < imgs.length; k += 3) {
    await Promise.all(imgs.slice(k, k + 3).map(async (blk) => {
      try {
        const prompt = `${blk.imagePrompt}. Estilo: ${guide.illustration}${kind === "colorir" ? "" : `, ${stylePrefix}`}. Imagem para livro "${outline.title}". Nenhum texto, letra ou número na imagem.`;
        const img = await generateAdImage({ prompt, aspect, quality: kind === "colorir" ? "medium" : "high", format: "webp" } as any);
        blk.imageUrl = await saveImage(img.buffer, img.mime);
      } catch (e: any) {
        logger.warn(`[Ebook] ilustração falhou: ${e?.message}`);
      } finally {
        done++;
      }
    }));
    sync(`Ilustrando as páginas (${Math.min(k + 3, imgs.length)} de ${imgs.length})…`, done, total);
  }

  // 3) Capa (só arte; o título é tipografia do layout)
  try {
    sync("Criando a capa…", done, total);
    const prompt = `Arte de CAPA de livro ${illustrated ? "infantil" : "profissional"} sobre: ${outline.title} — ${outline.subtitle}. ${guide.illustration.replace(/sem texto/g, "")}. ${kind === "colorir" ? "Capa colorida e alegre mostrando alguns dos personagens/desenhos do livro." : "Composição vertical marcante, foco visual forte."} Deixe o TERÇO SUPERIOR com área limpa e calma para o título ser aplicado depois. Nenhum texto, letra ou número na imagem.`;
    const img = await generateAdImage({ prompt, aspect: "2:3", quality: "high", format: "webp" } as any);
    cover.blocks = [{ type: "image", imageUrl: await saveImage(img.buffer, img.mime), imagePrompt: prompt }];
  } catch (e: any) {
    logger.warn(`[Ebook] capa falhou: ${e?.message}`);
  }
  done++;
  sync("Pronto!", total, total);
  return ebook;
}

/** Refaz UMA ilustração (o usuário não gostou). */
export async function ebookRedoImage(kind: EbookKind, prompt: string, cover: boolean, estilo?: string) {
  const guide = KIND_GUIDE[kind] || KIND_GUIDE.guia;
  const full = cover
    ? `${prompt}`
    : `${prompt}. Estilo: ${guide.illustration}${estilo ? `, ${estilo}` : ""}. Nenhum texto, letra ou número na imagem.`;
  return generateAdImage({ prompt: full, aspect: cover ? "2:3" : kind === "colorir" ? "3:4" : kind === "infantil" ? "4:3" : "16:9", quality: "high", format: "webp" } as any);
}
