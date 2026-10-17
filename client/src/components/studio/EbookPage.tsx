import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen, Lightbulb, ListTree, Sparkles, Download, Check, ArrowLeft, ArrowUp, ArrowDown, Plus, X, Loader2, Wand2,
  RefreshCw, ChevronLeft, ChevronRight, GraduationCap, Baby, Palette, ChefHat, NotebookPen, Eye, Save, FolderOpen,
} from "lucide-react";
import { useStudio } from "./store";
import { postLong } from "./runners";
import { FieldLabel, FormPanel, PageGrid, PageHeader, PillGroup, PreviewPanel, useLocalForm } from "./page-kit";
import { ebookCss, paginate, printEbook, PALETAS } from "./EbookRender";
import type { EBook, EbookKind, Paleta, Sheet } from "./EbookRender";

const KINDS: { v: EbookKind; label: string; desc: string; icon: any }[] = [
  { v: "guia", label: "Guia / ensino", desc: "Passo a passo, dicas e exemplos", icon: GraduationCap },
  { v: "infantil", label: "Infantil ilustrado", desc: "História com ilustração em toda página", icon: Baby },
  { v: "colorir", label: "Livro para colorir", desc: "Desenhos em linha para pintar", icon: Palette },
  { v: "receitas", label: "Receitas", desc: "Ingredientes, preparo e fotos", icon: ChefHat },
  { v: "workbook", label: "Workbook", desc: "Conceitos com exercícios", icon: NotebookPen },
];
const PAGINAS = [{ v: "12", label: "12" }, { v: "20", label: "20" }, { v: "30", label: "30" }, { v: "40", label: "40" }];
const ESTILOS = [{ v: "editorial", label: "Editorial" }, { v: "moderno", label: "Moderno" }, { v: "minimal", label: "Minimalista" }, { v: "infantil", label: "Infantil" }];
const EXEMPLOS: Record<EbookKind, { tema: string; publico: string }> = {
  guia: { tema: "Como começar a vender no Instagram do zero", publico: "Pequenos empreendedores e autônomos" },
  infantil: { tema: "A girafa Gigi que tinha medo de altura e aprendeu a ser corajosa", publico: "Crianças de 4 a 7 anos" },
  colorir: { tema: "Animais da fazenda", publico: "Crianças de 3 a 6 anos" },
  receitas: { tema: "Marmitas saudáveis para a semana toda", publico: "Quem quer comer bem gastando pouco tempo" },
  workbook: { tema: "Organização financeira pessoal em 30 dias", publico: "Adultos que querem sair das dívidas" },
};

interface Chapter { title: string; sections: { heading: string; brief: string }[] }
interface Outline { title: string; subtitle: string; sinopse?: string; paletas?: Paleta[]; chapters: Chapter[] }

const DEFAULTS = {
  passo: 1, kind: "guia" as EbookKind, tema: "", publico: "", autor: "", paginas: "20", estilo: "editorial", imagens: true, accent: "", paleta: "",
  outline: null as Outline | null, jobId: "", ebook: null as EBook | null,
};

const PASSOS = [
  { n: 1, label: "Briefing", icon: Lightbulb },
  { n: 2, label: "Sumário", icon: ListTree },
  { n: 3, label: "Escrevendo", icon: Sparkles },
  { n: 4, label: "Capa e PDF", icon: BookOpen },
];

// Custo aproximado em imagens: ajuda a pessoa a decidir. Capa e contracapa sempre entram.
const estimaImagens = (kind: EbookKind, paginas: number, imagens: boolean) =>
  kind === "colorir" || kind === "infantil" ? Math.max(4, paginas - 4) + 2
    : !imagens ? 2
    : kind === "receitas" ? Math.max(4, paginas - 5) + 2
    : Math.max(3, Math.round((paginas - 5) / 2.4)) + 2;

export default function EbookPage() {
  const { brief } = useStudio();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, patch, reset] = useLocalForm("ebook", DEFAULTS);
  const [busy, setBusy] = useState<"" | "outline" | "save">("");
  const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null);
  const [page, setPage] = useState(0);
  const [redo, setRedo] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [montando, setMontando] = useState(false);

  const kind = f.kind;
  const illustrated = kind === "colorir" || kind === "infantil";
  const estilo = illustrated && f.estilo === "editorial" ? "infantil" : f.estilo;

  const { data: biblioteca } = useQuery({
    queryKey: ["/api/ebook/list"],
    queryFn: async () => (await (await apiRequest("GET", "/api/ebook/list")).json()) as { slug: string; title: string; cover?: string; kind?: string; pageCount: number }[],
    staleTime: 60_000,
  });

  // ---- 1 → 2: sumário ----
  const gerarSumario = async () => {
    setBusy("outline");
    try {
      const r = await apiRequest("POST", "/api/ebook/v2/outline", { kind, tema: f.tema, publico: f.publico, paginas: Number(f.paginas), idioma: brief.lang });
      const d = (await r.json()) as { outline: Outline };
      patch({ outline: d.outline, passo: 2 });
    } catch (e: any) {
      toast({ title: "Erro ao criar o sumário", description: e?.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // ---- 2 → 3: escreve o livro em segundo plano ----
  const escrever = async () => {
    if (!f.outline) return;
    try {
      const r = await apiRequest("POST", "/api/ebook/v2/build", {
        brief: { kind, tema: f.tema, publico: f.publico, autor: f.autor, paginas: Number(f.paginas), estilo, imagens: f.imagens, idioma: brief.lang, ...corEscolhida() },
        outline: f.outline,
      });
      const d = (await r.json()) as { jobId: string };
      setProgress({ step: "Começando…", done: 0, total: 1 });
      patch({ jobId: d.jobId, passo: 3, ebook: null });
    } catch (e: any) {
      toast({ title: "Erro ao começar o livro", description: e?.message, variant: "destructive" });
    }
  };

  // Acompanha o livro sendo escrito (as páginas aparecem conforme ficam prontas).
  useEffect(() => {
    if (f.passo !== 3 || !f.jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/ebook/v2/build/${f.jobId}`, { credentials: "include" });
        if (r.status === 404) {
          if (!stop) { toast({ title: "A geração foi interrompida", description: "O sistema foi atualizado. Clique em escrever de novo.", variant: "destructive" }); patch({ passo: 2, jobId: "" }); }
          return;
        }
        const d = await r.json();
        if (stop) return;
        setProgress(d.progress);
        if (d.ebook) patch({ ebook: { ...d.ebook, slug: d.slug || d.ebook.slug } });
        if (d.status === "done") { patch({ passo: 4, jobId: "" }); setPage(0); qc.invalidateQueries({ queryKey: ["/api/ebook/list"] }); toast({ title: "Seu livro está pronto!" }); return; }
        if (d.status === "error") { toast({ title: "Erro ao gerar o livro", description: d.error, variant: "destructive" }); patch({ passo: 2, jobId: "" }); return; }
      } catch { /* rede oscilou */ }
      if (!stop) setTimeout(tick, 3000);
    };
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.passo, f.jobId]);

  const ebook = f.ebook;
  const pages = ebook?.pages || [];

  // Cor do livro: a escolhida, ou a 1ª sugestão da IA para o tema.
  const corEscolhida = () => {
    if (f.accent) return { accent: f.accent, paleta: f.paleta };
    const s = f.outline?.paletas?.[0];
    return s ? { accent: s.accent, paleta: s.nome } : {};
  };

  // Diagramação em folhas A4 (medida no navegador; refaz quando o livro muda).
  useEffect(() => {
    if (!ebook?.pages?.length) { setSheets([]); return; }
    let vivo = true;
    setMontando(true);
    const t = setTimeout(() => {
      paginate(ebook).then((s) => { if (vivo) { setSheets(s); setPage((p) => Math.min(p, Math.max(0, s.length - 1))); } })
        .catch(() => {}).finally(() => vivo && setMontando(false));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [ebook]);

  // ---- 4: ajustes ----
  const refazerImagem = async (pi: number, bi: number) => {
    if (!ebook) return;
    const blk = ebook.pages[pi]?.blocks[bi];
    if (!blk?.imagePrompt) return;
    const key = `${pi}-${bi}`;
    setRedo(key);
    try {
      const tipo = ebook.pages[pi].type;
      const capa = ebook.pages.find((x) => x.type === "cover")?.blocks.find((x) => x.type === "image")?.imageUrl;
      const d = await postLong<{ url: string }>("/api/ebook/v2/redo-image", {
        kind, prompt: blk.imagePrompt, cover: tipo === "cover" || tipo === "back", estilo, ref: tipo === "back" ? capa : undefined,
      });
      const next = structuredClone(ebook);
      next.pages[pi].blocks[bi] = { ...blk, imageUrl: d.url };
      patch({ ebook: next });
      void salvar(next, true);
    } catch (e: any) {
      toast({ title: "Erro ao refazer a imagem", description: e?.message, variant: "destructive" });
    } finally {
      setRedo(null);
    }
  };

  const salvar = async (eb = ebook, silencioso = false) => {
    if (!eb) return;
    setBusy("save");
    try {
      const r = await apiRequest("POST", "/api/ebook/save", { ebook: eb, slug: eb.slug });
      const d = (await r.json()) as { slug: string };
      if (!eb.slug) patch({ ebook: { ...eb, slug: d.slug } });
      qc.invalidateQueries({ queryKey: ["/api/ebook/list"] });
      if (!silencioso) toast({ title: "Livro salvo" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const abrir = async (slug: string) => {
    try {
      const d = (await (await apiRequest("GET", `/api/ebook/get/${slug}`)).json()) as { ebook: EBook; slug: string };
      patch({ ebook: { ...d.ebook, slug: d.slug }, kind: (d.ebook.kind as EbookKind) || "guia", passo: 4, jobId: "" });
      setPage(0);
    } catch (e: any) {
      toast({ title: "Não consegui abrir o livro", description: e?.message, variant: "destructive" });
    }
  };

  const moveCap = (i: number, dir: -1 | 1) => {
    if (!f.outline) return;
    const ch = [...f.outline.chapters];
    const j = i + dir;
    if (j < 0 || j >= ch.length) return;
    [ch[i], ch[j]] = [ch[j], ch[i]];
    patch({ outline: { ...f.outline, chapters: ch } });
  };
  const setCap = (i: number, c: Partial<Chapter>) => f.outline && patch({ outline: { ...f.outline, chapters: f.outline.chapters.map((x, k) => (k === i ? { ...x, ...c } : x)) } });

  const podeIr = (n: number) => n === 1 || (n === 2 && !!f.outline) || (n === 3 && !!f.jobId) || (n === 4 && !!ebook && !f.jobId);
  const nImgs = estimaImagens(kind, Number(f.paginas), f.imagens);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader icon={BookOpen} title="Criador de E-books"
        sub="Livros digitais completos: conteúdo, ilustrações, capa e PDF prontos para vender."
        tip="quanto mais claro o tema e o público, melhor o livro." />

      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
        {PASSOS.map((p, i) => {
          const ativo = f.passo === p.n, feito = f.passo > p.n;
          return (
            <div key={p.n} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button type="button" disabled={!podeIr(p.n)} onClick={() => patch({ passo: p.n })}
                className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-sm font-medium transition disabled:opacity-40 ${ativo ? "bg-primary text-primary-foreground border-primary shadow-sm" : feito ? "bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] text-primary" : "bg-card text-muted-foreground"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${ativo ? "bg-white/20" : feito ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{feito ? <Check className="w-3.5 h-3.5" /> : p.n}</span>
                {p.label}
              </button>
              {i < PASSOS.length - 1 && <span className="w-4 sm:w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <PageGrid
        form={
          <FormPanel
            icon={PASSOS[f.passo - 1].icon}
            title={["Que livro você quer criar?", "Revise o sumário", "Escrevendo o seu livro", "Capa, ajustes e PDF"][f.passo - 1]}
            sub={[
              "Escolha o tipo, conte o tema e para quem é. A IA monta o resto.",
              "Edite, reordene ou peça outro. Quando estiver bom, aprove.",
              "Pode levar alguns minutos. As páginas aparecem ao lado conforme ficam prontas.",
              "Navegue pelas páginas, refaça ilustrações e baixe o PDF.",
            ][f.passo - 1]}
            onExample={f.passo === 1 ? () => patch({ ...EXEMPLOS[kind], autor: f.autor || "Seu Nome" }) : undefined}
            footer={
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-t pt-4">
                {f.passo > 1 && f.passo !== 3 ? (
                  <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => patch({ passo: f.passo === 4 ? 1 : f.passo - 1 })}><ArrowLeft className="w-4 h-4 mr-2" /> {f.passo === 4 ? "Novo livro" : "Voltar"}</Button>
                ) : f.passo === 1 ? (
                  <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => { reset(); setProgress(null); }}>Recomeçar</Button>
                ) : <span />}
                {f.passo === 1 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={f.tema.trim().length < 3 || !!busy} onClick={() => void gerarSumario()}>
                    {busy === "outline" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Montando o sumário…</> : <><Wand2 className="w-4 h-4 mr-2" /> Criar sumário</>}
                  </Button>
                )}
                {f.passo === 2 && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => void gerarSumario()}>
                      {busy === "outline" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Gerar outro
                    </Button>
                    <Button className="h-11 sm:h-10 sm:min-w-[220px]" disabled={!!busy || !f.outline?.chapters.length} onClick={() => void escrever()}>
                      <Check className="w-4 h-4 mr-2" /> Aprovar e escrever o livro
                    </Button>
                  </div>
                )}
                {f.passo === 4 && ebook && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => void salvar()}>
                      {busy === "save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Salvar
                    </Button>
                    <Button className="h-11 sm:h-10 sm:min-w-[200px]" onClick={() => void printEbook(ebook, sheets)}><Download className="w-4 h-4 mr-2" /> Baixar PDF</Button>
                  </div>
                )}
              </div>
            }
          >
            {f.passo === 1 && (
              <div className="space-y-5">
                <div>
                  <FieldLabel>Tipo de livro</FieldLabel>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {KINDS.map((k) => {
                      const ativo = kind === k.v;
                      return (
                        <button key={k.v} type="button" onClick={() => patch({ kind: k.v, estilo: k.v === "colorir" || k.v === "infantil" ? "infantil" : f.estilo === "infantil" ? "editorial" : f.estilo })}
                          className={`text-left rounded-xl border p-3 transition ${ativo ? "border-[color-mix(in_srgb,var(--primary)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] shadow-sm" : "hover:bg-muted"}`}>
                          <k.icon className={`w-5 h-5 mb-1.5 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
                          <p className={`text-sm font-semibold ${ativo ? "text-primary" : ""}`}>{k.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">{k.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel required>Sobre o que é o livro?</FieldLabel>
                  <Textarea value={f.tema} onChange={(e) => patch({ tema: e.target.value })} className="min-h-[80px]" placeholder={EXEMPLOS[kind].tema} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                  <div><FieldLabel optional>Para quem</FieldLabel><Input value={f.publico} onChange={(e) => patch({ publico: e.target.value })} placeholder={EXEMPLOS[kind].publico} /></div>
                  <div><FieldLabel optional>Autor (vai na capa)</FieldLabel><Input value={f.autor} onChange={(e) => patch({ autor: e.target.value })} placeholder="Seu nome ou da sua marca" /></div>
                  <div><FieldLabel>Número de páginas</FieldLabel><PillGroup options={PAGINAS} value={f.paginas} onChange={(v) => patch({ paginas: v })} /></div>
                  <div><FieldLabel>Estilo do livro</FieldLabel><PillGroup options={ESTILOS} value={estilo} onChange={(v) => patch({ estilo: v })} /></div>
                </div>
                <div>
                  <FieldLabel optional>Cores do livro</FieldLabel>
                  <Cores value={f.accent} sugestaoIa onChange={(c) => patch({ accent: c?.accent || "", paleta: c?.nome || "" })} />
                  <p className="text-[11px] text-muted-foreground mt-1.5">{f.accent ? `Paleta ${f.paleta || "personalizada"} na capa, nos títulos e nos destaques.` : "A IA sugere cores que combinam com o tema no próximo passo."}</p>
                </div>
                {!illustrated && (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={f.imagens} onChange={(e) => patch({ imagens: e.target.checked })} className="w-4 h-4 accent-[var(--primary)]" />
                    {kind === "receitas" ? "Foto profissional em cada receita" : "Ilustrar a abertura de cada capítulo"}
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground">Este livro vai gerar cerca de <b>{nImgs} imagens</b>: capa e contracapa com o título já diagramado{illustrated ? ", e uma ilustração por página" : f.imagens ? (kind === "receitas" ? ", e uma foto por receita" : ", e uma por capítulo") : ""}. Livros com muitas imagens levam mais tempo.</p>
              </div>
            )}

            {f.passo === 2 && f.outline && (
              <div className="space-y-3">
                {!!f.outline.paletas?.length && (
                  <div className="rounded-xl border p-3">
                    <p className="text-[12px] font-semibold mb-2">Cores sugeridas para este tema</p>
                    <Cores value={f.accent || f.outline.paletas[0].accent} opcoes={f.outline.paletas} extras onChange={(c) => patch({ accent: c?.accent || "", paleta: c?.nome || "" })} />
                  </div>
                )}
                <div className="grid gap-2">
                  <Input value={f.outline.title} onChange={(e) => patch({ outline: { ...f.outline!, title: e.target.value } })} className="h-11 text-base font-semibold" aria-label="Título" />
                  <Input value={f.outline.subtitle} onChange={(e) => patch({ outline: { ...f.outline!, subtitle: e.target.value } })} className="h-9 text-sm" aria-label="Subtítulo" />
                </div>
                {f.outline.chapters.map((c, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <Input value={c.title} onChange={(e) => setCap(i, { title: e.target.value })} className="h-9 font-medium" aria-label={`Capítulo ${i + 1}`} />
                      <button type="button" onClick={() => moveCap(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => moveCap(i, 1)} disabled={i === f.outline!.chapters.length - 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Descer"><ArrowDown className="w-4 h-4" /></button>
                      {f.outline!.chapters.length > 1 && <button type="button" onClick={() => patch({ outline: { ...f.outline!, chapters: f.outline!.chapters.filter((_, k) => k !== i) } })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600" aria-label="Remover capítulo"><X className="w-4 h-4" /></button>}
                    </div>
                    <div className="pl-8 grid gap-1">
                      {c.sections.map((s, k) => (
                        <input key={k} value={s.heading} onChange={(e) => setCap(i, { sections: c.sections.map((x, j) => (j === k ? { ...x, heading: e.target.value } : x)) })}
                          className="text-[13px] text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none py-0.5" />
                      ))}
                    </div>
                  </div>
                ))}
                {f.outline.chapters.length < 14 && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => patch({ outline: { ...f.outline!, chapters: [...f.outline!.chapters, { title: "Novo capítulo", sections: [{ heading: "Primeira seção", brief: "" }] }] } })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar capítulo
                  </Button>
                )}
              </div>
            )}

            {f.passo === 3 && (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <p className="text-sm font-medium">{progress?.step || "Começando…"}</p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700" style={{ width: `${Math.max(4, ((progress?.done || 0) / Math.max(1, progress?.total || 1)) * 100)}%` }} />
                </div>
                <p className="text-[12px] text-muted-foreground">Pode continuar usando o sistema. Não feche esta página até terminar.</p>
              </div>
            )}

            {f.passo === 4 && ebook && (
              <div className="space-y-3">
                <p className="text-sm"><b>{ebook.title}</b> · {montando && !sheets.length ? "diagramando…" : `${sheets.length} páginas A4`}</p>
                <div>
                  <FieldLabel>Cor dos títulos e destaques</FieldLabel>
                  <Cores value={ebook.accent || ""} opcoes={ebook.paletas} extras onChange={(c) => { const next = { ...ebook, accent: c?.accent || undefined }; patch({ ebook: next }); void salvar(next, true); }} />
                  <p className="text-[11px] text-muted-foreground mt-1.5">Muda o miolo na hora. A capa e a contracapa mantêm as cores com que foram criadas (use “Refazer capa” se quiser outra).</p>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Use os botões sobre a página para refazer só aquela foto, a capa ou a contracapa. O PDF abre numa nova aba: escolha <b>“Salvar como PDF”</b> na janela de impressão.
                </p>
              </div>
            )}

            {f.passo === 1 && !!biblioteca?.length && (
              <div className="pt-2">
                <FieldLabel>Meus e-books</FieldLabel>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {biblioteca.map((b) => (
                    <button key={b.slug} type="button" onClick={() => void abrir(b.slug)} className="flex-shrink-0 w-24 text-left group" title={b.title}>
                      <div className="aspect-[210/297] rounded-md border overflow-hidden bg-muted mb-1 group-hover:ring-2 ring-primary transition">
                        {b.cover ? <img src={b.cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><FolderOpen className="w-5 h-5 text-muted-foreground" /></div>}
                      </div>
                      <p className="text-[11px] font-medium leading-tight line-clamp-2">{b.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormPanel>
        }
        preview={
          <PreviewPanel icon={Eye} sub={sheets.length ? `Página ${page + 1} de ${sheets.length} · A4` : pages.length ? "Diagramando as páginas…" : "Seu livro aparece aqui, página por página."}>
            {sheets.length && ebook ? (
              <>
                <div className="relative">
                  <PageView ebook={ebook} sheet={sheets[Math.min(page, sheets.length - 1)]} redo={redo} onRedo={f.passo === 4 ? refazerImagem : undefined} />
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 shadow flex items-center justify-center disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="w-5 h-5 text-slate-800" /></button>
                  <button type="button" onClick={() => setPage((p) => Math.min(sheets.length - 1, p + 1))} disabled={page >= sheets.length - 1} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 shadow flex items-center justify-center disabled:opacity-30" aria-label="Próxima página"><ChevronRight className="w-5 h-5 text-slate-800" /></button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {sheets.map((sh, i) => (
                    <button key={i} type="button" onClick={() => setPage(i)} className={`flex-shrink-0 w-12 rounded border-2 overflow-hidden transition ${i === page ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`} aria-label={`Ir para a página ${i + 1}`}>
                      <PageView ebook={ebook} sheet={sh} mini />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="aspect-[210/297] w-full max-w-[320px] mx-auto rounded-lg border bg-[color-mix(in_srgb,var(--muted)_50%,transparent)] flex flex-col items-center justify-center text-center p-6 gap-2">
                <BookOpen className="w-9 h-9 text-muted-foreground" />
                <p className="text-sm font-semibold">{KINDS.find((k) => k.v === kind)?.label}</p>
                <p className="text-xs text-muted-foreground">A4 · capa, sumário, capítulos e página final</p>
              </div>
            )}
          </PreviewPanel>
        }
      />
    </div>
  );
}

/** Uma folha A4 do livro, em escala, com a mesma diagramação do PDF. */
function PageView({ ebook, sheet, mini, redo, onRedo }: { ebook: EBook; sheet: Sheet; mini?: boolean; redo?: string | null; onRedo?: (pi: number, bi: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(mini ? 48 : 320);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(() => box.current && setW(box.current.clientWidth));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const css = useMemo(() => ebookCss(ebook), [ebook.theme, ebook.accent]);
  const PAGE_W = 793.7; // 210mm em px (96dpi)
  const scale = w / PAGE_W;
  const rotulo = (pi: number) => {
    const t = ebook.pages[pi]?.type;
    return t === "cover" ? "Refazer capa" : t === "back" ? "Refazer contracapa" : ebook.kind === "receitas" ? "Refazer foto" : "Refazer ilustração";
  };

  return (
    <div ref={box} className={`relative w-full mx-auto ${mini ? "" : "max-w-[360px] rounded-md shadow-lg border"} overflow-hidden bg-white`} style={{ aspectRatio: "210 / 297" }}>
      <div className="eb absolute top-0 left-0 origin-top-left pointer-events-none" style={{ transform: `scale(${scale})`, width: PAGE_W }}>
        <style>{css}</style>
        <div dangerouslySetInnerHTML={{ __html: sheet.html }} />
      </div>
      {!mini && onRedo && sheet.images.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 p-2 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/50 to-transparent">
          {sheet.images.map(({ pi, bi }) => (
            <button key={`${pi}-${bi}`} type="button" onClick={() => onRedo(pi, bi)} disabled={!!redo}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-800 shadow disabled:opacity-60">
              {redo === `${pi}-${bi}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {rotulo(pi)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Escolha de cor: sugestões (da IA ou prontas), paletas da casa e cor livre. */
function Cores({ value, onChange, opcoes, extras, sugestaoIa }: {
  value: string; onChange: (c: Paleta | null) => void; opcoes?: Paleta[]; extras?: boolean; sugestaoIa?: boolean;
}) {
  const lista = [...(opcoes || []), ...(!opcoes?.length || extras ? PALETAS.filter((p) => !opcoes?.some((o) => o.accent.toLowerCase() === p.accent.toLowerCase())) : [])];
  const v = value.toLowerCase();
  return (
    <div className="flex flex-wrap gap-1.5">
      {sugestaoIa && (
        <button type="button" onClick={() => onChange(null)}
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[12px] font-medium transition ${!value ? "border-[color-mix(in_srgb,var(--primary)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] text-primary shadow-sm" : "hover:bg-muted"}`}>
          <Sparkles className="w-3.5 h-3.5" /> A IA sugere
        </button>
      )}
      {lista.map((p) => {
        const ativo = v === p.accent.toLowerCase();
        return (
          <button key={p.accent + p.nome} type="button" onClick={() => onChange(p)} title={p.nome}
            className={`inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border text-[12px] font-medium transition ${ativo ? "border-[color-mix(in_srgb,var(--primary)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] shadow-sm" : "hover:bg-muted"}`}>
            <span className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center" style={{ background: p.accent }}>{ativo && <Check className="w-3.5 h-3.5 text-white" />}</span>
            {p.nome}
          </button>
        );
      })}
      <label className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border text-[12px] font-medium hover:bg-muted cursor-pointer" title="Escolher outra cor">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#0f766e"} onChange={(e) => onChange({ nome: "Personalizada", accent: e.target.value })}
          className="w-6 h-6 rounded-full border-0 p-0 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-black/10" />
        Outra
      </label>
    </div>
  );
}
