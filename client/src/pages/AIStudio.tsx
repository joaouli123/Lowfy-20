import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, Image as ImageIcon, Type, Mic, Video, UserSquare2,
  Loader2, Copy, Download, Wand2, RefreshCw, Check, Upload, History, Volume2,
  AudioWaveform, Trash2, X,
} from "lucide-react";

const COPY_TYPES = [
  { v: "headline", label: "Headlines" },
  { v: "anuncio", label: "Texto de anúncio" },
  { v: "vsl", label: "Roteiro de VSL" },
  { v: "email", label: "E-mail de vendas" },
  { v: "legenda", label: "Legenda p/ redes" },
  { v: "cta", label: "CTA" },
];
const FRAMEWORKS = [
  { v: "auto", label: "Automático" },
  { v: "AIDA", label: "AIDA" },
  { v: "PAS", label: "PAS" },
  { v: "BAB", label: "BAB" },
  { v: "4P", label: "4P" },
  { v: "FAB", label: "FAB" },
];
const TTS_VOICES = [
  { v: "nova", label: "Nova" },
  { v: "shimmer", label: "Shimmer" },
  { v: "alloy", label: "Alloy" },
  { v: "echo", label: "Echo" },
  { v: "fable", label: "Fable" },
  { v: "onyx", label: "Onyx" },
  { v: "verse", label: "Verse" },
  { v: "ballad", label: "Ballad" },
];
const VIDEO_FORMATS = [
  { v: "1080x1080", label: "Quadrado", sub: "Feed" },
  { v: "1080x1920", label: "Vertical", sub: "Story / Reels" },
  { v: "1920x1080", label: "Horizontal", sub: "YouTube" },
];
const IMG_STYLES = [
  "Fotográfico", "Minimalista", "Gradiente", "Estúdio", "3D realista", "Vibrante", "Cinematográfico", "Flat / clean",
];
const IMG_RATIOS = [
  { v: "1:1", label: "1:1", cls: "aspect-square" },
  { v: "4:5", label: "4:5", cls: "aspect-[4/5]" },
  { v: "9:16", label: "9:16", cls: "aspect-[9/16]" },
  { v: "16:9", label: "16:9", cls: "aspect-video" },
];
const TOM_PRESETS = [
  "Animado e persuasivo", "Calmo e confiável", "Urgente", "Amigável", "Profissional", "Storytelling",
];

type Hist = { type: "image" | "audio" | "video"; url: string; label: string };

// ---- helpers de UI ----
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70 leading-snug">{hint}</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg border transition ${
        active
          ? "bg-accent text-accent-foreground border-primary/30 shadow-sm"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ProviderBadge({ free, premium }: { free: string; premium: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {free}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5">
        <Sparkles className="w-3 h-3" /> Premium: {premium}
      </span>
    </div>
  );
}

function CanvasShell({ children, ratio = "aspect-[4/3]" }: { children: React.ReactNode; ratio?: string }) {
  return (
    <div className={`w-full ${ratio} rounded-xl border bg-muted/30 flex items-center justify-center overflow-hidden`}>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-card border border-dashed flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
        <span>{label}</span><span className="font-medium text-foreground">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-primary h-1.5 cursor-pointer" />
    </div>
  );
}

export default function AIStudio() {
  const { toast } = useToast();
  const [history, setHistory] = useState<Hist[]>([]);
  const pushHist = (h: Hist) => setHistory((p) => [h, ...p].slice(0, 12));

  // ---- Histórico persistente (todas as gerações) ----
  const [histType, setHistType] = useState("all");
  const [histQ, setHistQ] = useState("");
  const { data: hist = [], refetch: refetchHist, isFetching: histLoading } = useQuery({
    queryKey: ["/api/ai-studio/history", histType, histQ],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (histType !== "all") p.set("type", histType);
      if (histQ) p.set("q", histQ);
      const r = await apiRequest("GET", `/api/ai-studio/history?${p.toString()}`);
      return (await r.json()) as any[];
    },
    staleTime: 0,
  });
  const delHist = async (id: string) => { try { await apiRequest("DELETE", `/api/ai-studio/history/${id}`); refetchHist(); } catch {} };

  // ---- Criativo (imagem) ----
  const [img, setImg] = useState({ produto: "", estilo: "", headline: "", publico: "", ratio: "1:1", quality: "high", format: "png", background: "auto" });
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const imageMut = useMutation({
    mutationFn: async () => {
      const size = img.ratio === "16:9" ? "1536x1024" : (img.ratio === "9:16" || img.ratio === "4:5") ? "1024x1536" : "1024x1024";
      const r = await apiRequest("POST", "/api/ai-studio/image", { ...img, size });
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => { setImgUrl(d.url); pushHist({ type: "image", url: d.url, label: img.produto || "Criativo" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" }),
  });

  // ---- Copy ----
  const [copy, setCopy] = useState({ produto: "", publico: "", dor: "", beneficios: "", oferta: "", tipo: "headline", framework: "auto", variacoes: 5 });
  const [copyOut, setCopyOut] = useState<string[]>([]);
  const copyMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/copy", copy);
      return (await r.json()) as { variacoes: string[] };
    },
    onSuccess: (d) => setCopyOut(d.variacoes || []),
    onError: (e: any) => toast({ title: "Erro ao gerar copy", description: e.message, variant: "destructive" }),
  });

  // ---- Narração (TTS) ----
  const [tts, setTts] = useState({ text: "", voice: "nova", instructions: "", modelId: "eleven_multilingual_v2", stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 });
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const ttsMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/tts", tts);
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => { setTtsUrl(d.url); pushHist({ type: "audio", url: d.url, label: "Narração" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar narração", description: e.message, variant: "destructive" }),
  });

  // ---- Avatar (foto + texto → vídeo) ----
  const [avatar, setAvatar] = useState<{ photo: string | null; text: string; voice: string; size: string }>({ photo: null, text: "", voice: "nova", size: "1080x1080" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/avatar", { imageUrl: avatar.photo, text: avatar.text, voice: avatar.voice, size: avatar.size });
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => { setAvatarUrl(d.url); pushHist({ type: "video", url: d.url, label: "Avatar" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar avatar", description: e.message, variant: "destructive" }),
  });

  // ---- Vídeo (Seedance 2.0) ----
  const [vid, setVid] = useState({ prompt: "", script: "", voice: "nova", size: "1080x1080", resolution: "720p", duration: "auto", imageUrl: "" });
  const [vidUrl, setVidUrl] = useState<string | null>(null);
  const videoMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/video", vid);
      return (await r.json()) as { url: string };
    },
    onSuccess: (d) => { setVidUrl(d.url); pushHist({ type: "video", url: d.url, label: vid.prompt || "Vídeo" }); },
    onError: (e: any) => toast({ title: "Erro ao gerar vídeo", description: e.message, variant: "destructive" }),
  });

  // ---- Clonagem de voz (ElevenLabs) ----
  const { data: voicesData, refetch: refetchVoices } = useQuery({
    queryKey: ["/api/ai-studio/voices"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ai-studio/voices");
      return (await r.json()) as { voices: { voiceId: string; name: string; category?: string }[] };
    },
  });
  const clonedVoices = (voicesData?.voices || []).filter((v) => v.category === "cloned" || v.category === "professional" || v.category === "generated");
  const [cloneName, setCloneName] = useState("");
  const [cloneSamples, setCloneSamples] = useState<{ data: string; type: string; name: string }[]>([]);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const cloneMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-studio/clone-voice", { name: cloneName, samples: cloneSamples });
      return (await r.json()) as { voiceId: string; requiresVerification?: boolean };
    },
    onSuccess: (d) => { setClonedVoiceId(d.voiceId); refetchVoices(); toast({ title: "Voz clonada com sucesso!", description: `Já disponível na narração.` }); },
    onError: (e: any) => toast({ title: "Erro ao clonar voz", description: e.message, variant: "destructive" }),
  });
  const onSamplePick = (files?: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 5).forEach((f) => {
      if (f.size > 12 * 1024 * 1024) { toast({ title: "Áudio muito grande", description: "Use até 12MB por amostra.", variant: "destructive" }); return; }
      const reader = new FileReader();
      reader.onload = () => setCloneSamples((s) => [...s, { data: String(reader.result), type: f.type || "audio/mpeg", name: f.name }].slice(0, 5));
      reader.readAsDataURL(f);
    });
  };

  const onPhotoPick = (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Foto muito grande", description: "Use uma imagem de até 8MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar((a) => ({ ...a, photo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "Copiado!" });
  };

  const ratioCls = IMG_RATIOS.find((r) => r.v === img.ratio)?.cls || "aspect-square";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent border border-primary/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_0%,hsl(161,84%,33%,0.10),transparent)]" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/25 flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Estúdio de Criação IA</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Criativos, copy persuasiva, narração realista, avatar lip-sync e vídeos — tudo num só lugar.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-lg bg-card/60 border px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Funciona grátis · upgrade premium ao conectar suas chaves
          </div>
        </div>
      </div>

      <Tabs defaultValue="criativo" orientation="vertical" className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-start">
        <TabsList className="flex lg:flex-col h-auto w-full lg:w-52 shrink-0 gap-1 bg-card border rounded-xl p-2 lg:sticky lg:top-20 overflow-x-auto">
          <p className="hidden lg:block px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Ferramentas</p>
          <TabsTrigger value="criativo" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><ImageIcon className="w-4 h-4" /> Criativo</TabsTrigger>
          <TabsTrigger value="copy" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><Type className="w-4 h-4" /> Copy</TabsTrigger>
          <TabsTrigger value="narracao" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><Mic className="w-4 h-4" /> Narração</TabsTrigger>
          <TabsTrigger value="avatar" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><UserSquare2 className="w-4 h-4" /> Avatar</TabsTrigger>
          <TabsTrigger value="video" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><Video className="w-4 h-4" /> Vídeo</TabsTrigger>
          <TabsTrigger value="clonar" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><AudioWaveform className="w-4 h-4" /> Clonar Voz</TabsTrigger>
          <TabsTrigger value="historico" className="lg:w-full lg:justify-start gap-2 text-sm px-3 py-2.5"><History className="w-4 h-4" /> Histórico</TabsTrigger>
        </TabsList>

        {/* ---------- CRIATIVO ---------- */}
        <TabsContent value="criativo" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="Flux" premium="GPT-Image" />
                <Field label="Produto / oferta *">
                  <Input value={img.produto} onChange={(e) => setImg({ ...img, produto: e.target.value })} placeholder="Ex.: tênis esportivo branco premium" />
                </Field>
                <Field label="Headline na imagem">
                  <Input value={img.headline} onChange={(e) => setImg({ ...img, headline: e.target.value })} placeholder="Ex.: 50% OFF HOJE" />
                </Field>
                <Field label="Proporção">
                  <div className="flex flex-wrap gap-1.5">
                    {IMG_RATIOS.map((r) => (
                      <Chip key={r.v} active={img.ratio === r.v} onClick={() => setImg({ ...img, ratio: r.v })}>{r.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Estilo visual" hint="Clique num preset ou escreva o seu.">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {IMG_STYLES.map((s) => (
                      <Chip key={s} active={img.estilo === s} onClick={() => setImg({ ...img, estilo: s })}>{s}</Chip>
                    ))}
                  </div>
                  <Input value={img.estilo} onChange={(e) => setImg({ ...img, estilo: e.target.value })} placeholder="Ex.: fundo gradiente, luz de estúdio…" />
                </Field>
                <Field label="Público-alvo">
                  <Input value={img.publico} onChange={(e) => setImg({ ...img, publico: e.target.value })} placeholder="Ex.: corredores iniciantes" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Qualidade">
                    <div className="flex flex-wrap gap-1.5">
                      {[["high", "Alta"], ["medium", "Média"], ["low", "Baixa"]].map(([v, l]) => (
                        <Chip key={v} active={img.quality === v} onClick={() => setImg({ ...img, quality: v })}>{l}</Chip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Formato">
                    <div className="flex flex-wrap gap-1.5">
                      {["png", "jpeg", "webp"].map((f) => (
                        <Chip key={f} active={img.format === f} onClick={() => setImg({ ...img, format: f })}>{f.toUpperCase()}</Chip>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Fundo" hint="Transparente exige PNG/WebP (ideal p/ logos e recortes).">
                  <div className="flex flex-wrap gap-1.5">
                    {[["auto", "Automático"], ["opaque", "Opaco"], ["transparent", "Transparente"]].map(([v, l]) => (
                      <Chip key={v} active={img.background === v} onClick={() => setImg({ ...img, background: v, format: v === "transparent" && img.format === "jpeg" ? "png" : img.format })}>{l}</Chip>
                    ))}
                  </div>
                </Field>
                <Button className="w-full shadow-sm" disabled={imageMut.isPending || !img.produto} onClick={() => imageMut.mutate()}>
                  {imageMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  {imgUrl ? "Gerar novamente" : "Gerar criativo"}
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <CanvasShell ratio={ratioCls}>
                  {imageMut.isPending ? (
                    <Loading label="Gerando seu criativo…" />
                  ) : imgUrl ? (
                    <img src={imgUrl} alt="Criativo gerado" className="w-full h-full object-cover" />
                  ) : (
                    <EmptyState icon={ImageIcon} title="Seu criativo aparecerá aqui" sub="Preencha os campos e clique em Gerar" />
                  )}
                </CanvasShell>
                {imgUrl && !imageMut.isPending && (
                  <div className="flex gap-2 mt-3">
                    <a href={imgUrl} download className="flex-1"><Button variant="outline" size="sm" className="w-full"><Download className="w-3.5 h-3.5 mr-1.5" />Baixar</Button></a>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => imageMut.mutate()}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Variar</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toast({ title: "Edição no Canva", description: "Conecte sua conta Canva nas configurações." })}>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />Canva
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- COPY ---------- */}
        <TabsContent value="copy" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="Gemini" premium="GPT-4o" />
                <Field label="Produto / oferta *">
                  <Input value={copy.produto} onChange={(e) => setCopy({ ...copy, produto: e.target.value })} placeholder="Ex.: Curso de marketing do zero" />
                </Field>
                <Field label="Tipo de copy">
                  <div className="flex flex-wrap gap-1.5">
                    {COPY_TYPES.map((t) => (
                      <Chip key={t.v} active={copy.tipo === t.v} onClick={() => setCopy({ ...copy, tipo: t.v })}>{t.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Framework de copywriting">
                  <div className="flex flex-wrap gap-1.5">
                    {FRAMEWORKS.map((f) => (
                      <Chip key={f.v} active={copy.framework === f.v} onClick={() => setCopy({ ...copy, framework: f.v })}>{f.label}</Chip>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Público-alvo">
                    <Input value={copy.publico} onChange={(e) => setCopy({ ...copy, publico: e.target.value })} placeholder="Ex.: iniciantes" />
                  </Field>
                  <Field label="Dor principal">
                    <Input value={copy.dor} onChange={(e) => setCopy({ ...copy, dor: e.target.value })} placeholder="Ex.: não sabem começar" />
                  </Field>
                </div>
                <Field label="Benefícios / oferta">
                  <Textarea rows={2} value={copy.beneficios} onChange={(e) => setCopy({ ...copy, beneficios: e.target.value })} placeholder="Ex.: método passo a passo, suporte, garantia" />
                </Field>
                <Field label="Variações">
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 5, 8, 10].map((n) => (
                      <Chip key={n} active={copy.variacoes === n} onClick={() => setCopy({ ...copy, variacoes: n })}>{n}</Chip>
                    ))}
                  </div>
                </Field>
                <Button className="w-full shadow-sm" disabled={copyMut.isPending || !copy.produto} onClick={() => copyMut.mutate()}>
                  {copyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Gerar copy
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 min-h-[340px]">
                {copyMut.isPending ? (
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2 animate-pulse">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : copyOut.length ? (
                  <div className="space-y-2.5">
                    {copyOut.map((c, i) => (
                      <div key={i} className="group rounded-lg border p-3 text-sm whitespace-pre-wrap relative hover:border-primary/30 hover:bg-muted/30 transition">
                        {c}
                        <button onClick={() => copyToClipboard(c)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"><Copy className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full min-h-[300px] flex items-center justify-center">
                    <EmptyState icon={Type} title="Suas copies aparecerão aqui" sub="Escolha tipo, framework e clique em Gerar" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- NARRAÇÃO ---------- */}
        <TabsContent value="narracao" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="Google TTS pt-BR" premium="ElevenLabs" />
                <Field label="Texto para narrar *">
                  <Textarea rows={5} value={tts.text} onChange={(e) => setTts({ ...tts, text: e.target.value })} placeholder="Cole o roteiro/texto da narração…" />
                </Field>
                <Field label="Voz" hint={clonedVoices.length ? "Inclui suas vozes clonadas." : undefined}>
                  <div className="flex flex-wrap gap-1.5">
                    {clonedVoices.map((v) => (
                      <Chip key={v.voiceId} active={tts.voice === v.voiceId} onClick={() => setTts({ ...tts, voice: v.voiceId })}><AudioWaveform className="w-3.5 h-3.5" />{v.name}</Chip>
                    ))}
                    {TTS_VOICES.map((v) => (
                      <Chip key={v.v} active={tts.voice === v.v} onClick={() => setTts({ ...tts, voice: v.v })}><Volume2 className="w-3.5 h-3.5" />{v.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Modelo (ElevenLabs)">
                  <div className="flex flex-wrap gap-1.5">
                    {[["eleven_v3", "v3 · expressivo"], ["eleven_multilingual_v2", "Multilingual v2"], ["eleven_flash_v2_5", "Flash · rápido"]].map(([v, l]) => (
                      <Chip key={v} active={tts.modelId === v} onClick={() => setTts({ ...tts, modelId: v })}>{l}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Ajustes de voz">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <Slider label="Estabilidade" value={tts.stability} min={0} max={1} step={0.05} onChange={(n) => setTts({ ...tts, stability: n })} />
                    <Slider label="Similaridade" value={tts.similarityBoost} min={0} max={1} step={0.05} onChange={(n) => setTts({ ...tts, similarityBoost: n })} />
                    <Slider label="Estilo" value={tts.style} min={0} max={1} step={0.05} onChange={(n) => setTts({ ...tts, style: n })} />
                    <Slider label="Velocidade" value={tts.speed} min={0.7} max={1.2} step={0.05} onChange={(n) => setTts({ ...tts, speed: n })} />
                  </div>
                </Field>
                <Field label="Tom (emoção)">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {TOM_PRESETS.map((t) => (
                      <Chip key={t} active={tts.instructions === t} onClick={() => setTts({ ...tts, instructions: t })}>{t}</Chip>
                    ))}
                  </div>
                  <Input value={tts.instructions} onChange={(e) => setTts({ ...tts, instructions: e.target.value })} placeholder="Ou descreva: animado e persuasivo…" />
                </Field>
                <Button className="w-full shadow-sm" disabled={ttsMut.isPending || !tts.text} onClick={() => ttsMut.mutate()}>
                  {ttsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                  Gerar narração
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 min-h-[340px] flex flex-col items-center justify-center">
                {ttsMut.isPending ? (
                  <Loading label="Gerando narração…" />
                ) : ttsUrl ? (
                  <div className="w-full space-y-3">
                    <div className="rounded-xl border bg-muted/30 p-5 flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center"><Volume2 className="w-7 h-7 text-primary" /></div>
                      <audio controls src={ttsUrl} className="w-full" />
                    </div>
                    <a href={ttsUrl} download className="block"><Button variant="outline" size="sm" className="w-full"><Download className="w-3.5 h-3.5 mr-1.5" />Baixar MP3</Button></a>
                  </div>
                ) : (
                  <EmptyState icon={Mic} title="Sua narração aparecerá aqui" sub="Cole o texto, escolha a voz e gere" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- AVATAR ---------- */}
        <TabsContent value="avatar" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="Foto + narração → MP4" premium="HeyGen / D-ID lip-sync" />
                <Field label="Foto da pessoa *">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
                    {avatar.photo ? (
                      <img src={avatar.photo} alt="Foto" className="h-36 rounded-lg object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-3">
                        <div className="w-12 h-12 rounded-xl bg-card border flex items-center justify-center mx-auto mb-2"><Upload className="w-5 h-5 text-muted-foreground/50" /></div>
                        Clique para enviar uma foto (rosto)
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoPick(e.target.files?.[0])} />
                  </label>
                </Field>
                <Field label="O que a pessoa vai falar *">
                  <Textarea rows={4} value={avatar.text} onChange={(e) => setAvatar({ ...avatar, text: e.target.value })} placeholder="Cole o roteiro que será narrado…" />
                </Field>
                <Field label="Voz">
                  <div className="flex flex-wrap gap-1.5">
                    {TTS_VOICES.map((v) => (
                      <Chip key={v.v} active={avatar.voice === v.v} onClick={() => setAvatar({ ...avatar, voice: v.v })}><Volume2 className="w-3.5 h-3.5" />{v.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Formato">
                  <div className="flex flex-wrap gap-1.5">
                    {VIDEO_FORMATS.map((f) => (
                      <Chip key={f.v} active={avatar.size === f.v} onClick={() => setAvatar({ ...avatar, size: f.v })}>{f.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Button className="w-full shadow-sm" disabled={avatarMut.isPending || !avatar.photo || !avatar.text} onClick={() => avatarMut.mutate()}>
                  {avatarMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Gerar avatar
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 min-h-[340px] flex flex-col items-center justify-center">
                {avatarMut.isPending ? (
                  <Loading label="Gerando seu avatar… pode levar alguns segundos" />
                ) : avatarUrl ? (
                  <div className="w-full space-y-3">
                    <video controls src={avatarUrl} className="w-full rounded-xl border" />
                    <a href={avatarUrl} download className="block"><Button variant="outline" size="sm" className="w-full"><Download className="w-3.5 h-3.5 mr-1.5" />Baixar vídeo</Button></a>
                  </div>
                ) : (
                  <EmptyState icon={UserSquare2} title="Seu avatar aparecerá aqui" sub="Envie a foto e o roteiro para começar" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- VÍDEO ---------- */}
        <TabsContent value="video" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="Imagem + narração → MP4" premium="Seedance 2.0 (vídeo + áudio nativo)" />
                <Field label="Descrição do vídeo / produto *">
                  <Textarea rows={3} value={vid.prompt} onChange={(e) => setVid({ ...vid, prompt: e.target.value })} placeholder="Ex.: tênis esportivo premium em fundo escuro com luz de estúdio, foco no produto" />
                </Field>
                <Field label="Roteiro de narração" hint="Deixe vazio para vídeo sem áudio.">
                  <Textarea rows={4} value={vid.script} onChange={(e) => setVid({ ...vid, script: e.target.value })} placeholder="Cole a copy / voiceover…" />
                </Field>
                <Field label="Voz">
                  <div className="flex flex-wrap gap-1.5">
                    {TTS_VOICES.map((v) => (
                      <Chip key={v.v} active={vid.voice === v.v} onClick={() => setVid({ ...vid, voice: v.v })}><Volume2 className="w-3.5 h-3.5" />{v.label}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Formato">
                  <div className="flex flex-wrap gap-1.5">
                    {VIDEO_FORMATS.map((f) => (
                      <Chip key={f.v} active={vid.size === f.v} onClick={() => setVid({ ...vid, size: f.v })}>{f.label}</Chip>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Resolução">
                    <div className="flex flex-wrap gap-1.5">
                      {["480p", "720p", "1080p"].map((r) => (
                        <Chip key={r} active={vid.resolution === r} onClick={() => setVid({ ...vid, resolution: r })}>{r}</Chip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Duração">
                    <div className="flex flex-wrap gap-1.5">
                      {[["auto", "Auto"], ["5", "5s"], ["8", "8s"], ["10", "10s"], ["12", "12s"]].map(([v, l]) => (
                        <Chip key={v} active={vid.duration === v} onClick={() => setVid({ ...vid, duration: v })}>{l}</Chip>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Imagem base (opcional)" hint="Cole uma URL pública para animar a imagem (image-to-video do Seedance).">
                  <Input value={vid.imageUrl} onChange={(e) => setVid({ ...vid, imageUrl: e.target.value })} placeholder="https://…  (vazio = gera do texto)" />
                </Field>
                <Button className="w-full shadow-sm" disabled={videoMut.isPending || (!vid.prompt && !vid.imageUrl)} onClick={() => videoMut.mutate()}>
                  {videoMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Gerar vídeo
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 min-h-[340px] flex flex-col items-center justify-center">
                {videoMut.isPending ? (
                  <Loading label="Renderizando seu vídeo…" />
                ) : vidUrl ? (
                  <div className="w-full space-y-3">
                    <video controls src={vidUrl} className="w-full rounded-xl border" />
                    <a href={vidUrl} download className="block"><Button variant="outline" size="sm" className="w-full"><Download className="w-3.5 h-3.5 mr-1.5" />Baixar vídeo</Button></a>
                  </div>
                ) : (
                  <EmptyState icon={Video} title="Seu vídeo aparecerá aqui" sub="Descreva o produto e gere" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- CLONAR VOZ ---------- */}
        <TabsContent value="clonar" className="flex-1 min-w-0 w-full mt-0">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <ProviderBadge free="—" premium="ElevenLabs Instant Voice Cloning" />
                <p className="text-xs text-muted-foreground -mt-1">Envie 1–5 amostras de áudio limpas da voz (total ~1 min). A voz clonada aparece automaticamente na aba Narração.</p>
                <Field label="Nome da voz *">
                  <Input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="Ex.: Minha voz, Locutor João…" />
                </Field>
                <Field label="Amostras de áudio *" hint="MP3/WAV/M4A, até 5 arquivos, 12MB cada.">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
                    <div className="w-12 h-12 rounded-xl bg-card border flex items-center justify-center mb-2"><Upload className="w-5 h-5 text-muted-foreground/50" /></div>
                    <span className="text-sm text-muted-foreground">Clique para enviar amostras</span>
                    <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => onSamplePick(e.target.files)} />
                  </label>
                </Field>
                {cloneSamples.length > 0 && (
                  <div className="space-y-1.5">
                    {cloneSamples.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <Volume2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="truncate flex-1">{s.name}</span>
                        <button onClick={() => setCloneSamples((arr) => arr.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full shadow-sm" disabled={cloneMut.isPending || !cloneName || !cloneSamples.length} onClick={() => cloneMut.mutate()}>
                  {cloneMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AudioWaveform className="w-4 h-4 mr-2" />}
                  Clonar voz
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 min-h-[340px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Minhas vozes</h3>
                  <Button variant="ghost" size="sm" onClick={() => refetchVoices()} className="h-7 gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>
                </div>
                {clonedVoiceId && (
                  <div className="rounded-lg border border-primary/30 bg-accent px-3 py-2.5 text-sm text-accent-foreground mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4" /> Voz clonada criada! Já dá pra usar na Narração.
                  </div>
                )}
                {clonedVoices.length ? (
                  <div className="space-y-1.5">
                    {clonedVoices.map((v) => (
                      <div key={v.voiceId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0"><AudioWaveform className="w-3.5 h-3.5 text-primary" /></div>
                        <span className="truncate flex-1 font-medium">{v.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{v.category}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full min-h-[260px] flex items-center justify-center">
                    <EmptyState icon={AudioWaveform} title="Nenhuma voz clonada ainda" sub="Clone uma voz à esquerda — requer a chave ElevenLabs" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- HISTÓRICO ---------- */}
        <TabsContent value="historico" className="flex-1 min-w-0 w-full mt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <input value={histQ} onChange={(e) => setHistQ(e.target.value)} placeholder="Buscar por título ou prompt…" className="flex-1 min-w-[180px] h-9 rounded-md border border-input bg-card px-3 text-sm" />
              <button onClick={() => refetchHist()} className="text-sm rounded-lg px-3 py-1.5 border hover:bg-muted flex items-center gap-1.5 transition"><RefreshCw className={`w-3.5 h-3.5 ${histLoading ? "animate-spin" : ""}`} />Atualizar</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[["all", "Todos"], ["image", "Imagens"], ["copy", "Copy"], ["audio", "Áudio"], ["video", "Vídeo"]].map(([v, l]) => (
                <Chip key={v} active={histType === v} onClick={() => setHistType(v)}>{l}</Chip>
              ))}
            </div>
            {hist.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {hist.map((g: any) => (
                  <div key={g.id} className="group bg-card border rounded-xl overflow-hidden hover:shadow-md transition">
                    <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                      {g.type === "image" ? <img src={g.url} alt="" className="w-full h-full object-cover" />
                        : g.type === "video" ? <video src={g.url} className="w-full h-full object-cover" />
                        : g.type === "audio" ? <Volume2 className="w-8 h-8 text-primary" />
                        : <div className="p-3 text-[11px] text-muted-foreground line-clamp-5 w-full h-full overflow-hidden">{g.text}</div>}
                    </div>
                    <div className="p-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{g.title}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(g.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      {g.type === "copy"
                        ? <button onClick={() => { navigator.clipboard.writeText(g.text || ""); toast({ title: "Copiado!" }); }} className="p-1.5 rounded hover:bg-muted transition" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                        : <a href={g.url} download target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-muted transition" title="Baixar"><Download className="w-3.5 h-3.5" /></a>}
                      <button onClick={() => delHist(g.id)} className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[300px] flex items-center justify-center">
                <EmptyState icon={History} title="Nenhuma criação ainda" sub="Suas gerações aparecem aqui automaticamente" />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Galeria de criações recentes (sessão) */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Criações recentes</h2>
            <span className="text-xs text-muted-foreground">· nesta sessão</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noreferrer" title={h.label} className="group flex-shrink-0 w-28">
                <div className="w-28 h-28 rounded-xl border bg-muted/30 overflow-hidden flex items-center justify-center relative">
                  {h.type === "image" ? (
                    <img src={h.url} alt={h.label} className="w-full h-full object-cover" />
                  ) : h.type === "video" ? (
                    <video src={h.url} className="w-full h-full object-cover" />
                  ) : (
                    <Volume2 className="w-7 h-7 text-primary" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-1">{h.label}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
