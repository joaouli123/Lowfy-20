import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ComponentView, { type RuntimeCtx } from "@/components/quiz/ComponentView";
import {
  PALETTE, CATEGORIES, newComponent, newStep, emptySpec,
  type QComponent, type QuizSpec, type QuizStep,
} from "@/lib/quizSchema";
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
  const create = () => setEditing(emptySpec(`Funil ${list.length + 1}`, ""));
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const step = spec.steps[stepIdx] || spec.steps[0];
  const comps = step?.components || [];
  const selected = comps.find((c) => c.id === selId) || null;

  const patch = (p: Partial<QuizSpec>) => setSpec((s) => ({ ...s, ...p }));
  const setSteps = (steps: QuizStep[]) => setSpec((s) => ({ ...s, steps }));
  const setComps = (updater: (c: QComponent[]) => QComponent[]) =>
    setSpec((s) => ({ ...s, steps: s.steps.map((st, i) => (i === stepIdx ? { ...st, components: updater(st.components) } : st)) }));

  const addComp = (type: any, at?: number) => {
    const c = newComponent(type);
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
      const type = (active.data.current as any).type;
      let at = comps.length;
      if (over.id !== "CANVAS") { const oi = comps.findIndex((c) => c.id === over.id); if (oi >= 0) at = oi + 1; }
      addComp(type, at);
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

  const save = async () => {
    if (!spec.name?.trim()) { toast({ title: "Dê um nome ao funil", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await apiRequest("POST", "/api/quiz/save", spec);
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
        <input value={spec.name} onChange={(e) => patch({ name: e.target.value })} className="font-semibold bg-transparent outline-none border-b border-transparent focus:border-primary px-1 min-w-[120px]" placeholder="Nome do funil" />
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none mr-1">
            <input type="checkbox" checked={!!spec.isPublished} onChange={(e) => patch({ isPublished: e.target.checked })} className="accent-emerald-500 w-4 h-4" />
            Publicado
          </label>
          <button onClick={() => setPreview((v) => !v)} className={`text-sm border rounded-lg px-3 py-1.5 flex items-center gap-1.5 ${preview ? "bg-primary text-white border-primary" : "hover:bg-accent"}`}><Icons.Eye className="w-4 h-4" /> Preview</button>
          <button onClick={save} disabled={saving} className="text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-1.5 font-semibold flex items-center gap-1.5 disabled:opacity-50">{saving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Save className="w-4 h-4" />} Salvar</button>
        </div>
      </div>

      {/* STEP TABS */}
      <div className="h-11 border-b bg-white dark:bg-gray-900 flex items-center px-3 gap-1.5 overflow-x-auto shrink-0">
        {spec.steps.map((s, i) => (
          <button key={s.id} onClick={() => { setStepIdx(i); setSelId(null); }} className={`shrink-0 text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${i === stepIdx ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-accent"}`}>
            <span className="w-5 h-5 rounded bg-current/10 text-[11px] flex items-center justify-center opacity-70">{i + 1}</span>
            {s.name || `Etapa ${i + 1}`}
          </button>
        ))}
        <button onClick={addStep} className="shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent"><Icons.Plus className="w-4 h-4" /></button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          {/* PALETA */}
          {!preview && (
            <div className="w-60 border-r bg-white dark:bg-gray-900 overflow-y-auto shrink-0 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">COMPONENTES</p>
              {CATEGORIES.map((cat) => (
                <div key={cat} className="mb-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 px-1">{cat}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PALETTE.filter((p) => p.category === cat).map((item) => <PaletteCard key={item.type} item={item} onAdd={() => addComp(item.type)} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CANVAS */}
          <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 py-8 px-4">
            <Phone theme={spec.theme}>
              {preview
                ? <RuntimePreview step={step} theme={spec.theme} />
                : <Canvas comps={comps} selId={selId} onSelect={setSelId} onRemove={removeComp} onDup={dupComp} theme={spec.theme} />}
            </Phone>
          </div>

          {/* PROPRIEDADES */}
          {!preview && (
            <div className="w-80 border-l bg-white dark:bg-gray-900 overflow-y-auto shrink-0">
              {selected
                ? <PropsPanel comp={selected} steps={spec.steps} onChange={(props, vis) => updateComp(selected.id, props, vis)} onClose={() => setSelId(null)} />
                : <StepPanel spec={spec} stepIdx={stepIdx} onPatch={patch} onStepName={(n: string) => setSteps(spec.steps.map((s, i) => i === stepIdx ? { ...s, name: n } : s))} onMove={moveStep} onDel={delStep} publicUrl={publicUrl} />}
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}

// ---- Paleta (draggable + click) ----
function PaletteCard({ item, onAdd }: { item: any; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `new-${item.type}`, data: { kind: "palette", type: item.type } });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={onAdd}
      className={`flex flex-col items-center gap-1 border rounded-lg py-2.5 hover:border-primary hover:bg-primary/5 transition text-center ${isDragging ? "opacity-40" : ""}`}>
      <Icon name={item.icon} size={18} className="text-muted-foreground" />
      <span className="text-[11px] leading-tight">{item.label}</span>
    </button>
  );
}

// ---- Canvas (sortable) ----
function Canvas({ comps, selId, onSelect, onRemove, onDup, theme }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: "CANVAS" });
  if (comps.length === 0) {
    return <div ref={setNodeRef} className={`min-h-[280px] m-3 border-2 border-dashed rounded-xl flex items-center justify-center text-center text-sm transition ${isOver ? "border-primary bg-primary/5" : "border-gray-300 text-muted-foreground"}`}>
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
    <div ref={setNodeRef} style={style} onClick={onSelect}
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

// ---- Phone frame ----
function Phone({ theme, children }: { theme?: any; children: React.ReactNode }) {
  return (
    <div className="mx-auto" style={{ maxWidth: 420 }}>
      <div className="rounded-[36px] border-[10px] border-black bg-black shadow-2xl overflow-hidden">
        <div className="rounded-[26px] overflow-hidden" style={{ background: theme?.bgColor || "#fff", minHeight: 560 }}>
          <div className="max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Runtime preview (interativo, etapa única) ----
function RuntimePreview({ step, theme }: { step: QuizStep; theme: any }) {
  const ctx: RuntimeCtx = { theme: theme || {}, vars: { score: 0 }, score: 0, onPick: () => {}, onButton: () => {}, onSubmitCapture: () => {}, onAdvance: () => {} };
  return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>{(step?.components || []).map((c) => <div key={c.id}><ComponentView comp={c} ctx={ctx} /></div>)}</div>;
}

// =========================================================================
// PAINEL DE PROPRIEDADES
// =========================================================================
function PropsPanel({ comp, steps, onChange, onClose }: { comp: QComponent; steps: QuizStep[]; onChange: (props: any, vis?: any) => void; onClose: () => void }) {
  const p = comp.props || {};
  const set = (k: string, v: any) => onChange({ [k]: v });
  const stepOpts: [string, string][] = [["", "Próxima etapa"], ...steps.map((s, i) => [s.id, s.name || `Etapa ${i + 1}`] as [string, string])];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm capitalize flex items-center gap-2"><Icon name={(PALETTE.find((x) => x.type === comp.type) as any)?.icon || "Square"} size={16} /> {comp.type}</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
      </div>

      <div className="space-y-3">
        {comp.type === "texto" && <>
          <Field l="Texto"><Ta v={p.text} onChange={(v: any) => set("text", v)} /></Field>
          <Field l="Estilo"><Sel v={p.variant} onChange={(v) => set("variant", v)} opts={[["title", "Título"], ["subtitle", "Subtítulo"], ["paragraph", "Parágrafo"]]} /></Field>
          <Field l="Alinhamento"><Sel v={p.align} onChange={(v) => set("align", v)} opts={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} /></Field>
          <Field l="Cor (hex)"><In v={p.color} onChange={(v: any) => set("color", v)} placeholder="#0f172a" /></Field>
        </>}

        {comp.type === "imagem" && <>
          <Field l="URL da imagem"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>
          <Field l="Arredondamento"><In type="number" v={p.radius} onChange={(v: any) => set("radius", +v)} /></Field>
          <Field l="Largura (%)"><In type="number" v={p.maxWidth} onChange={(v: any) => set("maxWidth", +v)} /></Field>
        </>}

        {(comp.type === "video" || comp.type === "audio") && <Field l="URL (link/embed)"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>}

        {comp.type === "galeria" && <>
          <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["grid", "Grade"], ["slide", "Lista"]]} /></Field>
          <ListEditor label="Imagens (URLs)" items={p.images || []} onChange={(items) => set("images", items)} render={(it, upd) => <In v={it} onChange={upd} placeholder="https://…" />} create={() => ""} />
        </>}

        {comp.type === "opcoes" && <>
          <Field l="Pergunta"><Ta v={p.question} onChange={(v: any) => set("question", v)} /></Field>
          <Field l="Ajuda (opcional)"><In v={p.help} onChange={(v: any) => set("help", v)} /></Field>
          <div className="flex gap-3">
            <Check l="Múltipla" v={p.multiple} onChange={(v) => set("multiple", v)} />
            <Check l="Avançar auto" v={p.autoAdvance !== false} onChange={(v) => set("autoAdvance", v)} />
          </div>
          <Field l="Layout"><Sel v={p.layout} onChange={(v) => set("layout", v)} opts={[["list", "Lista"], ["grid", "Grade"]]} /></Field>
          <ListEditor label="Opções (rótulo · pontos · destino)" items={p.options || []} onChange={(items) => set("options", items)}
            create={() => ({ id: Math.random().toString(36).slice(2, 9), label: "Nova opção", score: 0 })}
            render={(o, _u, patchItem) => <div className="space-y-1.5">
              <In v={o.label} onChange={(v: any) => patchItem({ label: v })} placeholder="Rótulo" />
              <div className="flex gap-1.5">
                <In v={o.emoji} onChange={(v: any) => patchItem({ emoji: v })} placeholder="😀" />
                <In type="number" v={o.score} onChange={(v: any) => patchItem({ score: +v })} placeholder="pts" />
              </div>
              <Sel v={o.nextStepId || ""} onChange={(v) => patchItem({ nextStepId: v })} opts={stepOpts} />
            </div>} />
        </>}

        {comp.type === "captura" && <>
          <Field l="Título"><In v={p.title} onChange={(v: any) => set("title", v)} /></Field>
          <Field l="Descrição"><In v={p.description} onChange={(v: any) => set("description", v)} /></Field>
          <Field l="Texto do botão"><In v={p.buttonText} onChange={(v: any) => set("buttonText", v)} /></Field>
          <Field l="Ao enviar, ir para"><Sel v={p.nextStepId || ""} onChange={(v) => set("nextStepId", v)} opts={stepOpts} /></Field>
          <ListEditor label="Campos" items={p.fields || []} onChange={(items) => set("fields", items)}
            create={() => ({ type: "text", name: "campo", label: "Campo", required: true })}
            render={(f, _u, patchItem) => <div className="space-y-1.5">
              <Sel v={f.type} onChange={(v) => patchItem({ type: v })} opts={[["name", "Nome"], ["email", "E-mail"], ["phone", "Telefone"], ["text", "Texto"]]} />
              <In v={f.name} onChange={(v: any) => patchItem({ name: v })} placeholder="variável (ex: nome)" />
              <In v={f.label} onChange={(v: any) => patchItem({ label: v })} placeholder="rótulo" />
              <Check l="Obrigatório" v={f.required !== false} onChange={(v) => patchItem({ required: v })} />
            </div>} />
        </>}

        {comp.type === "botao" && <>
          <Field l="Texto"><In v={p.label} onChange={(v: any) => set("label", v)} /></Field>
          <Field l="Ação"><Sel v={p.action} onChange={(v) => set("action", v)} opts={[["next", "Próxima etapa"], ["step", "Etapa específica"], ["url", "Link externo"]]} /></Field>
          {p.action === "step" && <Field l="Etapa"><Sel v={p.stepId || ""} onChange={(v) => set("stepId", v)} opts={stepOpts} /></Field>}
          {p.action === "url" && <Field l="URL"><In v={p.url} onChange={(v: any) => set("url", v)} placeholder="https://…" /></Field>}
          <Field l="Estilo"><Sel v={p.style} onChange={(v) => set("style", v)} opts={[["solid", "Sólido"], ["outline", "Contorno"]]} /></Field>
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

        <VisibilityEditor comp={comp} onChange={(vis) => onChange({}, vis)} />
      </div>
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
function StepPanel({ spec, stepIdx, onPatch, onStepName, onMove, onDel, publicUrl }: any) {
  const step = spec.steps[stepIdx];
  const th = spec.theme || {};
  const setTheme = (k: string, v: any) => onPatch({ theme: { ...th, [k]: v } });
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">ETAPA {stepIdx + 1}</p>
        <Field l="Nome da etapa"><In v={step?.name} onChange={onStepName} /></Field>
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onMove(stepIdx, -1)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-accent">← Mover</button>
          <button onClick={() => onMove(stepIdx, 1)} className="flex-1 text-xs border rounded-lg py-1.5 hover:bg-accent">Mover →</button>
          <button onClick={() => onDel(stepIdx)} className="text-xs border rounded-lg py-1.5 px-3 hover:bg-red-50 hover:text-red-600"><Icons.Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">APARÊNCIA</p>
        <Field l="Cor primária"><div className="flex gap-2"><input type="color" value={th.primaryColor || "#22c55e"} onChange={(e) => setTheme("primaryColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.primaryColor} onChange={(v: any) => setTheme("primaryColor", v)} /></div></Field>
        <Field l="Fundo"><div className="flex gap-2"><input type="color" value={th.bgColor || "#ffffff"} onChange={(e) => setTheme("bgColor", e.target.value)} className="w-9 h-9 rounded border" /><In v={th.bgColor} onChange={(v: any) => setTheme("bgColor", v)} /></div></Field>
        <Field l="Logo (URL)"><In v={th.logoUrl} onChange={(v: any) => setTheme("logoUrl", v)} placeholder="https://…" /></Field>
        <Check l="Barra de progresso" v={th.showProgress !== false} onChange={(v) => setTheme("showProgress", v)} />
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">PUBLICAÇÃO & INTEGRAÇÕES</p>
        <Field l="Redirect final (URL)"><In v={spec.redirectUrl} onChange={(v: any) => onPatch({ redirectUrl: v })} placeholder="https://checkout…" /></Field>
        <Field l="Meta Pixel ID"><In v={spec.pixelId} onChange={(v: any) => onPatch({ pixelId: v })} placeholder="1234567890" /></Field>
        <Field l="Webhook (lead)"><In v={spec.webhookUrl} onChange={(v: any) => onPatch({ webhookUrl: v })} placeholder="https://…" /></Field>
        {publicUrl && <div className="mt-2 text-xs">
          <p className="text-muted-foreground mb-1">URL pública:</p>
          <div className="flex gap-1.5"><input readOnly value={publicUrl} className="flex-1 border rounded-lg px-2 py-1.5 bg-muted text-xs" /><button onClick={() => { navigator.clipboard.writeText(publicUrl); }} className="border rounded-lg px-2 hover:bg-accent"><Icons.Copy className="w-3.5 h-3.5" /></button></div>
        </div>}
      </div>
    </div>
  );
}

// ---- Inputs reutilizáveis ----
function Field({ l, children }: { l: string; children: React.ReactNode }) { return <div><label className="text-xs text-muted-foreground block mb-1">{l}</label>{children}</div>; }
function In({ v, onChange, type = "text", placeholder }: any) { return <input type={type} value={v ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary" />; }
function Ta({ v, onChange }: any) { return <textarea value={v ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary resize-y" />; }
function Sel({ v, onChange, opts }: { v: any; onChange: (v: string) => void; opts: [string, string][] }) { return <select value={v ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary">{opts.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}</select>; }
function Check({ l, v, onChange }: { l: string; v: any; onChange: (v: boolean) => void }) { return <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} className="accent-primary w-4 h-4" />{l}</label>; }

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
