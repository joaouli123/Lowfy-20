/**
 * Renderizador visual de um componente do quiz. Inline styles (independe do
 * Tailwind) para funcionar igual no canvas do builder e na página pública.
 * Modo `preview` desativa interações reais (usado no editor).
 */
import { useEffect, useRef, useState } from "react";
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
  const primary = t.primaryColor || "#0d9b6e";
  const btnText = t.buttonTextColor || "#ffffff";
  const txt = (s?: string) => resolveVars(s || "", ctx.vars);

  switch (comp.type) {
    case "texto": {
      const align = (p.align || "center") as any;
      const color = p.color || t.textColor || "#0f172a";
      const titleColor = p.color || t.titleColor || t.textColor || "#0f172a";
      if (p.html) return <div style={{ textAlign: align, color, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: txt(p.html) }} />;
      if (p.variant === "subtitle") return <h2 style={{ fontSize: 18, fontWeight: 600, textAlign: align, color: titleColor, margin: "0 0 6px" }}>{txt(p.text)}</h2>;
      if (p.variant === "paragraph") return <p style={{ fontSize: 15, lineHeight: 1.6, textAlign: align, color, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{txt(p.text)}</p>;
      return <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: align, color: titleColor, margin: "0 0 8px", lineHeight: 1.25 }}>{txt(p.text)}</h1>;
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
      const horizontal = p.direction === "horizontal" || p.layout === "spread";
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
        <div style={p.fixedBottom ? { position: "sticky", bottom: 8, zIndex: 5 } : undefined}>
          <button type="button" disabled={ctx.preview} onClick={() => ctx.onButton?.(comp)}
            style={{
              width: p.full === false ? "auto" : "100%", padding: "15px 28px", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: ctx.preview ? "default" : "pointer",
              border: p.style === "outline" ? `2px solid ${primary}` : "none",
              background: p.style === "outline" ? "transparent" : primary, color: p.style === "outline" ? primary : btnText,
              animation: p.animated ? "qpulse 1.6s ease-in-out infinite" : undefined,
            }}>{txt(p.label) || "Continuar"}</button>
          {p.animated && <style>{`@keyframes qpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}`}</style>}
        </div>
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
          {p.avatar
            ? <img src={p.avatar} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + "1a", color: primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>!</div>}
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>{txt(p.title)}</div><div style={{ fontSize: 13, color: "#64748b" }}>{txt(p.text)}</div></div>
        </div>
      );
    case "depoimentos": {
      const items = p.items || [];
      const grid = p.layout === "grid";
      return (
        <div style={{ display: "grid", gridTemplateColumns: grid ? "repeat(2,1fr)" : "1fr", gap: 10 }}>
          {items.map((it: any, i: number) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {it.avatar
                  ? <img src={it.avatar} style={{ width: 38, height: 38, borderRadius: 999, objectFit: "cover" }} />
                  : <div style={{ width: 38, height: 38, borderRadius: 999, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 700 }}>{(it.name || "?")[0]}</div>}
                <div><div style={{ fontSize: 14, fontWeight: 700, color: t.textColor }}>{it.name}</div>{it.handle && <div style={{ fontSize: 12, color: "#94a3b8" }}>{it.handle}</div>}</div>
              </div>
              <p style={{ fontSize: 14, margin: "0 0 10px", color: "#475569", lineHeight: 1.5 }}>{txt(it.text)}</p>
              <div style={{ color: "#f59e0b", fontSize: 15, letterSpacing: 1 }}>{"★".repeat(Math.max(1, Math.min(5, it.stars || 5)))}</div>
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
    case "faq":
      return <FaqView comp={comp} ctx={ctx} primary={primary} />;
    case "carrossel":
      return <CarrosselView comp={comp} ctx={ctx} primary={primary} />;
    case "antes_depois": {
      const ph = (label: string) => <div style={{ flex: 1, aspectRatio: "3/4", borderRadius: 12, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>{label}</div>;
      return (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textAlign: "center", marginBottom: 6 }}>{p.labelBefore || "Antes"}</div>
            {p.before ? <img src={p.before} style={{ width: "100%", borderRadius: 12 }} /> : ph("Antes")}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primary, textAlign: "center", marginBottom: 6 }}>{p.labelAfter || "Depois"}</div>
            {p.after ? <img src={p.after} style={{ width: "100%", borderRadius: 12 }} /> : ph("Depois")}
          </div>
        </div>
      );
    }
    case "graficos": {
      const items = p.items || [];
      const grid = p.layout === "grid";
      const colorOf = (c: string) => c === "vermelho" ? "#ef4444" : c === "verde" ? "#0d9b6e" : primary;
      if (p.layout === "bars") {
        const maxV = Math.max(100, ...items.map((d: any) => d.value || 0));
        return (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 12, padding: "8px 4px" }}>
            {items.map((d: any, i: number) => {
              const col = colorOf(d.color), h = Math.max(8, ((d.value || 0) / maxV) * 130);
              return (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 140, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    <div style={{ width: "70%", maxWidth: 46, height: h, background: "#eef2f7", borderRadius: "10px 10px 6px 6px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: `linear-gradient(180deg, ${col}, ${col}cc)`, borderRadius: "10px 10px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{d.value}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.textColor, marginTop: 6 }}>{txt(d.label)}</div>
                  {d.sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{txt(d.sub)}</div>}
                </div>
              );
            })}
          </div>
        );
      }
      return (
        <div style={{ display: "grid", gridTemplateColumns: grid ? "repeat(2,1fr)" : "1fr", gap: 14 }}>
          {items.map((it: any, i: number) => {
            const col = colorOf(it.color);
            const pct = Math.min(100, Math.max(0, it.value || 0));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {it.type === "circular" ? (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(${col} ${pct * 3.6}deg, #eef2f7 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: "50%", background: t.bgColor || "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{pct}%</div>
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, background: "#eef2f7", borderRadius: 999 }}><div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 999 }} /></div>
                  </div>
                )}
                <div style={{ fontSize: 13, color: t.textColor }}>{it.type === "circular" ? "" : `${pct}% `}{txt(it.label)}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case "script":
      return <ScriptView comp={comp} preview={!!ctx.preview} />;
    case "regua":
      return <ReguaView comp={comp} ctx={ctx} primary={primary} />;
    case "garantia":
      return (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: "22px 18px", textAlign: "center", background: "#fff" }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={t.textColor || "#0f172a"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
          </svg>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: t.textColor, margin: "0 0 6px" }}>{txt(p.title)}</h3>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.55 }}>{txt(p.text)}</p>
        </div>
      );
    case "beneficios": {
      const items = p.items || [];
      return (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: "18px", background: "#fff" }}>
          {p.title && <h3 style={{ fontSize: 17, fontWeight: 800, color: t.textColor, textAlign: "center", margin: "0 0 14px" }}>{txt(p.title)}</h3>}
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {items.map((it: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                <span style={{ fontSize: 14, color: t.textColor, lineHeight: 1.45 }}>{txt(it.text)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "resultado": {
      const pctR = Math.max(0, Math.min(100, p.fromScore ? ctx.score : (p.percent ?? 50)));
      const levels: string[] = p.levels && p.levels.length ? p.levels : ["Baixo", "Médio", "Alto"];
      return (
        <div style={{ borderRadius: 16, padding: "18px 18px 22px", background: `linear-gradient(135deg, ${primary}, ${primary}cc)`, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{txt(p.title)}</span>
            {p.result && <span style={{ fontSize: 15, fontWeight: 800 }}>{txt(p.result)}</span>}
          </div>
          <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,.35)", borderRadius: 999, marginBottom: 8 }}>
            <div style={{ width: `${pctR}%`, height: "100%", background: "#fff", borderRadius: 999 }} />
            <div style={{ position: "absolute", top: "50%", left: `${pctR}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 4px rgba(255,255,255,.3)" }} />
            <div style={{ position: "absolute", bottom: 18, left: `${pctR}%`, transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", color: ctx.theme.textColor, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{txt(p.scoreLabel) || "Você está aqui"}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, opacity: 0.95 }}>
            {levels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </div>
      );
    }
    case "cartesiano": {
      const items: any[] = p.items || [];
      if (!items.length) return <Placeholder label="Cartesiano (adicione dados)" />;
      const W = 320, H = 160, pad = 28;
      const max = Math.max(100, ...items.map((d) => d.value || 0));
      const pts = items.map((d, i) => [pad + (i * (W - 2 * pad)) / Math.max(1, items.length - 1), H - pad - ((d.value || 0) / max) * (H - 2 * pad)]);
      const line = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
      const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - pad} L${pts[0][0].toFixed(1)} ${H - pad} Z`;
      return (
        <div>
          {p.title && <h3 style={{ fontSize: 16, fontWeight: 700, textAlign: "center", color: t.textColor, margin: "0 0 8px" }}>{txt(p.title)}</h3>}
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
            {p.showY && [0, 0.5, 1].map((g, i) => <line key={i} x1={pad} x2={W - pad} y1={pad + g * (H - 2 * pad)} y2={pad + g * (H - 2 * pad)} stroke="#eef2f7" />)}
            {p.showArea && <path d={area} fill={primary} opacity={0.12} />}
            <path d={line} fill="none" stroke={primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {items.map((d, i) => {
              const bx = Math.max(13, Math.min(W - 13, pts[i][0])), by = Math.max(11, pts[i][1] - 16);
              return (
                <g key={i}>
                  <g transform={`translate(${bx - 13},${by - 9})`}>
                    <rect width={26} height={17} rx={5} fill={primary} />
                    <text x={13} y={12} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{d.value}</text>
                  </g>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r={d.you ? 5.5 : 4} fill={d.you ? primary : "#fff"} stroke={primary} strokeWidth={2} />
                  {p.showX && <text x={pts[i][0]} y={H - 8} textAnchor="middle" fontSize={9} fill="#64748b">{d.label}</text>}
                  {d.you && <text x={pts[i][0]} y={pts[i][1] + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={primary}>Você</text>}
                </g>
              );
            })}
          </svg>
        </div>
      );
    }
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
          const common = { placeholder: f.label || f.type, value: vals[key] || "", disabled: ctx.preview, onChange: (e: any) => setVals((v) => ({ ...v, [key]: e.target.value })) };
          if (f.type === "textarea") return <textarea key={i} {...common} rows={3} style={{ borderRadius: 12, border: "1.5px solid #e2e8f0", padding: "12px 16px", fontSize: 15, resize: "vertical" }} />;
          const itype = f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
          return <input key={i} type={itype} {...common} style={{ height: 48, borderRadius: 12, border: "1.5px solid #e2e8f0", padding: "0 16px", fontSize: 15 }} />;
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
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      {p.showProgress !== false && (
        <div style={{ position: "relative", height: 22, background: "#eef2f7", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${primary}cc, ${primary})`, borderRadius: 999, transition: "width .12s" }} />
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: pct > 52 ? "#fff" : "#475569" }}>{Math.round(pct)}%</span>
        </div>
      )}
      <h3 style={{ fontSize: 18, fontWeight: 800, color: ctx.theme.textColor, margin: "0 0 4px" }}>{resolveVars(p.text || "Carregando…", ctx.vars)}</h3>
      {p.subtitle && <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>{resolveVars(p.subtitle, ctx.vars)}</p>}
    </div>
  );
}

function FaqView({ comp, ctx }: { comp: QComponent; ctx: RuntimeCtx; primary: string }) {
  const items = comp.props?.items || [];
  const multiple = comp.props?.mode === "multiple";
  const [openSet, setOpenSet] = useState<number[]>([0]);
  const isOpen = (i: number) => openSet.includes(i);
  const toggle = (i: number) => { if (ctx.preview) return; setOpenSet((s) => multiple ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : (s.includes(i) ? [] : [i])); };
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
      {items.map((it: any, i: number) => (
        <div key={i} style={{ borderTop: i ? "1px solid #f1f5f9" : "none" }}>
          <button type="button" onClick={() => toggle(i)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 16px", background: "transparent", border: "none", cursor: ctx.preview ? "default" : "pointer", fontWeight: 600, fontSize: 14, textAlign: "left", color: ctx.theme.textColor }}>
            <span>{resolveVars(it.q, ctx.vars)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: isOpen(i) ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {(isOpen(i) || ctx.preview) && <div style={{ padding: "0 16px 14px", fontSize: 14, color: "#475569", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: resolveVars(it.a || "", ctx.vars) }} />}
        </div>
      ))}
    </div>
  );
}

function CarrosselView({ comp, ctx, primary }: { comp: QComponent; ctx: RuntimeCtx; primary: string }) {
  const p = comp.props || {};
  const items: any[] = p.items || [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (ctx.preview || !p.autoplay || items.length < 2) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % items.length), 3500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, p.autoplay]);
  if (!items.length) return <Placeholder label="Carrossel (adicione itens)" />;
  const cur = items[Math.min(idx, items.length - 1)];
  return (
    <div>
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        {cur.image ? <img src={cur.image} style={{ width: "100%", display: "block" }} /> : <div style={{ aspectRatio: "16/10", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Imagem</div>}
        {(cur.title || cur.desc) && <div style={{ padding: "12px 14px" }}>
          {cur.title && <div style={{ fontWeight: 700, marginBottom: 2, color: ctx.theme.textColor }}>{resolveVars(cur.title, ctx.vars)}</div>}
          {cur.desc && <div style={{ fontSize: 13, color: "#64748b" }}>{resolveVars(cur.desc, ctx.vars)}</div>}
        </div>}
        {items.length > 1 && !ctx.preview && <>
          <button type="button" onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)} style={navBtn("left")}>‹</button>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % items.length)} style={navBtn("right")}>›</button>
        </>}
      </div>
      {p.pagination !== false && items.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {items.map((_: any, i: number) => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i === idx ? primary : "#cbd5e1" }} />)}
        </div>
      )}
    </div>
  );
}
function navBtn(side: "left" | "right"): React.CSSProperties {
  return { position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.9)", boxShadow: "0 2px 8px rgba(0,0,0,.15)", cursor: "pointer", fontSize: 18, lineHeight: "30px" } as React.CSSProperties;
}

function ScriptView({ comp, preview }: { comp: QComponent; preview: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const code: string = comp.props?.code || "";
  useEffect(() => {
    if (preview || !ref.current || !code) return;
    ref.current.innerHTML = code;
    // re-executa <script> (innerHTML não executa scripts)
    ref.current.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.textContent = old.textContent;
      old.parentNode?.replaceChild(s, old);
    });
  }, [code, preview]);
  if (preview) return <Placeholder label={code ? "Script embutido (executa no quiz publicado)" : "Script (cole o código)"} />;
  return <div ref={ref} />;
}

function ReguaView({ comp, ctx, primary }: { comp: QComponent; ctx: RuntimeCtx; primary: string }) {
  const p = comp.props || {};
  const min = p.min ?? 0, max = p.max ?? 100;
  const [val, setVal] = useState<number>(p.value ?? Math.round((min + max) / 2));
  const [alt, setAlt] = useState(false); // unidade alternativa (pol/lb)
  const sec = p.unit === "cm" ? "pol" : p.unit === "kg" ? "lb" : "";
  const pct = ((val - min) / Math.max(1, max - min)) * 100;
  const display = () => {
    if (alt && p.unit === "cm") { const inch = Math.round(val / 2.54); return [`${Math.floor(inch / 12)}′${inch % 12}″`, ""]; }
    if (alt && p.unit === "kg") return [String(Math.round(val * 2.205)), "lb"];
    return [String(val), p.unit || ""];
  };
  const [num, un] = display();
  const setV = (v: number) => { setVal(v); ctx.onAnswer?.(comp, { [p.name || comp.type]: `${v} ${p.unit || ""}` }); };
  const ticks = Array.from({ length: 41 }, (_, i) => i);
  return (
    <div style={{ textAlign: "center" }}>
      {p.label && <h3 style={{ fontSize: 18, fontWeight: 700, color: ctx.theme.textColor, margin: "0 0 12px" }}>{resolveVars(p.label, ctx.vars)}</h3>}
      {sec && (
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 999, padding: 3, marginBottom: 12 }}>
          {[[p.unit, false], [sec, true]].map(([lab, a]) => (
            <button key={lab as string} type="button" disabled={ctx.preview} onClick={() => setAlt(a as boolean)}
              style={{ border: "none", background: alt === a ? primary : "transparent", color: alt === a ? "#fff" : "#64748b", borderRadius: 999, padding: "5px 16px", fontSize: 13, fontWeight: 600, cursor: ctx.preview ? "default" : "pointer" }}>{lab}</button>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 14 }}><span style={{ fontSize: 40, fontWeight: 800, color: ctx.theme.textColor }}>{num}</span><span style={{ fontSize: 20, fontWeight: 600, color: "#94a3b8", marginLeft: 2 }}>{un}</span></div>
      {/* régua */}
      <div style={{ position: "relative", height: 56, maxWidth: 340, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 30, padding: "0 2px" }}>
          {ticks.map((i) => <div key={i} style={{ width: 1, height: i % 5 === 0 ? 22 : 11, background: i % 5 === 0 ? "#94a3b8" : "#cbd5e1" }} />)}
        </div>
        {/* agulha */}
        <div style={{ position: "absolute", top: 0, left: `${pct}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 2, height: 30, background: primary }} />
          <div style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `9px solid ${primary}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginTop: 2 }}><span>{min}</span><span>{max}</span></div>
        <input type="range" min={min} max={max} value={val} disabled={ctx.preview} onChange={(e) => setV(+e.target.value)}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 34, opacity: 0, cursor: ctx.preview ? "default" : "pointer", margin: 0 }} />
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Arraste para selecionar</div>
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
