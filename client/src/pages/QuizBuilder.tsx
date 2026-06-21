import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  MousePointerClick, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Save,
  Eye, Users, Loader2, ChevronLeft, Settings2, Wand2,
} from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);
const STEP_TYPES = [
  { v: "question", label: "Pergunta" },
  { v: "content", label: "Conteúdo" },
  { v: "capture", label: "Captura de lead" },
  { v: "result", label: "Resultado" },
];

function newStep(type: string): any {
  const base: any = { id: uid(), type };
  if (type === "question") { base.title = "Nova pergunta"; base.options = [{ id: uid(), label: "Opção 1", score: 1 }, { id: uid(), label: "Opção 2", score: 0 }]; }
  if (type === "content") { base.title = "Título"; base.description = "Texto..."; base.buttonText = "Continuar"; }
  if (type === "capture") { base.title = "Falta pouco!"; base.fields = [{ type: "name", required: true }, { type: "email", required: true }]; base.buttonText = "Quero meu resultado"; }
  if (type === "result") { base.resultTitle = "Seu resultado"; base.resultDescription = "Parabéns!"; base.minScore = 0; }
  return base;
}
function emptyQuiz(): any {
  return { name: "Meu Quiz", slug: "", isPublished: false, theme: { primaryColor: "#29654f", showProgress: true }, steps: [newStep("question"), newStep("capture"), newStep("result")] };
}

export default function QuizBuilder() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await apiRequest("GET", "/api/quiz/list"); setList(await r.json()); }
    catch { setList([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setEditing(emptyQuiz());
  const openEdit = async (slug: string) => {
    try { const r = await apiRequest("GET", `/api/quiz/get/${slug}`); const { spec } = await r.json(); setEditing(spec); }
    catch (e: any) { toast({ title: "Erro ao abrir", description: e.message, variant: "destructive" }); }
  };
  const remove = async (slug: string) => {
    if (!confirm("Excluir este quiz?")) return;
    await apiRequest("DELETE", `/api/quiz/${slug}`); load();
  };
  const viewLeads = async (slug: string) => {
    const r = await apiRequest("GET", `/api/quiz/${slug}/leads`); setLeads(await r.json());
  };

  const save = async () => {
    if (!editing?.name) return toast({ title: "Dê um nome ao quiz", variant: "destructive" });
    setSaving(true);
    try {
      const r = await apiRequest("POST", "/api/quiz/save", editing);
      const d = await r.json();
      toast({ title: "Quiz salvo!", description: editing.isPublished ? `Publicado em /q/${d.slug}` : "Rascunho salvo." });
      setEditing({ ...editing, slug: d.slug });
      load();
    } catch (e: any) { toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  // ---- mutações de step ----
  const setStep = (i: number, patch: any) => setEditing((q: any) => ({ ...q, steps: q.steps.map((s: any, j: number) => j === i ? { ...s, ...patch } : s) }));
  const addStep = (type: string) => setEditing((q: any) => ({ ...q, steps: [...q.steps, newStep(type)] }));
  const delStep = (i: number) => setEditing((q: any) => ({ ...q, steps: q.steps.filter((_: any, j: number) => j !== i) }));
  const moveStep = (i: number, d: number) => setEditing((q: any) => { const s = [...q.steps]; const t = i + d; if (t < 0 || t >= s.length) return q; [s[i], s[t]] = [s[t], s[i]]; return { ...q, steps: s }; });

  if (editing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => { setEditing(null); load(); }}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <div className="flex items-center gap-2">
            {editing.slug && <a href={`/q/${editing.slug}`} target="_blank" rel="noreferrer"><Button variant="outline"><Eye className="w-4 h-4 mr-1" /> Visualizar</Button></a>}
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Salvar</Button>
          </div>
        </div>

        {/* Configurações gerais */}
        <Card className="mb-4"><CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Settings2 className="w-4 h-4" /> Configurações</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Cor principal</Label><Input type="color" value={editing.theme?.primaryColor || "#29654f"} onChange={(e) => setEditing({ ...editing, theme: { ...editing.theme, primaryColor: e.target.value } })} className="h-10 p-1" /></div>
            <div><Label>Logo (URL)</Label><Input value={editing.theme?.logoUrl || ""} onChange={(e) => setEditing({ ...editing, theme: { ...editing.theme, logoUrl: e.target.value } })} placeholder="https://…" /></div>
            <div><Label>Redirecionar ao final (URL)</Label><Input value={editing.redirectUrl || ""} onChange={(e) => setEditing({ ...editing, redirectUrl: e.target.value })} placeholder="https://seu-checkout…" /></div>
            <div><Label>Pixel do Facebook (ID)</Label><Input value={editing.pixelId || ""} onChange={(e) => setEditing({ ...editing, pixelId: e.target.value })} placeholder="123456789" /></div>
            <div><Label>Webhook (envia o lead)</Label><Input value={editing.webhookUrl || ""} onChange={(e) => setEditing({ ...editing, webhookUrl: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2"><Switch checked={editing.theme?.showProgress !== false} onCheckedChange={(v) => setEditing({ ...editing, theme: { ...editing.theme, showProgress: v } })} /><span className="text-sm">Barra de progresso</span></div>
            <div className="flex items-center gap-2"><Switch checked={!!editing.isPublished} onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })} /><span className="text-sm font-medium">{editing.isPublished ? "Publicado" : "Rascunho"}</span></div>
          </div>
        </CardContent></Card>

        {/* Steps */}
        <div className="space-y-3">
          {editing.steps.map((s: any, i: number) => (
            <Card key={s.id}><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <select value={s.type} onChange={(e) => setStep(i, newStep(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm font-medium">
                  {STEP_TYPES.map((t) => <option key={t.v} value={t.v}>{i + 1}. {t.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveStep(i, -1)} className="p-1.5 hover:bg-muted rounded"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => moveStep(i, 1)} className="p-1.5 hover:bg-muted rounded"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => delStep(i)} className="p-1.5 hover:bg-red-50 text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {(s.type === "question" || s.type === "content" || s.type === "capture") && (
                <Input className="mb-2" value={s.title || ""} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Título" />
              )}
              {(s.type === "content") && (
                <Textarea className="mb-2" rows={2} value={s.description || ""} onChange={(e) => setStep(i, { description: e.target.value })} placeholder="Texto" />
              )}

              {s.type === "question" && (
                <div className="space-y-2">
                  {(s.options || []).map((o: any, oi: number) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <Input value={o.label} onChange={(e) => setStep(i, { options: s.options.map((x: any, j: number) => j === oi ? { ...x, label: e.target.value } : x) })} placeholder="Opção" />
                      <div className="flex items-center gap-1 shrink-0"><span className="text-xs text-muted-foreground">pts</span>
                        <Input type="number" className="w-16" value={o.score ?? 0} onChange={(e) => setStep(i, { options: s.options.map((x: any, j: number) => j === oi ? { ...x, score: Number(e.target.value) } : x) })} />
                      </div>
                      <button onClick={() => setStep(i, { options: s.options.filter((_: any, j: number) => j !== oi) })} className="p-1.5 text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setStep(i, { options: [...(s.options || []), { id: uid(), label: "Nova opção", score: 0 }] })}><Plus className="w-4 h-4 mr-1" /> Opção</Button>
                </div>
              )}

              {s.type === "capture" && (
                <p className="text-xs text-muted-foreground">Campos: nome, e-mail{(s.fields || []).some((f: any) => f.type === "phone") ? ", telefone" : ""}. <button className="underline" onClick={() => setStep(i, { fields: [...(s.fields || []), { type: "phone", required: false }] })}>+ telefone</button></p>
              )}

              {s.type === "result" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground whitespace-nowrap">Score mínimo</span><Input type="number" className="w-20" value={s.minScore ?? 0} onChange={(e) => setStep(i, { minScore: Number(e.target.value) })} /></div>
                  <Input value={s.resultTitle || ""} onChange={(e) => setStep(i, { resultTitle: e.target.value })} placeholder="Título do resultado" />
                  <Textarea rows={2} value={s.resultDescription || ""} onChange={(e) => setStep(i, { resultDescription: e.target.value })} placeholder="Descrição do resultado" />
                  <Input value={s.resultRedirectUrl || ""} onChange={(e) => setStep(i, { resultRedirectUrl: e.target.value })} placeholder="URL do botão (opcional)" />
                </div>
              )}
            </CardContent></Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {STEP_TYPES.map((t) => <Button key={t.v} variant="outline" size="sm" onClick={() => addStep(t.v)}><Plus className="w-4 h-4 mr-1" /> {t.label}</Button>)}
        </div>
      </div>
    );
  }

  // ---- Lista ----
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center"><MousePointerClick className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Quiz Builder</h1><p className="text-sm text-muted-foreground">Crie funis de quiz que capturam leads e qualificam seu público.</p></div>
        </div>
        <Button onClick={openNew}><Wand2 className="w-4 h-4 mr-1" /> Novo quiz</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <MousePointerClick className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-3">Nenhum quiz ainda.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Criar meu primeiro quiz</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <Card key={q.slug}><CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><p className="font-semibold truncate">{q.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${q.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{q.isPublished ? "Publicado" : "Rascunho"}</span>
                </div>
                <p className="text-xs text-muted-foreground">{q.meta?.views || 0} views · {q.meta?.leads || 0} leads · /q/{q.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => viewLeads(q.slug)}><Users className="w-4 h-4" /></Button>
                {q.isPublished && <a href={`/q/${q.slug}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button></a>}
                <Button variant="outline" size="sm" onClick={() => openEdit(q.slug)}>Editar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(q.slug)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {leads && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLeads(null)}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}><CardContent className="p-5">
            <h3 className="font-semibold mb-3">Leads capturados ({leads.length})</h3>
            {leads.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p> : (
              <div className="space-y-2">
                {leads.map((l, i) => (
                  <div key={i} className="text-sm border rounded-lg p-2">
                    <div className="font-medium">{l.name || "—"} · {l.email || ""} {l.phone ? `· ${l.phone}` : ""}</div>
                    <div className="text-xs text-muted-foreground">score: {l.score ?? "—"} · {l.at ? new Date(l.at).toLocaleString("pt-BR") : ""}</div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full mt-3" onClick={() => setLeads(null)}>Fechar</Button>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
