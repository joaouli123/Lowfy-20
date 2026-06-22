import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ComponentView, { type RuntimeCtx } from "@/components/quiz/ComponentView";
import ImageUpload from "@/components/quiz/ImageUpload";
import {
  PALETTE, PALETTE_BY_KEY, CATEGORIES, newComponentFromPalette, newStep, emptySpec, ensureGoogleFont,
  type QComponent, type QuizSpec, type QuizStep,
} from "@/lib/quizSchema";
import { TEMPLATES } from "@/lib/quizTemplates";
import * as Icons from "lucide-react";

const Icon = ({ name, ...p }: { name: string; size?: number; className?: string }) => {
  const C = (Icons as any)[name] || Icons.Square;
  return <C {...p} />;
};

// =========================================================================
// LISTA DE FUNIS
// =========================================================================
export default function QuizBuilder() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<QuizSpec | null>(null);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await apiRequest("GET", "/api/quiz/list"); setList(await r.json()); }
    catch { setList([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const open = async (slug: string) => {
    const r = await apiRequest("GET", `/api/quiz/get/${slug}`);
    const { spec } = await r.json();
    setEditing(spec);
  };
  const [creating, setCreating] = useState(false);
  const create = () => setCreating(true);
  const startWith = (name: string, partial: Partial<QuizSpec>) => {
    const base = emptySpec(name || `Funil ${list.length + 1}`, "");
    setEditing({ ...base, ...partial, name: name || base.name, isPublished: false });
    setCreating(false);
  };
  const del = async (slug: string) => {
    if (!confirm("Excluir este funil?")) return;
    await apiRequest("DELETE", `/api/quiz/${slug}`);
    toast({ title: "Funil excluído" }); load();
  };

  if (editing) return <Editor spec={editing} onClose={() => { setEditing(null); load(); }} />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center"><Icons.LayoutTemplate className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Quiz Builder</h1><p className="text-sm text-muted-foreground">Crie funis de quiz interativos — arraste, solte e publique.</p></div>
        </div>
        <button onClick={create} className="bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2 hover:opacity-90"><Icons.Plus className="w-4 h-4" /> Criar Funil</button>
      </div>

      <div className="mt-6">
        {loading ? <div className="text-center text-muted-foreground py-16"><Icons.Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : list.length === 0 ? (
            <div className="border-2 border-dashed rounded-2xl py-16 text-center">
              <Icons.LayoutTemplate className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground mb-4">Crie seu primeiro funil</p>
              <button onClick={create} className="bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2"><Icons.Plus className="w-4 h-4" /> Criar Funil</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((q) => (
                <div key={q.slug} className="border rounded-xl p-4 hover:shadow-md transition group">
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3"><Icons.ListChecks className="w-5 h-5 text-primary" /></div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${q.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{q.isPublished ? "Publicado" : "Rascunho"}</span>
                  </div>
                  <h3 className="font-semibold truncate">{q.name}</h3>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3"><span>👁 {q.meta?.views || 0}</span><span>✅ {q.meta?.leads || 0} leads</span></div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => open(q.slug)} className="flex-1 text-sm border rounded-lg py-1.5 hover:bg-accent">Editar</button>
                    <a href={`/q/${q.slug}`} target="_blank" rel="noreferrer" className="text-sm border rounded-lg py-1.5 px-3 hover:bg-accent">↗</a>
                    <button onClick={() => del(q.slug)} className="text-sm border rounded-lg py-1.5 px-3 hover:bg-red-50 hover:text-red-600 hover:border-red-200"><Icons.Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      {creating && <CreateFunnelModal onClose={() => setCreating(false)} onCreate={startWith} />}
    </div>
  );
}

// =========================================================================
// MODAL: criar funil (Modelos + IA)
// =========================================================================
function CreateFunnelModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, partial: Partial<QuizSpec>) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState("blank");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const createFromTemplate = () => {
    const t = TEMPLATES.find((x) => x.id === tpl) || TEMPLATES[0];
    onCreate(name || t.name, t.build());
  };
  const generateAi = async () => {
    if (aiPrompt.trim().length < 3) { toast({ title: "Descreva o tema do funil" }); return; }
    setGenerating(true);
    try {
      const r = await apiRequest("POST", "/api/quiz/generate", { prompt: aiPrompt });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Falha ao gerar");
      onCreate(name || d.spec?.name || aiPrompt.slice(0, 40), d.spec);
    } catch (e: any) {
      toast({ title: "IA indisponível", description: `${e.message} Criando a partir de um modelo.`, variant: "destructive" });
      const t = TEMPLATES.find((x) => x.id === "reco")!;
      onCreate(name || aiPrompt.slice(0, 40), t.build());
    } finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Criar funil</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icons.X className="w-5 h-5" /></button></div>

        <label className="text-xs text-muted-foreground block mb-1">Título do seu funil</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Quiz de bem-estar" className="w-full border rounded-lg px-3 py-2 text-sm mb-5 bg-white dark:bg-gray-800 outline-none focus:border-primary" />

        <p className="text-xs font-semibold text-muted-foreground mb-2">COMECE POR UM MODELO</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTpl(t.id)} className={`text-left border rounded-xl p-3 transition ${tpl === t.id ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:border-gray-300"}`}>
              <Icon name={t.icon} size={18} className="text-primary mb-1.5" />
              <div className="text-sm font-medium leading-tight">{t.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t.description}</div>
            </button>
          ))}
        </div>

        <div className="border rounded-xl p-3.5 bg-gradient-to-br from-primary/5 to-transparent mb-5">
          <div className="flex items-center gap-1.5 mb-2"><Icons.Sparkles className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Gerar com IA</span></div>
          <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value.slice(0, 280))} rows={2} placeholder="Descreva o tema do seu funil… (ex.: quiz para vender curso de inglês)" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary resize-none" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">{aiPrompt.length}/280</span>
            <button onClick={generateAi} disabled={generating} className="text-sm bg-primary text-white rounded-lg px-4 py-1.5 font-medium flex items-center gap-1.5 disabled:opacity-50">{generating ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Wand2 className="w-4 h-4" />} Gerar funil</button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm border rounded-lg px-4 py-2 hover:bg-accent">Cancelar</button>
          <button onClick={createFromTemplate} className="text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg px-5 py-2 font-semibold">Criar funil</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// EDITOR (3 painéis)
// =========================================================================
function Editor({ spec: initial, onClose }: { spec: QuizSpec; onClose: () => void }) {
  const { toast } = useToast();
  const [spec, setSpec] = useState<QuizSpec>(initial);
  const [stepIdx, setStepIdx] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(initial.slug || null);
  const [tab, setTab] = useState<"construtor" | "fluxo" | "design" | "leads" | "config">("construtor");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [showShare, setShowShare] = useState(false);
  const [showVars, setShowVars] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useEffect(() => { ensureGoogleFont(spec.theme?.font); }, [spec.theme?.font]);

  // ---- undo / redo ----
  const [past, setPast] = useState<QuizSpec[]>([]);
  const [future, setFuture] = useState<QuizSpec[]>([]);
  const prevSpec = useRef(spec);
  const skipHist = useRef(false);
  useEffect(() => {
    if (skipHist.current) { skipHist.current = false; prevSpec.current = spec; return; }
    if (prevSpec.current !== spec) { const old = prevSpec.current; prevSpec.current = spec; setPast((p) => [...p.slice(-49), old]); setFuture([]); }
  }, [spec]);
  const undo = () => setPast((p) => { if (!p.length) return p; setFuture((f) => [spec, ...f]); skipHist.current = true; setSpec(p[p.length - 1]); return p.slice(0, -1); });
  const redo = () => setFuture((f) => { if (!f.length) return f; setPast((pp) => [...pp, spec]); skipHist.current = true; setSpec(f[0]); return f.slice(1); });
  const step = spec.steps[stepIdx] || spec.steps[0];
  const comps = step?.components || [];
  const selected = comps.find((c) => c.id === selId) || null;

  const patch = (p: Partial<QuizSpec>) => setSpec((s) => ({ ...s, ...p }));
  const setSteps = (steps: QuizStep[]) => setSpec((s) => ({ ...s, steps }));
  const setComps = (updater: (c: QComponent[]) => QComponent[]) =>
    setSpec((s) => ({ ...s, steps: s.steps.map((st, i) => (i === stepIdx ? { ...st, components: updater(st.components) } : st)) }));

  const addFromPalette = (key: string, at?: number) => {
    const c = newComponentFromPalette(key);
    setComps((list) => { const copy = [...list]; copy.splice(at ?? copy.length, 0, c); return copy; });
    setSelId(c.id);
  };
  const updateComp = (id: string, props: Record<string, any>, visibility?: any) =>
    setComps((list) => list.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...props }, ...(visibility ? { visibility } : {}) } : c)));
  const removeComp = (id: string) => { setComps((list) => list.filter((c) => c.id !== id)); if (selId === id) setSelId(null); };
  const dupComp = (id: string) => setComps((list) => { const i = list.findIndex((c) => c.id === id); if (i < 0) return list; const copy = [...list]; copy.splice(i + 1, 0, { ...list[i], id: Math.random().toString(36).slice(2, 9) }); return copy; });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e; if (!over) return;
    const kind = (active.data.current as any)?.kind;
    if (kind === "palette") {
      const key = (active.data.current as any).paletteKey;
      let at = comps.length;
      if (over.id !== "CANVAS") { const oi = comps.findIndex((c) => c.id === over.id); if (oi >= 0) at = oi + 1; }
      addFromPalette(key, at);
    } else if (kind === "item") {
      if (over.id === active.id) return;
      const from = comps.findIndex((c) => c.id === active.id);
      const to = comps.findIndex((c) => c.id === over.id);
      if (from >= 0 && to >= 0) setComps((list) => arrayMove(list, from, to));
    }
  };

  const addStep = () => { const s = newStep(`Etapa ${spec.steps.length + 1}`); setSteps([...spec.steps, s]); setStepIdx(spec.steps.length); setSelId(null); };
  const delStep = (i: number) => { if (spec.steps.length <= 1) return; setSteps(spec.steps.filter((_, x) => x !== i)); setStepIdx(Math.max(0, i - 1)); setSelId(null); };
  const moveStep = (i: number, dir: number) => { const j = i + dir; if (j < 0 || j >= spec.steps.length) return; setSteps(arrayMove(spec.steps, i, j)); setStepIdx(j); };

  // garante 'name' (variável {{}}) único entre componentes opcoes/video_resposta,
  // evitando que respostas se sobrescrevam no lead/{{}}.
  const dedupeNames = (s: QuizSpec): QuizSpec => {
    const seen = new Map<string, number>();
    return {
      ...s,
      steps: s.steps.map((st) => ({
        ...st,
        components: st.components.map((c) => {
          if (c.type !== "opcoes" && c.type !== "video_resposta") return c;
          let base = (c.props?.name || c.type) as string;
          if (seen.has(base)) { const n = (seen.get(base) || 1) + 1; seen.set(base, n); base = `${base}_${n}`; }
          else seen.set(base, 1);
          return c.props?.name === base ? c : { ...c, props: { ...c.props, name: base } };
        }),
      })),
    };
  };

  const save = async () => {
    if (!spec.name?.trim()) { toast({ title: "Dê um nome ao funil", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const clean = dedupeNames(spec);
      setSpec(clean);
      const r = await apiRequest("POST", "/api/quiz/save", clean);
      const d = await r.json();
      setSavedSlug(d.slug); setSpec((s) => ({ ...s, slug: d.slug }));
      toast({ title: "Funil salvo!", description: spec.isPublished ? `Publicado em /q/${d.slug}` : "Rascunho salvo." });
    } catch (e: any) { toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const publicUrl = savedSlug ? `${window.location.origin}/q/${savedSlug}` : "";

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* HEADER */}
      <div className="h-14 border-b bg-white dark:bg-gray-900 flex items-center px-4 gap-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><Icons.ArrowLeft className="w-4 h-4" /></button>
        <input value={spec.name} onChange={(e) => patch({ name: e.target.value })} className="font-semibold bg-transparent outline-none border-b border-transparent focus:border-primary px-1 min-w-[80px] max-w-[150px]" placeholder="Nome do funil" />
        <div className="flex items-center gap-0.5 border-l pl-2">
          <button onClick={undo} disabled={!past.length} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30" title="Desfazer"><Icons.Undo2 className="w-4 h-4" /></button>
          <button onClick={redo} disabled={!future.length} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30" title="Refazer"><Icons.Redo2 className="w-4 h-4" /></button>
          <button onClick={() => setShowVars(true)} className="px-2 py-1 rounded-md hover:bg-accent text-xs font-mono italic" title="Variáveis">f(x)</button>
        </div>
        <div className="flex items-center gap-0.5 mx-auto bg-muted/50 rounded-lg p-0.5">
          {([["construtor", "Construtor", "LayoutGrid"], ["fluxo", "Fluxo", "GitBranch"], ["design", "Design", "Palette"], ["leads", "Leads", "Users"], ["config", "Configurações", "Settings"]] as const).map(([k, label, ic]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 ${tab === k ? "bg-white dark:bg-gray-800 shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon name={ic} size={14} /> <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none mr-1">
            <input type="checkbox" checked={!!spec.isPublished} onChange={(e) => patch({ isPublished: e.target.checked })} className="accent-emerald-500 w-4 h-4" />
            Publicado
          </label>
          <div className="flex items-center border rounded-lg p-0.5">
            <button onClick={() => setDevice("mobile")} className={`p-1.5 rounded-md ${device === "mobile" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Celular"><Icons.Smartphone className="w-4 h-4" /></button>
            <button onClick={() => setDevice("desktop")} className={`p-1.5 rounded-md ${device === "desktop" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Computador"><Icons.Monitor className="w-4 h-4" /></button>
          </div>
          <button onClick={() => savedSlug ? setShowShare(true) : toast({ title: "Salve o funil primeiro" })} className="text-sm border rounded-lg px-2.5 py-1.5 hover:bg-accent" title="Compartilhar"><Icons.Share2 className="w-4 h-4" /></button>
          <button onClick={() => setPreview((v) => !v)} className={`text-sm border rounded-lg px-3 py-1.5 flex items-center gap-1.5 ${preview ? "bg-primary text-white border-primary" : "hover:bg-accent"}`}><Icons.Eye className="w-4 h-4" /> Preview</button>
          <button onClick={save} disabled={saving} className="text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-1.5 font-semibold flex items-center gap-1.5 disabled:opacity-50">{saving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Save className="w-4 h-4" />} Salvar</button>
        </div>
      </div>

      {tab === "leads" ? (
        <LeadsDashboard slug={savedSlug} />
      ) : tab === "fluxo" ? (
        <FlowOverview spec={spec} onPick={(i) => { setStepIdx(i); setTab("construtor"); }} />
      ) : tab === "config" ? (
        <ConfigPanel spec={spec} onPatch={patch} publicUrl={publicUrl} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="flex-1 flex overflow-hidden">
            {/* RAIL DE ETAPAS */}
            {!preview && (
              <StepsRail spec={spec} stepIdx={stepIdx}
                onSelect={(i) => { setStepIdx(i); setSelId(null); }}
                onAdd={addStep} onDel={delStep}
                onReorder={(from, to) => { setSteps(arrayMove(spec.steps, from, to)); setStepIdx(to); }}
              />
            )}
            {/* PALETA */}
            {!preview && tab === "construtor" && (
              <div className="w-60 border-r bg-white dark:bg-gray-900 overflow-y-auto shrink-0 p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">COMPONENTES</p>
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="mb-4">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 px-1">{cat}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PALETTE.filter((p) => p.category === cat).map((item) => <PaletteCard key={item.key} item={item} onAdd={() => addFromPalette(item.key)} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CANVAS */}
            <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 py-8 px-4">
              <Frame device={device} theme={spec.theme}>
                <QuizChrome theme={spec.theme} header={step?.header} canBack={stepIdx > 0} progress={Math.round(((stepIdx + 1) / Math.max(1, spec.steps.length)) * 100)} />
                {preview
                  ? <RuntimePreview step={step} theme={spec.theme} />
                  : <Canvas comps={comps} selId={selId} onSelect={setSelId} onRemove={removeComp} onDup={dupComp} theme={spec.theme} />}
              </Frame>
            </div>

            {/* PROPRIEDADES */}
            {!preview && (
              <div className="w-80 border-l bg-white dark:bg-gray-900 overflow-y-auto shrink-0">
                {tab === "design"
                  ? <StepPanel spec={spec} stepIdx={stepIdx} onPatch={patch} onStepName={(n: string) => setSteps(spec.steps.map((s, i) => i === stepIdx ? { ...s, name: n } : s))} onStepPatch={(pp: any) => setSteps(spec.steps.map((s, i) => i === stepIdx ? { ...s, ...pp } : s))} onMove={moveStep} onDel={delStep} publicUrl={publicUrl} only="design" />
                  : selected
                    ? <PropsPanel comp={selected} steps={spec.steps} onChange={(props, vis) => updateComp(selected.id, props, vis)} onClose={() => setSelId(null)} />
                    : <StepPanel spec={spec} stepIdx={stepIdx} onPatch={patch} onStepName={(n: string) => setSteps(spec.steps.map((s, i) => i === stepIdx ? { ...s, name: n } : s))} onStepPatch={(pp: any) => setSteps(spec.steps.map((s, i) => i === stepIdx ? { ...s, ...pp } : s))} onMove={moveStep} onDel={delStep} publicUrl={publicUrl} />}
              </div>
            )}
          </div>
        </DndContext>
      )}

      {showShare && <ShareModal url={publicUrl} published={!!spec.isPublished} onClose={() => setShowShare(false)} />}
      {showVars && <VarsModal spec={spec} onClose={() => setShowVars(false)} />}
    </div>
  );
}

// ---- Modal Compartilhar ----
function ShareModal({ url, published, onClose }: { url: string; published: boolean; onClose: () => void }) {
  const enc = encodeURIComponent(url);
  const socials: [string, string, string][] = [
    ["Facebook", "BrandFacebook", `https://www.facebook.com/sharer/sharer.php?u=${enc}`],
    ["Twitter", "BrandX", `https://twitter.com/intent/tweet?url=${enc}`],
    ["LinkedIn", "BrandLinkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`],
    ["WhatsApp", "BrandWhatsapp", `https://wa.me/?text=${enc}`],
    ["Telegram", "BrandTelegram", `https://t.me/share/url?url=${enc}`],
    ["E-mail", "Mail", `mailto:?body=${enc}`],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Compartilhar funil</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icons.X className="w-4 h-4" /></button></div>
        {!published && <p className="text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2 mb-3">⚠️ Marque "Publicado" e salve para o link funcionar.</p>}
        <p className="text-xs text-muted-foreground mb-1">Link do funil:</p>
        <div className="flex gap-1.5 mb-4"><input readOnly value={url} className="flex-1 border rounded-lg px-3 py-2 text-sm bg-muted" /><button onClick={() => navigator.clipboard.writeText(url)} className="border rounded-lg px-3 hover:bg-accent"><Icons.Copy className="w-4 h-4" /></button></div>
        <p className="text-xs text-muted-foreground mb-2">Redes sociais:</p>
        <div className="grid grid-cols-3 gap-2">
          {socials.map(([name, icon, href]) => (
            <a key={name} href={href} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 border rounded-lg py-3 hover:border-primary hover:bg-primary/5 text-xs">
              <Icon name={icon} size={20} /> {name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Modal Variáveis f(x) ----
function VarsModal({ spec, onClose }: { spec: QuizSpec; onClose: () => void }) {
  const vars = new Set<string>(["score"]);
  for (const st of spec.steps) for (const c of st.components) {
    if (c.props?.name) vars.add(c.props.name);
    if (c.type === "captura") for (const f of (c.props?.fields || [])) if (f.name) vars.add(f.name);
  }
  const list = Array.from(vars);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2"><h3 className="font-semibold flex items-center gap-2"><span className="font-mono italic">f(x)</span> Variáveis disponíveis</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><Icons.X className="w-4 h-4" /></button></div>
        <p className="text-xs text-muted-foreground mb-3">Use estas variáveis em qualquer texto (ex.: <code className="bg-muted px-1 rounded">Olá, {"{{nome}}"}!</code>). O <code className="bg-muted px-1 rounded">{"{{score}}"}</code> é a pontuação acumulada.</p>
        <div className="flex flex-wrap gap-1.5">
          {list.map((v) => <button key={v} onClick={() => navigator.clipboard.writeText(`{{${v}}}`)} className="text-xs font-mono bg-primary/10 text-primary rounded-lg px-2.5 py-1.5 hover:bg-primary/20" title="Copiar">{`{{${v}}}`}</button>)}
        </div>
      </div>
    </div>
  );
}

// ---- Configurações em sidebar (Geral / Pixel / SEO / Webhooks) ----
function ConfigPanel({ spec, onPatch, publicUrl }: { spec: QuizSpec; onPatch: (p: Partial<QuizSpec>) => void; publicUrl: string }) {
  const [sec, setSec] = useState("geral");
  const s: any = spec;
  const sections: [string, string, string][] = [["geral", "Geral", "Settings"], ["pixel", "Pixel & Scripts", "Code"], ["seo", "SEO & Favicon", "Globe"], ["webhooks", "Webhooks", "Webhook"]];
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-56 border-r bg-white dark:bg-gray-900 p-2 space-y-1 shrink-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 px-2 pt-1 pb-2">Configurações</p>
        {sections.map(([k, lab, ic]) => (
          <button key={k} onClick={() => setSec(k)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${sec === k ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"}`}><Icon name={ic} size={15} /> {lab}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-950">
        <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-xl border p-5 space-y-3">
          {sec === "geral" && <>
            <h3 className="font-semibold text-sm mb-1">Geral</h3>
            <Field l="Título do funil"><In v={spec.name} onChange={(v: any) => onPatch({ name: v })} /></Field>
            <Field l="Redirect final (URL)"><In v={spec.redirectUrl} onChange={(v: any) => onPatch({ redirectUrl: v })} placeholder="https://checkout…" /></Field>
            {publicUrl && <div><label className="text-xs text-muted-foreground block mb-1">URL pública</label><div className="flex gap-1.5"><input readOnly value={publicUrl} className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm bg-muted" /><button onClick={() => navigator.clipboard.writeText(publicUrl)} className="border rounded-lg px-2.5 hover:bg-accent"><Icons.Copy className="w-4 h-4" /></button></div></div>}
            <div className="border-t pt-3"><p className="text-xs font-semibold text-muted-foreground mb-2">DOMÍNIO PRÓPRIO</p>
              <Field l="Domínio ou subdomínio"><In v={s.customDomain} onChange={(v: any) => onPatch({ customDomain: v } as any)} placeholder="ex: quiz.seusite.com.br" /></Field>
              {s.customDomain && <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2.5 mt-1.5 space-y-1">
                <p>Aponte seu DNS para ativar:</p>
                <p className="font-mono">CNAME · {s.customDomain.split(".")[0] || "@"} → cname.lowfy.com.br</p>
                <p className="text-amber-600">⏳ Propagação pode levar até 24h.</p>
              </div>}
            </div>
          </>}
          {sec === "pixel" && <>
            <h3 className="font-semibold text-sm mb-1">Pixel & Scripts de rastreamento</h3>
            <Field l="Meta (Facebook) Pixel ID"><In v={spec.pixelId} onChange={(v: any) => onPatch({ pixelId: v })} placeholder="1234567890" /></Field>
            <Field l="Google Analytics ID"><In v={s.gaId} onChange={(v: any) => onPatch({ gaId: v } as any)} placeholder="G-XXXXXXX" /></Field>
            <Field l="Scripts personalizados (no <head>)"><Ta v={s.headScript} onChange={(v: any) => onPatch({ headScript: v } as any)} /></Field>
            <p className="text-[11px] text-muted-foreground">O Pixel dispara PageView e Lead automaticamente.</p>
          </>}
          {sec === "seo" && <>
            <h3 className="font-semibold text-sm mb-1">SEO & Favicon</h3>
            <Field l="Título (SEO)"><In v={s.seoTitle} onChange={(v: any) => onPatch({ seoTitle: v } as any)} placeholder="Aparece na aba do navegador" /></Field>
            <Field l="Descrição (SEO)"><Ta v={s.seoDescription} onChange={(v: any) => onPatch({ seoDescription: v } as any)} /></Field>
            <Field l="Favicon (URL)"><In v={s.faviconUrl} onChange={(v: any) => onPatch({ faviconUrl: v } as any)} placeholder="https://…/favicon.png" /></Field>
            <Field l="Imagem de compartilhamento (URL)"><In v={s.shareImage} onChange={(v: any) => onPatch({ shareImage: v } as any)} placeholder="https://…/og.jpg" /></Field>
          </>}
          {sec === "webhooks" && <>
            <h3 className="font-semibold text-sm mb-1">Webhooks</h3>
            <Field l="Webhook de lead (POST)"><In v={spec.webhookUrl} onChange={(v: any) => onPatch({ webhookUrl: v })} placeholder="https://…" /></Field>
            <p className="text-[11px] text-muted-foreground">Enviamos um POST com os dados do lead (nome, e-mail, respostas, score) a cada captura.</p>
          </>}
        </div>
      </div>
    </div>
  );
}

// ---- Rail de etapas (lista lateral, estilo Inlead) ----
function StepsRail({ spec, stepIdx, onSelect, onAdd, onDel, onReorder }: { spec: QuizSpec; stepIdx: number; onSelect: (i: number) => void; onAdd: () => void; onDel: (i: number) => void; onReorder: (from: number, to: number) => void }) {
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <div className="w-48 border-r bg-white dark:bg-gray-900 shrink-0 flex flex-col">
      <div className="p-2 border-b">
        <div className="relative"><Icons.Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar…" className="w-full border rounded-lg pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-gray-800 outline-none focus:border-primary" /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {spec.steps.map((s, i) => (!q || (s.name || `Etapa ${i + 1}`).toLowerCase().includes(q.toLowerCase())) ? (
          <div key={s.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) onReorder(drag, i); setDrag(null); }}
            onClick={() => onSelect(i)} data-step-rail={i}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${i === stepIdx ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"} ${drag === i ? "opacity-50" : ""}`}>
            <Icons.GripVertical className="w-3 h-3 opacity-40 shrink-0 cursor-grab" />
            <span className="w-5 h-5 rounded bg-current/10 text-[11px] flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="flex-1 truncate">{s.name || `Etapa ${i + 1}`}</span>
            {spec.steps.length > 1 && <button onClick={(e) => { e.stopPropagation(); onDel(i); }} className="opacity-0 group-hover:opacity-100 hover:text-red-600 shrink-0"><Icons.X className="w-3.5 h-3.5" /></button>}
          </div>
        ) : null)}
      </div>
      <div className="p-2 border-t">
        <button onClick={onAdd} data-add-step className="w-full text-sm border rounded-lg py-1.5 hover:bg-accent flex items-center justify-center gap-1.5"><Icons.Plus className="w-4 h-4" /> Nova etapa</button>
      </div>
    </div>
  );
}

// ---- Paleta (draggable + click) ----
function PaletteCard({ item, onAdd }: { item: any; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `new-${item.key}`, data: { kind: "palette", paletteKey: item.key } });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={onAdd} data-palette={item.key}
      className={`relative flex flex-col items-center gap-1 border rounded-lg py-2.5 hover:border-primary hover:bg-primary/5 transition text-center ${isDragging ? "opacity-40" : ""}`}>
      {item.novo && <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">novo</span>}
      <Icon name={item.icon} size={18} className="text-muted-foreground" />
      <span className="text-[11px] leading-tight">{item.label}</span>
    </button>
  );
}

// ---- Canvas (sortable) ----
function Canvas({ comps, selId, onSelect, onRemove, onDup, theme }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: "CANVAS" });
  if (comps.length === 0) {
    return <div ref={setNodeRef} data-empty-canvas className={`min-h-[280px] m-3 border-2 border-dashed rounded-xl flex items-center justify-center text-center text-sm transition ${isOver ? "border-primary bg-primary/5" : "border-gray-300 text-muted-foreground"}`}>
      Arraste componentes aqui<br />ou clique em um item da paleta
    </div>;
  }
  return (
    <div ref={setNodeRef} className="p-3 space-y-2">
      <SortableContext items={comps.map((c: QComponent) => c.id)} strategy={verticalListSortingStrategy}>
        {comps.map((c: QComponent) => (
          <CanvasItem key={c.id} comp={c} selected={selId === c.id} onSelect={() => onSelect(c.id)} onRemove={() => onRemove(c.id)} onDup={() => onDup(c.id)} theme={theme} />
        ))}
      </SortableContext>
    </div>
  );
}

function CanvasItem({ comp, selected, onSelect, onRemove, onDup, theme }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: comp.id, data: { kind: "item" } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const ctx: RuntimeCtx = { theme: theme || {}, vars: { score: 0 }, score: 0, preview: true };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect} data-canvas-item={comp.type}
      className={`relative group rounded-xl border bg-white p-3 cursor-pointer ${selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200 hover:border-gray-300"}`}>
      <div className="absolute -top-2.5 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
        <button onClick={(e) => { e.stopPropagation(); onDup(); }} className="w-6 h-6 rounded bg-white border shadow-sm flex items-center justify-center hover:bg-accent"><Icons.Copy className="w-3 h-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="w-6 h-6 rounded bg-white border shadow-sm flex items-center justify-center hover:bg-red-50 hover:text-red-600"><Icons.Trash2 className="w-3 h-3" /></button>
        <button {...listeners} {...attributes} onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded bg-white border shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing"><Icons.GripVertical className="w-3 h-3" /></button>
      </div>
      <div className="pointer-events-none"><ComponentView comp={comp} ctx={ctx} /></div>
    </div>
  );
}

// ---- Chrome do quiz dentro do mockup (logo + barra de progresso + voltar) ----
function QuizChrome({ theme, header, progress, canBack }: { theme?: any; header?: any; progress: number; canBack?: boolean }) {
  const primary = theme?.primaryColor || "#22c55e";
  const showLogo = (header?.showLogo !== false) && theme?.logoUrl;
  const showProgress = (header?.showProgress !== false) && (theme?.showProgress !== false);
  const showBack = (header?.allowBack !== false) && canBack;
  if (!showLogo && !showProgress && !showBack) return null;
  return (
    <div style={{ padding: "10px 18px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
      {(showLogo || showBack) && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showBack && <span style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#64748b" }}>‹</span>}
        {showLogo && <img src={theme.logoUrl} alt="" style={{ height: 30, objectFit: "contain", margin: showBack ? 0 : "0 auto" }} />}
      </div>}
      {showProgress && <div style={{ width: "100%", height: 6, background: "#e5e9ee", borderRadius: 999 }}><div style={{ width: `${Math.max(4, progress)}%`, height: "100%", background: primary, borderRadius: 999, transition: "width .3s" }} /></div>}
    </div>
  );
}

// ---- Frame: escolhe iPhone (mobile) ou navegador (desktop) ----
function Frame({ device, theme, children }: { device: "mobile" | "desktop"; theme?: any; children: React.ReactNode }) {
  if (device === "desktop") return <DesktopFrame theme={theme}>{children}</DesktopFrame>;
  return <Phone theme={theme}>{children}</Phone>;
}

// ---- Mockup desktop (janela de navegador ~1280x800) ----
function DesktopFrame({ theme, children }: { theme?: any; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1280 }}>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", boxShadow: "0 28px 60px -20px rgba(0,0,0,.5)", background: "#fff" }}>
        <div style={{ height: 40, background: "#e9edf1", display: "flex", alignItems: "center", gap: 7, padding: "0 16px", borderBottom: "1px solid #d8dee6" }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ec6a5e" }} />
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f4bf50" }} />
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#61c354" }} />
          <div style={{ flex: 1, margin: "0 14px", maxWidth: 460, height: 24, borderRadius: 7, background: "#fff", border: "1px solid #d8dee6", fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", padding: "0 12px" }}>🔒 lowfy.com.br/q/seu-funil</div>
        </div>
        <div style={{ background: theme?.bgColor || "#fff", color: theme?.textColor || "#0f172a", fontFamily: theme?.font || "Inter, system-ui, sans-serif", height: 800, maxHeight: "70vh", overflowY: "auto", padding: "8px 0 40px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Mockup iPhone 16 Pro ----
function Phone({ theme, children }: { theme?: any; children: React.ReactNode }) {
  const sc = theme?.textColor || "#0f172a";
  return (
    <div className="mx-auto" style={{ width: 348 }}>
      {/* moldura de titânio */}
      <div style={{
        position: "relative", borderRadius: 60, padding: 11,
        background: "linear-gradient(150deg,#46484d 0%,#1a1b1e 52%,#3c3e43 100%)",
        boxShadow: "0 28px 60px -18px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.07)",
      }}>
        {/* botões laterais */}
        <span style={{ position: "absolute", left: -2.5, top: 118, width: 3, height: 26, borderRadius: 3, background: "#303236" }} />
        <span style={{ position: "absolute", left: -2.5, top: 168, width: 3, height: 48, borderRadius: 3, background: "#303236" }} />
        <span style={{ position: "absolute", left: -2.5, top: 230, width: 3, height: 48, borderRadius: 3, background: "#303236" }} />
        <span style={{ position: "absolute", right: -2.5, top: 190, width: 3, height: 70, borderRadius: 3, background: "#303236" }} />
        {/* tela */}
        <div style={{ position: "relative", borderRadius: 49, overflow: "hidden", background: theme?.bgColor || "#fff", color: theme?.textColor || "#0f172a", fontFamily: theme?.font || "Inter, system-ui, sans-serif", height: 712, maxHeight: "72vh" }}>
          {/* barra de status */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", zIndex: 30, pointerEvents: "none" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: sc, letterSpacing: ".3px" }}>9:41</span>
            <span style={{ display: "flex", gap: 5, alignItems: "center", color: sc }}>
              <Icons.Signal style={{ width: 15, height: 15 }} />
              <Icons.Wifi style={{ width: 15, height: 15 }} />
              <Icons.BatteryFull style={{ width: 24, height: 15 }} />
            </span>
          </div>
          {/* Dynamic Island */}
          <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 110, height: 32, background: "#000", borderRadius: 20, zIndex: 40, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)" }} />
          {/* conteúdo */}
          <div style={{ height: "100%", overflowY: "auto", paddingTop: 56 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Runtime preview (interativo, etapa única) ----
function RuntimePreview({ step, theme }: { step: QuizStep; theme: any }) {
  const ctx: RuntimeCtx = { theme: theme || {}, vars: { score: 0 }, score: 0, onPick: () => {}, onButton: () => {}, onSubmitCapture: () => {}, onAdvance: () => {} };
  return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>{(step?.components || []).map((c) => <div key={c.id} style={{ marginTop: c.props?._mt || 0, marginBottom: c.props?._mb || 0 }}><ComponentView comp={c} ctx={ctx} /></div>)}</div>;
}

// =========================================================================
// PAINEL DE PROPRIEDADES
// =========================================================================
function PropsPanel({ comp, steps, onChange, onClose }: { comp: QComponent; steps: QuizStep[]; onChange: (props: any, vis?: any) => void; onClose: () => void }) {
  const p = comp.props || {};
  const set = (k: string, v: any) => onChange({ [k]: v });
  const stepOpts: [string, string][] = [["", "Próxima etapa"], ...steps.map((s, i) => [s.id, s.name || `Etapa ${i + 1}`] as [string, string])];
  const [ptab, setPtab] = useState<"componente" | "estilo" | "exibicao">("componente");
  const label = PALETTE_BY_KEY[p._pk] || (PALETTE.find((x) => x.type === comp.type) as any);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm capitalize flex items-center gap-2"><Icon name={label?.icon || "Square"} size={16} /> {label?.label || comp.type}</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
      </div>

      <div className="flex gap-0.5 mb-3 bg-muted/50 rounded-lg p-0.5">
        {([["componente", "Componente"], ["estilo", "Estilo"], ["exibicao", "Exibição"]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setPtab(k as any)} className={`flex-1 text-xs py-1.5 rounded-md ${ptab === k ? "bg-white dark:bg-gray-800 shadow-sm font-medium" : "text-muted-foreground"}`}>{lab}</button>
        ))}
      </div>

      {ptab === "componente" && <div className="space-y-3">
        {comp.type === "texto" && <>
          <Field l="Texto (formatação completa)"><RichTextEditor key={comp.id} value={p.html || wrapTexto(p.text, p.variant)} onChange={(html) => onChange({ html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() })} /></Field>
          <Field l="Alinhamento geral"><Sel v={p.align} onChange={(v) => set("align", v)} opts={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} /></Field>
        </>}

        {comp.type === "imagem" && <>
          <Field l="Imagem"><ImageUpload value={p.url} onChange={(u) => set("url", u)} folder="quiz-imagens" /></Field>
          <Field l="Arredondamento"><In type="number" v={p.radius} onChange={(v: any) => set("radius", +v)} /></Field>
          <Field l="Largura (%)"><In type="number" v={p.maxWidth} onChange={(v: any) => set("maxWidth", +v)} /></Field>
        </>}

        {(comp.type === "video" || comp.type === "audio") && <Field l="URL (link/embed)"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>}

        {comp.type === "galeria" && <>
          <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["grid", "Grade"], ["slide", "Lista"]]} /></Field>
          <ListEditor label="Imagens" items={p.images || []} onChange={(items) => set("images", items)} render={(it, upd) => <ImageUpload value={it} onChange={(u) => upd(u)} compact folder="quiz-galeria" />} create={() => ""} />
        </>}

        {comp.type === "opcoes" && <>
          <Field l="ID / Name (variável {{...}})"><In v={p.name} onChange={(v: any) => set("name", v)} placeholder="ex: emocoes" /></Field>
          <Field l="Pergunta"><Ta v={p.question} onChange={(v: any) => set("question", v)} /></Field>
          <Field l="Ajuda (opcional)"><In v={p.help} onChange={(v: any) => set("help", v)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["list", "Itens em lista"], ["grid", "Grade"], ["spread", "Itens espalhados"]]} /></Field>
            <Field l="Direção"><Sel v={p.direction} onChange={(v) => set("direction", v)} opts={[["vertical", "Vertical"], ["horizontal", "Horizontal"]]} /></Field>
          </div>
          <Field l="Disposição"><Sel v={p.disposition} onChange={(v) => set("disposition", v)} opts={[["texto", "Texto"], ["image_texto", "Imagem | texto"], ["image", "Apenas imagem"], ["emoji_texto", "Emoji | texto"]]} /></Field>
          <ListEditor label="Opções (rótulo · pontos · imagem · destino)" items={p.options || []} onChange={(items) => set("options", items)}
            create={() => ({ id: Math.random().toString(36).slice(2, 9), label: "Nova opção", score: 0 })}
            render={(o, _u, patchItem) => <div className="space-y-1.5">
              <In v={o.label} onChange={(v: any) => patchItem({ label: v })} placeholder="Rótulo" />
              <div className="flex gap-1.5">
                <In v={o.emoji} onChange={(v: any) => patchItem({ emoji: v })} placeholder="😀" />
                <In type="number" v={o.score} onChange={(v: any) => patchItem({ score: +v })} placeholder="pts" />
                <In v={o.valor} onChange={(v: any) => patchItem({ valor: v })} placeholder="valor (A/B)" />
              </div>
              <ImageUpload value={o.image} onChange={(u) => patchItem({ image: u })} compact folder="quiz-opcoes" />
              <Sel v={o.nextStepId || ""} onChange={(v) => patchItem({ nextStepId: v })} opts={stepOpts} />
            </div>} />
          <div className="border-t pt-3 space-y-2.5">
            <CheckDesc l="Seleção obrigatória" desc="O usuário é obrigado a selecionar alguma opção para prosseguir." v={p.required} onChange={(v) => set("required", v)} />
            <CheckDesc l="Permitir múltipla escolha" desc="O usuário poderá selecionar mais de uma opção; a próxima etapa terá que ser definida através de um componente do tipo 'botão'." v={p.multiple} onChange={(v) => set("multiple", v)} />
            <CheckDesc l="Redirecionar apenas ao clicar no botão" desc="O usuário terá que clicar em um componente do tipo 'botão' para avançar. A próxima etapa configurada nas opções terá prioridade sobre a do botão." v={p.advanceOnButton} onChange={(v) => set("advanceOnButton", v)} />
          </div>
        </>}

        {comp.type === "video_resposta" && <>
          <Field l="ID / Name (variável)"><In v={p.name} onChange={(v: any) => set("name", v)} placeholder="ex: video_resposta" /></Field>
          <Field l="Pergunta"><Ta v={p.question} onChange={(v: any) => set("question", v)} /></Field>
          <Field l="Ajuda (opcional)"><In v={p.help} onChange={(v: any) => set("help", v)} /></Field>
          <Field l="Duração máxima (s)"><In type="number" v={p.maxSeconds} onChange={(v: any) => set("maxSeconds", +v)} /></Field>
          <Field l="Texto do botão"><In v={p.buttonText} onChange={(v: any) => set("buttonText", v)} /></Field>
        </>}

        {comp.type === "captura" && <>
          <Field l="Título"><In v={p.title} onChange={(v: any) => set("title", v)} /></Field>
          <Field l="Descrição"><In v={p.description} onChange={(v: any) => set("description", v)} /></Field>
          <Field l="Texto do botão"><In v={p.buttonText} onChange={(v: any) => set("buttonText", v)} /></Field>
          <Field l="Ao enviar, ir para"><Sel v={p.nextStepId || ""} onChange={(v) => set("nextStepId", v)} opts={stepOpts} /></Field>
          <ListEditor label="Campos" items={p.fields || []} onChange={(items) => set("fields", items)}
            create={() => ({ type: "text", name: "campo", label: "Campo", required: true })}
            render={(f, _u, patchItem) => <div className="space-y-1.5">
              <Sel v={f.type} onChange={(v) => patchItem({ type: v })} opts={[["name", "Nome"], ["email", "E-mail"], ["phone", "Telefone"], ["number", "Número"], ["date", "Data"], ["textarea", "Texto longo"], ["text", "Texto"]]} />
              <In v={f.name} onChange={(v: any) => patchItem({ name: v })} placeholder="variável (ex: nome)" />
              <In v={f.label} onChange={(v: any) => patchItem({ label: v })} placeholder="rótulo" />
              <Check l="Obrigatório" v={f.required !== false} onChange={(v) => patchItem({ required: v })} />
            </div>} />
        </>}

        {comp.type === "botao" && <>
          <Field l="Texto do botão"><In v={p.label} onChange={(v: any) => set("label", v)} /></Field>
          <Field l="Tipo de navegação"><Sel v={p.action} onChange={(v) => set("action", v)} opts={[["next", "Navegar entre etapas"], ["step", "Etapa específica"], ["url", "Redirecionar (link)"]]} /></Field>
          {p.action === "step" && <Field l="Destino"><Sel v={p.stepId || ""} onChange={(v) => set("stepId", v)} opts={stepOpts} /></Field>}
          {p.action === "url" && <>
            <Field l="Destino do redirecionamento"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>
            <Check l="Abrir em nova aba" v={p.newTab} onChange={(v) => set("newTab", v)} />
          </>}
          <Field l="Estilo"><Sel v={p.style} onChange={(v) => set("style", v)} opts={[["solid", "Sólido"], ["outline", "Contorno"]]} /></Field>
          <div className="flex gap-3"><Check l="Fixar no rodapé" v={p.fixedBottom} onChange={(v) => set("fixedBottom", v)} /><Check l="Com animação" v={p.animated} onChange={(v) => set("animated", v)} /></div>
        </>}

        {comp.type === "nivel" && <>
          <Field l="Rótulo"><In v={p.label} onChange={(v: any) => set("label", v)} /></Field>
          <Check l="Usar score do quiz" v={p.fromScore} onChange={(v) => set("fromScore", v)} />
          {!p.fromScore && <Field l="Porcentagem"><In type="number" v={p.percent} onChange={(v: any) => set("percent", +v)} /></Field>}
        </>}

        {comp.type === "loading" && <>
          <Field l="Texto"><In v={p.text} onChange={(v: any) => set("text", v)} /></Field>
          <Field l="Duração (s)"><In type="number" v={p.durationSec} onChange={(v: any) => set("durationSec", +v)} /></Field>
          <Field l="Ir para"><Sel v={p.nextStepId || ""} onChange={(v) => set("nextStepId", v)} opts={stepOpts} /></Field>
          <Field l="Ou redirecionar p/ URL"><In v={p.redirectUrl} onChange={(v: any) => set("redirectUrl", v)} placeholder="https://…" /></Field>
        </>}

        {comp.type === "timer" && <>
          <Field l="Minutos"><In type="number" v={p.minutes} onChange={(v: any) => set("minutes", +v)} /></Field>
          <Field l="Texto"><In v={p.text} onChange={(v: any) => set("text", v)} /></Field>
          <Field l="Texto ao expirar"><In v={p.expiredText} onChange={(v: any) => set("expiredText", v)} /></Field>
        </>}

        {comp.type === "alerta" && <>
          <Field l="Texto"><Ta v={p.text} onChange={(v: any) => set("text", v)} /></Field>
          <Field l="Tipo"><Sel v={p.variant} onChange={(v) => set("variant", v)} opts={[["info", "Info"], ["warning", "Aviso"], ["success", "Sucesso"], ["danger", "Perigo"]]} /></Field>
        </>}

        {comp.type === "notificacao" && <>
          <Field l="Título"><In v={p.title} onChange={(v: any) => set("title", v)} /></Field>
          <Field l="Texto"><In v={p.text} onChange={(v: any) => set("text", v)} /></Field>
        </>}

        {comp.type === "depoimentos" && <>
          <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["list", "Lista"], ["grid", "Grade"]]} /></Field>
          <ListEditor label="Depoimentos" items={p.items || []} onChange={(items) => set("items", items)}
            create={() => ({ name: "Cliente", text: "Adorei!", stars: 5 })}
            render={(it, _u, patchItem) => <div className="space-y-1.5">
              <In v={it.name} onChange={(v: any) => patchItem({ name: v })} placeholder="Nome" />
              <Ta v={it.text} onChange={(v: any) => patchItem({ text: v })} />
              <In type="number" v={it.stars} onChange={(v: any) => patchItem({ stars: +v })} placeholder="estrelas" />
            </div>} />
        </>}

        {comp.type === "argumentos" && <ListEditor label="Argumentos (até 4)" items={p.items || []} onChange={(items) => set("items", items.slice(0, 4))}
          create={() => ({ title: "Vantagem", text: "Descrição" })}
          render={(it, _u, patchItem) => <div className="space-y-1.5"><In v={it.title} onChange={(v: any) => patchItem({ title: v })} placeholder="Título" /><In v={it.text} onChange={(v: any) => patchItem({ text: v })} placeholder="Texto" /></div>} />}

        {comp.type === "preco" && <>
          <Field l="Preço"><In v={p.price} onChange={(v: any) => set("price", v)} /></Field>
          <Field l="Parcelas"><In v={p.installments} onChange={(v: any) => set("installments", v)} /></Field>
          <Field l="Texto do botão"><In v={p.ctaLabel} onChange={(v: any) => set("ctaLabel", v)} /></Field>
          <Field l="URL de checkout"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>
        </>}

        {comp.type === "espaco" && <Field l="Altura (px)"><In type="number" v={p.height} onChange={(v: any) => set("height", +v)} /></Field>}

        {comp.type === "faq" && <ListEditor label="Perguntas e respostas" items={p.items || []} onChange={(items) => set("items", items)}
          create={() => ({ q: "Nova pergunta?", a: "Resposta." })}
          render={(it, _u, patchItem) => <div className="space-y-1.5"><In v={it.q} onChange={(v: any) => patchItem({ q: v })} placeholder="Pergunta" /><Ta v={it.a} onChange={(v: any) => patchItem({ a: v })} /></div>} />}

        {comp.type === "carrossel" && <>
          <Field l="Disposição"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["image_texto", "Imagem e texto"], ["image", "Apenas imagem"]]} /></Field>
          <div className="flex gap-3"><Check l="Autoplay" v={p.autoplay} onChange={(v) => set("autoplay", v)} /><Check l="Paginação" v={p.pagination !== false} onChange={(v) => set("pagination", v)} /></div>
          <ListEditor label="Itens" items={p.items || []} onChange={(items) => set("items", items)}
            create={() => ({ image: "", title: "Novo item", desc: "" })}
            render={(it, _u, patchItem) => <div className="space-y-1.5"><ImageUpload value={it.image} onChange={(u) => patchItem({ image: u })} compact folder="quiz-carrossel" /><In v={it.title} onChange={(v: any) => patchItem({ title: v })} placeholder="Título" /><In v={it.desc} onChange={(v: any) => patchItem({ desc: v })} placeholder="Descrição" /></div>} />
        </>}

        {comp.type === "antes_depois" && <>
          <Field l="Imagem 'Antes'"><ImageUpload value={p.before} onChange={(u) => set("before", u)} folder="quiz-antes" /></Field>
          <Field l="Imagem 'Depois'"><ImageUpload value={p.after} onChange={(u) => set("after", u)} folder="quiz-depois" /></Field>
          <div className="grid grid-cols-2 gap-2"><Field l="Rótulo antes"><In v={p.labelBefore} onChange={(v: any) => set("labelBefore", v)} /></Field><Field l="Rótulo depois"><In v={p.labelAfter} onChange={(v: any) => set("labelAfter", v)} /></Field></div>
        </>}

        {comp.type === "graficos" && <>
          <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["list", "Itens em lista"], ["grid", "Grade 2 colunas"]]} /></Field>
          <ListEditor label="Gráficos" items={p.items || []} onChange={(items) => set("items", items)}
            create={() => ({ type: "circular", color: "tema", value: 50, label: "Métrica" })}
            render={(it, _u, patchItem) => <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Sel v={it.type} onChange={(v) => patchItem({ type: v })} opts={[["circular", "Circular"], ["barra", "Barra"]]} />
                <Sel v={it.color} onChange={(v) => patchItem({ color: v })} opts={[["tema", "Cor tema"], ["verde", "Verde"], ["vermelho", "Vermelho"]]} />
              </div>
              <div className="flex gap-1.5"><In type="number" v={it.value} onChange={(v: any) => patchItem({ value: +v })} placeholder="%" /><In v={it.label} onChange={(v: any) => patchItem({ label: v })} placeholder="Legenda" /></div>
            </div>} />
        </>}

        {comp.type === "script" && <Field l="Código de incorporação (HTML/JS)"><Ta v={p.code} onChange={(v: any) => set("code", v)} /></Field>}

        {comp.type === "regua" && <>
          <Field l="Pergunta / rótulo"><In v={p.label} onChange={(v: any) => set("label", v)} /></Field>
          <Field l="Unidade"><Sel v={p.unit} onChange={(v) => set("unit", v)} opts={[["cm", "cm (altura)"], ["kg", "kg (peso)"], ["anos", "anos (idade)"], ["", "sem unidade"]]} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field l="Mín"><In type="number" v={p.min} onChange={(v: any) => set("min", +v)} /></Field>
            <Field l="Máx"><In type="number" v={p.max} onChange={(v: any) => set("max", +v)} /></Field>
            <Field l="Inicial"><In type="number" v={p.value} onChange={(v: any) => set("value", +v)} /></Field>
          </div>
          <Check l="Campo obrigatório" v={p.required} onChange={(v) => set("required", v)} />
        </>}

        {comp.type === "cartesiano" && <>
          <Field l="Título"><In v={p.title} onChange={(v: any) => set("title", v)} /></Field>
          <div className="flex gap-3 flex-wrap"><Check l="Área" v={p.showArea} onChange={(v) => set("showArea", v)} /><Check l="Eixo X" v={p.showX} onChange={(v) => set("showX", v)} /><Check l="Eixo Y" v={p.showY} onChange={(v) => set("showY", v)} /></div>
          <ListEditor label="Pontos (rótulo · valor · 'Você')" items={p.items || []} onChange={(items) => set("items", items)}
            create={() => ({ label: "Ponto", value: 50 })}
            render={(it, _u, patchItem) => <div className="space-y-1.5">
              <div className="flex gap-1.5"><In v={it.label} onChange={(v: any) => patchItem({ label: v })} placeholder="Rótulo" /><In type="number" v={it.value} onChange={(v: any) => patchItem({ value: +v })} placeholder="valor" /></div>
              <Check l="Marcar como 'Você'" v={it.you} onChange={(v) => patchItem({ you: v })} />
            </div>} />
        </>}

        <div className="border-t pt-2 mt-1">
          <details>
            <summary className="text-[11px] uppercase tracking-wide text-muted-foreground/70 cursor-pointer">+ Avançado</summary>
            <div className="mt-2"><Field l="ID / Name (CSS, pixel, variáveis)"><In v={p.name ?? p._id} onChange={(v: any) => set(p.name !== undefined ? "name" : "_id", v)} placeholder="ex: meu_componente" /></Field></div>
          </details>
        </div>
      </div>}

      {ptab === "estilo" && <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field l="Margem superior (px)"><In type="number" v={p._mt} onChange={(v: any) => set("_mt", +v)} /></Field>
          <Field l="Margem inferior (px)"><In type="number" v={p._mb} onChange={(v: any) => set("_mb", +v)} /></Field>
        </div>
        {(comp.type === "texto") && <>
          <Field l="Cor do texto (hex)"><In v={p.color} onChange={(v: any) => set("color", v)} placeholder="#0f172a" /></Field>
          <Field l="Alinhamento"><Sel v={p.align} onChange={(v) => set("align", v)} opts={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} /></Field>
        </>}
        {(comp.type === "opcoes") && <Field l="Avançar automático (escolha única)"><Sel v={p.autoAdvance === false ? "no" : "yes"} onChange={(v) => set("autoAdvance", v === "yes")} opts={[["yes", "Sim, avança ao escolher"], ["no", "Não, espera o botão"]]} /></Field>}
        <p className="text-xs text-muted-foreground">A largura/cor primária seguem o tema do funil (aba Design).</p>
      </div>}

      {ptab === "exibicao" && <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Controle quando este componente aparece para o usuário, com base na pontuação (score) acumulada ou no tempo na etapa.</p>
        <VisibilityEditor comp={comp} onChange={(vis) => onChange({}, vis)} />
      </div>}
    </div>
  );
}

function VisibilityEditor({ comp, onChange }: { comp: QComponent; onChange: (vis: any) => void }) {
  const vis = comp.visibility || { mode: "always" };
  return (
    <div className="border-t pt-3 mt-2">
      <p className="text-xs font-semibold text-muted-foreground mb-2">EXIBIÇÃO CONDICIONAL</p>
      <Sel v={vis.mode || "always"} onChange={(v) => onChange({ ...vis, mode: v })} opts={[["always", "Sempre visível"], ["score", "Por pontuação (score)"], ["time", "Após X segundos"]]} />
      {vis.mode === "score" && <div className="flex gap-1.5 mt-2">
        <Sel v={vis.op || ">="} onChange={(v) => onChange({ ...vis, op: v })} opts={[[">", ">"], ["<", "<"], [">=", "≥"], ["<=", "≤"], ["==", "="]]} />
        <In type="number" v={vis.value} onChange={(v: any) => onChange({ ...vis, value: +v })} placeholder="score" />
      </div>}
      {vis.mode === "time" && <div className="mt-2"><In type="number" v={vis.afterSeconds} onChange={(v: any) => onChange({ ...vis, afterSeconds: +v })} placeholder="segundos" /></div>}
    </div>
  );
}

// ---- Painel da etapa / funil ----
function StepPanel({ spec, stepIdx, onPatch, onStepName, onStepPatch, onMove, onDel, publicUrl, only }: any) {
  const step = spec.steps[stepIdx];
  const th = spec.theme || {};
  const hd = step?.header || {};
  const setTheme = (k: string, v: any) => onPatch({ theme: { ...th, [k]: v } });
  const setHeader = (k: string, v: any) => onStepPatch({ header: { ...hd, [k]: v } });
  // Construtor (sem `only`) = config por etapa; Design = tema global; Config = integrações
  const showStep = !only;
  const showAppearance = only === "design";
  const showConfig = only === "config";
  return (
    <div className="p-4 space-y-4">
      {showStep && <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">ETAPA {stepIdx + 1}</p>
        <Field l="Nome da etapa"><In v={step?.name} onChange={onStepName} /></Field>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onMove(stepIdx, -1)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-accent">← Mover</button>
          <button onClick={() => onMove(stepIdx, 1)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-accent">Mover →</button>
          <button onClick={() => onDel(stepIdx)} className="text-xs border rounded-lg py-1.5 px-3 hover:bg-red-50 hover:text-red-600"><Icons.Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Cabeçalho</p>
          <Check l="Mostrar logo" v={hd.showLogo !== false} onChange={(v) => setHeader("showLogo", v)} />
          <Check l="Mostrar progresso" v={hd.showProgress !== false} onChange={(v) => setHeader("showProgress", v)} />
          <Check l="Permitir voltar" v={hd.allowBack !== false} onChange={(v) => setHeader("allowBack", v)} />
        </div>
      </div>}

      {showAppearance && <div className="space-y-4">
        <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">🎨 O Design se aplica a <b>todo o funil</b> — cores, fonte e logo valem para todas as etapas.</p>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">GERAL</p>
          <Field l="Logo no topo"><ImageUpload value={th.logoUrl} onChange={(u) => setTheme("logoUrl", u)} folder="quiz-logos" /></Field>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">CORES</p>
          <Field l="Cor primária (botões e destaques)"><div className="flex gap-2"><input type="color" value={th.primaryColor || "#22c55e"} onChange={(e) => setTheme("primaryColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.primaryColor} onChange={(v: any) => setTheme("primaryColor", v)} /></div></Field>
          <Field l="Cor de fundo"><div className="flex gap-2"><input type="color" value={th.bgColor || "#ffffff"} onChange={(e) => setTheme("bgColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.bgColor} onChange={(v: any) => setTheme("bgColor", v)} /></div></Field>
          <Field l="Cor dos textos"><div className="flex gap-2"><input type="color" value={th.textColor || "#0f172a"} onChange={(e) => setTheme("textColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.textColor} onChange={(v: any) => setTheme("textColor", v)} /></div></Field>
          <Field l="Cor dos títulos"><div className="flex gap-2"><input type="color" value={th.titleColor || th.textColor || "#0f172a"} onChange={(e) => setTheme("titleColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.titleColor} onChange={(v: any) => setTheme("titleColor", v)} /></div></Field>
          <Field l="Cor do texto do botão"><div className="flex gap-2"><input type="color" value={th.buttonTextColor || "#ffffff"} onChange={(e) => setTheme("buttonTextColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.buttonTextColor} onChange={(v: any) => setTheme("buttonTextColor", v)} /></div></Field>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">TIPOGRAFIA</p>
          <Field l="Fonte"><Sel v={th.font || ""} onChange={(v) => setTheme("font", v)} opts={[["", "Padrão (Inter)"], ["Inter, sans-serif", "Inter"], ["Poppins, sans-serif", "Poppins"], ["Montserrat, sans-serif", "Montserrat"], ["'Roboto', sans-serif", "Roboto"], ["Georgia, serif", "Georgia (serifa)"]]} /></Field>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">CABEÇALHO (PADRÃO)</p>
          <Check l="Mostrar barra de progresso" v={th.showProgress !== false} onChange={(v) => setTheme("showProgress", v)} />
          <p className="text-[11px] text-muted-foreground mt-1">Cada etapa pode sobrescrever no Construtor.</p>
        </div>
      </div>}

      {showConfig && <div className={showAppearance ? "border-t pt-3" : ""}>
        <p className="text-xs font-semibold text-muted-foreground mb-2">PUBLICAÇÃO & INTEGRAÇÕES</p>
        <Field l="Redirect final (URL)"><In v={spec.redirectUrl} onChange={(v: any) => onPatch({ redirectUrl: v })} placeholder="https://checkout…" /></Field>
        <Field l="Meta Pixel ID"><In v={spec.pixelId} onChange={(v: any) => onPatch({ pixelId: v })} placeholder="1234567890" /></Field>
        <Field l="Webhook (lead)"><In v={spec.webhookUrl} onChange={(v: any) => onPatch({ webhookUrl: v })} placeholder="https://…" /></Field>
        {publicUrl && <div className="mt-2 text-xs">
          <p className="text-muted-foreground mb-1">URL pública:</p>
          <div className="flex gap-1.5"><input readOnly value={publicUrl} className="flex-1 border rounded-lg px-2 py-1.5 bg-muted text-xs" /><button onClick={() => { navigator.clipboard.writeText(publicUrl); }} className="border rounded-lg px-2 hover:bg-accent"><Icons.Copy className="w-3.5 h-3.5" /></button></div>
        </div>}
      </div>}
    </div>
  );
}

// =========================================================================
// LEADS DASHBOARD
// =========================================================================
function LeadsDashboard({ slug }: { slug: string | null }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lsub, setLsub] = useState<"performance" | "respostas" | "resultados">("performance");

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    Promise.all([
      apiRequest("GET", `/api/quiz/${slug}/leads`).then((r) => r.json()).catch(() => []),
      apiRequest("GET", `/api/quiz/get/${slug}`).then((r) => r.json()).catch(() => ({})),
    ]).then(([ls, g]) => { setLeads(Array.isArray(ls) ? ls : []); setMeta(g?.meta || null); }).finally(() => setLoading(false));
  }, [slug]);

  if (!slug) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Salve o funil para ver os leads.</div>;
  if (loading) return <div className="flex-1 flex items-center justify-center"><Icons.Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const views = meta?.views || 0, starts = meta?.starts || 0, completions = meta?.completions || 0;
  const qualified = leads.filter((l) => (l.score || 0) > 0).length;
  const interaction = views ? ((starts / views) * 100).toFixed(1) : "0";
  const cards = [
    { label: "Visitantes", value: views, sub: "acessaram o funil", icon: "Eye" },
    { label: "Leads adquiridos", value: leads.length, sub: "enviaram dados/contato", icon: "UserPlus" },
    { label: "Taxa de interação", value: `${interaction}%`, sub: "interagiram", icon: "TrendingUp" },
    { label: "Leads qualificados", value: qualified, sub: "score > 0", icon: "Star" },
    { label: "Fluxos completos", value: completions, sub: "até a última etapa", icon: "CheckCircle2" },
  ];

  const nomeOf = (l: any) => l.nome || l.name || "";
  const contatoOf = (l: any) => l.email || l.phone || l.telefone || l.whatsapp || l.celular || "";

  const exportCsv = () => {
    const cols = ["data", "nome", "contato", "score", "respostas"];
    const rows = leads.map((l) => [l.at, nomeOf(l), contatoOf(l), l.score ?? "", JSON.stringify(l.respostas || {})]);
    const csv = [cols.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${slug}-leads.csv`; a.click();
  };

  // RESULTADOS: agrega as respostas por pergunta (distribuição de % por valor)
  const aggregate: { name: string; total: number; opts: { label: string; n: number; pct: number }[] }[] = (() => {
    const byQ: Record<string, Record<string, number>> = {};
    for (const l of leads) for (const [k, v] of Object.entries(l.respostas || {})) {
      const vals = Array.isArray(v) ? v : [v];
      byQ[k] = byQ[k] || {};
      for (const val of vals) { const s = String(val); byQ[k][s] = (byQ[k][s] || 0) + 1; }
    }
    return Object.entries(byQ).map(([name, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      const opts = Object.entries(counts).map(([label, n]) => ({ label, n, pct: Math.round((n / total) * 100) })).sort((a, b) => b.n - a.n);
      return { name, total, opts };
    });
  })();

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-1 mb-5 bg-white dark:bg-gray-900 border rounded-xl p-1 w-fit">
          {([["performance", "Performance"], ["resultados", "Resultados"], ["respostas", "Respostas"]] as const).map(([k, lab]) => (
            <button key={k} onClick={() => setLsub(k as any)} className={`text-sm px-4 py-1.5 rounded-lg ${lsub === k ? "bg-primary text-white" : "hover:bg-accent text-muted-foreground"}`}>{lab}</button>
          ))}
        </div>

        {lsub === "performance" && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">{c.label}</span><Icon name={c.icon} size={15} className="text-primary" /></div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
              </div>
            ))}
          </div>
        )}

        {lsub === "resultados" && (
          <div className="space-y-4">
            {aggregate.length === 0 ? <div className="bg-white dark:bg-gray-900 rounded-xl border py-16 text-center text-muted-foreground text-sm">Sem respostas ainda.</div>
              : aggregate.map((q) => (
                <div key={q.name} className="bg-white dark:bg-gray-900 rounded-xl border p-4">
                  <div className="flex justify-between items-center mb-3"><h4 className="font-medium text-sm">{q.name}</h4><span className="text-xs text-muted-foreground">{q.total} resposta(s)</span></div>
                  <div className="space-y-2">
                    {q.opts.map((o) => (
                      <div key={o.label}>
                        <div className="flex justify-between text-xs mb-0.5"><span>{o.label}</span><span className="text-muted-foreground">{o.pct}% ({o.n})</span></div>
                        <div className="h-2.5 bg-muted rounded-full"><div className="h-full bg-primary rounded-full" style={{ width: `${o.pct}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {lsub === "respostas" && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Leads ({leads.length})</h3>
              {leads.length > 0 && <button onClick={exportCsv} className="text-xs border rounded-lg px-3 py-1.5 hover:bg-accent flex items-center gap-1.5"><Icons.Download className="w-3.5 h-3.5" /> Exportar CSV</button>}
            </div>
            {leads.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Nenhum lead ainda. Compartilhe a URL pública do funil.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Nome</th><th className="px-4 py-2 font-medium">Contato</th><th className="px-4 py-2 font-medium">Score</th><th className="px-4 py-2 font-medium">Respostas</th>
                  </tr></thead>
                  <tbody>
                    {leads.map((l, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2 text-xs whitespace-nowrap">{l.at ? new Date(l.at).toLocaleString("pt-BR") : "—"}</td>
                        <td className="px-4 py-2">{nomeOf(l) || "—"}</td>
                        <td className="px-4 py-2 text-xs">{contatoOf(l) || "—"}</td>
                        <td className="px-4 py-2"><span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium">{l.score ?? 0}</span></td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[280px] truncate">{Object.entries(l.respostas || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// FLUXO (visão geral das etapas + ramificações)
// =========================================================================
function FlowOverview({ spec, onPick }: { spec: QuizSpec; onPick: (i: number) => void }) {
  const stepName = (id: string) => { const i = spec.steps.findIndex((s) => s.id === id); return i >= 0 ? (spec.steps[i].name || `Etapa ${i + 1}`) : null; };
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {spec.steps.map((s, i) => {
          const branches: string[] = [];
          for (const c of s.components) {
            if (c.type === "opcoes") for (const o of (c.props?.options || [])) if (o.nextStepId) { const n = stepName(o.nextStepId); if (n) branches.push(`${o.label} → ${n}`); }
            if ((c.type === "captura" || c.type === "loading") && c.props?.nextStepId) { const n = stepName(c.props.nextStepId); if (n) branches.push(`→ ${n}`); }
            if (c.type === "botao" && c.props?.action === "step" && c.props?.stepId) { const n = stepName(c.props.stepId); if (n) branches.push(`${c.props.label || "Botão"} → ${n}`); }
          }
          return (
            <div key={s.id}>
              <button onClick={() => onPick(i)} className="w-full text-left bg-white dark:bg-gray-900 rounded-xl border p-4 hover:border-primary transition">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                  <span className="font-medium">{s.name || `Etapa ${i + 1}`}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.components.length} componente(s)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {s.components.map((c) => <span key={c.id} className="text-[11px] bg-muted rounded px-1.5 py-0.5">{c.type}</span>)}
                </div>
                {branches.length > 0 && <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">{branches.map((b, x) => <span key={x} className="flex items-center gap-1"><Icons.GitBranch className="w-3 h-3" />{b}</span>)}</div>}
              </button>
              {i < spec.steps.length - 1 && <div className="flex justify-center py-1 text-muted-foreground"><Icons.ChevronDown className="w-4 h-4" /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Editor rich-text (WYSIWYG inline) ----
function wrapTexto(text?: string, variant?: string) {
  const tag = variant === "paragraph" ? "p" : variant === "subtitle" ? "h2" : "h1";
  return text ? `<${tag}>${text}</${tag}>` : "";
}
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ""; /* eslint-disable-next-line */ }, []);
  const emit = () => onChange(ref.current?.innerHTML || "");
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); ref.current?.focus(); emit(); };
  const tb = "px-1.5 py-1 rounded hover:bg-accent text-sm leading-none";
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1 bg-muted/40">
        <select onChange={(e) => { exec("formatBlock", e.target.value); e.target.value = ""; }} defaultValue="" className="text-xs border rounded px-1 py-0.5 bg-white dark:bg-gray-800 mr-1">
          <option value="">Estilo</option><option value="h1">Título</option><option value="h2">Subtítulo</option><option value="p">Normal</option>
        </select>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><u>U</u></button>
        <span className="inline-flex items-center" onMouseDown={(e) => e.preventDefault()} title="Cor do texto"><input type="color" onChange={(e) => exec("foreColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" /></span>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("hiliteColor", "#fde68a")} title="Realçar"><span style={{ background: "#fde68a", padding: "0 3px", borderRadius: 3 }}>A</span></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")}><Icons.AlignLeft className="w-3.5 h-3.5" /></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")}><Icons.AlignCenter className="w-3.5 h-3.5" /></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")}><Icons.AlignRight className="w-3.5 h-3.5" /></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><Icons.List className="w-3.5 h-3.5" /></button>
        <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt("URL do link:"); if (u) exec("createLink", u); }} title="Link"><Icons.Link className="w-3.5 h-3.5" /></button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} className="px-3 py-2 text-sm min-h-[64px] outline-none" style={{ wordBreak: "break-word" }} />
    </div>
  );
}

// ---- Inputs reutilizáveis ----
function Field({ l, children }: { l: string; children: React.ReactNode }) { return <div><label className="text-xs text-muted-foreground block mb-1">{l}</label>{children}</div>; }
function In({ v, onChange, type = "text", placeholder }: any) { return <input type={type} value={v ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary" />; }
function Ta({ v, onChange }: any) { return <textarea value={v ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary resize-y" />; }
function Sel({ v, onChange, opts }: { v: any; onChange: (v: string) => void; opts: [string, string][] }) { return <select value={v ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary">{opts.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}</select>; }
function Check({ l, v, onChange }: { l: string; v: any; onChange: (v: boolean) => void }) { return <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} className="accent-primary w-4 h-4" />{l}</label>; }
function CheckDesc({ l, desc, v, onChange }: { l: string; desc: string; v: any; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2 cursor-pointer">
      <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} className="accent-primary w-4 h-4 mt-0.5 shrink-0" />
      <span><span className="text-sm">{l}</span><span className="block text-[11px] text-muted-foreground leading-snug">{desc}</span></span>
    </label>
  );
}

function ListEditor({ label, items, onChange, render, create }: { label: string; items: any[]; onChange: (items: any[]) => void; render: (item: any, upd: (v: any) => void, patchItem: (p: any) => void) => React.ReactNode; create: () => any }) {
  const patchAt = (i: number, p: any) => onChange(items.map((it, x) => (x === i ? (typeof it === "object" ? { ...it, ...p } : p) : it)));
  const setAt = (i: number, v: any) => onChange(items.map((it, x) => (x === i ? v : it)));
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="border rounded-lg p-2 bg-muted/30 relative">
            <button onClick={() => onChange(items.filter((_, x) => x !== i))} className="absolute top-1 right-1 text-muted-foreground hover:text-red-600"><Icons.X className="w-3.5 h-3.5" /></button>
            {render(it, (v) => setAt(i, v), (p) => patchAt(i, p))}
          </div>
        ))}
        <button onClick={() => onChange([...items, create()])} className="w-full text-xs border border-dashed rounded-lg py-1.5 hover:bg-accent flex items-center justify-center gap-1"><Icons.Plus className="w-3.5 h-3.5" /> Adicionar</button>
      </div>
    </div>
  );
}
