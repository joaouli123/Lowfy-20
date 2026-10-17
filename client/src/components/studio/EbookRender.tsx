// Diagramação do e-book: o MESMO HTML/CSS é usado no preview e no PDF (impressão do navegador),
// então o que a pessoa vê é o que vai para o arquivo. Página A4 (210 × 297 mm).

export type EbookKind = "guia" | "infantil" | "colorir" | "receitas" | "workbook";
export interface EBlock { type: string; content?: string; items?: string[]; imagePrompt?: string; imageUrl?: string; label?: string; stats?: { value: string; label: string }[] }
export interface EPage { type: "cover" | "toc" | "chapter" | "content" | "cta"; title?: string; subtitle?: string; chapter?: number; blocks: EBlock[] }
export interface EBook { title: string; subtitle: string; author: string; theme: string; kind?: EbookKind; pages: EPage[]; pageCount?: number; slug?: string }

interface Theme { accent: string; ink: string; soft: string; head: string; body: string; font: string }
export const THEMES: Record<string, Theme> = {
  editorial: { accent: "#0f766e", ink: "#1f2937", soft: "#f0fdfa", head: "Georgia, 'Times New Roman', serif", body: "Georgia, 'Times New Roman', serif", font: "" },
  moderno: { accent: "#7c3aed", ink: "#111827", soft: "#f5f3ff", head: "'Poppins', Arial, sans-serif", body: "'Inter', Arial, sans-serif", font: "Poppins:wght@600;800" },
  minimal: { accent: "#111827", ink: "#374151", soft: "#f3f4f6", head: "'Inter', Arial, sans-serif", body: "'Inter', Arial, sans-serif", font: "" },
  infantil: { accent: "#f97316", ink: "#1f2937", soft: "#fff7ed", head: "'Baloo 2', 'Comic Sans MS', sans-serif", body: "'Baloo 2', 'Comic Sans MS', sans-serif", font: "Baloo+2:wght@500;700;800" },
};
export const themeOf = (b: EBook) => THEMES[b.theme] || THEMES.editorial;

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const br = (s: any) => esc(s).replace(/\n/g, "<br/>");

function blockHtml(b: EBlock, i: number): string {
  switch (b.type) {
    case "heading": return `<h2 class="h">${esc(b.content)}</h2>`;
    case "subheading": return `<h3 class="sh">${esc(b.content)}</h3>`;
    case "paragraph": return `<p class="p">${br(b.content)}</p>`;
    case "list": return `<ul class="ul">${(b.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    case "callout": return `<div class="co"><b>${esc(b.label || "Dica")}</b><span>${br(b.content)}</span></div>`;
    case "quote": return `<blockquote class="q">“${esc(b.content)}”${b.label ? `<cite>${esc(b.label)}</cite>` : ""}</blockquote>`;
    case "stats": return `<div class="st">${(b.stats || []).map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join("")}</div>`;
    case "divider": return `<hr class="hr"/>`;
    case "image": return b.imageUrl ? `<figure class="fig" data-img="${i}"><img src="${esc(b.imageUrl)}" alt=""/></figure>` : `<figure class="fig ph" data-img="${i}"><span>Ilustração</span></figure>`;
    default: return "";
  }
}

/** HTML de uma página. `n` = número da página (para o rodapé). */
export function pageHtml(p: EPage, n: number, b: EBook): string {
  const kind = b.kind || "guia";
  const img = p.blocks.find((x) => x.type === "image");
  if (p.type === "cover") {
    return `<section class="pg cover">${img?.imageUrl ? `<img class="cover-img" src="${esc(img.imageUrl)}" alt=""/>` : `<div class="cover-img ph"></div>`}
      <div class="cover-top"><h1>${esc(b.title)}</h1>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}</div>
      ${b.author ? `<div class="cover-author">${esc(b.author)}</div>` : ""}</section>`;
  }
  if (p.type === "toc") {
    const items = p.blocks[0]?.items || [];
    return `<section class="pg"><div class="in"><div class="kicker">Sumário</div><h1 class="toc-t">${kind === "colorir" ? "Desenhos deste livro" : "O que você vai encontrar"}</h1>
      <ol class="toc">${items.map((x) => `<li><span>${esc(x.replace(/^\d+\.\s*/, ""))}</span></li>`).join("")}</ol></div>${foot(n)}</section>`;
  }
  if (p.type === "cta") {
    return `<section class="pg end"><div class="in center"><div class="end-mark">✦</div><h1>${esc(p.title)}</h1>${p.blocks.map(blockHtml).join("")}${b.author ? `<p class="by">${esc(b.author)}</p>` : ""}</div></section>`;
  }
  // Livro para colorir: título, desenho grande e frase.
  if (kind === "colorir") {
    const txt = p.blocks.filter((x) => x.type === "paragraph").map((x) => esc(x.content)).join(" ");
    return `<section class="pg color"><div class="in"><h2 class="color-t">${esc(p.title)}</h2>
      ${img ? blockHtml(img, p.blocks.indexOf(img)) : ""}<p class="color-p">${txt}</p></div>${foot(n)}</section>`;
  }
  // Livro infantil: ilustração grande em cima, texto grande embaixo.
  if (kind === "infantil") {
    const txt = p.blocks.filter((x) => x.type === "paragraph").map((x) => `<p>${br(x.content)}</p>`).join("");
    return `<section class="pg kid">${img ? blockHtml(img, p.blocks.indexOf(img)) : ""}<div class="in kid-t">${txt}</div>${foot(n)}</section>`;
  }
  const opener = p.type === "chapter";
  return `<section class="pg${opener ? " opener" : ""}"><div class="in">
    ${opener ? `<div class="kicker">Capítulo ${p.chapter}</div><h1 class="ch-t">${esc(p.title)}</h1>` : ""}
    ${p.blocks.map(blockHtml).join("")}</div>${foot(n)}</section>`;
}
const foot = (n: number) => `<div class="foot">${n}</div>`;

export function ebookCss(b: EBook): string {
  const t = themeOf(b);
  return `
  .eb{--a:${t.accent};--ink:${t.ink};--soft:${t.soft};color:var(--ink);font-family:${t.body}}
  .eb *{box-sizing:border-box}
  .eb .pg{position:relative;width:210mm;min-height:297mm;background:#fff;overflow:hidden;break-after:page;page-break-after:always}
  .eb .in{padding:22mm 20mm 24mm}
  .eb .in.center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:297mm}
  .eb h1,.eb h2,.eb h3{font-family:${t.head};color:var(--ink);margin:0}
  .eb .kicker{font:700 10pt/1 ${t.head};letter-spacing:.18em;text-transform:uppercase;color:var(--a);margin-bottom:6mm}
  .eb .ch-t{font-size:30pt;line-height:1.1;margin-bottom:10mm;padding-bottom:6mm;border-bottom:3px solid var(--a)}
  .eb .toc-t{font-size:26pt;line-height:1.15;margin-bottom:12mm}
  .eb .toc{list-style:none;counter-reset:c;padding:0;margin:0}
  .eb .toc li{counter-increment:c;display:flex;gap:6mm;align-items:baseline;padding:4mm 0;border-bottom:1px solid #e5e7eb;font-size:13pt}
  .eb .toc li:before{content:counter(c,decimal-leading-zero);font:800 12pt ${t.head};color:var(--a)}
  .eb .h{font-size:18pt;line-height:1.2;margin:8mm 0 4mm}
  .eb .sh{font-size:13.5pt;margin:6mm 0 3mm;color:var(--a)}
  .eb .p{font-size:11.5pt;line-height:1.65;margin:0 0 4mm}
  .eb .ul{margin:0 0 5mm;padding-left:6mm;font-size:11.5pt;line-height:1.6}
  .eb .ul li{margin:1.5mm 0}.eb .ul li::marker{color:var(--a)}
  .eb .co{display:flex;flex-direction:column;gap:1.5mm;background:var(--soft);border-left:4px solid var(--a);border-radius:2mm;padding:5mm 6mm;margin:6mm 0;font-size:11pt;line-height:1.55;break-inside:avoid}
  .eb .co b{font:800 9.5pt ${t.head};letter-spacing:.08em;text-transform:uppercase;color:var(--a)}
  .eb .q{margin:7mm 0;padding:2mm 0 2mm 7mm;border-left:3px solid var(--a);font:italic 14pt/1.5 ${t.head};break-inside:avoid}
  .eb .q cite{display:block;margin-top:2mm;font:normal 9.5pt ${t.body};color:#6b7280}
  .eb .st{display:grid;grid-template-columns:repeat(auto-fit,minmax(35mm,1fr));gap:4mm;margin:6mm 0;break-inside:avoid}
  .eb .st div{background:var(--soft);border-radius:2mm;padding:4mm;text-align:center}
  .eb .st strong{display:block;font:800 17pt ${t.head};color:var(--a)}.eb .st span{font-size:9.5pt;color:#6b7280}
  .eb .hr{border:0;border-top:1px solid #e5e7eb;margin:7mm 0}
  .eb .fig{margin:6mm 0;border-radius:3mm;overflow:hidden;break-inside:avoid}
  .eb .fig img{display:block;width:100%;height:auto}
  .eb .fig.ph{aspect-ratio:16/9;background:var(--soft);display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10pt}
  .eb .foot{position:absolute;bottom:10mm;left:0;right:0;text-align:center;font-size:9pt;color:#9ca3af}
  .eb .cover{min-height:297mm;height:297mm;background:#111}
  .eb .cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .eb .cover-img.ph{background:linear-gradient(160deg,var(--a),#111)}
  .eb .cover-top{position:absolute;top:0;left:0;right:0;padding:26mm 18mm 34mm;text-align:center;background:linear-gradient(180deg,rgba(0,0,0,.62),rgba(0,0,0,.25) 70%,transparent)}
  .eb .cover-top h1{color:#fff;font-size:34pt;line-height:1.08;text-shadow:0 2px 12px rgba(0,0,0,.35)}
  .eb .cover-top p{color:rgba(255,255,255,.92);font-size:13pt;line-height:1.4;margin:5mm auto 0;max-width:150mm}
  .eb .cover-author{position:absolute;bottom:14mm;left:0;right:0;text-align:center;color:#fff;font:700 12pt ${t.head};letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,.6)}
  .eb .end{background:var(--soft)}
  .eb .end h1{font-size:28pt;margin:4mm 0 8mm}.eb .end-mark{font-size:30pt;color:var(--a)}.eb .end .p{max-width:130mm;font-size:13pt}
  .eb .by{margin-top:10mm;font:700 10pt ${t.head};letter-spacing:.14em;text-transform:uppercase;color:var(--a)}
  .eb .color .in{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:16mm}
  .eb .color-t{font-size:24pt;margin-bottom:6mm}
  .eb .color .fig{width:100%;border:2px solid #111;border-radius:4mm;margin:0;background:#fff}
  .eb .color-p{font-size:15pt;line-height:1.4;margin-top:6mm}
  .eb .kid .fig{margin:0;border-radius:0}
  .eb .kid .fig.ph{aspect-ratio:4/3}
  .eb .kid-t{padding-top:12mm}.eb .kid-t p{font-size:17pt;line-height:1.55;margin:0 0 4mm;text-align:center}
  `;
}

export function fontLink(b: EBook) {
  const f = themeOf(b).font;
  return f ? `https://fonts.googleapis.com/css2?family=${f}&display=swap` : "";
}

/** Abre a versão para impressão: o navegador salva como PDF (Ctrl+P → Salvar como PDF). */
export function printEbook(b: EBook) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF."); return; }
  const font = fontLink(b);
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${esc(b.title)}</title>
    ${font ? `<link rel="stylesheet" href="${font}"/>` : ""}
    <style>@page{size:A4;margin:0}html,body{margin:0;background:#e5e7eb}
    @media screen{.eb .pg{margin:8mm auto;box-shadow:0 4px 18px rgba(0,0,0,.12)}}
    @media print{html,body{background:#fff}}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}${ebookCss(b)}</style></head>
    <body><div class="eb">${b.pages.map((p, i) => pageHtml(p, i + 1, b)).join("")}</div>
    <script>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>(document.fonts?document.fonts.ready:Promise.resolve())).then(()=>setTimeout(()=>window.print(),300));</script>
    </body></html>`);
  w.document.close();
}
