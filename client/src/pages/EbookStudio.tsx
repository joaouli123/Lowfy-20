import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Sparkles, Loader2, Plus, ArrowLeft, Save, Trash2, Image as ImageIcon,
  Lightbulb, RefreshCw, ArrowUp, ArrowDown, FileDown, FileText, FileCode, Wand2, Check,
} from "lucide-react";

interface Block { type: string; content?: string; items?: string[]; imagePrompt?: string; imageUrl?: string; label?: string; stats?: { value: string; label: string }[] }
interface Page { type: string; title?: string; subtitle?: string; chapter?: number; blocks: Block[]; author?: string }
interface Ebook { title: string; subtitle: string; author: string; theme: string; withImages: boolean; pageCount: number; pages: Page[] }

const TOM = ["Didático", "Inspirador", "Técnico", "Conversacional", "Persuasivo"];
const TEMAS = [
  { v: "editorial", label: "Editorial" },
  { v: "moderno", label: "Moderno" },
  { v: "corporativo", label: "Corporativo" },
  { v: "minimal", label: "Minimal" },
];

type Theme = { accent: string; accentSoft: string; coverBg: string; font: string };
const THEMES: Record<string, Theme> = {
  editorial: { accent: "#0d9b6e", accentSoft: "#ecfdf5", coverBg: "linear-gradient(150deg,#0f3d2e,#0d9b6e 95%)", font: "Georgia, 'Times New Roman', serif" },
  moderno: { accent: "#7c3aed", accentSoft: "#f5f3ff", coverBg: "linear-gradient(150deg,#1e1b4b,#7c3aed 95%)", font: "'Inter', system-ui, sans-serif" },
  corporativo: { accent: "#1d4ed8", accentSoft: "#eff6ff", coverBg: "linear-gradient(150deg,#0f172a,#1d4ed8 95%)", font: "'Inter', system-ui, sans-serif" },
  minimal: { accent: "#111827", accentSoft: "#f3f4f6", coverBg: "#111827", font: "'Inter', system-ui, sans-serif" },
};
const themeOf = (t: string): Theme => THEMES[t] || THEMES.editorial;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-xs font-medium px-3 h-8 rounded-lg border transition ${active ? "bg-accent text-accent-foreground border-primary/30 shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"}`}>
      {children}
    </button>
  );
}

// ============================ EXPORT (HTML / PDF / EPUB) ============================
function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function blockHtml(b: Block): string {
  switch (b.type) {
    case "heading": return `<h2>${esc(b.content)}</h2>`;
    case "subheading": return `<h3>${esc(b.content)}</h3>`;
    case "paragraph": return `<p>${esc(b.content)}</p>`;
    case "list": return `<ul>${(b.items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "callout": return `<div class="callout">${b.label ? `<div class="cl-l">${esc(b.label)}</div>` : ""}<p>${esc(b.content)}</p></div>`;
    case "quote": return `<blockquote>“${esc(b.content)}”${b.label ? `<cite>${esc(b.label)}</cite>` : ""}</blockquote>`;
    case "stats": return `<div class="stats">${(b.stats || []).map((s) => `<div class="stat"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join("")}</div>`;
    case "image": return b.imageUrl ? `<img class="fig" src="${esc(b.imageUrl)}" alt=""/>` : "";
    case "divider": return `<hr/>`;
    default: return "";
  }
}
function pageHtml(p: Page, idx: number, ebook: Ebook): string {
  if (p.type === "cover") {
    return `<section class="page cover"><div class="cv-tag">Ebook</div><div class="cv-mid"><h1>${esc(p.title)}</h1>${p.subtitle ? `<p class="cv-sub">${esc(p.subtitle)}</p>` : ""}</div><div class="cv-au">${esc(ebook.author)}</div></section>`;
  }
  if (p.type === "toc") {
    return `<section class="page"><h2 class="toc-h">${esc(p.title)}</h2><div class="toc">${(p.blocks[0]?.items || []).map((i) => `<div class="toc-i">${esc(i)}</div>`).join("")}</div></section>`;
  }
  const head = p.type === "chapter" && p.chapter != null ? `<div class="ch">Capítulo ${p.chapter}</div>` : "";
  return `<section class="page">${head}${p.blocks.map(blockHtml).join("")}<div class="pn">${idx + 1}</div></section>`;
}
function buildExportHtml(ebook: Ebook, forPrint: boolean): string {
  const th = themeOf(ebook.theme);
  const body = ebook.pages.map((p, i) => pageHtml(p, i, ebook)).join("\n");
  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${th.font};color:#1f2937;background:#e5e7eb}
    .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto 10mm;padding:24mm 22mm;position:relative;box-shadow:0 4px 24px rgba(0,0,0,.12)}
    .cover{background:${th.coverBg};color:#fff;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
    .cv-tag{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.8}
    .cover h1{font-size:46px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
    .cv-sub{font-size:19px;margin-top:18px;opacity:.92;line-height:1.5}
    .cv-au{font-size:15px;opacity:.85}
    h2{font-size:26px;font-weight:700;color:#0f172a;margin:0 0 12px;letter-spacing:-.01em}
    h3{font-size:18px;font-weight:600;color:#1e293b;margin:14px 0 6px}
    p{font-size:15px;line-height:1.7;color:#374151;margin:0 0 12px}
    ul{margin:0 0 12px 18px}li{font-size:15px;line-height:1.7;color:#374151;margin-bottom:5px}
    .callout{border-left:4px solid ${th.accent};background:${th.accentSoft};padding:14px 18px;border-radius:0 8px 8px 0;margin:14px 0}
    .cl-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${th.accent};margin-bottom:5px}
    blockquote{border-left:3px solid #cbd5e1;padding-left:18px;margin:16px 0;font-style:italic;color:#475569;font-size:18px}
    blockquote cite{display:block;font-style:normal;font-size:13px;color:#94a3b8;margin-top:6px}
    .stats{display:flex;gap:14px;margin:14px 0;flex-wrap:wrap}
    .stat{flex:1;min-width:120px;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:14px;text-align:center}
    .stat .v{font-size:30px;font-weight:800;color:${th.accent}}
    .stat .l{font-size:12px;color:#64748b;margin-top:4px}
    .fig{width:100%;border-radius:10px;margin:14px 0;border:1px solid #e5e7eb}
    hr{border:none;border-top:1px solid #e5e7eb;margin:16px 0}
    .ch{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${th.accent};margin-bottom:8px}
    .toc-h{font-size:30px;margin-bottom:20px}
    .toc-i{font-size:16px;color:#334155;padding:10px 0;border-bottom:1px dashed #e2e8f0}
    .pn{position:absolute;bottom:14mm;left:0;right:0;text-align:center;font-size:11px;color:#94a3b8}
    ${forPrint ? `@page{size:A4;margin:0}@media print{body{background:#fff}.page{box-shadow:none;margin:0;page-break-after:always}}` : ""}
  `;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ebook.title)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${css}</style></head><body>${body}</body></html>`;
}
function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function slugify(s: string) { return (s || "ebook").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ebook"; }

async function exportEpub(ebook: Ebook) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const th = themeOf(ebook.theme);
  zip.file("mimetype", "application/epub+zip");
  zip.folder("META-INF")!.file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const oebps = zip.folder("OEBPS")!;
  oebps.file("style.css", `body{font-family:${th.font};color:#1f2937;line-height:1.7;padding:1em}h1{font-size:1.8em}h2{font-size:1.4em;color:#0f172a}.callout{border-left:4px solid ${th.accent};background:${th.accentSoft};padding:.6em 1em;margin:1em 0}blockquote{border-left:3px solid #cbd5e1;padding-left:1em;font-style:italic;color:#475569}img{max-width:100%}.cover{text-align:center}`);
  const chapters: { id: string; file: string; title: string }[] = [];
  ebook.pages.forEach((p, i) => {
    const id = `p${i}`;
    const file = `${id}.xhtml`;
    const inner = p.type === "cover"
      ? `<div class="cover"><h1>${esc(p.title)}</h1><p>${esc(p.subtitle)}</p><p>${esc(ebook.author)}</p></div>`
      : p.type === "toc"
        ? `<h2>${esc(p.title)}</h2>${(p.blocks[0]?.items || []).map((it) => `<p>${esc(it)}</p>`).join("")}`
        : `${p.chapter != null && p.type === "chapter" ? `<p><strong>Capítulo ${p.chapter}</strong></p>` : ""}${p.blocks.map(blockHtml).join("")}`;
    oebps.file(file, `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${esc(p.title || ebook.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${inner}</body></html>`);
    chapters.push({ id, file, title: p.title || `Página ${i + 1}` });
  });
  const manifest = chapters.map((c) => `<item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`).join("") + `<item id="css" href="style.css" media-type="text/css"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
  const spine = chapters.map((c) => `<itemref idref="${c.id}"/>`).join("");
  oebps.file("content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(ebook.title)}</dc:title><dc:creator>${esc(ebook.author || "Lowfy")}</dc:creator><dc:language>pt-BR</dc:language><dc:identifier id="bookid">lowfy-${slugify(ebook.title)}</dc:identifier></metadata><manifest>${manifest}</manifest><spine toc="ncx">${spine}</spine></package>`);
  oebps.file("toc.ncx", `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="lowfy-${slugify(ebook.title)}"/></head><docTitle><text>${esc(ebook.title)}</text></docTitle><navMap>${chapters.map((c, i) => `<navPoint id="n${i}" playOrder="${i + 1}"><navLabel><text>${esc(c.title)}</text></navLabel><content src="${c.file}"/></navPoint>`).join("")}</navMap></ncx>`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  downloadBlob(blob, `${slugify(ebook.title)}.epub`, "application/epub+zip");
}

// ============================ PREVIEW / EDITOR ============================
function Editable({ html, onChange, className, style }: { html?: string; onChange: (v: string) => void; className?: string; style?: any }) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      className={`outline-none focus:bg-primary/5 rounded px-0.5 -mx-0.5 ${className || ""}`}
      style={style}
      onBlur={(e) => onChange(e.currentTarget.textContent || "")}
    >{html}</div>
  );
}

function BlockView({ b, accent, edit, onText, onRegen, regenerating }: { b: Block; accent: string; edit: boolean; onText: (v: string) => void; onRegen: () => void; regenerating: boolean }) {
  switch (b.type) {
    case "heading":
      return edit ? <Editable html={b.content} onChange={onText} className="text-[19px] font-bold tracking-tight text-slate-900 leading-snug" /> : <h3 className="text-[19px] font-bold tracking-tight text-slate-900 leading-snug">{b.content}</h3>;
    case "subheading":
      return edit ? <Editable html={b.content} onChange={onText} className="text-[15px] font-semibold text-slate-800" /> : <h4 className="text-[15px] font-semibold text-slate-800">{b.content}</h4>;
    case "paragraph":
      return edit ? <Editable html={b.content} onChange={onText} className="text-[13.5px] leading-relaxed text-slate-700" /> : <p className="text-[13.5px] leading-relaxed text-slate-700">{b.content}</p>;
    case "list":
      return <ul className="space-y-1.5">{(b.items || []).map((it, i) => (
        <li key={i} className="text-[13.5px] leading-relaxed text-slate-700 flex gap-2"><span style={{ color: accent }} className="mt-0.5">•</span><span>{it}</span></li>
      ))}</ul>;
    case "callout":
      return (
        <div className="rounded-r-lg border-l-[3px] px-4 py-3" style={{ borderColor: accent, background: themeSoft(accent) }}>
          {b.label && <div className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1" style={{ color: accent }}><Lightbulb className="w-3.5 h-3.5" />{b.label}</div>}
          {edit ? <Editable html={b.content} onChange={onText} className="text-[13px] leading-relaxed text-slate-700" /> : <p className="text-[13px] leading-relaxed text-slate-700">{b.content}</p>}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-slate-300 pl-4 py-1">
          <p className="text-[15px] italic text-slate-600 leading-relaxed">"{b.content}"</p>
          {b.label && <cite className="text-[12px] text-slate-400 not-italic mt-1 block">{b.label}</cite>}
        </blockquote>
      );
    case "stats":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(b.stats || []).map((s, i) => (
            <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
              <div className="text-[22px] font-bold tracking-tight" style={{ color: accent }}>{s.value}</div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      );
    case "image":
      return b.imageUrl ? (
        <div className="relative group/img">
          <img src={b.imageUrl} alt="" className="w-full rounded-lg border border-slate-200" />
          {edit && <button onClick={onRegen} disabled={regenerating} className="absolute top-2 right-2 bg-white/90 border rounded-lg px-2 py-1 text-[11px] font-medium opacity-0 group-hover/img:opacity-100 transition flex items-center gap-1">{regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Regerar</button>}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-slate-400" /></div>
          <div className="text-[11px] text-slate-500 leading-snug flex-1"><span className="font-medium text-slate-600">Imagem IA:</span> {b.imagePrompt || "ilustração"}</div>
          {edit && <button onClick={onRegen} disabled={regenerating} className="border rounded-lg px-2 py-1 text-[11px] font-medium flex items-center gap-1 hover:bg-white">{regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}Gerar</button>}
        </div>
      );
    case "divider":
      return <hr className="border-slate-200" />;
    default:
      return null;
  }
}
function themeSoft(accent: string): string {
  // tinta clara aproximada por tema
  if (accent === "#7c3aed") return "#f5f3ff";
  if (accent === "#1d4ed8") return "#eff6ff";
  if (accent === "#111827") return "#f3f4f6";
  return "rgba(13,155,110,.07)";
}

function PageView({ page, index, ebook, edit, onText, onRegen, regenKey, onUp, onDown, onDelete }: {
  page: Page; index: number; ebook: Ebook; edit: boolean;
  onText: (bi: number, v: string) => void; onRegen: (bi: number) => void; regenKey: string | null;
  onUp: () => void; onDown: () => void; onDelete: () => void;
}) {
  const th = themeOf(ebook.theme);
  const controls = edit && page.type !== "cover" && (
    <div className="absolute -top-3 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition bg-white border rounded-lg shadow-sm p-0.5">
      <button onClick={onUp} title="Subir" className="p-1 hover:bg-muted rounded"><ArrowUp className="w-3.5 h-3.5" /></button>
      <button onClick={onDown} title="Descer" className="p-1 hover:bg-muted rounded"><ArrowDown className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} title="Excluir" className="p-1 hover:bg-red-50 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );

  if (page.type === "cover") {
    return (
      <div className="group relative aspect-[1/1.414] rounded-lg overflow-hidden shadow-lg flex flex-col justify-between p-8 text-white" style={{ background: th.coverBg }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] opacity-80">Ebook</div>
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>
          {page.subtitle && <p className="opacity-90 mt-3 text-[15px] leading-relaxed">{page.subtitle}</p>}
        </div>
        <div className="opacity-80 text-sm">{ebook.author}</div>
        <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
      </div>
    );
  }
  if (page.type === "toc") {
    return (
      <div className="group relative aspect-[1/1.414] rounded-lg bg-white shadow-lg border border-slate-200 p-8">
        {controls}
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-5">{page.title}</h2>
        <div className="space-y-2.5">
          {(page.blocks[0]?.items || []).map((it, i) => (
            <div key={i} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2.5"><span className="text-[14px] text-slate-700">{it}</span></div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="group relative aspect-[1/1.414] rounded-lg bg-white shadow-lg border border-slate-200 p-8 flex flex-col">
      {controls}
      {page.type === "chapter" && page.chapter != null && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: th.accent }}>Capítulo {page.chapter}</div>
      )}
      <div className="space-y-3.5 flex-1 overflow-hidden">
        {page.blocks.map((b, i) => (
          <BlockView key={i} b={b} accent={th.accent} edit={edit} onText={(v) => onText(i, v)} onRegen={() => onRegen(i)} regenerating={regenKey === `${index}-${i}`} />
        ))}
      </div>
      <div className="text-[11px] text-slate-400 text-center pt-4">— {index + 1} —</div>
    </div>
  );
}

export default function EbookStudio() {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "create">("list");
  const [list, setList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [form, setForm] = useState({ assunto: "", publico: "", autor: "", paginas: 20, tom: "Didático", tema: "editorial", comImagens: true });
  const [generating, setGenerating] = useState(false);
  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [genImages, setGenImages] = useState(false);
  const [regenKey, setRegenKey] = useState<string | null>(null);

  const loadList = async () => {
    setLoadingList(true);
    try { const r = await apiRequest("GET", "/api/ebook/list"); setList(await r.json()); }
    catch { setList([]); } finally { setLoadingList(false); }
  };
  useEffect(() => { loadList(); }, []);

  const generate = async () => {
    if (form.assunto.trim().length < 3) { toast({ title: "Descreva o assunto do ebook" }); return; }
    setGenerating(true); setEbook(null); setSlug(null); setEdit(false);
    try {
      const r = await apiRequest("POST", "/api/ebook/generate", form);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Falha ao gerar");
      setEbook(d.ebook);
      toast({ title: "Ebook gerado!", description: `${d.ebook.pageCount} páginas prontas pra revisar.` });
    } catch (e: any) {
      toast({ title: "IA indisponível", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (!ebook) return;
    setSaving(true);
    try {
      const r = await apiRequest("POST", "/api/ebook/save", { ebook, slug });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Falha");
      setSlug(d.slug);
      toast({ title: "Ebook salvo!", description: "Disponível em Meus Ebooks." });
      loadList();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const openEbook = async (s: string) => {
    try {
      const r = await apiRequest("GET", `/api/ebook/get/${s}`);
      const d = await r.json();
      if (r.ok) { setEbook(d.ebook); setSlug(d.slug); setForm((f) => ({ ...f, assunto: d.ebook.title, tema: d.ebook.theme })); setEdit(false); setView("create"); }
    } catch {}
  };
  const del = async (s: string) => {
    if (!confirm("Excluir este ebook?")) return;
    await apiRequest("DELETE", `/api/ebook/${s}`);
    toast({ title: "Ebook excluído" });
    loadList();
  };

  // ---- edição ----
  const patchEbook = (fn: (e: Ebook) => Ebook) => setEbook((e) => e ? fn(structuredClone(e)) : e);
  const setBlockText = (pi: number, bi: number, v: string) => patchEbook((e) => { const b = e.pages[pi]?.blocks[bi]; if (b) b.content = v; return e; });
  const movePage = (pi: number, dir: -1 | 1) => patchEbook((e) => {
    const ni = pi + dir;
    if (ni < 1 || ni >= e.pages.length || e.pages[pi].type === "cover") return e; // capa fixa
    const [pg] = e.pages.splice(pi, 1); e.pages.splice(ni, 0, pg); e.pageCount = e.pages.length; return e;
  });
  const deletePage = (pi: number) => patchEbook((e) => { if (e.pages[pi].type === "cover") return e; e.pages.splice(pi, 1); e.pageCount = e.pages.length; return e; });
  const addPage = () => patchEbook((e) => { e.pages.splice(e.pages.length - 1, 0, { type: "content", title: "Nova página", blocks: [{ type: "heading", content: "Novo título" }, { type: "paragraph", content: "Escreva aqui…" }] }); e.pageCount = e.pages.length; return e; });
  const setTheme = (t: string) => patchEbook((e) => { e.theme = t; return e; });

  const genOneImage = async (prompt: string, cover = false): Promise<string | null> => {
    try {
      const r = await apiRequest("POST", "/api/ebook/gen-image", { prompt, theme: ebook?.theme, cover });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message);
      return d.url as string;
    } catch (e: any) { toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" }); return null; }
  };
  const regenImage = async (pi: number, bi: number) => {
    const b = ebook?.pages[pi]?.blocks[bi]; if (!b) return;
    setRegenKey(`${pi}-${bi}`);
    const url = await genOneImage(b.imagePrompt || ebook?.title || "ilustração");
    if (url) patchEbook((e) => { const bl = e.pages[pi]?.blocks[bi]; if (bl) bl.imageUrl = url; return e; });
    setRegenKey(null);
  };
  const genAllImages = async () => {
    if (!ebook) return;
    setGenImages(true);
    let done = 0, total = 0;
    const targets: { pi: number; bi: number; prompt: string }[] = [];
    ebook.pages.forEach((p, pi) => p.blocks.forEach((b, bi) => { if (b.type === "image" && !b.imageUrl) { targets.push({ pi, bi, prompt: b.imagePrompt || ebook.title }); total++; } }));
    if (!total) { toast({ title: "Sem imagens pendentes", description: "Gere o ebook com 'imagens' ligado ou adicione blocos de imagem." }); setGenImages(false); return; }
    for (const t of targets.slice(0, 12)) {
      const url = await genOneImage(t.prompt);
      if (url) patchEbook((e) => { const bl = e.pages[t.pi]?.blocks[t.bi]; if (bl) bl.imageUrl = url; return e; });
      done++;
    }
    setGenImages(false);
    toast({ title: `Imagens geradas (${done}/${total})` });
  };

  // ---- export ----
  const exportPdf = () => {
    if (!ebook) return;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Permita pop-ups para exportar o PDF" }); return; }
    w.document.write(buildExportHtml(ebook, true));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };
  const exportHtml = () => { if (ebook) downloadBlob(buildExportHtml(ebook, false), `${slugify(ebook.title)}.html`, "text/html"); };
  const doEpub = async () => { if (!ebook) return; try { await exportEpub(ebook); } catch (e: any) { toast({ title: "Erro no EPUB", description: e.message, variant: "destructive" }); } };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent border border-primary/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_0%,hsl(161,84%,33%,0.10),transparent)]" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/25 flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Criador de Ebooks IA</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Descreva o tema → a IA escreve, ilustra e diagrama um ebook profissional.</p>
            </div>
          </div>
          {view === "list" ? (
            <button onClick={() => { setEbook(null); setSlug(null); setView("create"); }} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-primary/90 active:scale-[0.98] transition">
              <Plus className="w-4 h-4" /> Criar ebook
            </button>
          ) : (
            <button onClick={() => setView("list")} className="border rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-muted transition">
              <ArrowLeft className="w-4 h-4" /> Meus Ebooks
            </button>
          )}
        </div>
      </div>

      {view === "list" ? (
        loadingList ? (
          <div className="text-center text-muted-foreground py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : list.length === 0 ? (
          <div className="border-2 border-dashed rounded-2xl py-16 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground mb-4">Você ainda não criou nenhum ebook</p>
            <button onClick={() => setView("create")} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:bg-primary/90 transition">
              <Sparkles className="w-4 h-4" /> Criar meu primeiro ebook
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((e) => (
              <div key={e.slug} className="bg-card border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary" /></div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{e.pageCount} pág.</span>
                </div>
                <h3 className="font-semibold truncate">{e.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">{e.subtitle}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEbook(e.slug)} className="flex-1 text-sm font-medium border rounded-lg py-1.5 hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition">Abrir</button>
                  <button onClick={() => del(e.slug)} title="Excluir" className="text-sm border rounded-lg py-1.5 px-2.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Wizard */}
          <div className="bg-card border rounded-xl p-5 space-y-4 lg:sticky lg:top-20">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Assunto do ebook *</label>
              <input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} placeholder="Ex.: Marketing digital para iniciantes" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Público-alvo</label>
              <input value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })} placeholder="Ex.: empreendedores começando do zero" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Autor</label>
              <input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} placeholder="Seu nome / marca" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Nº de páginas</label>
                <span className="text-xs font-semibold text-primary">{form.paginas} páginas</span>
              </div>
              <input type="range" min={6} max={50} step={1} value={form.paginas} onChange={(e) => setForm({ ...form, paginas: parseInt(e.target.value) })} className="w-full accent-primary h-1.5 cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tom</label>
              <div className="flex flex-wrap gap-1.5">{TOM.map((t) => <Chip key={t} active={form.tom === t} onClick={() => setForm({ ...form, tom: t })}>{t}</Chip>)}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tema visual</label>
              <div className="flex flex-wrap gap-1.5">{TEMAS.map((t) => <Chip key={t.v} active={form.tema === t.v} onClick={() => setForm({ ...form, tema: t.v })}>{t.label}</Chip>)}</div>
            </div>
            <label className="flex items-center justify-between border rounded-lg px-3 py-2.5 cursor-pointer">
              <span className="text-sm font-medium flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Gerar imagens com IA</span>
              <input type="checkbox" checked={form.comImagens} onChange={(e) => setForm({ ...form, comImagens: e.target.checked })} className="accent-primary w-4 h-4" />
            </label>
            <button onClick={generate} disabled={generating} className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 disabled:opacity-60 transition">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {ebook ? "Gerar novamente" : "Gerar ebook"}
            </button>
            {ebook && (
              <button onClick={save} disabled={saving} className="w-full h-10 border rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-60 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar ebook
              </button>
            )}
            <p className="text-[11px] text-muted-foreground leading-snug">PDF usa o diálogo de impressão do navegador (salve como PDF). EPUB e HTML baixam direto. Geração de texto usa sua chave GPT/Gemini; imagens funcionam no gerador grátis.</p>
          </div>

          {/* Preview / Editor */}
          <div>
            {generating ? (
              <div className="border-2 border-dashed rounded-2xl py-24 text-center">
                <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
                <p className="text-sm text-muted-foreground">Escrevendo e diagramando seu ebook…</p>
                <p className="text-xs text-muted-foreground/60 mt-1">A IA cria o roteiro, capítulos e páginas. Pode levar alguns segundos.</p>
              </div>
            ) : ebook ? (
              <div className="space-y-5">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 flex-wrap sticky top-16 z-20 bg-background/90 backdrop-blur-sm py-2 -my-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight truncate">{ebook.title}</h2>
                    <p className="text-xs text-muted-foreground">{ebook.pageCount} páginas{slug ? " · salvo" : " · não salvo"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setEdit((v) => !v)} className={`text-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 border transition ${edit ? "bg-accent text-accent-foreground border-primary/30" : "hover:bg-muted"}`}>
                      {edit ? <Check className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}{edit ? "Editando" : "Editar"}
                    </button>
                    <button onClick={genAllImages} disabled={genImages} className="text-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 border hover:bg-muted transition disabled:opacity-60">
                      {genImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}Gerar imagens
                    </button>
                    <div className="h-6 w-px bg-border mx-0.5" />
                    <button onClick={exportPdf} className="text-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition"><FileDown className="w-3.5 h-3.5" />PDF</button>
                    <button onClick={exportHtml} title="Baixar HTML" className="text-sm rounded-lg px-2.5 py-1.5 border hover:bg-muted transition"><FileCode className="w-3.5 h-3.5" /></button>
                    <button onClick={doEpub} title="Baixar EPUB" className="text-sm rounded-lg px-2.5 py-1.5 border hover:bg-muted transition"><FileText className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {edit && (
                  <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/40 p-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Tema</span>
                    {TEMAS.map((t) => <Chip key={t.v} active={ebook.theme === t.v} onClick={() => setTheme(t.v)}>{t.label}</Chip>)}
                    <button onClick={addPage} className="text-xs font-medium border rounded-lg px-3 h-8 flex items-center gap-1.5 bg-card hover:bg-muted transition ml-auto"><Plus className="w-3.5 h-3.5" />Adicionar página</button>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  {ebook.pages.map((p, i) => (
                    <PageView key={i} page={p} index={i} ebook={ebook} edit={edit}
                      onText={(bi, v) => setBlockText(i, bi, v)}
                      onRegen={(bi) => regenImage(i, bi)} regenKey={regenKey}
                      onUp={() => movePage(i, -1)} onDown={() => movePage(i, 1)} onDelete={() => deletePage(i)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-2xl py-24 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">Seu ebook aparecerá aqui</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Preencha o tema à esquerda e clique em Gerar ebook</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
