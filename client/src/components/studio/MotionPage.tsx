import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Clapperboard, Lightbulb, ScrollText, Mic, Sparkles, RefreshCw, Check, Play, Pause, ArrowLeft, Loader2, Wand2, Plus, X, Eye,
} from "lucide-react";
import { useStudio } from "./store";
import { postLong } from "./runners";
import { playPreview, useVoices } from "./ui";
import { FieldLabel, FormPanel, PageGrid, PageHeader, Pill, PillGroup, PreviewPanel, DownloadButton, useLocalForm } from "./page-kit";

type Formato = "9:16" | "1:1" | "16:9";
interface Cena { texto: string; visual: string; start?: number; end?: number }
interface Palavra { w: string; start: number; end: number }

const SIZE: Record<Formato, { w: number; h: number; cls: string; max: string }> = {
  "9:16": { w: 1080, h: 1920, cls: "aspect-[9/16]", max: "max-w-[270px]" },
  "1:1": { w: 1080, h: 1080, cls: "aspect-square", max: "max-w-[400px]" },
  "16:9": { w: 1920, h: 1080, cls: "aspect-video", max: "max-w-full" },
};
const FORMATOS = [{ v: "9:16", label: "9:16 · Reels" }, { v: "1:1", label: "1:1 · Feed" }, { v: "16:9", label: "16:9 · YouTube" }] as const;
const DURACOES = [{ v: "15", label: "15s" }, { v: "30", label: "30s" }, { v: "60", label: "60s" }] as const;
const ESTILOS = [
  { v: "bold", label: "Bold Reels" }, { v: "clean", label: "Clean" }, { v: "neon", label: "Neon" }, { v: "corporativo", label: "Corporativo" },
] as const;
const PASSOS = [
  { n: 1, label: "Ideia", icon: Lightbulb },
  { n: 2, label: "Roteiro", icon: ScrollText },
  { n: 3, label: "Voz", icon: Mic },
  { n: 4, label: "Motion", icon: Sparkles },
];

const DEFAULTS = {
  passo: 1, ideia: "", formato: "9:16" as Formato, duracao: "30", estilo: "bold", cores: [] as string[],
  cenas: [] as Cena[], voice: "", audioUrl: "", words: [] as Palavra[], timed: [] as Cena[], duration: 0, html: "",
};

export default function MotionPage() {
  const { brief } = useStudio();
  const { toast } = useToast();
  const { catalog } = useVoices();
  const [f, patch, reset] = useLocalForm("motion", DEFAULTS);
  const [busy, setBusy] = useState<"" | "roteiro" | "voz" | "motion">("");
  const [instrucao, setInstrucao] = useState("");
  const colorRef = useRef<HTMLInputElement>(null);

  const call = async <T,>(url: string, body: any, kind: typeof busy, erro: string): Promise<T | null> => {
    setBusy(kind);
    try {
      const r = await apiRequest("POST", url, { ...body, idioma: brief.lang });
      return (await r.json()) as T;
    } catch (e: any) {
      toast({ title: erro, description: e?.message || "Tente novamente", variant: "destructive" });
      return null;
    } finally {
      setBusy("");
    }
  };

  const gerarRoteiro = async (outro = false) => {
    const d = await call<{ cenas: Cena[] }>("/api/ai-studio/motion/script", { ideia: f.ideia, duracao: Number(f.duracao), anterior: outro ? f.cenas : undefined }, "roteiro", "Erro ao criar o roteiro");
    if (d) patch({ cenas: d.cenas, passo: 2, audioUrl: "", words: [], timed: [], duration: 0, html: "" });
  };

  const gerarVoz = async () => {
    const d = await call<{ audioUrl: string; words: Palavra[]; scenes: Cena[]; duration: number }>(
      "/api/ai-studio/motion/voice", { cenas: f.cenas, voice: voice?.voiceId }, "voz", "Erro ao gerar a dublagem");
    if (d) patch({ audioUrl: d.audioUrl, words: d.words, timed: d.scenes, duration: d.duration, html: "", passo: 4 });
  };

  // A animação leva minutos: roda em segundo plano no servidor (ver postLong).
  const gerarMotion = async (comAjuste = false) => {
    setBusy("motion");
    try {
      const d = await postLong<{ html: string }>("/api/ai-studio/motion/animate", {
        scenes: f.timed, duration: f.duration, formato: f.formato, estilo: f.estilo, cores: f.cores, idioma: brief.lang,
        instrucao: comAjuste ? instrucao : undefined, htmlAnterior: comAjuste ? f.html : undefined,
      });
      patch({ html: d.html });
      setInstrucao("");
    } catch (e: any) {
      toast({ title: "Erro ao criar a animação", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const voice = useMemo(() => catalog.find((v) => v.voiceId === f.voice) || catalog[0], [catalog, f.voice]);

  // Exemplo real (feito pelo próprio Motion) mostrado no preview até a pessoa gerar o dela.
  const [exMotion, setExMotion] = useState<typeof DEFAULTS | null>(null);
  useEffect(() => {
    fetch("/studio-examples/motion-lowfy.json").then((r) => (r.ok ? r.json() : null)).then(setExMotion).catch(() => {});
  }, []);
  const mostra = f.html || !exMotion ? f : { ...f, ...exMotion, formato: exMotion.formato as Formato };
  const eExemplo = !f.html && !!exMotion && busy !== "motion";
  const exemplo = () => patch({
    ideia: "3 erros que fazem você perder clientes no Instagram, para donos de pequenos negócios. Termina convidando para seguir o perfil.",
    formato: "9:16", duracao: "30", estilo: "bold",
  });

  const podeIr = (n: number) => n === 1 || (n === 2 && f.cenas.length > 0) || (n === 3 && f.cenas.length > 0) || (n === 4 && !!f.audioUrl);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Clapperboard}
        title="Motion"
        sub="Vídeos animados com narração e legenda, no estilo que viraliza no Instagram."
        tip="frases curtas e um gancho forte no começo prendem a atenção."
      />

      {/* Passos */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
        {PASSOS.map((p, i) => {
          const ativo = f.passo === p.n;
          const feito = f.passo > p.n;
          return (
            <div key={p.n} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={!podeIr(p.n)}
                onClick={() => patch({ passo: p.n })}
                className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-sm font-medium transition disabled:opacity-40 ${
                  ativo ? "bg-primary text-primary-foreground border-primary shadow-sm" : feito ? "bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] text-primary border-[color-mix(in_srgb,var(--primary)_30%,transparent)]" : "bg-card text-muted-foreground"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${ativo ? "bg-white/20" : feito ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {feito ? <Check className="w-3.5 h-3.5" /> : p.n}
                </span>
                {p.label}
              </button>
              {i < PASSOS.length - 1 && <span className="w-4 sm:w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <PageGrid
        form={
          <FormPanel
            icon={PASSOS[f.passo - 1].icon}
            title={["Qual é a ideia do vídeo?", "Aprove o roteiro", "Escolha a voz", "Crie o motion"][f.passo - 1]}
            sub={[
              "Conte em poucas palavras sobre o que é o vídeo e para quem.",
              "A IA dividiu em cenas. Edite o que quiser, peça outro ou aprove.",
              "Ouça as vozes e gere a dublagem. A legenda acompanha a fala.",
              "Escolha o estilo e veja o vídeo animado no preview.",
            ][f.passo - 1]}
            onExample={f.passo === 1 ? exemplo : undefined}
            footer={
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-t pt-4">
                {f.passo > 1 ? (
                  <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => patch({ passo: f.passo - 1 })} disabled={!!busy}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                  </Button>
                ) : (
                  <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => { reset(); setInstrucao(""); }} disabled={!!busy}>Recomeçar</Button>
                )}
                {f.passo === 1 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={f.ideia.trim().length < 5 || !!busy} onClick={() => void gerarRoteiro()}>
                    {busy === "roteiro" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Escrevendo roteiro…</> : <><Wand2 className="w-4 h-4 mr-2" /> Criar roteiro</>}
                  </Button>
                )}
                {f.passo === 2 && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => void gerarRoteiro(true)}>
                      {busy === "roteiro" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Gerar outro roteiro
                    </Button>
                    <Button className="h-11 sm:h-10 sm:min-w-[180px]" disabled={!!busy || !f.cenas.some((c) => c.texto.trim())} onClick={() => patch({ passo: 3 })}>
                      <Check className="w-4 h-4 mr-2" /> Aprovar roteiro
                    </Button>
                  </div>
                )}
                {f.passo === 3 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={!voice || !!busy} onClick={() => void gerarVoz()}>
                    {busy === "voz" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando dublagem…</> : <><Mic className="w-4 h-4 mr-2" /> Gerar dublagem</>}
                  </Button>
                )}
                {f.passo === 4 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={!!busy} onClick={() => void gerarMotion(false)}>
                    {busy === "motion" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Animando… (1 a 3 min)</> : <><Sparkles className="w-4 h-4 mr-2" /> {f.html ? "Criar outra animação" : "Criar animação"}</>}
                  </Button>
                )}
              </div>
            }
          >
            {f.passo === 1 && (
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Sobre o que é o vídeo?</FieldLabel>
                  <Textarea value={f.ideia} onChange={(e) => patch({ ideia: e.target.value })} className="min-h-[120px]"
                    placeholder={"Ex.: 3 erros que fazem você perder clientes no Instagram, para donos de pequenos negócios. Termina convidando para seguir o perfil."} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
                  <div>
                    <FieldLabel>Formato</FieldLabel>
                    <PillGroup options={[...FORMATOS]} value={f.formato} onChange={(v) => patch({ formato: v as Formato, html: "" })} />
                  </div>
                  <div>
                    <FieldLabel>Duração</FieldLabel>
                    <PillGroup options={[...DURACOES]} value={f.duracao} onChange={(v) => patch({ duracao: v })} />
                  </div>
                </div>
              </div>
            )}

            {f.passo === 2 && (
              <div className="space-y-3">
                {f.cenas.map((c, i) => (
                  <div key={i} className="rounded-xl border p-3.5 space-y-2.5 bg-card">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Cena {i + 1}</span>
                      {i === 0 && <span className="text-[10px] text-muted-foreground">gancho</span>}
                      {i === f.cenas.length - 1 && <span className="text-[10px] text-muted-foreground">chamada final</span>}
                      {f.cenas.length > 2 && (
                        <button type="button" onClick={() => patch({ cenas: f.cenas.filter((_, j) => j !== i) })} className="ml-auto text-muted-foreground hover:text-red-600" aria-label="Remover cena">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Textarea value={c.texto} onChange={(e) => patch({ cenas: f.cenas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} className="min-h-[56px] text-[13px]" aria-label="O que o narrador fala" />
                    <div className="flex items-start gap-2">
                      <Eye className="w-3.5 h-3.5 mt-2.5 text-muted-foreground flex-shrink-0" />
                      <Input value={c.visual} onChange={(e) => patch({ cenas: f.cenas.map((x, j) => (j === i ? { ...x, visual: e.target.value } : x)) })} className="h-9 text-xs" aria-label="O que aparece na tela" />
                    </div>
                  </div>
                ))}
                {f.cenas.length < 10 && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => patch({ cenas: [...f.cenas.slice(0, -1), { texto: "", visual: "" }, ...f.cenas.slice(-1)] })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar cena
                  </Button>
                )}
              </div>
            )}

            {f.passo === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catalog.map((v) => {
                  const ativo = voice?.voiceId === v.voiceId;
                  return (
                    <div key={v.voiceId} className={`flex items-center gap-2 rounded-lg border pl-1.5 pr-3 py-1.5 transition ${ativo ? "border-[color-mix(in_srgb,var(--primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)]" : "hover:bg-muted"}`}>
                      <button type="button" onClick={() => playPreview(v.previewUrl)} disabled={!v.previewUrl} className="w-8 h-8 rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] flex items-center justify-center disabled:opacity-40" aria-label={`Ouvir ${v.name}`}>
                        <Play className="w-3.5 h-3.5 text-primary fill-current" />
                      </button>
                      <button type="button" onClick={() => patch({ voice: v.voiceId })} className="flex-1 min-w-0 text-left">
                        <p className={`text-xs font-semibold truncate ${ativo ? "text-primary" : ""}`}>{v.name}</p>
                        {v.tag && <p className="text-[10px] text-muted-foreground truncate">{v.tag}</p>}
                      </button>
                      {ativo && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {f.passo === 4 && (
              <div className="space-y-4">
                <div>
                  <FieldLabel>Estilo visual</FieldLabel>
                  <PillGroup options={[...ESTILOS]} value={f.estilo} onChange={(v) => patch({ estilo: v })} />
                </div>
                <div>
                  <FieldLabel optional>Cores da marca</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {f.cores.map((c, i) => (
                      <button key={`${c}-${i}`} type="button" onClick={() => patch({ cores: f.cores.filter((_, j) => j !== i) })} className="group relative w-8 h-8 rounded-full border shadow-sm" style={{ background: c }} title="Clique para remover">
                        <X className="w-3.5 h-3.5 absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                      </button>
                    ))}
                    {f.cores.length < 5 && (
                      <button type="button" onClick={() => colorRef.current?.click()} className="h-8 px-3 rounded-full border border-dashed flex items-center gap-1.5 text-xs text-muted-foreground hover:bg-muted">
                        <Plus className="w-3.5 h-3.5" /> {f.cores.length ? "" : "Adicionar cor"}
                      </button>
                    )}
                    <input ref={colorRef} type="color" className="sr-only" onChange={(e) => patch({ cores: [...f.cores, e.target.value] })} />
                  </div>
                </div>
                {f.html && (
                  <div>
                    <FieldLabel optional>Quer mudar algo?</FieldLabel>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input value={instrucao} onChange={(e) => setInstrucao(e.target.value)} placeholder="Ex.: deixa a cena 2 mais chamativa, números maiores" />
                      <Button variant="outline" className="h-10 flex-shrink-0" disabled={instrucao.trim().length < 3 || !!busy} onClick={() => void gerarMotion(true)}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Aplicar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </FormPanel>
        }
        preview={
          <PreviewPanel
            busy={busy === "motion"}
            icon={Eye}
            sub={f.html ? "Dê play para ver o motion com voz e legenda." : eExemplo ? "Exemplo real feito aqui no Motion. Dê play! O seu aparece no lugar." : f.audioUrl ? "A dublagem está pronta. Agora crie a animação." : "O vídeo aparece aqui depois dos passos."}
            actions={<><DownloadButton url={f.audioUrl || null} label="Baixar áudio" /><Button variant="outline" className="h-10 w-full" disabled title="Em breve: exportar em MP4">MP4 em breve</Button></>}
          >
            <div className="relative">
              {eExemplo && <span className="absolute -top-2 right-0 z-20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-[color-mix(in_srgb,var(--muted)_100%,transparent)] rounded px-1.5 py-0.5">Exemplo</span>}
              <MotionPlayer
                key={eExemplo ? "exemplo" : "meu"}
                html={busy === "motion" && !f.html ? "" : mostra.html}
                audioUrl={busy === "motion" && !f.html ? "" : mostra.audioUrl}
                words={mostra.words} scenes={mostra.timed} duration={mostra.duration} formato={mostra.formato} busy={busy === "motion"}
              />
            </div>
          </PreviewPanel>
        }
      />
    </div>
  );
}

/**
 * Player: a animação do Claude roda isolada num iframe (sandbox sem acesso ao site) e recebe
 * o tempo do áudio a cada quadro via postMessage. A legenda é desenhada aqui por cima.
 */
function MotionPlayer({ html, audioUrl, words, scenes, duration, formato, busy }: {
  html: string; audioUrl: string; words: Palavra[]; scenes: Cena[]; duration: number; formato: Formato; busy: boolean;
}) {
  const size = SIZE[formato];
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [scale, setScale] = useState(0.25);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / size.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w]);

  const srcDoc = useMemo(() => {
    if (!html) return "";
    const data = JSON.stringify({ duration, width: size.w, height: size.h, scenes, palette: [] }).replace(/</g, "\\u003c");
    const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob:;">
<script>window.MOTION=${data};window.addEventListener("message",function(e){var d=e.data;if(d&&typeof d.t==="number"&&typeof window.renderFrame==="function"){try{window.renderFrame(d.t)}catch(err){}}});</script>`;
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
  }, [html, duration, scenes, size.w, size.h]);

  // Loop do play: manda o tempo do áudio para a animação a cada quadro.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      const now = a ? a.currentTime : 0;
      setT(now);
      frameRef.current?.contentWindow?.postMessage({ t: now }, "*");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };

  // Legenda: grupo de até 4 palavras ao redor da palavra falada agora.
  const legenda = useMemo(() => {
    if (!words.length) return null;
    let i = words.findIndex((w) => t >= w.start && t < w.end + 0.15);
    if (i < 0) i = words.findIndex((w) => w.start > t) - 1;
    if (i < 0) return null;
    const ini = Math.floor(i / 4) * 4;
    return { grupo: words.slice(ini, ini + 4), ativo: i - ini };
  }, [words, t]);

  return (
    <div className={`mx-auto w-full ${size.max}`}>
      <div ref={boxRef} className={`${size.cls} w-full rounded-xl overflow-hidden border relative bg-slate-900`}>
        {html ? (
          <iframe
            ref={frameRef}
            title="Motion"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            onLoad={() => frameRef.current?.contentWindow?.postMessage({ t }, "*")}
            style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, pointerEvents: "none" }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-5 text-white">
            {busy ? <Loader2 className="w-8 h-8 animate-spin text-emerald-400" /> : <Clapperboard className="w-8 h-8 text-white/60" />}
            <p className="text-sm font-semibold">{busy ? "O Claude está animando seu vídeo…" : `${formato} · Motion`}</p>
            <p className="text-xs text-white/60">{busy ? "Leva de 1 a 3 minutos" : "Ideia → roteiro → voz → animação"}</p>
          </div>
        )}

        {legenda && (
          <div className="absolute inset-x-0 flex justify-center px-[6%] pointer-events-none" style={{ bottom: formato === "9:16" ? "24%" : "12%" }}>
            <p className="text-center font-extrabold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]" style={{ fontSize: Math.max(12, 64 * scale) }}>
              {legenda.grupo.map((w, k) => (
                <span key={k} className={k === legenda.ativo ? "text-yellow-300" : "text-white"}>{w.w} </span>
              ))}
            </p>
          </div>
        )}

        {audioUrl && (
          <button type="button" onClick={toggle} className="absolute inset-0 flex items-center justify-center group" aria-label={playing ? "Pausar" : "Tocar"}>
            {!playing && (
              <span className="w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm group-hover:scale-105 transition">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </span>
            )}
          </button>
        )}
      </div>

      {audioUrl && (
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={toggle} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0" aria-label={playing ? "Pausar" : "Tocar"}>
            {playing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${duration ? Math.min(100, (t / duration) * 100) : 0}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">{t.toFixed(0)}s/{duration.toFixed(0)}s</span>
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setT(0); frameRef.current?.contentWindow?.postMessage({ t: 0 }, "*"); }}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
