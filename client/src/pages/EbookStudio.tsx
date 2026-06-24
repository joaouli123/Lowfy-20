import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Sparkles, Loader2, Plus, ArrowLeft, Save, Trash2, Image as ImageIcon,
  Lightbulb, RefreshCw,
} from "lucide-react";

interface Block { type: string; content?: string; items?: string[]; imagePrompt?: string; imageUrl?: string; label?: string; stats?: { value: string; label: string }[] }
interface Page { type: string; title?: string; subtitle?: string; chapter?: number; blocks: Block[] }
interface Ebook { title: string; subtitle: string; author: string; theme: string; withImages: boolean; pageCount: number; pages: Page[] }

const TOM = ["Didático", "Inspirador", "Técnico", "Conversacional", "Persuasivo"];
const TEMAS = [
  { v: "editorial", label: "Editorial" },
  { v: "moderno", label: "Moderno" },
  { v: "corporativo", label: "Corporativo" },
  { v: "minimal", label: "Minimal" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-xs font-medium px-3 h-8 rounded-lg border transition ${active ? "bg-accent text-accent-foreground border-primary/30 shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"}`}>
      {children}
    </button>
  );
}

// ---------- Renderização de blocos (tema editorial) ----------
function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "heading":
      return <h3 className="text-[19px] font-bold tracking-tight text-slate-900 leading-snug">{b.content}</h3>;
    case "subheading":
      return <h4 className="text-[15px] font-semibold text-slate-800 mt-1">{b.content}</h4>;
    case "paragraph":
      return <p className="text-[13.5px] leading-relaxed text-slate-700">{b.content}</p>;
    case "list":
      return <ul className="space-y-1.5">{(b.items || []).map((it, i) => (
        <li key={i} className="text-[13.5px] leading-relaxed text-slate-700 flex gap-2"><span className="text-primary mt-0.5">•</span><span>{it}</span></li>
      ))}</ul>;
    case "callout":
      return (
        <div className="rounded-r-lg border-l-[3px] border-primary bg-emerald-50/70 px-4 py-3">
          {b.label && <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 flex items-center gap-1.5 mb-1"><Lightbulb className="w-3.5 h-3.5" />{b.label}</div>}
          <p className="text-[13px] leading-relaxed text-slate-700">{b.content}</p>
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
              <div className="text-[22px] font-bold text-primary tracking-tight">{s.value}</div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      );
    case "image":
      return b.imageUrl ? (
        <img src={b.imageUrl} alt="" className="w-full rounded-lg border border-slate-200" />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-slate-400" /></div>
          <div className="text-[11px] text-slate-500 leading-snug"><span className="font-medium text-slate-600">Imagem IA:</span> {b.imagePrompt || "ilustração"}</div>
        </div>
      );
    case "divider":
      return <hr className="border-slate-200" />;
    default:
      return null;
  }
}

function PageView({ page, index }: { page: Page; index: number }) {
  if (page.type === "cover") {
    return (
      <div className="aspect-[1/1.414] rounded-lg overflow-hidden shadow-lg relative flex flex-col justify-between p-8 text-white" style={{ background: "linear-gradient(150deg,#0f3d2e,#0d9b6e 95%)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200">Ebook</div>
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>
          {page.subtitle && <p className="text-emerald-100/90 mt-3 text-[15px] leading-relaxed">{page.subtitle}</p>}
        </div>
        <div className="text-emerald-100/80 text-sm">{(page as any).author || ""}</div>
        <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
      </div>
    );
  }
  if (page.type === "toc") {
    return (
      <div className="aspect-[1/1.414] rounded-lg bg-white shadow-lg border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-5">{page.title}</h2>
        <div className="space-y-2.5">
          {(page.blocks[0]?.items || []).map((it, i) => (
            <div key={i} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2.5">
              <span className="text-[14px] text-slate-700">{it}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-[1/1.414] rounded-lg bg-white shadow-lg border border-slate-200 p-8 flex flex-col">
      {page.type === "chapter" && page.chapter != null && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary mb-1">Capítulo {page.chapter}</div>
      )}
      <div className="space-y-3.5 flex-1 overflow-hidden">
        {page.blocks.map((b, i) => <BlockView key={i} b={b} />)}
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

  const loadList = async () => {
    setLoadingList(true);
    try { const r = await apiRequest("GET", "/api/ebook/list"); setList(await r.json()); }
    catch { setList([]); } finally { setLoadingList(false); }
  };
  useEffect(() => { loadList(); }, []);

  const generate = async () => {
    if (form.assunto.trim().length < 3) { toast({ title: "Descreva o assunto do ebook" }); return; }
    setGenerating(true); setEbook(null); setSlug(null);
    try {
      const r = await apiRequest("POST", "/api/ebook/generate", { assunto: form.assunto, publico: form.publico, autor: form.autor, paginas: form.paginas, tom: form.tom, tema: form.tema, comImagens: form.comImagens });
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
      if (r.ok) { setEbook(d.ebook); setSlug(d.slug); setForm((f) => ({ ...f, assunto: d.ebook.title, tema: d.ebook.theme })); setView("create"); }
    } catch {}
  };
  const del = async (s: string) => {
    if (!confirm("Excluir este ebook?")) return;
    await apiRequest("DELETE", `/api/ebook/${s}`);
    toast({ title: "Ebook excluído" });
    loadList();
  };

  // anexa autor na capa para o PageView
  const pagesForView = ebook ? ebook.pages.map((p) => p.type === "cover" ? { ...p, author: ebook.author } : p) : [];

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
            <p className="text-[11px] text-muted-foreground leading-snug">Exportar PDF profissional, leitor web e EPUB chegam nas próximas etapas. A geração por IA usa sua chave GPT/Gemini.</p>
          </div>

          {/* Preview */}
          <div>
            {generating ? (
              <div className="border-2 border-dashed rounded-2xl py-24 text-center">
                <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
                <p className="text-sm text-muted-foreground">Escrevendo e diagramando seu ebook…</p>
                <p className="text-xs text-muted-foreground/60 mt-1">A IA cria o roteiro, capítulos e páginas. Pode levar alguns segundos.</p>
              </div>
            ) : ebook ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{ebook.title}</h2>
                    <p className="text-xs text-muted-foreground">{ebook.pageCount} páginas · tema {ebook.theme}{slug ? " · salvo" : ""}</p>
                  </div>
                  <button onClick={generate} className="text-sm border rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-muted transition"><RefreshCw className="w-3.5 h-3.5" /> Regerar</button>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  {pagesForView.map((p, i) => <PageView key={i} page={p} index={i} />)}
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
