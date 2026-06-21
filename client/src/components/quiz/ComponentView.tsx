/**
 * Renderizador visual de um componente do quiz. Inline styles (independe do
 * Tailwind) para funcionar igual no canvas do builder e na página pública.
 * Modo `preview` desativa interações reais (usado no editor).
 */
import { useEffect, useState } from "react";
import type { QComponent, QuizTheme, QuizOption } from "@/lib/quizSchema";
import { resolveVars } from "@/lib/quizSchema";

export interface RuntimeCtx {
  theme: QuizTheme;
  vars: Record<string, any>;
  score: number;
  preview?: boolean;
  selectedOptionIds?: string[];
  onPick?: (comp: QComponent, option: QuizOption) => void;
  onSubmitCapture?: (comp: QComponent, values: Record<string, string>) => void;
  onAnswer?: (comp: QComponent, values: Record<string, string>) => void; // grava resposta SEM avançar/enviar lead
  onButton?: (comp: QComponent) => void;
  onAdvance?: (comp: QComponent) => void;
}

const isYouTube = (u: string) => /youtu\.?be/.test(u);
const ytId = (u: string) => (u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/) || [])[1] || "";

export default function ComponentView({ comp, ctx }: { comp: QComponent; ctx: RuntimeCtx }) {
  const p = comp.props || {};
  const t = ctx.theme || {};
  const primary = t.primaryColor || "#22c55e";
  const btnText = t.buttonTextColor || "#ffffff";
  const txt = (s?: string) => resolveVars(s || "", ctx.vars);

  switch (comp.type) {
    case "texto": {
      const align = (p.align || "center") as any;
      const color = p.color || t.textColor || "#0f172a";
      if (p.variant === "subtitle") return <h2 style={{ fontSize: 18, fontWeight: 600, textAlign: align, color, margin: "0 0 6px" }}>{txt(p.text)}</h2>;
      if (p.variant === "paragraph") return <p style={{ fontSize: 15, lineHeight: 1.6, textAlign: align, color, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{txt(p.text)}</p>;
      return <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: align, color, margin: "0 0 8px", lineHeight: 1.25 }}>{txt(p.text)}</h1>;
    }
    case "imagem":
      return p.url
        ? <img src={p.url} alt={p.alt || ""} style={{ width: `${p.maxWidth || 100}%`, borderRadius: p.radius ?? 14, display: "block", margin: "0 auto" }} />
        : <Placeholder label="Imagem (defina a URL)" />;
    case "video": {
      if (!p.url) return <Placeholder label="Vídeo (cole o link)" />;
      if (/\.mp4($|\?)/i.test(p.url)) return <video src={p.url} controls style={{ width: "100%", borderRadius: 14 }} />;
      const src = isYouTube(p.url) ? `https://www.youtube.com/embed/${ytId(p.url)}` : p.url;
      return <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 14, overflow: "hidden" }}><iframe src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allowFullScreen /></div>;
    }
    case "audio":
      return p.url ? <audio src={p.url} controls style={{ width: "100%" }} /> : <Placeholder label="Áudio (defina a URL)" />;
    case "galeria": {
      const imgs: string[] = (p.images || []).filter(Boolean);
      if (!imgs.length) return <Placeholder label="Galeria (adicione imagens)" />;
      return <div style={{ display: "grid", gridTemplateColumns: p.layout === "slide" ? "1fr" : "repeat(2,1fr)", gap: 8 }}>{imgs.map((u, i) => <img key={i} src={u} style={{ width: "100%", borderRadius: 12 }} />)}</div>;
    }
    case "opcoes": {
      const opts: QuizOption[] = p.options || [];
      const grid = p.layout === "grid";
      const horizontal = p.direction === "horizontal";
      const disp = p.disposition || "texto";
      const showImg = disp === "image_texto" || disp === "image";
      const showText = disp !== "image";
      const stackInner = grid || disp === "image" || disp === "image_texto";
      const containerStyle: React.CSSProperties = grid
        ? { display: "grid", gridTemplateColumns: `repeat(${horizontal ? Math.min(opts.length, 3) || 2 : 2},1fr)`, gap: 10, marginTop: 12 }
        : { display: "flex", flexDirection: horizontal ? "row" : "column", flexWrap: horizontal ? "wrap" : "nowrap", gap: 10, marginTop: 12 };
      return (
        <div>
          {p.question && <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", color: t.textColor, margin: "0 0 4px" }}>{txt(p.question)}</h2>}
          {p.help && <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, margin: "0 0 14px" }}>{txt(p.help)}</p>}
          <div style={containerStyle}>
            {opts.map((o, i) => {
              const sel = ctx.selectedOptionIds?.includes(o.id);
              return (
                <button key={o.id} type="button" disabled={ctx.preview}
                  onClick={() => ctx.onPick?.(comp, o)}
                  style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 10, textAlign: stackInner ? "center" : "left", cursor: ctx.preview ? "default" : "pointer",
                    background: sel ? primary + "1a" : "#fff", border: `1.5px solid ${sel ? primary : "#e2e8f0"}`,
                    borderRadius: 12, padding: stackInner ? "14px 12px" : "14px 16px", fontSize: 15, color: t.textColor, transition: "all .15s",
                    flexDirection: stackInner ? "column" : "row", justifyContent: stackInner ? "center" : "flex-start", flex: horizontal && !grid ? "1 1 0" : undefined, minWidth: horizontal && !grid ? 90 : undefined,
                  }}>
                  {p.multiple && <span style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? primary : "#cbd5e1"}`, background: sel ? primary : "transparent", color: "#fff", fontSize: 12, lineHeight: "14px", textAlign: "center" }}>{sel ? "✓" : ""}</span>}
                  {disp === "emoji_texto" && o.emoji && <span style={{ fontSize: 24 }}>{o.emoji}</span>}
                  {showImg && (o.image
                    ? <img src={o.image} style={{ width: stackInner ? 64 : 40, height: stackInner ? 64 : 40, borderRadius: 8, objectFit: "cover" }} />
                    : <span style={{ width: stackInner ? 64 : 40, height: stackInner ? 64 : 40, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 18 }}>▦</span>)}
                  {disp === "texto" && !stackInner && <span style={{ width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>{String.fromCharCode(65 + i)}</span>}
                  {showText && <span style={{ fontWeight: 600 }}>{txt(o.label)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "video_resposta":
      return <VideoRespostaView comp={comp} ctx={ctx} primary={primary} btnText={btnText} />;
    case "captura":
      return <CaptureView comp={comp} ctx={ctx} primary={primary} btnText={btnText} />;
    case "botao":
      return (
        <button type="button" disabled={ctx.preview} onClick={() => ctx.onButton?.(comp)}
          style={{
            width: p.full === false ? "auto" : "100%", padding: "15px 28px", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: ctx.preview ? "default" : "pointer",
            border: p.style === "outline" ? `2px solid ${primary}` : "none",
            background: p.style === "outline" ? "transparent" : primary, color: p.style === "outline" ? primary : btnText,
          }}>{txt(p.label) || "Continuar"}</button>
      );
    case "nivel": {
      const pct = p.fromScore ? Math.min(100, Math.max(0, ctx.score)) : (p.percent ?? 50);
      return (
        <div>
          {p.label && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginBottom: 6 }}><span>{txt(p.label)}</span><span>{pct}%</span></div>}
          <div style={{ height: 10, background: "#eef2f7", borderRadius: 999 }}><div style={{ width: `${pct}%`, height: "100%", background: primary, borderRadius: 999, transition: "width .4s" }} /></div>
        </div>
      );
    }
    case "loading":
      return <LoadingView comp={comp} ctx={ctx} primary={primary} />;
    case "timer":
      return <TimerView comp={comp} primary={primary} />;
    case "alerta": {
      const map: Record<string, string[]> = { info: ["#eff6ff", "#1d4ed8"], warning: ["#fff7ed", "#c2410c"], success: ["#f0fdf4", "#15803d"], danger: ["#fef2f2", "#b91c1c"] };
      const [bg, fg] = map[p.variant || "warning"] || map.warning;
      return <div style={{ background: bg, color: fg, borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 600, textAlign: "center" }}>{txt(p.text)}</div>;
    }
    case "notificacao":
      return (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + "1a", color: primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>!</div>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>{txt(p.title)}</div><div style={{ fontSize: 13, color: "#64748b" }}>{txt(p.text)}</div></div>
        </div>
      );
    case "depoimentos": {
      const items = p.items || [];
      const grid = p.layout === "grid";
      return (
        <div style={{ display: "grid", gridTemplateColumns: grid ? "repeat(2,1fr)" : "1fr", gap: 10 }}>
          {items.map((it: any, i: number) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: 4 }}>{"★".repeat(it.stars || 5)}</div>
              <p style={{ fontSize: 14, margin: "0 0 8px", color: "#334155" }}>"{it.text}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {it.avatar && <img src={it.avatar} style={{ width: 28, height: 28, borderRadius: 999, objectFit: "cover" }} />}
                <span style={{ fontSize: 13, fontWeight: 700 }}>{it.name}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "argumentos": {
      const items = (p.items || []).slice(0, 4);
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {items.map((it: any, i: number) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, textAlign: "center" }}>
              {it.image && <img src={it.image} style={{ width: 44, height: 44, objectFit: "contain", margin: "0 auto 8px" }} />}
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{it.title}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{it.text}</div>
            </div>
          ))}
        </div>
      );
    }
    case "preco":
      return (
        <div style={{ border: `2px solid ${p.highlight ? primary : "#e2e8f0"}`, borderRadius: 16, padding: 20, textAlign: "center", background: "#fff" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.textColor }}>{p.price}</div>
          {p.installments && <div style={{ fontSize: 14, color: "#64748b", marginBottom: 14 }}>{p.installments}</div>}
          <button type="button" disabled={ctx.preview} onClick={() => !ctx.preview && p.url && (window.location.href = p.url)}
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: primary, color: btnText, fontWeight: 700, fontSize: 16, cursor: ctx.preview ? "default" : "pointer" }}>{p.ctaLabel || "Comprar agora"}</button>
        </div>
      );
    case "espaco":
      return <div style={{ height: p.height ?? 24 }} />;
    default:
      return <Placeholder label={comp.type} />;
  }
}

function Placeholder({ label }: { label: string }) {
  return <div style={{ border: "1.5px dashed #cbd5e1", borderRadius: 12, padding: "24px 12px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>{label}</div>;
}

function VideoRespostaView({ comp, ctx, primary, btnText }: { comp: QComponent; ctx: RuntimeCtx; primary: string; btnText: string }) {
  const p = comp.props || {};
  const [fileName, setFileName] = useState<string>("");
  return (
    <div>
      {p.question && <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", color: ctx.theme.textColor, margin: "0 0 4px" }}>{resolveVars(p.question, ctx.vars)}</h2>}
      {p.help && <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>{resolveVars(p.help, ctx.vars)}</p>}
      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: `2px dashed ${fileName ? primary : "#cbd5e1"}`, borderRadius: 14, padding: "28px 16px", color: fileName ? primary : "#64748b", cursor: ctx.preview ? "default" : "pointer" }}>
        <span style={{ fontSize: 30 }}>🎥</span>
        <span style={{ fontSize: 14 }}>{fileName ? `Vídeo selecionado: ${fileName}` : "Toque para gravar / enviar um vídeo"}</span>
        {!ctx.preview && <input type="file" accept="video/*" capture="user" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFileName(f.name); ctx.onAnswer?.(comp, { [p.name || "video_resposta"]: f.name }); } }} />}
      </label>
      {!ctx.preview && <button type="button" onClick={() => ctx.onButton?.(comp)} style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: 12, border: "none", background: primary, color: btnText, fontWeight: 700, cursor: "pointer" }}>{p.buttonText || "Continuar"}</button>}
    </div>
  );
}

function CaptureView({ comp, ctx, primary, btnText }: { comp: QComponent; ctx: RuntimeCtx; primary: string; btnText: string }) {
  const p = comp.props || {};
  const [vals, setVals] = useState<Record<string, string>>({});
  const fields: any[] = p.fields || [];
  const submit = () => {
    for (const f of fields) if (f.required !== false && !vals[f.name || f.type]?.trim()) return;
    ctx.onSubmitCapture?.(comp, vals);
  };
  return (
    <div>
      {p.title && <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 4px", color: ctx.theme.textColor }}>{resolveVars(p.title, ctx.vars)}</h2>}
      {p.description && <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, margin: "0 0 14px" }}>{resolveVars(p.description, ctx.vars)}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((f, i) => {
          const key = f.name || f.type;
          return <input key={i} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} placeholder={f.label || f.type}
            value={vals[key] || ""} disabled={ctx.preview}
            onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
            style={{ height: 48, borderRadius: 12, border: "1.5px solid #e2e8f0", padding: "0 16px", fontSize: 15 }} />;
        })}
        <button type="button" disabled={ctx.preview} onClick={submit}
          style={{ height: 50, borderRadius: 12, border: "none", background: primary, color: btnText, fontWeight: 700, fontSize: 16, cursor: ctx.preview ? "default" : "pointer" }}>{p.buttonText || "Continuar"}</button>
      </div>
    </div>
  );
}

function LoadingView({ comp, ctx, primary }: { comp: QComponent; ctx: RuntimeCtx; primary: string }) {
  const p = comp.props || {};
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (ctx.preview) { setPct(60); return; }
    const dur = (p.durationSec || 3) * 1000;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const e = Math.min(100, ((Date.now() - t0) / dur) * 100);
      setPct(e);
      if (e >= 100) { clearInterval(iv); ctx.onAdvance?.(comp); }
    }, 60);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 48, height: 48, margin: "0 auto 14px", border: `4px solid ${primary}33`, borderTopColor: primary, borderRadius: "50%", animation: "qspin 1s linear infinite" }} />
      <div style={{ fontSize: 15, color: ctx.theme.textColor, marginBottom: 12 }}>{resolveVars(p.text || "Carregando…", ctx.vars)}</div>
      <div style={{ height: 8, background: "#eef2f7", borderRadius: 999, maxWidth: 260, margin: "0 auto" }}><div style={{ width: `${pct}%`, height: "100%", background: primary, borderRadius: 999, transition: "width .1s" }} /></div>
      <style>{`@keyframes qspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function TimerView({ comp, primary }: { comp: QComponent; primary: string }) {
  const p = comp.props || {};
  const [left, setLeft] = useState((p.minutes || 10) * 60);
  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div style={{ textAlign: "center" }}>
      {p.text && <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>{p.text}</div>}
      <div style={{ display: "inline-flex", gap: 6, fontVariantNumeric: "tabular-nums" }}>
        {left <= 0 ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>{p.expiredText || "Tempo esgotado!"}</span> :
          [mm, ss].map((v, i) => <span key={i} style={{ background: primary, color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 22, fontWeight: 800 }}>{v}</span>)}
      </div>
    </div>
  );
}
