import { Button } from "@/components/ui/button";
import {
  Play, RotateCcw, ArrowRight, Check, Loader2, AlertTriangle, ChevronLeft, Sparkles,
  ImageIcon, Type, Mic, Video, UserSquare2, Download, Copy as CopyIcon, Zap, ListChecks,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStudio } from "./store";
import { RECIPES } from "./recipes";
import { ratioSpec } from "./types";
import type { FlowStep, StepKind } from "./types";
import { AssetPreview, SendToMenu } from "./ui";

const STEP_ICON: Record<StepKind, any> = { copy: Type, image: ImageIcon, tts: Mic, avatar: UserSquare2, video: Video };
const STEP_TAB: Record<StepKind, any> = { copy: "copy", image: "criativo", tts: "narracao", avatar: "avatar", video: "video" };

export default function FlowBoard() {
  const { flow, runFlow, resetFlow, clearRecipe, runFlowStep, setFlowMode, missingFor, setTab, sendTo, removeAsset } = useStudio();
  const { toast } = useToast();

  if (!flow.recipe) return <RecipePicker />;

  const missing = missingFor(flow.recipe);
  const done = flow.steps.filter((s) => s.status === "done").length;
  const pct = flow.steps.length ? Math.round((done / flow.steps.length) * 100) : 0;
  const finished = done === flow.steps.length && flow.steps.length > 0;
  const deliverables = flow.steps.filter((s) => s.asset).map((s) => s.asset!);

  const tryRun = () => {
    if (missing.length) {
      toast({ title: "Falta preencher o briefing", description: `Precisamos de: ${missing.join(", ")}.`, variant: "destructive" });
      return;
    }
    runFlow();
  };

  return (
    <div className="space-y-4">
      {/* cabeçalho do fluxo */}
      <div className="rounded-2xl border bg-card shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-sm shadow-primary/20 flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold tracking-tight">{flow.recipe.name}</h2>
                <span className="text-[10px] font-medium rounded-full bg-accent text-accent-foreground px-2 py-0.5">{flow.recipe.delivers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{flow.recipe.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              <ModeBtn active={flow.mode === "auto"} onClick={() => setFlowMode("auto")} icon={Zap} label="Tudo de uma vez" />
              <ModeBtn active={flow.mode === "step"} onClick={() => setFlowMode("step")} icon={ListChecks} label="Aprovar etapa a etapa" />
            </div>
            <Button variant="ghost" size="sm" onClick={resetFlow} disabled={flow.running} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Limpar
            </Button>
            <Button size="sm" onClick={tryRun} disabled={flow.running} className="gap-1.5 shadow-sm">
              {flow.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {flow.running ? "Rodando…" : done > 0 && !finished ? "Continuar fluxo" : finished ? "Rodar de novo" : "Rodar fluxo"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{done}/{flow.steps.length} etapas</span>
          <button
            onClick={clearRecipe}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> trocar fluxo
          </button>
        </div>

        {missing.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Antes de rodar, complete no briefing: <strong>{missing.join(", ")}</strong>.</span>
          </div>
        )}
      </div>

      {/* cadeia de etapas */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
        {flow.steps.map((step, i) => (
          <div key={step.id} className="flex flex-col lg:flex-row lg:items-center lg:flex-1 lg:min-w-0">
            <StepCard step={step} index={i} onRun={() => runFlowStep(i)} onOpen={() => setTab(STEP_TAB[step.kind])} onSend={sendTo} onDelete={removeAsset} disabled={flow.running} />
            {i < flow.steps.length - 1 && <Connector active={flow.steps[i].status === "done"} />}
          </div>
        ))}
      </div>

      {/* entregáveis */}
      {deliverables.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${finished ? "bg-primary/10" : "bg-muted"}`}>
              {finished ? <Check className="w-3.5 h-3.5 text-primary" /> : <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <h3 className="text-sm font-semibold">{finished ? "Pronto pra publicar" : "Peças já geradas"}</h3>
            <span className="text-xs text-muted-foreground">· {deliverables.length} {deliverables.length === 1 ? "arquivo" : "arquivos"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {deliverables.map((a) => (
              <div key={a.id} className="rounded-xl border overflow-hidden bg-card group">
                <div className={`${a.kind === "copy" ? "h-28" : ratioSpec(a.ratio || "1:1").cls} max-h-48 bg-muted/30 flex items-center justify-center overflow-hidden`}>
                  <AssetPreview asset={a} />
                </div>
                <div className="p-2.5 flex items-center gap-2">
                  <p className="text-xs font-medium truncate flex-1">{a.label}</p>
                  {a.url ? (
                    <a href={a.url} download target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-muted transition" title="Baixar"><Download className="w-3.5 h-3.5" /></a>
                  ) : (
                    <button onClick={() => { navigator.clipboard.writeText(a.text || ""); toast({ title: "Copiado!" }); }} className="p-1.5 rounded hover:bg-muted transition" title="Copiar"><CopyIcon className="w-3.5 h-3.5" /></button>
                  )}
                  <SendToMenu asset={a} onSend={(t) => sendTo(a, t)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecipePicker() {
  const { startRecipe, brief, setTab } = useStudio();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5">
        <h2 className="text-base font-semibold tracking-tight">O que você quer criar hoje?</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Escolha um fluxo e o Estúdio encadeia as ferramentas sozinho: escreve a copy, gera o criativo, narra e monta o vídeo —
          usando o briefing {brief.produto ? <>de <strong className="text-foreground">{brief.produto}</strong></> : "que você preencher acima"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            onClick={() => startRecipe(r)}
            className="group text-left rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition relative overflow-hidden"
          >
            <div className="absolute top-3 right-3 text-[10px] font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition">{r.badge}</div>
            <div className="flex items-center gap-1.5 mb-3">
              {r.steps.map((s, i) => {
                const Icon = STEP_ICON[s.kind];
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-primary" /></div>
                    {i < r.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                  </div>
                );
              })}
            </div>
            <p className="text-sm font-semibold">{r.name}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.tagline}</p>
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{r.delivers}</span>
              <span className="text-[11px] font-medium text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                Começar <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed p-5 text-center">
        <p className="text-sm font-medium">Prefere ir na mão?</p>
        <p className="text-xs text-muted-foreground mt-1">Use as abas acima para operar cada ferramenta separadamente — os resultados continuam indo pra bandeja e podem ser reaproveitados.</p>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {(["criativo", "copy", "narracao", "avatar", "video"] as const).map((t) => (
            <Button key={t} variant="outline" size="sm" onClick={() => setTab(t)} className="capitalize">{t === "narracao" ? "narração" : t === "video" ? "vídeo" : t}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[11px] font-medium transition ${active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex lg:flex-col items-center justify-center px-1 py-1 lg:py-0 lg:px-1.5 flex-shrink-0">
      <div className={`hidden lg:block h-px w-4 ${active ? "bg-primary" : "bg-border"}`} />
      <div className={`lg:hidden w-px h-4 ${active ? "bg-primary" : "bg-border"}`} />
      <ArrowRight className={`w-3.5 h-3.5 rotate-90 lg:rotate-0 ${active ? "text-primary" : "text-muted-foreground/40"}`} />
      <div className={`hidden lg:block h-px w-4 ${active ? "bg-primary" : "bg-border"}`} />
      <div className={`lg:hidden w-px h-4 ${active ? "bg-primary" : "bg-border"}`} />
    </div>
  );
}

function StepCard({ step, index, onRun, onOpen, onSend, onDelete, disabled }: {
  step: FlowStep;
  index: number;
  onRun: () => void;
  onOpen: () => void;
  onSend: (a: any, t: any) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const Icon = STEP_ICON[step.kind];
  const running = step.status === "running";
  const done = step.status === "done";
  const error = step.status === "error";

  return (
    <div
      className={`flex-1 min-w-0 rounded-2xl border bg-card p-3.5 shadow-sm transition ${
        running ? "border-primary ring-2 ring-primary/15" : done ? "border-primary/30" : error ? "border-red-200" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? "bg-primary text-white" : running ? "bg-primary/10 text-primary" : error ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"}`}>
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : error ? <AlertTriangle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Etapa {index + 1}</p>
          <p className="text-[13px] font-semibold truncate leading-tight">{step.title}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/25 h-28 overflow-hidden flex items-center justify-center mb-2.5">
        {running ? (
          <div className="text-center px-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto mb-1.5" />
            <p className="text-[11px] text-muted-foreground">Gerando…</p>
          </div>
        ) : step.asset ? (
          <AssetPreview asset={step.asset} />
        ) : error ? (
          <p className="text-[11px] text-red-600 px-3 text-center line-clamp-4">{step.error}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70 px-3 text-center leading-snug">{step.outcome}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {step.asset ? (
          <>
            <button onClick={onOpen} className="text-[11px] font-medium border rounded-lg px-2 h-7 hover:bg-muted transition">Abrir</button>
            <SendToMenu asset={step.asset} onSend={(t) => onSend(step.asset, t)} onDelete={() => onDelete(step.asset!.id)} />
            <button onClick={onRun} disabled={disabled} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition" title="Refazer esta etapa">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onRun}
            disabled={disabled || running}
            className="w-full text-[11px] font-medium rounded-lg border h-7 hover:bg-accent hover:border-primary/30 disabled:opacity-40 transition inline-flex items-center justify-center gap-1.5"
          >
            {error ? <><RotateCcw className="w-3 h-3" /> Tentar de novo</> : <><Play className="w-3 h-3" /> Rodar só esta</>}
          </button>
        )}
      </div>
    </div>
  );
}
