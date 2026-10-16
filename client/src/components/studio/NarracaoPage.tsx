import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mic, Settings2, Play, Pause, Download, Copy as CopyIcon, Check, User, AudioLines, Gauge, Clock, Wand2,
  UserRound, CircleDot, Loader2,
} from "lucide-react";
import { useStudio } from "./store";
import { genTts } from "./runners";
import { playPreview, useVoices } from "./ui";
import type { StudioVoice } from "./ui";
import {
  CharCount, FieldLabel, FormFooter, FormPanel, MissingHint, PageGrid, PageHeader, PillGroup, PreviewPanel, DownloadButton, FullscreenButton,
  UploadBox, missingOf, selectCls, useLocalForm,
} from "./page-kit";
import type { UploadedFile } from "./page-kit";

const MAX = 2000;
const OBJETIVOS = ["Anúncio / propaganda", "Vídeo de vendas (VSL)", "Apresentação de produto", "Tutorial / explicação", "Conteúdo para redes", "Atendimento / URA"];
const LANGS = [{ v: "pt-BR", label: "Português (BR)" }, { v: "en-US", label: "English (US)" }, { v: "es-ES", label: "Español" }];
const TIPOS = [
  { v: "fem", label: "Feminina", icon: UserRound }, { v: "masc", label: "Masculina", icon: User }, { v: "neutra", label: "Neutra", icon: AudioLines },
] as const;
const ESTILOS = [
  { v: "natural", label: "Natural" }, { v: "calma", label: "Calma" }, { v: "energica", label: "Enérgica" }, { v: "profissional", label: "Profissional" },
] as const;
const VELOCIDADES = [{ v: "lenta", label: "Lenta" }, { v: "normal", label: "Normal" }, { v: "rapida", label: "Rápida" }] as const;
const PAUSAS = [{ v: "suave", label: "Suave" }, { v: "normal", label: "Normal" }] as const;

// Estilo e velocidade viram parâmetros do ElevenLabs.
const STYLE_PARAMS: Record<string, { stability: number; similarityBoost: number; style: number }> = {
  natural: { stability: 0.5, similarityBoost: 0.75, style: 0 },
  calma: { stability: 0.75, similarityBoost: 0.75, style: 0 },
  energica: { stability: 0.3, similarityBoost: 0.8, style: 0.55 },
  profissional: { stability: 0.65, similarityBoost: 0.85, style: 0.15 },
};
const SPEED: Record<string, number> = { lenta: 0.85, normal: 1, rapida: 1.15 };
const LABEL = (list: readonly { v: string; label: string }[], v: string) => list.find((x) => x.v === v)?.label || v;

const SAMPLE_TEXT = "Conheça o nosso novo produto. Qualidade e praticidade para o seu dia a dia. Tudo o que você precisa, com a confiança de sempre.";

const DEFAULTS = {
  texto: "", objetivo: "", tipo: "fem" as string, estilo: "natural" as string, velocidade: "normal" as string,
  pausa: "suave" as string, observacoes: "", voiceId: "", referencia: [] as UploadedFile[],
};

const genderOf = (v: StudioVoice) => {
  const g = String(v.gender || "").toLowerCase();
  return g.startsWith("f") ? "fem" : g.startsWith("m") ? "masc" : "neutra";
};

/** Pausa suave: um respiro a mais entre as frases (tag de pausa do ElevenLabs). */
const withPauses = (text: string, pausa: string) =>
  pausa === "suave" ? text.replace(/([.!?])\s+(?=\S)/g, '$1 <break time="0.5s" /> ') : text;

export default function NarracaoPage() {
  const { brief, patchBrief, script, addAsset } = useStudio();
  const { toast } = useToast();
  const { catalog, refetch } = useVoices();
  const [f, patch, reset] = useLocalForm("narracao", { ...DEFAULTS, texto: script || "" });
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const voices = useMemo(() => {
    const list = f.tipo === "neutra" ? catalog : catalog.filter((v) => genderOf(v) === f.tipo);
    return list.length ? list : catalog;
  }, [catalog, f.tipo]);
  const voice = voices.find((v) => v.voiceId === f.voiceId) || voices[0];

  const missing = missingOf([["texto", f.texto], ["objetivo", f.objetivo]]);

  const run = async () => {
    if (f.texto.length > MAX) return toast({ title: "Texto muito longo", description: `O limite é ${MAX} caracteres.`, variant: "destructive" });
    setBusy(true);
    try {
      let voiceId = voice?.voiceId || brief.voice;
      // Áudio de referência: clona a voz e usa ela na narração.
      if (f.referencia.length) {
        const r = await apiRequest("POST", "/api/ai-studio/clone-voice", { name: `Referência ${new Date().toLocaleDateString("pt-BR")}`, samples: f.referencia });
        voiceId = ((await r.json()) as { voiceId: string }).voiceId;
        patch({ referencia: [] });
        refetch();
      }
      patchBrief({ voice: voiceId });
      const d = await genTts({ ...brief, voice: voiceId }, {
        text: withPauses(f.texto, f.pausa),
        modelId: "eleven_multilingual_v2",
        speed: SPEED[f.velocidade] ?? 1,
        ...(STYLE_PARAMS[f.estilo] || STYLE_PARAMS.natural),
      });
      setUrl(d.url);
      addAsset({ kind: "audio", url: d.url, label: f.texto.slice(0, 40) || "Narração", from: "Narração" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar narração", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const transcript = f.texto.trim() || SAMPLE_TEXT;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Mic}
        title="Narração IA"
        sub="Crie locuções naturais para seus anúncios, vídeos e apresentações em poucos passos."
        tip="textos mais curtos geram narrações mais claras e naturais."
      />

      <PageGrid
        form={
          <FormPanel
            icon={Settings2}
            title="Configurações da narração"
            sub="Escreva o texto e escolha como a voz deve soar."
            footer={
              <div className="space-y-3">
                <FormFooter onClear={() => { reset(); setUrl(null); }} onSubmit={() => void run()} busy={busy} disabled={missing.length > 0} label="Gerar narração" busyLabel="Gravando…" icon={Wand2} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div>
              <FieldLabel required>Texto da narração</FieldLabel>
              <Textarea
                value={f.texto}
                onChange={(e) => patch({ texto: e.target.value })}
                placeholder={"Digite aqui o texto que será narrado...\nEx.: Conheça o nosso novo produto. Qualidade e praticidade para o seu dia a dia."}
                className="min-h-[96px]"
              />
              <CharCount value={f.texto} max={MAX} />
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
              <div>
                <FieldLabel required>Objetivo</FieldLabel>
                <select value={f.objetivo} onChange={(e) => patch({ objetivo: e.target.value })} className={selectCls}>
                  <option value="">Selecione o objetivo da narração</option>
                  {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Idioma</FieldLabel>
                <select value={brief.lang} onChange={(e) => patchBrief({ lang: e.target.value })} className={selectCls}>
                  {LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
                </select>
              </div>

              <div>
                <FieldLabel required>Tipo de voz</FieldLabel>
                <PillGroup options={[...TIPOS]} value={f.tipo} onChange={(v) => patch({ tipo: v, voiceId: "" })} />
              </div>
              <div>
                <FieldLabel>Estilo da voz</FieldLabel>
                <PillGroup options={ESTILOS.map((e) => ({ ...e, icon: f.estilo === e.v ? CircleDot : undefined }))} value={f.estilo} onChange={(v) => patch({ estilo: v })} />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Voz</FieldLabel>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {voices.map((v) => {
                    const active = voice?.voiceId === v.voiceId;
                    return (
                      <div key={v.voiceId} className={`flex items-center gap-2 rounded-lg border pl-1.5 pr-3 py-1.5 flex-shrink-0 transition ${active ? "border-[color-mix(in_srgb,var(--primary)_50%,transparent)] bg-accent" : "hover:bg-muted"}`}>
                        <button type="button" onClick={() => playPreview(v.previewUrl)} disabled={!v.previewUrl} className="w-7 h-7 rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] disabled:opacity-40" title="Ouvir amostra">
                          <Play className="w-3 h-3 text-primary fill-primary" />
                        </button>
                        <button type="button" onClick={() => patch({ voiceId: v.voiceId })} className="text-left">
                          <p className={`text-xs font-semibold ${active ? "text-primary" : ""}`}>{v.name}</p>
                          {v.tag && <p className="text-[10px] text-muted-foreground max-w-[130px] truncate">{v.tag}</p>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>Velocidade</FieldLabel>
                <PillGroup options={VELOCIDADES.map((e) => ({ ...e, icon: f.velocidade === e.v ? Gauge : undefined }))} value={f.velocidade} onChange={(v) => patch({ velocidade: v })} />
              </div>
              <div>
                <FieldLabel>Pausa entre frases</FieldLabel>
                <PillGroup options={PAUSAS.map((e) => ({ ...e, icon: f.pausa === e.v ? CircleDot : undefined }))} value={f.pausa} onChange={(v) => patch({ pausa: v })} />
              </div>

              <div>
                <FieldLabel optional>Áudio de referência</FieldLabel>
                <UploadBox
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm"
                  hint="MP3 ou WAV (máx. 10 MB) — a IA clona essa voz"
                  label="Clique para enviar um arquivo ou arraste aqui"
                  maxMb={10}
                  value={f.referencia}
                  onChange={(v) => patch({ referencia: v })}
                />
              </div>
              <div>
                <FieldLabel optional>Observações</FieldLabel>
                <Textarea value={f.observacoes} onChange={(e) => patch({ observacoes: e.target.value })} placeholder="Ex.: pronúncia de palavras, tom específico, etc." className="min-h-[64px]" />
              </div>
            </div>
          </FormPanel>
        }
        preview={
          <PreviewPanel
            busy={busy}
            icon={Play}
            sub={url ? "Sua narração está pronta." : "Ouça como sua narração poderá ficar."}
            actions={
              <>
                <Button variant="outline" className="h-10" onClick={() => playPreview(voice?.previewUrl)} disabled={!voice?.previewUrl}>
                  <Play className="w-4 h-4 mr-2" /> Ouvir amostra
                </Button>
                <DownloadButton url={url} label="Baixar áudio" />
              </>
            }
          >
            <WavePlayer url={url} busy={busy} seed={transcript} />

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-semibold">{url ? "Transcrição" : "Transcrição da amostra"}</p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(transcript); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center"
                  aria-label="Copiar transcrição"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <CopyIcon className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">{transcript}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat icon={User} label="Voz" value={voice?.name || LABEL(TIPOS, f.tipo)} />
              <Stat icon={AudioLines} label="Estilo" value={LABEL(ESTILOS, f.estilo)} />
              <Stat icon={Gauge} label="Velocidade" value={LABEL(VELOCIDADES, f.velocidade)} />
              <Stat icon={Clock} label="Duração" value={fmt(estimateSec(transcript, f.velocidade))} />
            </div>
          </PreviewPanel>
        }
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2.5 flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-primary" /></div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

// ~15 caracteres por segundo numa locução comercial.
const estimateSec = (t: string, vel: string) => Math.max(1, Math.round(t.length / 15 / (SPEED[vel] ?? 1)));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Player com forma de onda. Sem áudio, mostra a onda decorativa da amostra. */
function WavePlayer({ url, busy, seed }: { url: string | null; busy: boolean; seed: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  const bars = useMemo(() => {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 56 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      const env = Math.sin((i / 56) * Math.PI) * 0.6 + 0.4;
      return 0.18 + ((h % 1000) / 1000) * 0.82 * env;
    });
  }, [seed]);

  useEffect(() => { setPlaying(false); setT(0); }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };

  const progress = dur ? t / dur : 0;

  return (
    <div className="rounded-xl bg-gradient-to-br from-[color-mix(in_srgb,var(--accent)_70%,transparent)] to-[color-mix(in_srgb,var(--accent)_30%,transparent)] p-5 relative">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={!url}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition disabled:opacity-70 disabled:hover:scale-100 flex-shrink-0"
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-[3px] h-14 cursor-pointer"
            onClick={(e) => {
              const a = audioRef.current;
              if (!a || !dur) return;
              const r = e.currentTarget.getBoundingClientRect();
              a.currentTime = ((e.clientX - r.left) / r.width) * dur;
            }}
          >
            {bars.map((b, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full bg-primary transition-opacity ${busy ? "animate-pulse" : ""}`}
                style={{ height: `${b * 100}%`, opacity: i / bars.length < progress ? 1 : 0.35 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>{fmt(t)}</span>
            <span>{busy ? "gerando…" : url ? fmt(dur) : "amostra"}</span>
          </div>
        </div>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          className="hidden"
        />
      )}
    </div>
  );
}

