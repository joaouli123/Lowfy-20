import { llmJson } from "./aiStudio";

/**
 * Ebook Studio — gerador de ebooks profissionais diagramados (estilo Gamma).
 * Pipeline em etapas: outline (título/capítulos/seções) → expansão de cada
 * capítulo em páginas com blocos → montagem (capa + sumário + conteúdo + CTA).
 * As imagens entram como `imagePrompt` (a geração real é da Etapa B).
 */

export type EbookBlockType =
  | "heading" | "subheading" | "paragraph" | "list"
  | "image" | "callout" | "quote" | "stats" | "divider";

export interface EbookBlock {
  type: EbookBlockType;
  content?: string;
  items?: string[];
  imagePrompt?: string;
  imageUrl?: string;
  label?: string;
  stats?: { value: string; label: string }[];
}

export interface EbookPage {
  type: "cover" | "toc" | "chapter" | "content" | "cta";
  title?: string;
  subtitle?: string;
  chapter?: number;
  blocks: EbookBlock[];
}

export interface Ebook {
  title: string;
  subtitle: string;
  author: string;
  theme: string;
  withImages: boolean;
  pageCount: number;
  pages: EbookPage[];
}

export interface EbookInput {
  assunto: string;
  publico?: string;
  objetivo?: string;
  tom?: string;
  paginas?: number;
  idioma?: string;
  autor?: string;
  comImagens?: boolean;
  tema?: string;
}

const OUTLINE_SYSTEM = `Você é um autor e editor profissional de ebooks de alta qualidade. Crie a ESTRUTURA (outline) de um ebook a partir do tema do usuário.
Responda SOMENTE com JSON válido:
{"title":"Título forte e vendável","subtitle":"Subtítulo que promete um resultado","chapters":[{"title":"Título do capítulo","sections":[{"heading":"Título da seção","brief":"1 frase do que a seção cobre"}]}]}
Regras: gere exatamente o número de capítulos pedido; 2 a 4 seções por capítulo; progressão lógica (fundamentos → aplicação → avançado → próximos passos). Específico e original ao tema, no idioma pedido. Só o JSON.`;

const CHAPTER_SYSTEM = `Você é um autor profissional escrevendo o CONTEÚDO de um capítulo de ebook, já diagramado em páginas com blocos.
Responda SOMENTE com JSON válido:
{"pages":[{"title":"Título da página","blocks":[ {"type":"heading","content":"..."}, {"type":"paragraph","content":"..."}, {"type":"list","items":["...","..."]}, {"type":"callout","label":"Dica","content":"..."}, {"type":"quote","content":"...","label":"— autor"}, {"type":"stats","stats":[{"value":"73%","label":"..."}]}, {"type":"image","imagePrompt":"descrição visual da figura"} ]}]}
Tipos de bloco permitidos: heading, subheading, paragraph, list, callout, quote, stats, image, divider.
Regras: conteúdo real, denso e útil (não meta-texto); parágrafos de 2-4 frases; use callout/quote/stats/list para dar ritmo visual; cada página começa com um "heading". Idioma e tom conforme pedido. Só o JSON.`;

function sanitizeBlocks(blocks: any, withImages?: boolean): EbookBlock[] {
  const allowed = new Set<EbookBlockType>(["heading", "subheading", "paragraph", "list", "image", "callout", "quote", "stats", "divider"]);
  const out: EbookBlock[] = [];
  for (const b of (Array.isArray(blocks) ? blocks : []).slice(0, 14)) {
    if (!b || !allowed.has(b.type)) continue;
    if (b.type === "image" && !withImages) continue;
    const block: EbookBlock = { type: b.type };
    if (typeof b.content === "string") block.content = b.content.slice(0, 2000);
    if (Array.isArray(b.items)) block.items = b.items.map((x: any) => String(x)).slice(0, 10);
    if (b.type === "image") block.imagePrompt = String(b.imagePrompt || b.content || "").slice(0, 400);
    if ((b.type === "callout" || b.type === "quote") && b.label) block.label = String(b.label).slice(0, 80);
    if (b.type === "stats" && Array.isArray(b.stats)) block.stats = b.stats.slice(0, 4).map((s: any) => ({ value: String(s?.value || "").slice(0, 12), label: String(s?.label || "").slice(0, 60) }));
    out.push(block);
  }
  return out;
}

/** Gera um ebook completo a partir da descrição do usuário. */
export async function generateEbook(input: EbookInput): Promise<Ebook> {
  const target = Math.max(6, Math.min(60, Math.round(input.paginas || 20)));
  const contentTarget = Math.max(4, target - 3); // capa + sumário + cta
  const chaptersCount = Math.max(3, Math.min(12, Math.round(contentTarget / 2.2)));
  const lang = input.idioma || "Português do Brasil";
  const tom = input.tom || "didático e profissional";

  // 1) Outline
  const outline = await llmJson(
    OUTLINE_SYSTEM,
    `Tema: ${input.assunto}\nPúblico-alvo: ${input.publico || "geral"}\nObjetivo: ${input.objetivo || "educar e gerar autoridade"}\nTom: ${tom}\nIdioma: ${lang}\nNúmero de capítulos: ${chaptersCount}`,
    0.7,
  );
  const title = String(outline?.title || input.assunto).slice(0, 120);
  const subtitle = String(outline?.subtitle || "").slice(0, 160);
  const chapters: any[] = (Array.isArray(outline?.chapters) ? outline.chapters : []).slice(0, chaptersCount);
  if (!chapters.length) throw new Error("A IA não retornou um outline válido");

  // 2) Expansão por capítulo
  const pagesPerChapter = Math.max(1, Math.round(contentTarget / chapters.length));
  const contentPages: EbookPage[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const data = await llmJson(
      CHAPTER_SYSTEM,
      `Ebook: "${title}".\nCapítulo ${i + 1}: "${ch?.title}".\nSeções: ${JSON.stringify(ch?.sections || [])}.\nTom: ${tom}. Idioma: ${lang}.\nGere ${pagesPerChapter} página(s) para este capítulo. ${input.comImagens ? "Inclua 1 bloco 'image' com imagePrompt descritivo quando enriquecer a página." : "NÃO inclua blocos de imagem."}`,
      0.75,
    );
    const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
    pages.slice(0, pagesPerChapter + 1).forEach((p, idx) => {
      contentPages.push({
        type: idx === 0 ? "chapter" : "content",
        title: String(p?.title || ch?.title || `Capítulo ${i + 1}`).slice(0, 120),
        chapter: i + 1,
        blocks: sanitizeBlocks(p?.blocks, input.comImagens),
      });
    });
  }

  // 3) Montagem final
  const pages: EbookPage[] = [];
  pages.push({ type: "cover", title, subtitle, blocks: [] });
  pages.push({ type: "toc", title: "Sumário", blocks: [{ type: "list", items: chapters.map((c, i) => `${i + 1}. ${String(c?.title || "").slice(0, 80)}`) }] });
  pages.push(...contentPages);
  pages.push({
    type: "cta",
    title: "Próximos passos",
    blocks: [
      { type: "paragraph", content: "Você chegou ao fim — agora é hora de colocar em prática. Revise os pontos-chave e dê o primeiro passo hoje mesmo." },
      { type: "callout", label: "Continue", content: "Aplique o que aprendeu e compartilhe seus resultados." },
    ],
  });

  return {
    title,
    subtitle,
    author: String(input.autor || "").slice(0, 80),
    theme: input.tema || "editorial",
    withImages: !!input.comImagens,
    pageCount: pages.length,
    pages,
  };
}
