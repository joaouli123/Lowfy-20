import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import ComponentView, { type RuntimeCtx } from "@/components/quiz/ComponentView";
import { isVisible, type QComponent, type QuizOption, type QuizSpec } from "@/lib/quizSchema";

export default function QuizPlay() {
  const { slug } = useParams<{ slug: string }>();
  const [spec, setSpec] = useState<QuizSpec | null>(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [vars, setVars] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, Record<string, number>>>({});
  const [elapsed, setElapsed] = useState(0);
  const sentLead = useRef(false);
  const optNextRef = useRef<string | null>(null);
  const selected = useMemo(() => Object.values(picks).flatMap((m) => Object.keys(m)), [picks]);

  useEffect(() => {
    fetch(`/api/q/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((s: QuizSpec) => {
      setSpec(s);
      fetch(`/api/q/${slug}/start`, { method: "POST" }).catch(() => {});
      if (s.pixelId) injectPixel(s.pixelId);
    }).catch(() => setErr(true));
  }, [slug]);

  // cronômetro por etapa (para exibição condicional por tempo)
  useEffect(() => {
    setElapsed(0);
    setPicks({});
    optNextRef.current = null;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    window.scrollTo(0, 0);
    return () => clearInterval(iv);
  }, [idx]);

  const theme = spec?.theme || {};
  const primary = theme.primaryColor || "#22c55e";
  const steps = spec?.steps || [];
  const step = steps[idx];
  const allVars = useMemo(() => ({ score, ...vars }), [score, vars]);

  if (err) return <Centered>Quiz não encontrado.</Centered>;
  if (!spec || !step) return <Centered>Carregando…</Centered>;

  const goTo = (nextId?: string | null) => {
    if (nextId) {
      const i = steps.findIndex((s) => s.id === nextId);
      if (i >= 0) return setIdx(i);
    }
    if (idx + 1 < steps.length) return setIdx(idx + 1);
    finish();
  };

  const finish = () => { fetch(`/api/q/${slug}/complete`, { method: "POST" }).catch(() => {}); const r = spec.redirectUrl; if (r) window.location.href = r; };

  // valida componentes de opções com "seleção obrigatória" na etapa atual
  const requiredSatisfied = () => {
    for (const c of step.components) {
      if (c.type === "opcoes" && c.props?.required && !Object.keys(picks[c.id] || {}).length) return false;
    }
    return true;
  };

  const ctx: RuntimeCtx = {
    theme, vars: allVars, score, selectedOptionIds: selected,
    onPick: (comp, o: QuizOption) => {
      const cid = comp.id;
      const multiple = !!comp.props?.multiple;
      setPicks((prev) => {
        const cur = { ...(prev[cid] || {}) };
        if (multiple) {
          if (cur[o.id] !== undefined) { const s = cur[o.id]; delete cur[o.id]; setScore((v) => v - s); }
          else { cur[o.id] = o.score || 0; setScore((v) => v + (o.score || 0)); }
        } else {
          const prevScore = Object.values(cur).reduce((a, b) => a + b, 0);
          setScore((v) => v - prevScore + (o.score || 0));
          for (const k of Object.keys(cur)) delete cur[k];
          cur[o.id] = o.score || 0;
        }
        return { ...prev, [cid]: cur };
      });
      // resposta (variável {{name}}): única = label; múltipla = lista
      const name = comp.props?.name || comp.props?.question || cid;
      setAnswers((a) => {
        if (!multiple) return { ...a, [name]: o.label };
        const arr = Array.isArray(a[name]) ? [...a[name]] : [];
        const i = arr.indexOf(o.label);
        if (i >= 0) arr.splice(i, 1); else arr.push(o.label);
        return { ...a, [name]: arr };
      });
      if (o.nextStepId) optNextRef.current = o.nextStepId;
      // avanço: única + autoAdvance e SEM "avançar só no botão" → avança sozinha
      const waitButton = multiple || comp.props?.advanceOnButton || comp.props?.autoAdvance === false;
      if (!waitButton) setTimeout(() => goTo(o.nextStepId), 220);
    },
    onSubmitCapture: (comp, values) => {
      setVars((v) => ({ ...v, ...values }));
      sendLead({ ...vars, ...values });
      goTo(comp.props?.nextStepId);
    },
    onButton: (comp) => {
      if (!requiredSatisfied()) return; // bloqueia se faltou opção obrigatória
      // prioridade: a próxima etapa definida na OPÇÃO selecionada vence a do botão
      const optNext = optNextRef.current;
      if (optNext) { optNextRef.current = null; return goTo(optNext); }
      const a = comp.props?.action;
      if (a === "url" && comp.props?.url) { window.location.href = comp.props.url; return; }
      if (a === "step") return goTo(comp.props?.stepId);
      goTo();
    },
    onAdvance: (comp) => { if (comp.props?.redirectUrl) { window.location.href = comp.props.redirectUrl; return; } goTo(comp.props?.nextStepId); },
  };

  const sendLead = (lead: Record<string, any>) => {
    if (sentLead.current) return; sentLead.current = true;
    fetch(`/api/q/${slug}/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead, respostas: answers, score }) }).catch(() => {});
    if (typeof window !== "undefined" && (window as any).fbq) (window as any).fbq("track", "Lead");
  };

  const visibleComps = step.components.filter((c) => isVisible(c, { score, elapsedSec: elapsed }));
  const progress = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: theme.bgColor || "#f8fafc", color: theme.textColor || "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: theme.font || "Inter, system-ui, sans-serif", padding: "20px 16px" }}>
      {theme.logoUrl && <img src={theme.logoUrl} alt="" style={{ height: 40, marginBottom: 18, objectFit: "contain" }} />}
      {theme.showProgress !== false && (
        <div style={{ width: "100%", maxWidth: 520, height: 6, background: "#e2e8f0", borderRadius: 999, marginBottom: 26 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: primary, borderRadius: 999, transition: "width .3s" }} />
        </div>
      )}
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>
        {visibleComps.length === 0
          ? <Centered>Etapa vazia.</Centered>
          : visibleComps.map((c) => <div key={c.id} style={{ marginTop: c.props?._mt || 0, marginBottom: c.props?._mb || 0 }}><ComponentView comp={c} ctx={ctx} /></div>)}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 26, fontSize: 12, color: "#94a3b8" }}>Feito com Lowfy</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#64748b" }}>{children}</div>;
}

function injectPixel(id: string) {
  if (typeof window === "undefined" || (window as any).fbq) return;
  (function (f: any, b: any, e: any, v: any) {
    let n: any, t: any, s: any;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  (window as any).fbq("init", id);
  (window as any).fbq("track", "PageView");
}
