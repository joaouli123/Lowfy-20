import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";

interface QOption { id: string; label: string; image?: string | null; score?: number; nextStepId?: string | null; }
interface QField { type: "name" | "email" | "phone" | "text"; label?: string; required?: boolean; }
interface QStep {
  id: string; type: "question" | "content" | "capture" | "result";
  title?: string; description?: string; image?: string | null;
  multiple?: boolean; options?: QOption[]; fields?: QField[];
  buttonText?: string; nextStepId?: string | null;
  minScore?: number; resultTitle?: string; resultDescription?: string; resultButtonText?: string; resultRedirectUrl?: string;
}
interface QSpec {
  name: string; slug: string; steps: QStep[];
  theme?: { primaryColor?: string; bgColor?: string; textColor?: string; logoUrl?: string | null; showProgress?: boolean };
  pixelId?: string | null; redirectUrl?: string | null;
}

export default function QuizPlay() {
  const { slug } = useParams<{ slug: string }>();
  const [spec, setSpec] = useState<QSpec | null>(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [lead, setLead] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/q/${slug}`).then((r) => r.ok ? r.json() : Promise.reject()).then((s: QSpec) => {
      setSpec(s);
      fetch(`/api/q/${slug}/start`, { method: "POST" }).catch(() => {});
      if (s.pixelId) injectPixel(s.pixelId);
    }).catch(() => setErr(true));
  }, [slug]);

  const theme = spec?.theme || {};
  const primary = theme.primaryColor || "#29654f";
  const steps = spec?.steps || [];
  const step = steps[idx];

  // Para o passo de resultado: escolhe o melhor result step pelo score.
  const resultStep = useMemo(() => {
    if (!step || step.type !== "result") return step;
    const results = steps.filter((s) => s.type === "result").sort((a, b) => (b.minScore || 0) - (a.minScore || 0));
    return results.find((r) => score >= (r.minScore || 0)) || step;
  }, [step, steps, score]);

  if (err) return <Centered>Quiz não encontrado.</Centered>;
  if (!spec || !step) return <Centered>Carregando…</Centered>;

  const goNext = (nextId?: string | null, addScore = 0) => {
    if (addScore) setScore((s) => s + addScore);
    if (nextId) {
      const t = steps.findIndex((s) => s.id === nextId);
      if (t >= 0) return setIdx(t);
    }
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const pickOption = (o: QOption) => {
    setAnswers((a) => ({ ...a, [step.id]: o.label }));
    goNext(o.nextStepId, o.score || 0);
  };

  const submitLead = async () => {
    const required = (step.fields || []).filter((f) => f.required !== false);
    for (const f of required) if (!lead[f.type]?.trim()) return;
    setSent(true);
    try {
      const r = await fetch(`/api/q/${slug}/lead`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, respostas: answers, score }),
      });
      const data = await r.json().catch(() => ({}));
      if (typeof window !== "undefined" && (window as any).fbq) (window as any).fbq("track", "Lead");
      const redirect = data.redirectUrl || spec.redirectUrl;
      if (redirect) { window.location.href = redirect; return; }
    } catch {}
    goNext(step.nextStepId);
  };

  const progress = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: theme.bgColor || "#f6faf8", color: theme.textColor || "#16241d", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "Inter, system-ui, sans-serif", padding: "24px 16px" }}>
      {theme.logoUrl && <img src={theme.logoUrl} alt="" style={{ height: 40, marginBottom: 20, objectFit: "contain" }} />}
      {theme.showProgress !== false && (
        <div style={{ width: "100%", maxWidth: 520, height: 6, background: "#e3e8e5", borderRadius: 999, marginBottom: 28 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: primary, borderRadius: 999, transition: "width .3s" }} />
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 520 }}>
        {step.image && <img src={step.image} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 20 }} />}

        {/* RESULTADO */}
        {step.type === "result" ? (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>{resultStep?.resultTitle || resultStep?.title || "Seu resultado"}</h1>
            <p style={{ fontSize: 16, color: "#4a5a51", margin: "0 0 24px", whiteSpace: "pre-wrap" }}>{resultStep?.resultDescription || resultStep?.description}</p>
            {(resultStep?.resultRedirectUrl || spec.redirectUrl) && (
              <a href={resultStep?.resultRedirectUrl || spec.redirectUrl!} style={btn(primary)}>{resultStep?.resultButtonText || "Continuar"}</a>
            )}
          </div>
        ) : step.type === "capture" ? (
          /* CAPTURA DE LEAD */
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", textAlign: "center" }}>{step.title || "Falta pouco!"}</h1>
            {step.description && <p style={{ textAlign: "center", color: "#4a5a51", margin: "0 0 20px" }}>{step.description}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(step.fields || [{ type: "name", required: true }, { type: "email", required: true }]).map((f, i) => (
                <input key={i} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                  placeholder={f.label || fieldPlaceholder(f.type)}
                  value={lead[f.type] || ""} onChange={(e) => setLead({ ...lead, [f.type]: e.target.value })}
                  style={inputStyle()} />
              ))}
              <button disabled={sent} onClick={submitLead} style={btn(primary)}>{sent ? "Enviando…" : (step.buttonText || "Quero meu resultado")}</button>
            </div>
          </div>
        ) : step.type === "content" ? (
          /* CONTEÚDO */
          <div style={{ textAlign: "center" }}>
            {step.title && <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 12px" }}>{step.title}</h1>}
            {step.description && <p style={{ color: "#4a5a51", margin: "0 0 24px", whiteSpace: "pre-wrap" }}>{step.description}</p>}
            <button onClick={() => goNext(step.nextStepId)} style={btn(primary)}>{step.buttonText || "Continuar"}</button>
          </div>
        ) : (
          /* PERGUNTA */
          <div>
            {step.title && <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", textAlign: "center" }}>{step.title}</h1>}
            {step.description && <p style={{ textAlign: "center", color: "#4a5a51", margin: "0 0 20px" }}>{step.description}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(step.options || []).map((o) => (
                <button key={o.id} onClick={() => pickOption(o)} style={optStyle(primary)}
                  onMouseEnter={(e) => { (e.currentTarget.style.borderColor = primary); (e.currentTarget.style.background = primary + "12"); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.borderColor = "#dce4e0"); (e.currentTarget.style.background = "#fff"); }}>
                  {o.image && <img src={o.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", marginRight: 12 }} />}
                  <span style={{ fontWeight: 600 }}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 28, fontSize: 12, color: "#9aa8a0" }}>Feito com Lowfy</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#4a5a51" }}>{children}</div>;
}
function btn(primary: string): React.CSSProperties {
  return { display: "inline-block", background: primary, color: "#fff", border: "none", borderRadius: 12, padding: "15px 28px", fontWeight: 700, fontSize: 16, cursor: "pointer", textDecoration: "none", textAlign: "center", width: "100%", boxSizing: "border-box" };
}
function optStyle(primary: string): React.CSSProperties {
  return { display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid #dce4e0", borderRadius: 12, padding: "16px 18px", cursor: "pointer", fontSize: 15, textAlign: "left", transition: "all .15s", width: "100%" };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", height: 48, borderRadius: 12, border: "1.5px solid #dce4e0", padding: "0 16px", fontSize: 15, boxSizing: "border-box" };
}
function fieldPlaceholder(t: string): string {
  return { name: "Seu nome", email: "Seu melhor e-mail", phone: "Seu WhatsApp", text: "Sua resposta" }[t] || "";
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
