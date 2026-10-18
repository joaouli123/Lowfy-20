import { llmJson, langName, generateAdImage } from "./aiStudio";
import { logger } from "../utils/logger";
import type { Ebook, EbookBlock, EbookPage } from "./ebookStudio";

/**
 * Criador de E-books do Estúdio (v2): briefing → sumário editável → conteúdo + ilustrações
 * → capa, contracapa e diagramação. Cada tipo de livro tem estrutura e ilustração próprias:
 * guia/ensino, infantil ilustrado, infantil para colorir, receitas e workbook.
 * Capa e contracapa saem prontas da IA de imagem (arte + tipografia), como capa de livraria.
 * O miolo é diagramado no navegador em folhas A4 (a quebra de página é medida lá).
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
  accent?: string;     // cor principal escolhida (#hex)
  paleta?: string;     // nome da paleta (vai para o prompt da capa)
  fonte?: string;      // família tipográfica escolhida (classica, elegante, moderna, minimalista, arredondada, divertida)
}

/** Cor quando nem a pessoa nem a IA definiram: sóbria e de acordo com o tipo de livro. */
const COR_PADRAO: Record<EbookKind, Paleta> = {
  guia: { nome: "Grafite", accent: "#1f2937" },
  workbook: { nome: "Oceano", accent: "#1d4ed8" },
  receitas: { nome: "Terracota", accent: "#c2410c" },
  infantil: { nome: "Laranja alegre", accent: "#f97316" },
  colorir: { nome: "Laranja alegre", accent: "#f97316" },
};

/** Nome da cor em português (a IA de imagem entende melhor "vinho" do que um hex). */
function nomeDaCor(h: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "");
  if (!m) return "";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.15 || (l < 0.25 && s < 0.35)) return l < 0.12 ? "preto" : l < 0.45 ? "grafite" : l < 0.8 ? "cinza" : "branco";
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  const escuro = l < 0.36;
  if (hue < 12 || hue >= 340) return l < 0.4 ? "vinho" : "vermelho";
  if (hue < 40) return escuro ? "marrom" : l > 0.5 ? "laranja" : "terracota";
  if (hue < 65) return escuro ? "mostarda escuro" : "dourado/amarelo";
  if (hue < 150) return escuro ? "verde-oliva escuro" : "verde";
  if (hue < 190) return escuro ? "verde-petróleo" : "verde-água/turquesa";
  if (hue < 250) return escuro ? "azul-marinho" : "azul";
  if (hue < 290) return escuro ? "roxo escuro" : "roxo/lavanda";
  return escuro ? "vinho/bordô" : "rosa/magenta";
}

const FONTE_DESC: Record<string, string> = {
  classica: "serifada clássica de livro (estilo Playfair Display)",
  elegante: "serifada refinada e elegante (estilo Cormorant Garamond)",
  moderna: "sem serifa moderna e forte (estilo Poppins)",
  minimalista: "sem serifa limpa e minimalista (estilo Inter)",
  arredondada: "arredondada, suave e amigável (estilo Nunito)",
  divertida: "arredondada divertida infantil (estilo Baloo)",
};

export interface Paleta { nome: string; accent: string }
export interface OutlineChapter { title: string; sections: { heading: string; brief: string }[] }
export interface EbookOutline { title: string; subtitle: string; sinopse?: string; paletas?: Paleta[]; chapters: OutlineChapter[] }

export interface BuildProgress { step: string; done: number; total: number }

/** Modelo da OpenAI para capas (escreve texto em imagem muito melhor). */
const COVER_MODEL = () => process.env.OPENAI_COVER_MODEL || "chatgpt-image-latest";

const KIND_GUIDE: Record<EbookKind, { outline: string; chapter: string; illustration: string; capa: string }> = {
  guia: {
    outline: "Livro de ensino/guia prático com progressão lógica (fundamentos → aplicação → avançado → próximos passos).",
    chapter: "Conteúdo real, denso e útil: explique o porquê, dê exemplos concretos do dia a dia, passo a passo, erros comuns e dicas. Use subheading para dividir, list para passos e checklists, callout para dicas e alertas, quote só com frases autorais (sem atribuir a pessoas reais).",
    illustration: "ilustração editorial moderna em estilo flat/semi-realista, limpa, sem texto",
    capa: "capa editorial moderna de livro de não ficção best-seller, imagem conceitual forte ligada ao tema",
  },
  receitas: {
    outline: "Livro de receitas: cada capítulo é uma categoria (ex.: entradas, pratos principais, sobremesas) e CADA seção é UMA receita (o heading da seção é o nome da receita).",
    chapter: `Cada página é UMA receita completa, nesta ordem exata de blocos:
1) heading = nome da receita;
2) image = foto do prato pronto (imagePrompt: descreva o prato, a louça, a mesa e a luz);
3) paragraph = apresentação apetitosa de 40 a 60 palavras (sabor, textura, quando servir);
4) stats = [Preparo, Porções, Dificuldade] (ex.: "25 min", "4 porções", "Fácil");
5) subheading "Ingredientes" + list com quantidades exatas (6 a 12 itens, curtos);
6) subheading "Modo de preparo" + list com "ordered": true (5 a 8 passos claros, 1 a 2 frases cada, com tempos e pontos de cozimento);
7) callout com label "Dica do chef" (substituições, armazenamento ou variação, até 45 palavras).
Nada além disso na página. Receitas reais e testáveis, quantidades coerentes.`,
    illustration: "fotografia gastronômica profissional de revista, prato pronto bem empratado, luz natural suave, profundidade de campo, fundo de mesa bonito, sem texto",
    capa: "capa de livro de receitas de livraria com fotografia gastronômica profissional e apetitosa do prato principal do tema",
  },
  workbook: {
    outline: "Workbook/caderno de exercícios: cada capítulo ensina um conceito curto e traz exercícios práticos.",
    chapter: "Explique o conceito em 2 a 3 parágrafos com exemplo prático e traga exercícios: list com perguntas para responder, callouts 'Exercício' e 'Reflexão' com instruções claras, checklist de ação. Para resposta, use itens terminados em '__________'.",
    illustration: "ilustração simples e amigável em estilo flat, cores suaves, sem texto",
    capa: "capa de workbook/planner moderno e motivador, design gráfico limpo com elementos ligados ao tema",
  },
  infantil: {
    outline: "Livro infantil ilustrado: uma história com começo, meio e fim (ou um livro educativo infantil). Cada capítulo é uma parte da história e cada seção é UMA página ilustrada.",
    chapter: "Linguagem simples para crianças, frases curtas e acolhedoras. Cada página tem 2 a 4 frases (paragraph) e uma ilustração (image) descrevendo a cena exata daquela página. Personagens consistentes (descreva aparência fixa em todo imagePrompt).",
    illustration: "ilustração de livro infantil em aquarela/digital suave, cores alegres, personagens fofos e consistentes, sem texto",
    capa: "capa de livro infantil de livraria, ilustração encantadora dos personagens principais, cores alegres",
  },
  colorir: {
    outline: "Livro infantil para colorir: cada capítulo é um tema (ex.: animais da fazenda) e cada seção é UM desenho para colorir.",
    chapter: "Cada página tem um título curto do desenho, 1 frase divertida ou educativa (paragraph) e uma image com o desenho para colorir.",
    illustration: "desenho para colorir em LINHAS PRETAS grossas sobre fundo totalmente branco, sem cores, sem sombras, sem preenchimento, traços limpos e fechados, adequado para crianças, sem texto",
    capa: "capa de livro de colorir infantil TOTALMENTE COLORIDA, cores vivas, mostrando os desenhos do livro já pintados",
  },
};

const OUTLINE_SYSTEM = `Você é um autor e editor profissional de livros digitais vendidos em lojas e livrarias. Crie a ESTRUTURA (sumário) do livro, a sinopse da contracapa e sugestões de cor.
Responda SOMENTE com JSON válido: {"title":"Título forte e vendável","subtitle":"Subtítulo que promete um resultado (até 10 palavras)","sinopse":"Texto de contracapa: 2 frases, até 35 palavras, que vendem o livro","paletas":[{"nome":"Nome curto da paleta","accent":"#RRGGBB"}],"chapters":[{"title":"Título do capítulo","sections":[{"heading":"Título da seção/página","brief":"1 frase do que ela cobre"}]}]}
Regras: específico e original ao tema; títulos atraentes e curtos (título com até 7 palavras); progressão lógica; 3 paletas, da melhor para a menos indicada, cuja cor principal (accent) combine com o assunto e o público (ex.: receitas saudáveis → verde/oliva ou terracota; finanças e negócios → azul-marinho ou grafite; infantil → cores alegres; temas sóbrios ou profissionais → preto/grafite) e tenha bom contraste com fundo branco (nada de amarelo-claro ou pastel fraco); tudo no idioma pedido. Só o JSON.`;

const CHAPTER_SYSTEM = `Você é um autor profissional escrevendo o CONTEÚDO de um livro digital de nível comercial, já diagramado em páginas A4 com blocos.
Responda SOMENTE com JSON válido:
{"pages":[{"title":"Título da página","blocks":[ {"type":"heading","content":"..."}, {"type":"subheading","content":"..."}, {"type":"paragraph","content":"..."}, {"type":"list","items":["...","..."],"ordered":false}, {"type":"callout","label":"Dica","content":"..."}, {"type":"quote","content":"...","label":"— autor"}, {"type":"stats","stats":[{"value":"20 min","label":"Preparo"}]}, {"type":"image","imagePrompt":"descrição visual detalhada da cena"} ]}]}
Tipos permitidos: heading, subheading, paragraph, list (use "ordered": true para passos numerados), callout, quote, stats, image, divider.
NUNCA invente estatísticas, estudos ou citações de pessoas reais; stats só com dados práticos (tempo, porções, passos). Conteúdo real, sem meta-texto ("neste capítulo vamos..."), sem repetir o título do capítulo como heading. Só o JSON.`;

const palavras = (pg: EbookPage) =>
  pg.blocks.map((x) => [x.content || "", ...(x.items || [])].join(" ")).join(" ").split(/\s+/).filter(Boolean).length;

/** A IA às vezes numera ("1. Título"); o layout já numera. */
const semNumero = (t: string) => t.replace(/^\s*(cap[ií]tulo\s*)?\d+\s*[.):\-–]\s*/i, "").trim();
const hex = (v: any) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : "");

/** Folhas fixas fora do miolo: capa, sumário, introdução, fechamento e contracapa. */
function pagesFor(kind: EbookKind, paginas: number) {
  const target = Math.max(8, Math.min(60, Math.round(paginas || 20)));
  const illustrated = kind === "colorir" || kind === "infantil";
  const miolo = Math.max(4, target - (illustrated ? 4 : 5));
  if (illustrated) {
    const chapters = Math.max(2, Math.min(6, Math.round(miolo / 5)));
    return { chapters, perChapter: Math.max(2, Math.round(miolo / chapters)) };
  }
  if (kind === "receitas") {
    const chapters = Math.max(2, Math.min(6, Math.round(miolo / 3)));
    return { chapters, perChapter: Math.max(2, Math.round(miolo / chapters)) };
  }
  const chapters = Math.max(3, Math.min(12, Math.round(miolo / 2.4)));
  return { chapters, perChapter: Math.max(1, Math.round(miolo / chapters)) };
}

export const _nomeDaCor = nomeDaCor;

export async function ebookOutline(b: EbookBrief): Promise<EbookOutline> {
  const kind = KIND_GUIDE[b.kind] ? b.kind : "guia";
  const { chapters, perChapter } = pagesFor(kind, b.paginas);
  const porSecao = kind === "colorir" || kind === "infantil" ? `exatamente ${perChapter} seções por capítulo (cada seção é uma página)`
    : kind === "receitas" ? `exatamente ${perChapter} receitas por capítulo (cada seção é uma receita)`
    : "2 a 4 seções por capítulo";
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
    sinopse: String(j?.sinopse || "").slice(0, 320),
    paletas: (Array.isArray(j?.paletas) ? j.paletas : []).map((p: any) => ({ nome: String(p?.nome || "").slice(0, 30), accent: hex(p?.accent) })).filter((p: Paleta) => p.nome && p.accent).slice(0, 3),
    chapters: (Array.isArray(j?.chapters) ? j.chapters : []).slice(0, chapters).map((c: any) => ({
      title: semNumero(String(c?.title || "")).slice(0, 120),
      sections: (Array.isArray(c?.sections) ? c.sections : []).slice(0, 12).map((s: any) => ({ heading: semNumero(String(s?.heading || "")).slice(0, 120), brief: String(s?.brief || "").slice(0, 240) })),
    })).filter((c: OutlineChapter) => c.title),
  };
  if (!outline.chapters.length) throw new Error("A IA não conseguiu montar o sumário. Tente de novo.");
  return outline;
}

function sanitizeBlocks(blocks: any, kind: EbookKind): EbookBlock[] {
  const allowed = new Set(["heading", "subheading", "paragraph", "list", "image", "callout", "quote", "stats", "divider"]);
  const out: EbookBlock[] = [];
  let prevSub = "";
  for (const b of (Array.isArray(blocks) ? blocks : []).slice(0, 20)) {
    if (!b || !allowed.has(b.type)) continue;
    const block: EbookBlock = { type: b.type };
    if (typeof b.content === "string") block.content = b.content.slice(0, 2400);
    if (Array.isArray(b.items)) block.items = b.items.map((x: any) => String(x).replace(/^\s*(\d+[.)]|[-•])\s*/, "").slice(0, 400)).filter(Boolean).slice(0, 16);
    if (b.type === "list" && !block.items?.length) continue;
    if (b.type === "list" && (b.ordered === true || /preparo|passo|modo de fazer|etapa/i.test(prevSub))) block.ordered = true;
    if (b.type === "list" && /ingred/i.test(prevSub) && (block.items?.length || 0) >= 6) block.cols = 2;
    if (b.type === "image") block.imagePrompt = String(b.imagePrompt || b.content || "").slice(0, 500);
    if ((b.type === "callout" || b.type === "quote") && b.label) block.label = String(b.label).slice(0, 80);
    if (b.type === "stats" && Array.isArray(b.stats)) block.stats = b.stats.slice(0, 4).map((s: any) => ({ value: String(s?.value || "").slice(0, 16), label: String(s?.label || "").slice(0, 60) }));
    prevSub = b.type === "subheading" ? String(b.content || "") : b.type === "list" ? "" : prevSub;
    out.push(block);
  }
  if (kind === "receitas") {
    // Uma receita por página: só o nome é heading; a foto vem logo abaixo dele.
    let h = 0;
    for (const x of out) if (x.type === "heading" && h++ > 0) x.type = "subheading";
    const i = out.findIndex((x) => x.type === "image");
    if (i > 1) { const [img] = out.splice(i, 1); out.splice(out[0]?.type === "heading" ? 1 : 0, 0, img); }
  }
  return out;
}

/** Texto curto para a capa (a IA de imagem erra menos com pouco texto). */
const curto = (s: string, max: number) => (s.length <= max ? s : "");

function coverPrompt(b: EbookBrief, o: EbookOutline, kind: EbookKind) {
  const illustrated = kind === "infantil" || kind === "colorir";
  const paleta = b.accent ? `COR PRINCIPAL OBRIGATÓRIA: ${nomeDaCor(b.accent)} (${b.accent})${b.paleta && b.paleta !== "Personalizada" ? `, paleta "${b.paleta}"` : ""}. Use essa cor como a cor dominante da identidade da capa (tipografia, elementos gráficos ou fundo), combinada com neutros.` : "";
  const sub = curto(o.subtitle, 90);
  const fonte = b.fonte && FONTE_DESC[b.fonte] ? FONTE_DESC[b.fonte] : illustrated ? "divertidas e arredondadas" : "elegantes e modernas";
  return `Capa frontal de ${illustrated ? "livro infantil" : "e-book profissional"}, formato retrato (proporção 2:3), pronta para vender em livraria, nível de capa best-seller desenhada por um designer de capas premiado.
Tema do livro: ${o.title}${o.subtitle ? ` — ${o.subtitle}` : ""}. Público: ${b.publico || "geral"}.
Direção de arte: ${KIND_GUIDE[kind].capa}. ${paleta}
TIPOGRAFIA OBRIGATÓRIA — escreva exatamente estes textos, em ${langName(b.idioma)}, com todos os acentos e sem erros de grafia:
• Título, grande e em destaque: "${o.title}"
${sub ? `• Subtítulo, menor: "${sub}"\n` : ""}${b.autor ? `• Nome do autor, na base: "${b.autor}"\n` : ""}Hierarquia tipográfica profissional, tipografia ${fonte}, ótimo contraste com a arte, margens seguras (nada encostado nas bordas), texto integrado à composição.
Não escreva nenhum outro texto além desses. Sem selos, preço, código de barras ou logotipos.`;
}

function backPrompt(b: EbookBrief, o: EbookOutline, kind: EbookKind) {
  const sinopse = curto(o.sinopse || o.subtitle || "", 260);
  return `Contracapa (quarta capa) do MESMO livro da imagem de referência: mesma identidade visual, mesma paleta, mesma tipografia e estilo, composição mais calma e com bastante respiro, formato retrato (proporção 2:3).
TEXTOS OBRIGATÓRIOS — escreva exatamente assim, em ${langName(b.idioma)}, com todos os acentos e sem erros:
• No alto, pequeno: "${o.title}"
${sinopse ? `• Centralizado, em bloco de texto legível: "${sinopse}"\n` : ""}${b.autor ? `• Na base: "${b.autor}"\n` : ""}Não escreva nenhum outro texto. Sem código de barras, preço ou logotipos.${kind === "colorir" ? " Arte colorida." : ""}`;
}

/**
 * Escreve os capítulos, gera ilustrações, capa e contracapa. `onUpdate` recebe o livro parcial
 * e o progresso a cada etapa (o front mostra as páginas aparecendo). `saveImage` grava a imagem
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
  const tom = b.tom || "didático e acolhedor";
  // Cor do livro: a escolhida, senão a 1ª sugestão da IA para o tema, senão a padrão do tipo.
  if (!hex(b.accent)) {
    const sug = outline.paletas?.find((p) => hex(p.accent)) || COR_PADRAO[kind];
    b = { ...b, accent: sug.accent, paleta: sug.nome };
  }

  const ebook: Ebook = {
    title: outline.title, subtitle: outline.subtitle, author: String(b.autor || "").slice(0, 80),
    theme: b.estilo || (illustrated ? "infantil" : "editorial"), withImages, pageCount: 0, pages: [],
  };
  (ebook as any).kind = kind;
  (ebook as any).accent = hex(b.accent);
  if (b.fonte && FONTE_DESC[b.fonte]) (ebook as any).fonte = b.fonte;
  if (outline.paletas?.length) (ebook as any).paletas = outline.paletas;
  const cover: EbookPage = { type: "cover", title: outline.title, subtitle: outline.subtitle, blocks: [] };
  const toc: EbookPage = { type: "toc", title: "Sumário", blocks: [{ type: "list", items: outline.chapters.map((c, i) => `${i + 1}. ${c.title}`) }] };
  let intro: EbookPage | null = null;
  const content: EbookPage[] = [];
  let end: EbookPage = {
    type: "cta", title: illustrated ? "Fim" : "Próximos passos",
    blocks: illustrated
      ? [{ type: "paragraph", content: kind === "colorir" ? "Parabéns! Você coloriu todos os desenhos. Que tal escolher o seu favorito e mostrar para alguém especial?" : "E assim termina a nossa história. Que tal contar para alguém o que você mais gostou?" }]
      : [{ type: "paragraph", content: "Você chegou ao fim — agora é hora de colocar em prática. Revise os pontos principais e dê o primeiro passo hoje mesmo." }],
  };
  const back: EbookPage = { type: "back" as any, title: outline.title, blocks: [] };
  const sync = (step: string, done: number, total: number) => {
    ebook.pages = [cover, toc, ...(intro ? [intro] : []), ...content, end, back];
    ebook.pageCount = ebook.pages.length;
    onUpdate(ebook, { step, done, total });
  };

  const chapterSteps = outline.chapters.length + (illustrated ? 0 : 2);
  let done = 0;
  let total = chapterSteps + 2;
  sync("Escrevendo o livro…", done, total);

  // 0) Capa e contracapa em paralelo com a escrita (são as imagens mais demoradas).
  const capas = (async () => {
    try {
      const prompt = coverPrompt(b, outline, kind);
      const img = await generateAdImage({ prompt, aspect: "2:3", quality: "high", format: "webp", model: COVER_MODEL() } as any);
      cover.blocks = [{ type: "image", imageUrl: await saveImage(img.buffer, img.mime), imagePrompt: prompt, textInImage: true } as any];
      done++;
      try {
        const bp = backPrompt(b, outline, kind);
        const ref = `data:${img.mime};base64,${img.buffer.toString("base64")}`;
        const bimg = await generateAdImage({ prompt: bp, aspect: "2:3", quality: "high", format: "webp", model: COVER_MODEL(), reference: ref } as any);
        back.blocks = [{ type: "image", imageUrl: await saveImage(bimg.buffer, bimg.mime), imagePrompt: bp, textInImage: true } as any];
      } catch (e: any) {
        logger.warn(`[Ebook] contracapa falhou: ${e?.message}`);
      }
      done++;
    } catch (e: any) {
      logger.warn(`[Ebook] capa falhou: ${e?.message}`);
      done += 2;
    }
  })();

  // 1) Introdução (livros de texto)
  if (!illustrated) {
    try {
      const j = await llmJson(CHAPTER_SYSTEM, `Livro: "${outline.title}" — ${outline.subtitle}. ${guide.outline}
Capítulos: ${outline.chapters.map((c) => c.title).join("; ")}.
Escreva a página de ABERTURA do livro (vem antes do capítulo 1). Título curto e convidativo (ex.: ${kind === "receitas" ? "\"Antes de começar\"" : "\"Introdução\" ou \"Bem-vindo\""}).
${kind === "receitas" ? "Conte a proposta do livro e os benefícios dessas receitas (2 parágrafos), traga subheading \"Despensa básica\" com list dos ingredientes que mais aparecem, subheading \"Utensílios\" com list curta e um callout \"Como usar este livro\"." : kind === "workbook" ? "Explique a proposta, como fazer os exercícios (list de 4 a 6 regras) e um callout \"Seu compromisso\" com espaço para assinatura '__________'." : "Apresente o problema que o livro resolve, a transformação prometida, para quem é e um list com o que o leitor vai conquistar em cada etapa; feche com um callout motivador."}
Entre 280 e 360 palavras. Público: ${b.publico || "geral"}. Tom: ${tom}. Idioma: ${lang}. Sem blocos image. Exatamente 1 página.`, 0.7);
      const p0 = Array.isArray(j?.pages) ? j.pages[0] : null;
      const blocks = sanitizeBlocks(p0?.blocks, "guia").filter((x) => x.type !== "image");
      if (blocks.length) intro = { type: "intro" as any, title: String(p0?.title || "Introdução").slice(0, 80), blocks };
    } catch (e: any) {
      logger.warn(`[Ebook] introdução falhou: ${e?.message}`);
    }
    done++;
    sync(`Escrevendo o capítulo 1 de ${outline.chapters.length}…`, done, total);
  }

  // 2) Capítulos
  const paginaAlvo = kind === "receitas"
    ? "Cada página é UMA receita (siga a ordem de blocos acima). Não junte duas receitas na mesma página."
    : `Cada página deve preencher uma folha A4: ${withImages ? "a PRIMEIRA página do capítulo tem uma imagem e 260 a 320 palavras; as demais" : "todas"} entre 340 e 420 palavras de conteúdo real, com 1 heading, 2 a 4 parágrafos, pelo menos 1 subheading e 1 elemento de destaque (list, callout, quote ou stats). Nada de página curta ou rasa.`;
  for (let i = 0; i < outline.chapters.length; i++) {
    const ch = outline.chapters[i];
    const nPages = illustrated || kind === "receitas" ? ch.sections.length || perChapter : perChapter;
    const data = await llmJson(CHAPTER_SYSTEM, `Livro: "${outline.title}" — ${guide.outline}
Capítulo ${i + 1}: "${ch.title}". Seções: ${JSON.stringify(ch.sections)}.
Instruções do tipo de livro: ${guide.chapter}
Público: ${b.publico || "geral"}. Tom: ${tom}. Idioma: ${lang}.
Gere ${nPages} página(s) para este capítulo${kind === "receitas" ? ", uma para cada receita das seções, na mesma ordem" : ""}.
${illustrated ? "TODA página deve ter exatamente 1 bloco image com imagePrompt detalhado da cena daquela página." : paginaAlvo}
${illustrated || kind === "receitas" ? "" : withImages ? "Inclua 1 bloco image (imagePrompt descritivo) só na PRIMEIRA página do capítulo, logo depois do primeiro parágrafo." : "NÃO inclua blocos image."}`, 0.75);
    const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
    pages.slice(0, nPages + 1).forEach((p, idx) => {
      let blocks = sanitizeBlocks(p?.blocks, kind);
      if (!withImages) blocks = blocks.filter((x) => x.type !== "image");
      else if (kind !== "receitas" && !illustrated && idx > 0) blocks = blocks.filter((x) => x.type !== "image");
      if (kind === "receitas" && withImages && !blocks.some((x) => x.type === "image")) {
        const nome = blocks.find((x) => x.type === "heading")?.content || p?.title || ch.sections[idx]?.heading || "";
        if (nome) blocks.splice(blocks[0]?.type === "heading" ? 1 : 0, 0, { type: "image", imagePrompt: `Foto do prato pronto: ${nome}` });
      }
      content.push({ type: idx === 0 ? "chapter" : "content", title: String(p?.title || ch.title).slice(0, 120), chapter: i + 1, blocks });
    });
    // Página de texto rasa vira página cheia: amplia mantendo o que já foi escrito.
    if (!illustrated && kind !== "receitas") {
      const doCapitulo = content.filter((pg) => pg.chapter === i + 1);
      await Promise.all(doCapitulo.map(async (pg) => {
        const temImg = pg.blocks.some((x) => x.type === "image");
        if (palavras(pg) >= (temImg ? 240 : 310)) return;
        try {
          const ext = await llmJson(CHAPTER_SYSTEM, `Esta é uma página do livro "${outline.title}" (capítulo "${ch.title}"), mas está curta (${palavras(pg)} palavras).
Página atual: ${JSON.stringify({ title: pg.title, blocks: pg.blocks.filter((x) => x.type !== "image") })}
Reescreva a página COMPLETA ampliando para ${temImg ? "260 a 320" : "350 a 420"} palavras: mantenha o que já existe, aprofunde com explicações, exemplos práticos e passo a passo, e inclua pelo menos 1 list ou callout. Tom: ${tom}. Idioma: ${lang}. ${guide.chapter}
Responda no mesmo formato JSON com "pages" contendo exatamente 1 página, sem blocos image.`, 0.7);
          const nova = Array.isArray(ext?.pages) ? ext.pages[0] : null;
          const blocks = sanitizeBlocks(nova?.blocks, kind).filter((x) => x.type !== "image");
          if (blocks.length && palavras({ ...pg, blocks }) > palavras(pg)) {
            const img = pg.blocks.find((x) => x.type === "image");
            if (img) blocks.splice(Math.min(2, blocks.length), 0, img);
            pg.blocks = blocks;
          }
        } catch (e: any) {
          logger.warn(`[Ebook] ampliação falhou: ${e?.message}`);
        }
      }));
    }
    done++;
    total = chapterSteps + 2 + content.reduce((n, pg) => n + pg.blocks.filter((x) => x.type === "image").length, 0);
    sync(`Escrevendo o capítulo ${Math.min(i + 2, outline.chapters.length)} de ${outline.chapters.length}…`, done, total);
  }

  // 3) Fechamento (livros de texto)
  if (!illustrated) {
    try {
      const nomes = kind === "receitas"
        ? content.map((pg) => pg.blocks.find((x) => x.type === "heading")?.content).filter(Boolean).join("; ")
        : outline.chapters.map((c) => c.title).join("; ");
      const j = await llmJson(CHAPTER_SYSTEM, `Livro: "${outline.title}". ${kind === "receitas" ? `Receitas do livro: ${nomes}.` : `Capítulos: ${nomes}.`}
Escreva a página FINAL do livro. ${kind === "receitas" ? "Título como \"Seu cardápio da semana\": 1 parágrafo de fechamento, subheading \"Sugestão de cardápio\" com list de 5 a 7 dias combinando as receitas do livro pelo nome, e callout \"Dica de organização\" sobre preparo antecipado e armazenamento." : "Título como \"Próximos passos\": resumo dos aprendizados (list de 4 a 6 itens), um plano de ação para os próximos 7 dias (list ordered) e 1 parágrafo final motivador."}
Entre 200 e 280 palavras. Tom: ${tom}. Idioma: ${lang}. Sem blocos image. Exatamente 1 página.`, 0.7);
      const p0 = Array.isArray(j?.pages) ? j.pages[0] : null;
      const blocks = sanitizeBlocks(p0?.blocks, "guia").filter((x) => x.type !== "image" && x.type !== "heading");
      if (blocks.length) end = { type: "cta", title: String(p0?.title || "Próximos passos").slice(0, 80), blocks };
    } catch (e: any) {
      logger.warn(`[Ebook] fechamento falhou: ${e?.message}`);
    }
    done++;
    sync("Fotografando e ilustrando…", done, total);
  }

  // 4) Ilustrações do miolo (3 por vez)
  const imgs = content.flatMap((pg) => pg.blocks.filter((x) => x.type === "image" && !x.imageUrl));
  const aspect = kind === "colorir" ? "3:4" : kind === "infantil" ? "4:3" : "16:9";
  const stylePrefix = b.estilo === "minimal" ? "visual minimalista" : b.estilo === "moderno" ? "visual moderno e vibrante" : "visual elegante";
  const tons = `, paleta de cores que harmoniza com ${nomeDaCor(b.accent || "")} (cor do livro)`;
  for (let k = 0; k < imgs.length; k += 3) {
    await Promise.all(imgs.slice(k, k + 3).map(async (blk) => {
      try {
        const prompt = `${blk.imagePrompt}. Estilo: ${guide.illustration}${kind === "colorir" ? "" : `, ${stylePrefix}${tons}`}. Imagem para o livro "${outline.title}". Nenhum texto, letra ou número na imagem.`;
        const img = await generateAdImage({ prompt, aspect, quality: kind === "colorir" ? "medium" : illustrated ? "high" : "medium", format: "webp" } as any);
        blk.imageUrl = await saveImage(img.buffer, img.mime);
      } catch (e: any) {
        logger.warn(`[Ebook] ilustração falhou: ${e?.message}`);
      } finally {
        done++;
      }
    }));
    sync(`Ilustrando as páginas (${Math.min(k + 3, imgs.length)} de ${imgs.length})…`, done, total);
  }

  sync("Finalizando capa e contracapa…", done, total);
  await capas;
  sync("Pronto!", total, total);
  return ebook;
}

/** Refaz UMA ilustração (o usuário não gostou). Capa e contracapa saem com a tipografia. */
export async function ebookRedoImage(kind: EbookKind, prompt: string, cover: boolean, estilo?: string, reference?: string) {
  const guide = KIND_GUIDE[kind] || KIND_GUIDE.guia;
  if (cover) return generateAdImage({ prompt, aspect: "2:3", quality: "high", format: "webp", model: COVER_MODEL(), reference } as any);
  const full = /Estilo:/.test(prompt) ? prompt : `${prompt}. Estilo: ${guide.illustration}${estilo ? `, ${estilo}` : ""}. Nenhum texto, letra ou número na imagem.`;
  return generateAdImage({ prompt: full, aspect: kind === "colorir" ? "3:4" : kind === "infantil" ? "4:3" : "16:9", quality: kind === "receitas" || kind === "guia" || kind === "workbook" ? "medium" : "high", format: "webp" } as any);
}
