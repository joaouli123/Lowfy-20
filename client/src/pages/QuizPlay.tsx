import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import ComponentView, { type RuntimeCtx } from "@/components/quiz/ComponentView";
import { ensureGoogleFont, isVisible, type QComponent, type QuizOption, type QuizSpec } from "@/lib/quizSchema";

export default function QuizPlay() {
  const { slug } = useParams<{ slug: string }>();
  const [spec, setSpec] = useState<QuizSpec | null>(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [vars, setVars] = useState<Record<string, string>>({});
  // seleções por etapa: stepId -> compId -> optId -> score
  const [picks, setPicks] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const sentLead = useRef(false);

  useEffect(() => {
    fetch(`/api/q/${slug}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((s: QuizSpec) => {
      setSpec(s);
      ensureGoogleFont(s.theme?.font);
      applyMeta(s);
      fetch(`/api/q/${slug}/start`, { method: "POST" }).catch(() => {});
      if (s.pixelId) injectPixel(s.pixelId);
    }).catch(() => setErr(true));
  }, [slug]);

  // cronômetro por etapa (exibição condicional por tempo). NÃO apaga picks:
  // preserva seleções ao navegar para trás (evita contar score em dobro).
  useEffect(() => {
    setElapsed(0);
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    window.scrollTo(0, 0);
    return () => clearInterval(iv);
  }, [idx]);

  const theme = spec?.theme || {};
  const primary = theme.primaryColor || "#22c55e";
  const steps = spec?.steps || [];
  const step = steps[idx];
  const stepId = step?.id;

  // score DERIVADO de todas as seleções acumuladas (sem deltas manuais)
  const score = useMemo(() => {
    let s = 0;
    for (const byComp of Object.values(picks)) for (const byOpt of Object.values(byComp)) for (const v of Object.values(byOpt)) s += v;
    return s;
  }, [picks]);
  const selected = useMemo(() => Object.values(picks[stepId || ""] || {}).flatMap((m) => Object.keys(m)), [picks, stepId]);
  const allVars = useMemo(() => ({ score, ...vars }), [score, vars]);

  if (err) return <Centered>Quiz não encontrado.</Centered>;
  if (!spec || !step) return <Centered>Carregando…</Centered>;

  const goTo = (nextId?: string | null) => {
    let target = -1;
    if (nextId) { const i = steps.findIndex((s) => s.id === nextId); if (i >= 0) target = i; }
    if (target < 0) target = idx + 1 < steps.length ? idx + 1 : -1;
    if (target < 0) return finish();
    setHistory((h) => [...h, idx]);   // pilha p/ o botão "voltar"
    setIdx(target);
  };

  const goBack = () => setHistory((h) => { if (!h.length) return h; const prev = h[h.length - 1]; setIdx(prev); return h.slice(0, -1); });

  const finish = () => { fetch(`/api/q/${slug}/complete`, { method: "POST" }).catch(() => {}); const r = spec.redirectUrl; if (r) window.location.href = r; };

  // valida componentes de opções com "seleção obrigatória" na etapa atual
  const requiredSatisfied = () => {
    for (const c of step.components) {
      if (c.type === "opcoes" && c.props?.required && !Object.keys(picks[step.id]?.[c.id] || {}).length) return false;
    }
    return true;
  };

  const ctx: RuntimeCtx = {
    theme, vars: allVars, score, selectedOptionIds: selected,
    onPick: (comp, o: QuizOption) => {
      const cid = comp.id, sid = step.id, multiple = !!comp.props?.multiple;
      setPicks((prev) => {
        const byComp = { ...(prev[sid] || {}) };
        const cur = { ...(byComp[cid] || {}) };
        if (multiple) { if (cur[o.id] !== undefined) delete cur[o.id]; else cur[o.id] = o.score || 0; }
        else { for (const k of Object.keys(cur)) delete cur[k]; cur[o.id] = o.score || 0; }
        byComp[cid] = cur;
        return { ...prev, [sid]: byComp };
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
      // avanço: escolha única + autoAdvance e SEM "avançar só no botão" → avança sozinha
      const waitButton = multiple || comp.props?.advanceOnButton || comp.props?.autoAdvance === false;
      if (!waitButton) setTimeout(() => goTo(o.nextStepId), 220);
    },
    onSubmitCapture: (comp, values) => {
      setVars((v) => ({ ...v, ...values }));
      sendLead({ ...vars, ...values });
      goTo(comp.props?.nextStepId);
    },
    onAnswer: (comp, values) => { setVars((v) => ({ ...v, ...values })); setAnswers((a) => ({ ...a, ...values })); },
    onButton: (comp) => {
      if (!requiredSatisfied()) return; // bloqueia se faltou opção obrigatória
      // prioridade: o destino da OPÇÃO selecionada (escolha ÚNICA) vence a ação do botão.
      // Múltipla escolha NÃO roteia por opção — o botão decide (regra Movify).
      for (const c of step.components) {
        if (c.type !== "opcoes" || c.props?.multiple) continue;
        const sel = picks[step.id]?.[c.id]; if (!sel) continue;
        const opt = (c.props.options || []).find((o: QuizOption) => sel[o.id] !== undefined && o.nextStepId);
        if (opt) return goTo(opt.nextStepId);
      }
      const a = comp.props?.action;
      if (a === "url" && comp.props?.url) {
        if (comp.props?.newTab) { window.open(comp.props.url, "_blank"); return; }
        window.location.href = comp.props.url; return;
      }
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
  // header por etapa (sobrepõe o tema)
  const hd = step.header || {};
  const showLogo = hd.showLogo !== false && theme.logoUrl;
  const showProgress = hd.showProgress !== false && theme.showProgress !== false;
  const showBack = hd.allowBack !== false && history.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: theme.bgColor || "#f8fafc", color: theme.textColor || "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: theme.font || "Inter, system-ui, sans-serif", padding: "20px 16px" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", alignItems: "center", gap: 10, marginBottom: showProgress || showLogo ? 14 : 0 }}>
        {showBack && <button type="button" onClick={goBack} aria-label="Voltar" style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 18, lineHeight: "30px", color: theme.textColor, flexShrink: 0 }}>‹</button>}
        {showLogo && <img src={theme.logoUrl!} alt="" style={{ height: 38, objectFit: "contain", margin: showBack ? 0 : "0 auto" }} />}
        {showBack && !showLogo && <div style={{ flex: 1 }} />}
      </div>
      {showProgress && (
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

function applyMeta(s: any) {
  if (typeof document === "undefined") return;
  if (s.seoTitle || s.name) document.title = s.seoTitle || s.name;
  if (s.seoDescription) { let m = document.querySelector('meta[name="description"]'); if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); } m.setAttribute("content", s.seoDescription); }
  if (s.faviconUrl) { let l = document.querySelector('link[rel="icon"]') as HTMLLinkElement; if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); } l.href = s.faviconUrl; }
  if (s.gaId && !(window as any)._gaDone) {
    (window as any)._gaDone = true;
    const t = document.createElement("script"); t.async = true; t.src = `https://www.googletagmanager.com/gtag/js?id=${s.gaId}`; document.head.appendChild(t);
    const i = document.createElement("script"); i.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${s.gaId}')`; document.head.appendChild(i);
  }
  if (s.headScript && !(window as any)._headDone) {
    (window as any)._headDone = true;
    const div = document.createElement("div"); div.innerHTML = s.headScript;
    div.querySelectorAll("script").forEach((old) => { const sc = document.createElement("script"); for (const a of Array.from(old.attributes)) sc.setAttribute(a.name, a.value); sc.textContent = old.textContent; document.head.appendChild(sc); });
  }
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
