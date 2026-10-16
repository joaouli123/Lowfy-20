import { useState } from "react";
import { Copy as CopyIcon, Check, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Globe, CheckCheck, Star, ShieldCheck, ChevronDown } from "lucide-react";

// Preview de cada canal da Copy, com a cara do lugar onde o texto vai aparecer.

export type Canal = "social" | "meta" | "whatsapp" | "landing" | "email";
export type CopyOut = Record<string, any> & { canal?: Canal };

const s = (v: any) => (typeof v === "string" ? v : "");
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

/** Texto puro de cada canal (copiar / baixar / histórico). */
export function copyToText(canal: Canal, d: CopyOut): string {
  if (canal === "social") return [s(d.gancho), s(d.legenda), s(d.cta), arr(d.hashtags).join(" ")].filter(Boolean).join("\n\n");
  if (canal === "meta") return [`TEXTO PRINCIPAL:\n${s(d.texto_principal)}`, `TÍTULO: ${s(d.titulo)}`, `DESCRIÇÃO: ${s(d.descricao)}`, `BOTÃO: ${s(d.botao)}`].join("\n\n");
  if (canal === "whatsapp") return s(d.mensagem);
  if (canal === "email") return [`ASSUNTO: ${s(d.assunto)}`, `PRÉ-CABEÇALHO: ${s(d.preheader)}`, "", s(d.corpo), "", `[BOTÃO: ${s(d.botao)}]`, "", s(d.ps)].join("\n");
  const L: string[] = [];
  const sec = (t: string, x?: string) => L.push(`## ${t}`, ...(x ? [x] : []), "");
  sec(s(d.hero?.titulo), s(d.hero?.subtitulo)); L.push(`[BOTÃO: ${s(d.hero?.botao)}]`, "");
  sec(s(d.problema?.titulo), s(d.problema?.texto));
  sec(s(d.solucao?.titulo), s(d.solucao?.texto));
  L.push("## Benefícios"); arr(d.beneficios).forEach((b) => L.push(`- ${s(b.titulo)}: ${s(b.texto)}`)); L.push("");
  L.push("## Como funciona"); arr(d.como_funciona).forEach((b, i) => L.push(`${i + 1}. ${s(b.titulo)}: ${s(b.texto)}`)); L.push("");
  sec(s(d.oferta?.titulo), [s(d.oferta?.texto), s(d.oferta?.preco)].filter(Boolean).join("\n")); L.push(`[BOTÃO: ${s(d.oferta?.botao)}]`, "");
  sec(s(d.garantia?.titulo), s(d.garantia?.texto));
  L.push("## Perguntas frequentes"); arr(d.faq).forEach((f) => L.push(`P: ${s(f.pergunta)}`, `R: ${s(f.resposta)}`, ""));
  sec(s(d.cta_final?.titulo), s(d.cta_final?.texto)); L.push(`[BOTÃO: ${s(d.cta_final?.botao)}]`);
  return L.join("\n").trim();
}

function CopyBtn({ text, className = "" }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); }}
      className={`w-7 h-7 rounded-md border bg-card/90 flex items-center justify-center hover:bg-muted transition flex-shrink-0 ${className}`}
      aria-label="Copiar"
      title="Copiar"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-primary" /> : <CopyIcon className="w-3.5 h-3.5" />}
    </button>
  );
}

/** Texto com quebras de linha e *negrito* do WhatsApp. */
function Rich({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>))}
    </p>
  );
}

/** Card do post/anúncio como aparece na rede social: borda suave, sem moldura de celular. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden text-slate-900 font-sans">
      {children}
    </div>
  );
}

export function CopyPreview({ canal, d }: { canal: Canal; d: CopyOut }) {
  if (canal === "social") return <SocialPreview d={d} />;
  if (canal === "meta") return <MetaPreview d={d} />;
  if (canal === "whatsapp") return <WhatsPreview d={d} />;
  if (canal === "email") return <EmailPreview d={d} />;
  return <LandingPreview d={d} />;
}

function Avatar() {
  return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 p-[2px]"><div className="w-full h-full rounded-full bg-card flex items-center justify-center text-[10px] font-bold">SM</div></div>;
}

function SocialPreview({ d }: { d: CopyOut }) {
  const [mais, setMais] = useState(false);
  return (
    <div className="space-y-3">
      <Phone>
        <div className="flex items-center gap-2 px-3 py-2.5"><Avatar /><span className="font-semibold text-[13px]">sua_marca</span><MoreHorizontal className="w-4 h-4 ml-auto text-slate-500" /></div>
        <img src="/studio-examples/post-fone-4x5.webp" alt="" className="w-full aspect-[4/5] object-cover" />
        <div className="flex items-center gap-3.5 px-3 pt-2.5"><Heart className="w-[22px] h-[22px]" /><MessageCircle className="w-[22px] h-[22px]" /><Send className="w-[22px] h-[22px]" /><Bookmark className="w-[22px] h-[22px] ml-auto" /></div>
        <p className="px-3 pt-1.5 text-[13px] font-semibold">1.284 curtidas</p>
        <div className="px-3 pt-1 pb-3 text-[13.5px] leading-[1.4]">
          <span className="font-semibold mr-1.5">sua_marca</span>
          <span>{s(d.gancho)}</span>
          {!mais ? (
            <button type="button" onClick={() => setMais(true)} className="text-slate-500 ml-1">… mais</button>
          ) : (
            <>
              <Rich text={`\n${s(d.legenda)}\n\n${s(d.cta)}`} className="mt-0.5" />
              <p className="text-[#00376b] mt-2">{arr(d.hashtags).join(" ")}</p>
            </>
          )}
        </div>
      </Phone>
      <div className="flex justify-end"><CopyBtn text={copyToText("social", d)} /></div>
      {arr(d.variacoes).length > 0 && <Alt title="Outros ganchos para testar" items={arr(d.variacoes).map(s)} />}
    </div>
  );
}

function MetaPreview({ d }: { d: CopyOut }) {
  const texto = s(d.texto_principal);
  const [mais, setMais] = useState(false);
  const curto = texto.split("\n").slice(0, 2).join("\n").slice(0, 125);
  return (
    <div className="space-y-3">
      <Phone>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar />
          <div><p className="font-semibold text-[13px] leading-tight">Sua Marca</p><p className="text-[11px] text-slate-500">Patrocinado · <Globe className="inline w-2.5 h-2.5" /></p></div>
          <MoreHorizontal className="w-4 h-4 ml-auto text-slate-500" />
        </div>
        <div className="px-3 pb-2.5 text-[13.5px] leading-[1.4]">
          <p className="whitespace-pre-wrap">{mais || texto.length <= curto.length ? texto : curto}{!mais && texto.length > curto.length && <button type="button" onClick={() => setMais(true)} className="text-slate-500"> …Ver mais</button>}</p>
        </div>
        <img src="/studio-examples/post-perfume-1x1.webp" alt="" className="w-full aspect-square object-cover" />
        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-100">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase text-slate-500">suamarca.com.br</p>
            <p className="font-semibold text-[14px] leading-tight truncate">{s(d.titulo)}</p>
            <p className="text-[12px] text-slate-500 truncate">{s(d.descricao)}</p>
          </div>
          <span className="rounded-md bg-slate-200 px-3 py-2 text-[13px] font-semibold whitespace-nowrap">{s(d.botao) || "Saiba mais"}</span>
        </div>
      </Phone>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Field label="Título" value={s(d.titulo)} max={40} />
        <Field label="Descrição" value={s(d.descricao)} max={30} />
        <Field label="Botão" value={s(d.botao)} />
      </div>
      <div className="flex justify-end"><CopyBtn text={copyToText("meta", d)} /></div>
      {arr(d.variacoes).length > 0 && (
        <Alt title="Variações para teste A/B" items={arr(d.variacoes).map((v) => `${s(v?.titulo)} — ${s(v?.texto_principal)}`)} />
      )}
    </div>
  );
}

function Field({ label, value, max }: { label: string; value: string; max?: number }) {
  return (
    <div className="rounded-lg border p-2 min-w-0">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>{label}</span>
        {max && <span className={value.length > max ? "text-red-600 font-semibold" : ""}>{value.length}/{max}</span>}
      </div>
      <p className="font-medium truncate" title={value}>{value || "—"}</p>
    </div>
  );
}

function WhatsPreview({ d }: { d: CopyOut }) {
  return (
    <div className="space-y-3">
      <Phone>
        <div className="bg-[#075e54] text-white px-3 py-2.5 flex items-center gap-2.5 sticky top-0"><div className="w-8 h-8 rounded-full bg-white/25" /><div><p className="font-semibold text-[14px] leading-tight">Sua Marca</p><p className="text-[11px] text-white/70">online</p></div></div>
        <div className="p-3 min-h-[360px]" style={{ background: "#e5ddd5" }}>
          <div className="relative max-w-[88%] ml-auto rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 shadow-sm text-[14px] text-slate-900 leading-[1.4]">
            <Rich text={s(d.mensagem)} />
            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-1">10:42 <CheckCheck className="w-3.5 h-3.5 text-sky-500" /></div>
          </div>
        </div>
      </Phone>
      <div className="flex justify-end"><CopyBtn text={s(d.mensagem)} /></div>
      {arr(d.variacoes).length > 0 && <Alt title="Versões mais curtas" items={arr(d.variacoes).map(s)} rich />}
    </div>
  );
}

function EmailPreview({ d }: { d: CopyOut }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white overflow-hidden text-[14px] text-slate-900 shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50">
          <p className="text-[10px] text-muted-foreground">Caixa de entrada</p>
          <p className="font-semibold truncate">{s(d.assunto)}</p>
          <p className="text-[11px] text-muted-foreground truncate">{s(d.preheader)}</p>
        </div>
        <div className="p-5 space-y-3 leading-relaxed max-h-[520px] overflow-y-auto">
          <Rich text={s(d.corpo)} />
          <div className="text-center py-1"><span className="inline-block rounded-lg bg-primary text-primary-foreground px-5 py-2 font-semibold text-sm">{s(d.botao)}</span></div>
          {s(d.ps) && <p className="text-muted-foreground italic">{s(d.ps)}</p>}
        </div>
      </div>
      <div className="flex justify-end"><CopyBtn text={copyToText("email", d)} /></div>
      {arr(d.variacoes_assunto).length > 0 && <Alt title="Outros assuntos para testar" items={arr(d.variacoes_assunto).map(s)} />}
    </div>
  );
}

/** Protótipo da landing page montado com a copy, seção por seção. */
function LandingPreview({ d }: { d: CopyOut }) {
  const Btn = ({ t }: { t: string }) => t ? <span className="inline-block rounded-lg bg-primary text-primary-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wide">{t}</span> : null;
  const Sec = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) => <section className={`px-4 py-5 ${tone}`}>{children}</section>;
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-[15px] font-extrabold leading-snug mb-1.5">{children}</h3>;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border overflow-hidden bg-white text-slate-900 text-[13px] leading-relaxed max-h-[680px] overflow-y-auto shadow-sm">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] sticky top-0 z-10">
          <span className="w-2 h-2 rounded-full bg-red-400" /><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="ml-2 text-[10px] text-muted-foreground truncate">suapagina.com.br</span>
        </div>

        <Sec tone="bg-slate-900 text-white text-center">
          <h2 className="text-lg font-extrabold leading-tight mb-2 !text-white">{s(d.hero?.titulo)}</h2>
          <p className="text-white/75 mb-3">{s(d.hero?.subtitulo)}</p>
          <Btn t={s(d.hero?.botao)} />
        </Sec>

        {d.problema && <Sec><H>{s(d.problema.titulo)}</H><Rich text={s(d.problema.texto)} className="text-muted-foreground line-clamp-[12]" /></Sec>}
        {d.solucao && <Sec tone="bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]"><H>{s(d.solucao.titulo)}</H><Rich text={s(d.solucao.texto)} className="text-muted-foreground" /></Sec>}

        {arr(d.beneficios).length > 0 && (
          <Sec>
            <H>Benefícios</H>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {arr(d.beneficios).map((b, i) => (
                <div key={i} className="rounded-lg border p-2.5">
                  <Star className="w-3.5 h-3.5 text-primary mb-1" />
                  <p className="font-semibold leading-tight">{s(b.titulo)}</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{s(b.texto)}</p>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {arr(d.como_funciona).length > 0 && (
          <Sec tone="bg-[color-mix(in_srgb,var(--muted)_50%,transparent)]">
            <H>Como funciona</H>
            <div className="space-y-2 mt-2">
              {arr(d.como_funciona).map((b, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div><p className="font-semibold">{s(b.titulo)}</p><p className="text-muted-foreground text-[11px]">{s(b.texto)}</p></div>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {d.oferta && (
          <Sec tone="text-center">
            <div className="rounded-xl border-2 border-primary p-4">
              <H>{s(d.oferta.titulo)}</H>
              <Rich text={s(d.oferta.texto)} className="text-muted-foreground mb-2" />
              {s(d.oferta.preco) && <p className="text-xl font-extrabold text-primary mb-2">{s(d.oferta.preco)}</p>}
              <Btn t={s(d.oferta.botao)} />
            </div>
          </Sec>
        )}

        {d.garantia && (
          <Sec tone="bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]">
            <div className="flex gap-2.5"><ShieldCheck className="w-6 h-6 text-primary flex-shrink-0" /><div><H>{s(d.garantia.titulo)}</H><Rich text={s(d.garantia.texto)} className="text-muted-foreground" /></div></div>
          </Sec>
        )}

        {arr(d.faq).length > 0 && (
          <Sec>
            <H>Perguntas frequentes</H>
            <div className="space-y-1.5 mt-2">
              {arr(d.faq).map((f, i) => (
                <details key={i} className="rounded-lg border px-2.5 py-2 group">
                  <summary className="font-semibold cursor-pointer list-none flex items-center gap-2">{s(f.pergunta)}<ChevronDown className="w-3.5 h-3.5 ml-auto group-open:rotate-180 transition" /></summary>
                  <p className="text-muted-foreground mt-1">{s(f.resposta)}</p>
                </details>
              ))}
            </div>
          </Sec>
        )}

        {d.cta_final && (
          <Sec tone="bg-slate-900 text-white text-center">
            <h3 className="text-base font-extrabold mb-1.5 !text-white">{s(d.cta_final.titulo)}</h3>
            <p className="text-white/75 mb-3">{s(d.cta_final.texto)}</p>
            <Btn t={s(d.cta_final.botao)} />
          </Sec>
        )}
      </div>
      <div className="flex justify-end"><CopyBtn text={copyToText("landing", d)} /></div>
    </div>
  );
}

function Alt({ title, items, rich }: { title: string; items: string[]; rich?: boolean }) {
  return (
    <div>
      <p className="text-[12px] font-semibold mb-1.5">{title}</p>
      <div className="space-y-1.5">
        {items.map((t, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--muted)_50%,transparent)] px-3 py-2 text-[12px]">
            {rich ? <Rich text={t} className="flex-1" /> : <p className="flex-1 whitespace-pre-wrap">{t}</p>}
            <CopyBtn text={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
