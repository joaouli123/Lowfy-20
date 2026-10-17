// Diagramação do e-book: o MESMO HTML/CSS é usado no preview e no PDF (impressão do navegador),
// então o que a pessoa vê é o que vai para o arquivo. Página A4 (210 × 297 mm) de altura FIXA:
// o conteúdo de cada página lógica é medido e distribuído em folhas (quebra parágrafos e listas
// no ponto certo, título nunca fica sozinho no pé da folha).

export type EbookKind = "guia" | "infantil" | "colorir" | "receitas" | "workbook";
export interface EBlock {
  type: string; content?: string; items?: string[]; imagePrompt?: string; imageUrl?: string; label?: string;
  stats?: { value: string; label: string }[]; ordered?: boolean; cols?: number; start?: number; textInImage?: boolean;
}
export interface EPage { type: "cover" | "toc" | "intro" | "chapter" | "content" | "cta" | "back"; title?: string; subtitle?: string; chapter?: number; blocks: EBlock[] }
export interface Paleta { nome: string; accent: string }
export interface EBook { title: string; subtitle: string; author: string; theme: string; kind?: EbookKind; accent?: string; paletas?: Paleta[]; pages: EPage[]; pageCount?: number; slug?: string }

interface Theme { accent: string; ink: string; head: string; body: string; font: string }
export const THEMES: Record<string, Theme> = {
  editorial: { accent: "#0f766e", ink: "#1f2937", head: "'Playfair Display', Georgia, serif", body: "'Source Serif 4', Georgia, serif", font: "Playfair+Display:wght@600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600" },
  moderno: { accent: "#7c3aed", ink: "#111827", head: "'Poppins', Arial, sans-serif", body: "'Inter', Arial, sans-serif", font: "Poppins:wght@600;700;800&family=Inter:wght@400;600" },
  minimal: { accent: "#111827", ink: "#374151", head: "'Inter', Arial, sans-serif", body: "'Inter', Arial, sans-serif", font: "Inter:wght@400;600;800" },
  infantil: { accent: "#f97316", ink: "#1f2937", head: "'Baloo 2', 'Comic Sans MS', sans-serif", body: "'Baloo 2', 'Comic Sans MS', sans-serif", font: "Baloo+2:wght@500;700;800" },
};
export const themeOf = (b: EBook) => THEMES[b.theme] || THEMES.editorial;

/** Paletas prontas (a IA também sugere as dela, a partir do tema do livro). */
export const PALETAS: Paleta[] = [
  { nome: "Esmeralda", accent: "#0f766e" },
  { nome: "Oceano", accent: "#1d4ed8" },
  { nome: "Terracota", accent: "#c2410c" },
  { nome: "Vinho", accent: "#9f1239" },
  { nome: "Lavanda", accent: "#7c3aed" },
  { nome: "Oliva", accent: "#4d7c0f" },
  { nome: "Dourado", accent: "#b45309" },
  { nome: "Rosa", accent: "#db2777" },
  { nome: "Grafite", accent: "#1f2937" },
];
export const accentOf = (b: EBook) => (b.accent && /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : themeOf(b).accent);

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const br = (s: any) => esc(s).replace(/\n/g, "<br/>");

function blockHtml(b: EBlock, pi: number, bi: number): string {
  switch (b.type) {
    case "heading": return `<h2 class="h">${esc(b.content)}</h2>`;
    case "subheading": return `<h3 class="sh">${esc(b.content)}</h3>`;
    case "paragraph": return `<p class="p">${br(b.content)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const cls = `ul${b.ordered ? " ol" : ""}${b.cols === 2 ? " cols2" : ""}`;
      return `<${tag} class="${cls}"${b.ordered && b.start ? ` start="${b.start}"` : ""}>${(b.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</${tag}>`;
    }
    case "callout": return `<div class="co"><b>${esc(b.label || "Dica")}</b><span>${br(b.content)}</span></div>`;
    case "quote": return `<blockquote class="q">“${esc(b.content)}”${b.label ? `<cite>${esc(b.label)}</cite>` : ""}</blockquote>`;
    case "stats": return `<div class="st">${(b.stats || []).map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join("")}</div>`;
    case "divider": return `<hr class="hr"/>`;
    case "image": return b.imageUrl
      ? `<figure class="fig" data-pi="${pi}" data-bi="${bi}"><img src="${esc(b.imageUrl)}" alt=""/></figure>`
      : `<figure class="fig ph" data-pi="${pi}" data-bi="${bi}"><span>Ilustração</span></figure>`;
    default: return "";
  }
}

const foot = (n: number) => `<div class="foot">${n}</div>`;

function coverHtml(p: EPage, pi: number, b: EBook, back = false): string {
  const bi = p.blocks.findIndex((x) => x.type === "image");
  const img = p.blocks[bi];
  const arte = img?.imageUrl ? `<img class="cover-img" src="${esc(img.imageUrl)}" alt="" data-pi="${pi}" data-bi="${bi}"/>` : `<div class="cover-img ph" data-pi="${pi}" data-bi="${Math.max(0, bi)}"></div>`;
  // Arte com o texto já desenhado pela IA: não sobrepõe nada.
  if (img?.imageUrl && img.textInImage) return `<section class="pg cover">${arte}</section>`;
  if (back) {
    return `<section class="pg cover back">${arte}<div class="back-box"><h2>${esc(b.title)}</h2>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}${b.author ? `<span>${esc(b.author)}</span>` : ""}</div></section>`;
  }
  return `<section class="pg cover">${arte}
    <div class="cover-top"><h1>${esc(b.title)}</h1>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}</div>
    ${b.author ? `<div class="cover-author">${esc(b.author)}</div>` : ""}</section>`;
}

/** Páginas de layout fixo (capa, infantil, colorir): uma folha cada, sem medir. */
function fixedHtml(p: EPage, pi: number, b: EBook): string | null {
  const kind = b.kind || "guia";
  if (p.type === "cover") return coverHtml(p, pi, b);
  if (p.type === "back") return coverHtml(p, pi, b, true);
  const bi = p.blocks.findIndex((x) => x.type === "image");
  const img = bi >= 0 ? blockHtml(p.blocks[bi], pi, bi) : "";
  if (kind === "colorir" && (p.type === "chapter" || p.type === "content")) {
    const txt = p.blocks.filter((x) => x.type === "paragraph").map((x) => esc(x.content)).join(" ");
    return `<section class="pg color"><div class="in"><h2 class="color-t">${esc(p.title)}</h2>${img}<p class="color-p">${txt}</p></div></section>`;
  }
  if (kind === "infantil" && (p.type === "chapter" || p.type === "content")) {
    const txt = p.blocks.filter((x) => x.type === "paragraph").map((x) => `<p>${br(x.content)}</p>`).join("");
    return `<section class="pg kid">${img}<div class="in kid-t">${txt}</div></section>`;
  }
  return null;
}

function headerHtml(p: EPage, b: EBook): string {
  if (p.type === "chapter") return `<div class="kicker">Capítulo ${p.chapter}</div><h1 class="ch-t">${esc(p.title)}</h1>`;
  if (p.type === "intro") return `<div class="kicker">Introdução</div><h1 class="ch-t">${esc(p.title)}</h1>`;
  if (p.type === "cta") return `<div class="end-mark">✦</div><h1 class="ch-t">${esc(p.title)}</h1>`;
  return "";
}

export function ebookCss(b: EBook): string {
  const t = themeOf(b);
  return `
  .eb{--a:${accentOf(b)};--ink:${t.ink};--soft:color-mix(in srgb,var(--a) 8%,#fff);--line:color-mix(in srgb,var(--a) 22%,#e5e7eb);color:var(--ink);font-family:${t.body}}
  .eb *{box-sizing:border-box}
  .eb .pg{position:relative;width:210mm;height:297mm;background:#fff;overflow:hidden;break-after:page;page-break-after:always}
  .eb .in{padding:20mm 20mm 0}
  .eb .flow{display:flow-root}
  .eb h1,.eb h2,.eb h3{font-family:${t.head};color:var(--ink);margin:0}
  .eb .kicker{font:700 9.5pt/1 ${t.head};letter-spacing:.2em;text-transform:uppercase;color:var(--a);margin-bottom:5mm}
  .eb .ch-t{font-size:28pt;line-height:1.1;margin-bottom:9mm;padding-bottom:5mm;border-bottom:3px solid var(--a)}
  .eb .toc-t{font-size:26pt;line-height:1.15;margin-bottom:10mm}
  .eb .toc{list-style:none;padding:0;margin:0}
  .eb .toc li{display:flex;align-items:baseline;gap:3mm;padding:2.6mm 0;font-size:12pt}
  .eb .toc li.c{font:700 13pt ${t.head};padding-top:5mm;border-top:1px solid var(--line)}
  .eb .toc li.c:first-child{border-top:0;padding-top:0}
  .eb .toc li.c em{font-style:normal;color:var(--a);min-width:9mm}
  .eb .toc li.s{padding:1.4mm 0 1.4mm 12mm;font-size:11pt;color:#4b5563}
  .eb .toc li i{flex:1;border-bottom:1px dotted #cbd5e1;transform:translateY(-1mm)}
  .eb .toc li b{font:700 11pt ${t.head};color:var(--a);min-width:8mm;text-align:right}
  .eb .h{font-size:18pt;line-height:1.2;margin:7mm 0 4mm}
  .eb .flow>.h:first-child,.eb .flow>.sh:first-child{margin-top:0}
  .eb .sh{font-size:12.5pt;margin:5mm 0 2.5mm;color:var(--a);text-transform:uppercase;letter-spacing:.06em}
  .eb .p{font-size:11.2pt;line-height:1.62;margin:0 0 3.6mm;text-align:justify;hyphens:auto}
  .eb .ul{margin:0 0 4.5mm;padding-left:6mm;font-size:11.2pt;line-height:1.55}
  .eb .ul li{margin:1.3mm 0}.eb .ul li::marker{color:var(--a);font-weight:700}
  .eb .ul.cols2{columns:2;column-gap:10mm}.eb .ul.cols2 li{break-inside:avoid}
  .eb .ol{padding-left:7mm}
  .eb .co{display:flex;flex-direction:column;gap:1.5mm;background:var(--soft);border-left:4px solid var(--a);border-radius:2mm;padding:4.5mm 6mm;margin:5mm 0;font-size:10.8pt;line-height:1.55}
  .eb .co b{font:800 9pt ${t.head};letter-spacing:.1em;text-transform:uppercase;color:var(--a)}
  .eb .q{margin:6mm 0;padding:2mm 0 2mm 7mm;border-left:3px solid var(--a);font:italic 14pt/1.5 ${t.head}}
  .eb .q cite{display:block;margin-top:2mm;font:normal 9.5pt ${t.body};color:#6b7280}
  .eb .st{display:grid;grid-template-columns:repeat(auto-fit,minmax(35mm,1fr));gap:4mm;margin:5mm 0}
  .eb .st div{background:var(--soft);border-radius:2mm;padding:3.5mm;text-align:center}
  .eb .st strong{display:block;font:800 15pt ${t.head};color:var(--a)}.eb .st span{font-size:9pt;color:#6b7280}
  .eb .hr{border:0;border-top:1px solid var(--line);margin:6mm 0}.eb .hr.sep{margin:9mm 0 8mm;border-top-width:2px}
  .eb .fig{margin:5mm 0;border-radius:3mm;overflow:hidden;height:82mm;background:var(--soft)}
  .eb .fig img{display:block;width:100%;height:100%;object-fit:cover}
  .eb .fig.ph{display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10pt}
  .eb .foot{position:absolute;bottom:9mm;left:20mm;right:20mm;display:flex;justify-content:space-between;font-size:8.5pt;color:#9ca3af;border-top:1px solid #eef0f3;padding-top:3mm}
  .eb .foot span{max-width:120mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .eb .cover{background:#111}
  .eb .cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .eb .cover-img.ph{background:linear-gradient(160deg,var(--a),#111)}
  .eb .cover-top{position:absolute;top:0;left:0;right:0;padding:26mm 18mm 34mm;text-align:center;background:linear-gradient(180deg,rgba(0,0,0,.62),rgba(0,0,0,.25) 70%,transparent)}
  .eb .cover-top h1{color:#fff;font-size:34pt;line-height:1.08;text-shadow:0 2px 12px rgba(0,0,0,.35)}
  .eb .cover-top p{color:rgba(255,255,255,.92);font-size:13pt;line-height:1.4;margin:5mm auto 0;max-width:150mm}
  .eb .cover-author{position:absolute;bottom:14mm;left:0;right:0;text-align:center;color:#fff;font:700 12pt ${t.head};letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.6)}
  .eb .back-box{position:absolute;left:18mm;right:18mm;bottom:22mm;background:rgba(255,255,255,.94);border-radius:4mm;padding:9mm 10mm;text-align:center}
  .eb .back-box h2{font-size:18pt;line-height:1.2}.eb .back-box p{font-size:11pt;line-height:1.5;margin:3mm 0 0;color:#4b5563}
  .eb .back-box span{display:block;margin-top:5mm;font:700 9.5pt ${t.head};letter-spacing:.16em;text-transform:uppercase;color:var(--a)}
  .eb .notes{margin-top:7mm;border:1px solid var(--line);border-radius:3mm;padding:5mm 6mm;background:repeating-linear-gradient(to bottom,transparent 0,transparent 9mm,var(--line) 9mm,var(--line) calc(9mm + 1px));background-origin:content-box;background-clip:content-box}
  .eb .notes b{display:block;margin-bottom:4mm;font:800 9pt ${t.head};letter-spacing:.12em;text-transform:uppercase;color:var(--a);background:#fff}
  .eb .end{background:var(--soft)}
  .eb .end-mark{font-size:26pt;color:var(--a);margin-bottom:3mm}
  .eb .color .in{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:16mm}
  .eb .color-t{font-size:24pt;margin-bottom:6mm}
  .eb .color .fig{width:100%;height:205mm;border:2px solid #111;border-radius:4mm;margin:0;background:#fff}
  .eb .color .fig img{object-fit:contain}
  .eb .color-p{font-size:15pt;line-height:1.4;margin-top:6mm}
  .eb .kid .fig{margin:0;border-radius:0;height:158mm}
  .eb .kid-t{padding-top:12mm}.eb .kid-t p{font-size:17pt;line-height:1.55;margin:0 0 4mm;text-align:center}
  `;
}

export function fontLink(b: EBook) {
  const f = themeOf(b).font;
  return f ? `https://fonts.googleapis.com/css2?family=${f}&display=swap` : "";
}

/** Garante a fonte do tema carregada antes de medir (senão a quebra muda depois). */
async function loadFont(b: EBook) {
  const href = fontLink(b);
  if (href && !document.querySelector(`link[href="${href}"]`)) {
    const l = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    await new Promise<void>((r) => { l.onload = l.onerror = () => r(); document.head.appendChild(l); setTimeout(r, 4000); });
  }
  const t = themeOf(b);
  try {
    await Promise.race([
      Promise.all([`700 20px ${t.head}`, `400 14px ${t.body}`, `italic 400 14px ${t.head}`].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch { /* segue com a fonte de reserva */ }
}

export interface Sheet { html: string; images: { pi: number; bi: number }[]; cover?: boolean }

const MM = 96 / 25.4;
const LIMIT = (297 - 24) * MM; // até onde o conteúdo pode descer (o rodapé fica abaixo)

/**
 * Distribui o livro em folhas A4. Mede no DOM (fora da tela) com a mesma CSS do PDF.
 * Parágrafos e listas são cortados onde a folha acaba; o resto continua na próxima.
 */
export async function paginate(b: EBook): Promise<Sheet[]> {
  await loadFont(b);
  const host = document.createElement("div");
  host.className = "eb";
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none";
  host.innerHTML = `<style>${ebookCss(b)}</style>`;
  document.body.appendChild(host);

  type Raw = { el: HTMLElement; kind: "fixed" | "flow" | "toc"; pi: number; opener?: boolean; label?: string };
  const raws: Raw[] = [];
  const marks: { pi: number; sheet: number; title: string; level: "c" | "s" }[] = [];
  const kind = b.kind || "guia";

  const newSheet = (cls: string, header: string) => {
    const s = document.createElement("section");
    s.className = `pg${cls ? ` ${cls}` : ""}`;
    s.innerHTML = `<div class="in"><div class="flow">${header}</div></div>`;
    host.appendChild(s);
    return { s, flow: s.querySelector(".flow") as HTMLElement };
  };
  const fits = (s: HTMLElement, flow: HTMLElement) => flow.getBoundingClientRect().bottom - s.getBoundingClientRect().top <= LIMIT;
  const toEl = (html: string) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };

  // Última folha corrida: a página seguinte do MESMO capítulo continua nela se sobrar espaço.
  let aberta: { s: HTMLElement; flow: HTMLElement; chapter?: number } | null = null;

  try {
    b.pages.forEach((p, pi) => {
      if (p.type === "toc") { aberta = null; raws.push({ el: document.createElement("section"), kind: "toc", pi }); return; }
      const fixed = fixedHtml(p, pi, b);
      if (fixed != null) { aberta = null; const el = toEl(fixed); host.appendChild(el); raws.push({ el, kind: "fixed", pi }); return; }

      const cls = p.type === "cta" ? "end" : "";
      const capTitle = p.chapter ? b.pages.find((x) => x.type === "chapter" && x.chapter === p.chapter)?.title : "";
      const label = p.chapter ? `Capítulo ${p.chapter} · ${capTitle || p.title}` : b.title;
      const sobra = aberta ? LIMIT - (aberta.flow.getBoundingClientRect().bottom - aberta.s.getBoundingClientRect().top) : 0;
      const continua = !!aberta && p.type === "content" && aberta.chapter === p.chapter && sobra > LIMIT * 0.35;
      // Fim de capítulo com folha meio vazia: vira espaço de anotações (receitas e workbook).
      if (aberta && !continua && (kind === "receitas" || kind === "workbook") && sobra > LIMIT * 0.28) {
        aberta.flow.insertAdjacentHTML("beforeend", `<div class="notes" style="height:${Math.floor(sobra - 8 * MM)}px"><b>Anotações</b></div>`);
      }
      let cur: { s: HTMLElement; flow: HTMLElement };
      if (continua) {
        cur = aberta!;
        cur.flow.insertAdjacentHTML("beforeend", `<hr class="hr sep"/>`);
      } else {
        cur = newSheet(cls, headerHtml(p, b));
        raws.push({ el: cur.s, kind: "flow", pi, label });
      }
      if (p.type === "chapter" || p.type === "intro") marks.push({ pi, sheet: raws.length - 1, title: p.title || "", level: "c" });
      const base = continua ? 0 : cur.flow.children.length; // elementos do cabeçalho
      let fresh = !continua; // folha ainda sem conteúdo (só cabeçalho)

      const nextSheet = () => {
        // Título não fica sozinho no pé da folha: leva junto para a próxima.
        const carry: HTMLElement[] = [];
        while (cur.flow.children.length > base + 1) {
          const last = cur.flow.lastElementChild as HTMLElement;
          if (!last || !/^(H2|H3)$/.test(last.tagName)) break;
          carry.unshift(last); last.remove();
        }
        const ultimo = cur.flow.lastElementChild as HTMLElement | null;
        if (ultimo?.classList.contains("sep")) ultimo.remove();
        cur = newSheet(cls, "");
        raws.push({ el: cur.s, kind: "flow", pi, label });
        carry.forEach((c) => cur.flow.appendChild(c));
        fresh = carry.length === 0;
        for (const c of carry) { const m = marks.find((x) => x.level === "s" && (x as any).node === c); if (m) m.sheet = raws.length - 1; }
      };

      const queue: { blk: EBlock; bi: number }[] = p.blocks.map((blk, bi) => ({ blk, bi }));
      while (queue.length) {
        const { blk, bi } = queue.shift()!;
        const el = toEl(blockHtml(blk, pi, bi));
        if (!el) continue;
        cur.flow.appendChild(el);
        if (fits(cur.s, cur.flow)) {
          fresh = false;
          if (blk.type === "heading" && (kind === "receitas")) marks.push({ pi, sheet: raws.length - 1, title: blk.content || "", level: "s", node: el } as any);
          continue;
        }
        el.remove();
        // Tenta cortar parágrafo/lista no ponto exato.
        const cut = split(blk, (part) => {
          const t = toEl(blockHtml(part, pi, bi));
          cur.flow.appendChild(t);
          const ok = fits(cur.s, cur.flow);
          t.remove();
          return ok;
        });
        if (cut) {
          cur.flow.appendChild(toEl(blockHtml(cut[0], pi, bi)));
          queue.unshift({ blk: cut[1], bi });
          nextSheet();
          continue;
        }
        if (fresh && cur.flow.children.length <= base) {
          // Não cabe nem numa folha vazia: coloca assim mesmo (o excesso é cortado).
          cur.flow.appendChild(el); fresh = false; continue;
        }
        nextSheet();
        queue.unshift({ blk, bi });
      }
      aberta = p.type === "cta" ? null : { ...cur, chapter: p.chapter };
    });

    // Sumário: precisa dos números das folhas (e pode ocupar mais de uma).
    const tocIdx = raws.findIndex((r) => r.kind === "toc");
    let sheets: HTMLElement[][] = raws.map((r) => [r.el]);
    if (tocIdx >= 0) {
      const tocPage = b.pages[raws[tocIdx].pi];
      let extra = 0, tocSheets: HTMLElement[] = [];
      for (let tries = 0; tries < 3; tries++) {
        tocSheets.forEach((s) => s.remove());
        tocSheets = [];
        const num = (sheet: number) => sheet + 1 + (sheet > tocIdx ? extra : 0);
        const rows = marks.length ? marks.map((m) => {
          const pg = b.pages[m.pi];
          const pre = m.level === "c" ? (pg.type === "chapter" ? `<em>${String(pg.chapter).padStart(2, "0")}</em>` : `<em>✦</em>`) : "";
          return `<li class="${m.level}">${pre}<span>${esc(m.title)}</span><i></i><b>${num(m.sheet)}</b></li>`;
        }) : (tocPage.blocks[0]?.items || []).map((x) => `<li class="c"><span>${esc(x.replace(/^\d+\.\s*/, ""))}</span></li>`);
        const head = `<div class="kicker">Sumário</div><h1 class="toc-t">${kind === "colorir" ? "Desenhos deste livro" : "O que você vai encontrar"}</h1>`;
        let cur = newSheet("", head);
        let ol = document.createElement("ol"); ol.className = "toc"; cur.flow.appendChild(ol);
        tocSheets.push(cur.s);
        for (const r of rows) {
          const li = toEl(r); ol.appendChild(li);
          if (!fits(cur.s, cur.flow) && ol.children.length > 1) {
            li.remove();
            cur = newSheet("", ""); ol = document.createElement("ol"); ol.className = "toc"; cur.flow.appendChild(ol); ol.appendChild(li);
            tocSheets.push(cur.s);
          }
        }
        if (tocSheets.length - 1 === extra) break;
        extra = tocSheets.length - 1;
      }
      sheets[tocIdx] = tocSheets;
    }

    const flat = sheets.flat();
    const out: Sheet[] = flat.map((el, i) => {
      const raw = raws.find((r) => r.el === el);
      const isCover = el.classList.contains("cover");
      const images = Array.from(el.querySelectorAll<HTMLElement>("[data-bi]")).map((x) => ({ pi: Number(x.dataset.pi), bi: Number(x.dataset.bi) }));
      if (!isCover && !el.classList.contains("color") && !el.classList.contains("kid")) {
        el.insertAdjacentHTML("beforeend", `<div class="foot"><span>${esc(raw?.label || b.title)}</span><span>${i + 1}</span></div>`);
      } else if (!isCover) {
        el.insertAdjacentHTML("beforeend", `<div class="foot" style="justify-content:center;border:0">${i + 1}</div>`);
      }
      return { html: el.outerHTML, images, cover: isCover };
    });
    return out;
  } finally {
    host.remove();
  }
}

/** Corta um parágrafo (por palavras) ou lista (por itens) no maior pedaço que cabe. */
function split(blk: EBlock, cabe: (part: EBlock) => boolean): [EBlock, EBlock] | null {
  if (blk.type === "paragraph" && blk.content) {
    const words = blk.content.split(/\s+/);
    if (words.length < 16) return null;
    let lo = 0, hi = words.length - 6;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (cabe({ ...blk, content: words.slice(0, mid).join(" ") })) lo = mid; else hi = mid - 1;
    }
    if (lo < 10) return null; // menos de ~2 linhas: melhor ir inteiro para a próxima folha
    return [{ ...blk, content: words.slice(0, lo).join(" ") }, { ...blk, content: words.slice(lo).join(" ") }];
  }
  if (blk.type === "list" && blk.items && blk.items.length > 1) {
    let k = 0;
    for (let i = 1; i < blk.items.length; i++) { if (cabe({ ...blk, items: blk.items.slice(0, i) })) k = i; else break; }
    if (k < 1) return null;
    const start = (blk.start || 1) + k;
    return [{ ...blk, items: blk.items.slice(0, k) }, { ...blk, items: blk.items.slice(k), start }];
  }
  return null;
}

/** HTML completo das folhas (preview grande e impressão). */
export function sheetsDocument(b: EBook, sheets: Sheet[], print = false) {
  const font = fontLink(b);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${esc(b.title)}</title>
    ${font ? `<link rel="stylesheet" href="${font}"/>` : ""}
    <style>@page{size:A4;margin:0}html,body{margin:0;background:#e5e7eb}
    @media screen{.eb .pg{margin:8mm auto;box-shadow:0 4px 18px rgba(0,0,0,.12)}}
    @media print{html,body{background:#fff}.eb .pg{margin:0;box-shadow:none}}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}${ebookCss(b)}</style></head>
    <body><div class="eb">${sheets.map((s) => s.html).join("")}</div>
    ${print ? `<script>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>(document.fonts?document.fonts.ready:Promise.resolve())).then(()=>setTimeout(()=>window.print(),300));</script>` : ""}
    </body></html>`;
}

/** Abre a versão para impressão: o navegador salva como PDF (Ctrl+P → Salvar como PDF). */
export async function printEbook(b: EBook, ready?: Sheet[]) {
  const w = window.open("", "_blank"); // abre já no clique (senão o navegador bloqueia)
  if (!w) { alert("Permita pop-ups para gerar o PDF."); return; }
  w.document.write(`<p style="font:14px system-ui;padding:24px">Montando o PDF…</p>`);
  const sheets = ready?.length ? ready : await paginate(b);
  w.document.open();
  w.document.write(sheetsDocument(b, sheets, true));
  w.document.close();
}
