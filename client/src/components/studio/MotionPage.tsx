import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Clapperboard, FileText, ListChecks, ScrollText, Mic, Sparkles, RefreshCw, Check, Play, Pause, ArrowLeft, Loader2, Wand2, Plus, X, Eye,
  ImagePlus, Music2, AudioLines, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { useStudio } from "./store";
import { postLong } from "./runners";
import { playPreview, useVoices } from "./ui";
import { FieldLabel, FormPanel, PageGrid, PageHeader, PillGroup, PreviewPanel, DownloadButton, useLocalForm } from "./page-kit";

type Formato = "9:16" | "1:1" | "16:9";
interface Cena { tela?: string; fala?: string; texto?: string; visual: string; anexo?: number | null; start?: number; end?: number }
interface Palavra { w: string; start: number; end: number }
/** data = imagem ainda no navegador (data URL); url = já enviada ao servidor. */
interface Anexo { data?: string; url?: string; legenda: string; tipo?: string; descricao?: string }
interface Entendimento {
  titulo: string;
  resumo: { produto: string; publico: string; oferta: string; diferenciais: string[]; contato: string; cta: string; tom: string };
  roteiroCliente: { tem: boolean; texto: string };
  perguntas: { id: string; pergunta: string; dica: string }[];
  pronuncias: { termo: string; fala: string }[];
  anexos: { tipo: string; descricao: string }[];
  cores: string[];
  estilo: "produto" | "premium";
}
interface Checagem { ok: boolean; score: number; faltando: string[]; ouvido: string }
interface Cue { t: number; sfx: string }

const SIZE: Record<Formato, { w: number; h: number; cls: string; max: string }> = {
  "9:16": { w: 1080, h: 1920, cls: "aspect-[9/16]", max: "max-w-[270px]" },
  "1:1": { w: 1080, h: 1080, cls: "aspect-square", max: "max-w-[400px]" },
  "16:9": { w: 1920, h: 1080, cls: "aspect-video", max: "max-w-full" },
};
const FORMATOS = [{ v: "9:16", label: "9:16 · Reels" }, { v: "1:1", label: "1:1 · Feed" }, { v: "16:9", label: "16:9 · YouTube" }] as const;
const DURACOES = [{ v: "15", label: "15s" }, { v: "30", label: "30s" }, { v: "45", label: "45s" }, { v: "60", label: "60s" }] as const;
const ESTILOS = [{ v: "produto", label: "Produto · claro" }, { v: "premium", label: "Premium · escuro" }] as const;
const PASSOS = [
  { n: 1, label: "Briefing", icon: FileText },
  { n: 2, label: "Entendi assim", icon: ListChecks },
  { n: 3, label: "Roteiro", icon: ScrollText },
  { n: 4, label: "Voz e som", icon: Mic },
  { n: 5, label: "Motion", icon: Sparkles },
];
const TIPOS_ANEXO: Record<string, string> = { logo: "Logo", print_site: "Print do site", print_app: "Print do app", foto_produto: "Foto do produto", foto_pessoa: "Foto de pessoa", outro: "Imagem" };

const DEFAULTS = {
  passo: 1, briefing: "", anexos: [] as Anexo[], formato: "9:16" as Formato, duracao: "30",
  entendimento: null as Entendimento | null, respostas: {} as Record<string, string>, modo: "melhorar" as "melhorar" | "exato",
  cenas: [] as Cena[], voice: "", musica: "", efeitos: true,
  audioUrl: "", words: [] as Palavra[], timed: [] as Cena[], duration: 0, checagem: null as Checagem | null,
  musicaUrl: "", efeitosUrls: {} as Record<string, string>,
  estilo: "produto", cores: [] as string[], html: "",
};

const PLACEHOLDER = `Escreva do seu jeito. Ajuda contar:
• o que você vende e para quem
• o preço ou a condição (se quiser mostrar)
• o que te diferencia
• como o cliente fala com você (WhatsApp, site, @)
• se já tem um texto pronto, cole aqui que a gente usa`;

const EXEMPLO_BRIEFING = `Sou a Clínica Vitta, odontologia em Curitiba. Quero um vídeo para o Instagram falando com quem tem vergonha de sorrir.
Fazemos clareamento, implantes e lentes de contato dental, com avaliação gratuita.
Diferencial: atendimento sem dor, com sedação, e parcelamento em até 12x.
Já atendemos mais de 3 mil pacientes. Contato pelo WhatsApp (41) 99999-0000.
Tom acolhedor e confiante.`;

/** Reduz a imagem antes de enviar (máx. 1600px, JPEG) para o envio e a análise ficarem rápidos. */
function reduzir(file: File): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onerror = () => fail(new Error("Não deu para ler a imagem"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => fail(new Error("Imagem inválida"));
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d")!;
        const png = file.type === "image/png";
        if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL(png ? "image/png" : "image/jpeg", 0.86));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

export default function MotionPage() {
  const { brief } = useStudio();
  const { toast } = useToast();
  const { cloned } = useVoices();
  const [f, patch, reset] = useLocalForm("motion2", DEFAULTS);
  const [busy, setBusy] = useState<"" | "brief" | "roteiro" | "voz" | "motion">("");
  const [instrucao, setInstrucao] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);

  const { data: lib } = useQuery<{ voices: { voiceId: string; name: string; gender: string; tag: string; previewUrl: string }[]; climas: { v: string; label: string }[] }>({
    queryKey: ["/api/ai-studio/motion/voices"],
    queryFn: async () => (await apiRequest("GET", "/api/ai-studio/motion/voices")).json(),
    staleTime: 60 * 60 * 1000,
  });
  const vozes = lib?.voices || [];
  const voice = f.voice || vozes[1]?.voiceId || "";

  const run = async <T,>(kind: typeof busy, fn: () => Promise<T>, erro: string): Promise<T | null> => {
    setBusy(kind);
    try { return await fn(); }
    catch (e: any) { toast({ title: erro, description: e?.message?.replace(/^\d+:\s*/, "") || "Tente novamente", variant: "destructive" }); return null; }
    finally { setBusy(""); }
  };
  const post = async <T,>(url: string, body: any) => (await apiRequest("POST", url, { ...body, idioma: brief.lang })).json() as Promise<T>;

  // 1 → 2
  const analisar = async () => {
    const d = await run("brief", () => post<{ entendimento: Entendimento; anexos: Anexo[] }>("/api/ai-studio/motion/brief", {
      texto: f.briefing, formato: f.formato, duracao: Number(f.duracao),
      anexos: f.anexos.map((a) => ({ img: a.data || a.url, legenda: a.legenda })),
    }), "Não deu para analisar o briefing");
    if (!d) return;
    patch({
      entendimento: d.entendimento, anexos: d.anexos.map((a) => ({ url: a.url, legenda: a.legenda, tipo: a.tipo, descricao: a.descricao })),
      respostas: {}, modo: d.entendimento.roteiroCliente.tem ? "exato" : "melhorar", estilo: d.entendimento.estilo,
      cores: f.cores.length ? f.cores : d.entendimento.cores, passo: 2, cenas: [], audioUrl: "", html: "",
    });
  };

  // 2 → 3
  const gerarRoteiro = async (outro = false) => {
    const d = await run("roteiro", () => post<{ cenas: Cena[] }>("/api/ai-studio/motion/script", {
      briefing: f.briefing, entendimento: f.entendimento, respostas: f.respostas, duracao: Number(f.duracao), modo: f.modo,
      anexos: f.anexos.map((a) => ({ tipo: a.tipo, descricao: a.descricao || a.legenda })), anterior: outro ? f.cenas : undefined,
    }), "Erro ao criar o roteiro");
    if (d) patch({ cenas: d.cenas, passo: 3, audioUrl: "", words: [], timed: [], duration: 0, html: "", checagem: null });
  };

  // 4: dublagem (com conferência de pronúncia) + trilha/efeitos escolhidos
  const gerarVoz = async () => {
    const d = await run("voz", async () => {
      const [v, a] = await Promise.all([
        postLong<{ audioUrl: string; words: Palavra[]; scenes: Cena[]; duration: number; checagem: Checagem | null }>("/api/ai-studio/motion/voice", { cenas: f.cenas, voice, idioma: brief.lang }),
        f.musica || f.efeitos
          ? postLong<{ musicaUrl: string | null; efeitos: Record<string, string> }>("/api/ai-studio/motion/audio", { musica: f.musica || undefined, efeitos: f.efeitos }).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { v, a };
    }, "Erro ao gerar a dublagem");
    if (!d) return;
    patch({
      audioUrl: d.v.audioUrl, words: d.v.words, timed: d.v.scenes, duration: d.v.duration, checagem: d.v.checagem,
      musicaUrl: d.a?.musicaUrl || "", efeitosUrls: d.a?.efeitos || {}, html: "",
    });
    if (f.musica && d.a && !d.a.musicaUrl) toast({ title: "A trilha não ficou pronta", description: "O vídeo segue só com a voz. Tente a música de novo mais tarde." });
  };

  // 5: animação (minutos, em segundo plano no servidor)
  const gerarMotion = async (comAjuste = false) => {
    const d = await run("motion", () => postLong<{ html: string }>("/api/ai-studio/motion/animate", {
      scenes: f.timed, duration: f.duration, formato: f.formato, estilo: f.estilo, cores: f.cores, idioma: brief.lang,
      assets: f.anexos.filter((a) => a.url).map((a) => ({ url: a.url, tipo: a.tipo, descricao: a.descricao || a.legenda })),
      instrucao: comAjuste ? instrucao : undefined, htmlAnterior: comAjuste ? f.html : undefined,
    }), "Erro ao criar a animação");
    if (d) { patch({ html: d.html }); setInstrucao(""); }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const livres = 6 - f.anexos.length;
    const list = Array.from(files).filter((x) => /^image\/(png|jpe?g|webp)$/.test(x.type)).slice(0, livres);
    try {
      const datas = await Promise.all(list.map(reduzir));
      patch({ anexos: [...f.anexos, ...datas.map((data) => ({ data, legenda: "" }))], entendimento: null });
    } catch (e: any) { toast({ title: "Imagem não aceita", description: e?.message, variant: "destructive" }); }
  };

  // Exemplo real (feito pelo próprio Motion) mostrado no preview até a pessoa gerar o dela.
  const [exMotion, setExMotion] = useState<any>(null);
  useEffect(() => {
    fetch("/studio-examples/motion-lowfy.json").then((r) => (r.ok ? r.json() : null)).then(setExMotion).catch(() => {});
  }, []);
  const eExemplo = !f.html && !!exMotion && busy !== "motion";
  const mostra = eExemplo ? { ...exMotion, formato: exMotion.formato as Formato, anexos: [], musicaUrl: "", efeitosUrls: {}, estilo: "bold", cores: [] } : f;

  const e = f.entendimento;
  const setResumo = (k: keyof Entendimento["resumo"], v: any) => e && patch({ entendimento: { ...e, resumo: { ...e.resumo, [k]: v } } });
  const podeIr = (n: number) => n === 1 || (n === 2 && !!e) || (n === 3 && f.cenas.length > 0) || (n === 4 && f.cenas.length > 0) || (n === 5 && !!f.audioUrl);
  const falta = (e?.perguntas || []).filter((q) => !(f.respostas[q.id] || "").trim()).length;

  const titulos = ["Conte o que você quer", "Confira se entendemos", "Aprove o roteiro", "Escolha a voz e o som", "Crie o motion"];
  const subs = [
    "Escreva com suas palavras e anexe o que tiver (logo, prints, fotos). Nada é gerado ainda.",
    "A IA leu seu briefing. Corrija o que precisar e responda o que faltou.",
    "O que aparece na tela e o que o locutor fala, cena por cena. Edite à vontade.",
    "Ouça as vozes, escolha a trilha e os efeitos. A fala é conferida palavra por palavra.",
    "Escolha o visual e veja o vídeo no preview.",
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Clapperboard}
        title="Motion"
        sub="Vídeos animados com narração profissional, no padrão das melhores agências."
        tip="quanto mais você contar no briefing (e anexar prints reais), mais o vídeo parece seu."
      />

      {/* Passos */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
        {PASSOS.map((p, i) => {
          const ativo = f.passo === p.n;
          const feito = f.passo > p.n;
          return (
            <div key={p.n} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                type="button" disabled={!podeIr(p.n) || !!busy} onClick={() => patch({ passo: p.n })}
                className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-sm font-medium transition disabled:opacity-40 ${
                  ativo ? "bg-primary text-primary-foreground border-primary shadow-sm" : feito ? "bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] text-primary border-[color-mix(in_srgb,var(--primary)_30%,transparent)]" : "bg-card text-muted-foreground"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${ativo ? "bg-white/20" : feito ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {feito ? <Check className="w-3.5 h-3.5" /> : p.n}
                </span>
                {p.label}
              </button>
              {i < PASSOS.length - 1 && <span className="w-3 sm:w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <PageGrid
        form={
          <FormPanel
            icon={PASSOS[f.passo - 1].icon}
            title={titulos[f.passo - 1]}
            sub={subs[f.passo - 1]}
            onExample={f.passo === 1 ? () => patch({ briefing: EXEMPLO_BRIEFING, duracao: "30", formato: "9:16" }) : undefined}
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
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={f.briefing.trim().length < 10 || !!busy} onClick={() => void analisar()}>
                    {busy === "brief" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lendo seu briefing…</> : <><Wand2 className="w-4 h-4 mr-2" /> Analisar briefing</>}
                  </Button>
                )}
                {f.passo === 2 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={!!busy} onClick={() => void gerarRoteiro()}>
                    {busy === "roteiro" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Escrevendo roteiro…</> : <><Check className="w-4 h-4 mr-2" /> Está certo, criar roteiro</>}
                  </Button>
                )}
                {f.passo === 3 && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => void gerarRoteiro(true)}>
                      {busy === "roteiro" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Outro roteiro
                    </Button>
                    <Button className="h-11 sm:h-10 sm:min-w-[180px]" disabled={!!busy || !f.cenas.some((c) => (c.fala || c.texto || "").trim())} onClick={() => patch({ passo: 4 })}>
                      <Check className="w-4 h-4 mr-2" /> Aprovar roteiro
                    </Button>
                  </div>
                )}
                {f.passo === 4 && (
                  f.audioUrl ? (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => void gerarVoz()}>
                        {busy === "voz" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Gravar de novo
                      </Button>
                      <Button className="h-11 sm:h-10 sm:min-w-[180px]" disabled={!!busy} onClick={() => patch({ passo: 5 })}>
                        <Check className="w-4 h-4 mr-2" /> Seguir para o motion
                      </Button>
                    </div>
                  ) : (
                    <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={!voice || !!busy} onClick={() => void gerarVoz()}>
                      {busy === "voz" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando e conferindo…</> : <><Mic className="w-4 h-4 mr-2" /> Gerar dublagem</>}
                    </Button>
                  )
                )}
                {f.passo === 5 && (
                  <Button className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]" disabled={!!busy} onClick={() => void gerarMotion(false)}>
                    {busy === "motion" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Animando… (2 a 5 min)</> : <><Sparkles className="w-4 h-4 mr-2" /> {f.html ? "Criar outra animação" : "Criar animação"}</>}
                  </Button>
                )}
              </div>
            }
          >
            {/* 1. Briefing */}
            {f.passo === 1 && (
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Conte com suas palavras o que você quer no vídeo</FieldLabel>
                  <Textarea value={f.briefing} onChange={(ev) => patch({ briefing: ev.target.value, entendimento: null })} className="min-h-[170px] text-[13px] leading-relaxed" placeholder={PLACEHOLDER} />
                </div>
                <div>
                  <FieldLabel optional>Anexos: logo, prints do site ou app, fotos</FieldLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {f.anexos.map((a, i) => (
                      <div key={i} className="rounded-lg border bg-card overflow-hidden">
                        <div className="relative aspect-[4/3] bg-muted">
                          <img src={a.data || a.url} alt="" className="absolute inset-0 w-full h-full object-contain" />
                          <button type="button" onClick={() => patch({ anexos: f.anexos.filter((_, j) => j !== i), entendimento: null })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remover anexo">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <Input value={a.legenda} onChange={(ev) => patch({ anexos: f.anexos.map((x, j) => (j === i ? { ...x, legenda: ev.target.value } : x)) })} placeholder="O que é? (ex.: meu logo)" className="h-8 text-xs rounded-none border-0 border-t focus-visible:ring-0" />
                      </div>
                    ))}
                    {f.anexos.length < 6 && (
                      <button type="button" onClick={() => fileRef.current?.click()} className="aspect-[4/3] rounded-lg border border-dashed flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground hover:bg-muted transition">
                        <ImagePlus className="w-5 h-5" /> Adicionar imagem
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(ev) => { void addFiles(ev.target.files); ev.target.value = ""; }} />
                  <p className="text-[11px] text-muted-foreground mt-1.5">Prints reais deixam o vídeo com a cara do seu negócio: eles aparecem dentro do navegador, do celular ou do notebook animados.</p>
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

            {/* 2. Entendi assim */}
            {f.passo === 2 && e && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([["produto", "O que é"], ["publico", "Para quem"], ["oferta", "Oferta ou preço"], ["contato", "Contato"], ["cta", "Chamada final"], ["tom", "Tom de voz"]] as const).map(([k, label]) => (
                    <div key={k}>
                      <FieldLabel>{label}</FieldLabel>
                      <Input value={(e.resumo as any)[k] || ""} onChange={(ev) => setResumo(k, ev.target.value)} className="h-9 text-[13px]" placeholder="—" />
                    </div>
                  ))}
                </div>
                <div>
                  <FieldLabel>Diferenciais</FieldLabel>
                  <Textarea value={e.resumo.diferenciais.join("\n")} onChange={(ev) => setResumo("diferenciais", ev.target.value.split("\n"))} className="min-h-[70px] text-[13px]" placeholder="Um por linha" />
                </div>

                {e.perguntas.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-3">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Faltou isto para o vídeo ficar completo{falta ? ` (${falta})` : ""}</p>
                    {e.perguntas.map((q) => (
                      <div key={q.id}>
                        <p className="text-[13px] font-medium mb-1">{q.pergunta}</p>
                        <Input value={f.respostas[q.id] || ""} onChange={(ev) => patch({ respostas: { ...f.respostas, [q.id]: ev.target.value } })} className="h-9 text-[13px] bg-white" placeholder={q.dica || "Sua resposta"} />
                      </div>
                    ))}
                  </div>
                )}

                {e.roteiroCliente.tem && (
                  <div>
                    <FieldLabel>Você mandou um texto pronto. Como usar?</FieldLabel>
                    <PillGroup options={[{ v: "exato", label: "Narrar do jeito que está" }, { v: "melhorar", label: "Pode melhorar" }]} value={f.modo} onChange={(v) => patch({ modo: v as any })} />
                  </div>
                )}

                <div>
                  <FieldLabel optional>Como se fala (nomes e marcas)</FieldLabel>
                  <div className="space-y-1.5">
                    {e.pronuncias.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <Input value={p.termo} onChange={(ev) => patch({ entendimento: { ...e, pronuncias: e.pronuncias.map((x, j) => (j === i ? { ...x, termo: ev.target.value } : x)) } })} className="h-8 text-xs" placeholder="Como se escreve" />
                        <Input value={p.fala} onChange={(ev) => patch({ entendimento: { ...e, pronuncias: e.pronuncias.map((x, j) => (j === i ? { ...x, fala: ev.target.value } : x)) } })} className="h-8 text-xs" placeholder="Como se fala" />
                        <button type="button" onClick={() => patch({ entendimento: { ...e, pronuncias: e.pronuncias.filter((_, j) => j !== i) } })} className="text-muted-foreground hover:text-red-600" aria-label="Remover"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => patch({ entendimento: { ...e, pronuncias: [...e.pronuncias, { termo: "", fala: "" }] } })}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar pronúncia
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Ex.: "UXcode" se fala "iú éks code". O locutor segue isso à risca.</p>
                </div>

                {f.anexos.length > 0 && (
                  <div>
                    <FieldLabel>Anexos que entendemos</FieldLabel>
                    <div className="space-y-1.5">
                      {f.anexos.map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-lg border p-1.5 pr-3">
                          <img src={a.url || a.data} alt="" className="w-12 h-9 object-cover rounded" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">{TIPOS_ANEXO[a.tipo || "outro"] || "Imagem"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.descricao || a.legenda}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Roteiro */}
            {f.passo === 3 && (
              <div className="space-y-3">
                {f.cenas.map((c, i) => (
                  <div key={i} className="rounded-xl border p-3.5 space-y-2.5 bg-card">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Cena {i + 1}</span>
                      {i === 0 && <span className="text-[10px] text-muted-foreground">gancho</span>}
                      {i === f.cenas.length - 1 && <span className="text-[10px] text-muted-foreground">chamada final</span>}
                      {f.cenas.length > 2 && (
                        <button type="button" onClick={() => patch({ cenas: f.cenas.filter((_, j) => j !== i), audioUrl: "" })} className="ml-auto text-muted-foreground hover:text-red-600" aria-label="Remover cena">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Na tela</p>
                      <Input value={c.tela || ""} onChange={(ev) => patch({ cenas: f.cenas.map((x, j) => (j === i ? { ...x, tela: ev.target.value } : x)), audioUrl: "" })} className="h-9 text-[13px] font-semibold" aria-label="Texto da tela" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">O locutor fala</p>
                      <Textarea value={c.fala || c.texto || ""} onChange={(ev) => patch({ cenas: f.cenas.map((x, j) => (j === i ? { ...x, fala: ev.target.value, texto: ev.target.value } : x)), audioUrl: "" })} className="min-h-[56px] text-[13px]" aria-label="O que o narrador fala" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Eye className="w-3.5 h-3.5 mt-2.5 text-muted-foreground flex-shrink-0" />
                      <Input value={c.visual} onChange={(ev) => patch({ cenas: f.cenas.map((x, j) => (j === i ? { ...x, visual: ev.target.value } : x)) })} className="h-9 text-xs" aria-label="O que aparece na tela" />
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Use *asteriscos* para destacar uma palavra na tela. Números na fala vão por extenso para o locutor não errar.</p>
                {f.cenas.length < 12 && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => patch({ cenas: [...f.cenas.slice(0, -1), { tela: "", fala: "", visual: "" }, ...f.cenas.slice(-1)], audioUrl: "" })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar cena
                  </Button>
                )}
              </div>
            )}

            {/* 4. Voz e som */}
            {f.passo === 4 && (
              <div className="space-y-5">
                {(["masc", "fem"] as const).map((g) => (
                  <div key={g}>
                    <FieldLabel>{g === "masc" ? "Vozes masculinas" : "Vozes femininas"}</FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {vozes.filter((v) => v.gender === g).map((v) => (
                        <VoiceRow key={v.voiceId} name={v.name} tag={v.tag} preview={v.previewUrl} active={voice === v.voiceId} onSelect={() => patch({ voice: v.voiceId, audioUrl: "" })} />
                      ))}
                    </div>
                  </div>
                ))}
                {cloned.length > 0 && (
                  <div>
                    <FieldLabel optional>Suas vozes</FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cloned.map((v) => (
                        <VoiceRow key={v.voiceId} name={v.name} tag={v.tag || "Voz da sua conta"} preview={v.previewUrl} active={voice === v.voiceId} onSelect={() => patch({ voice: v.voiceId, audioUrl: "" })} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5"><Music2 className="w-4 h-4 text-primary" /> Música de fundo</p>
                      <p className="text-[11px] text-muted-foreground">Baixinha, e abaixa sozinha quando a voz fala.</p>
                    </div>
                    <Switch checked={!!f.musica} onCheckedChange={(on) => patch({ musica: on ? (lib?.climas[0]?.v || "animada") : "", musicaUrl: "" })} />
                  </div>
                  {!!f.musica && <PillGroup options={(lib?.climas || []).map((c) => ({ v: c.v, label: c.label }))} value={f.musica} onChange={(v) => patch({ musica: v, musicaUrl: "" })} />}
                </div>
                <div className="rounded-xl border p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5"><AudioLines className="w-4 h-4 text-primary" /> Efeitos sonoros</p>
                    <p className="text-[11px] text-muted-foreground">Whoosh nas transições, clique, carimbo e "pop" discretos.</p>
                  </div>
                  <Switch checked={f.efeitos} onCheckedChange={(on) => patch({ efeitos: on })} />
                </div>

                {f.checagem && (
                  f.checagem.ok ? (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Pronúncia conferida: o locutor falou o roteiro certinho ({Math.round(f.checagem.score * 100)}%).
                    </p>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> O locutor pode ter errado ou pulado: {f.checagem.faltando.slice(0, 8).join(", ")}</p>
                      <p>Ouça no preview. Se precisar, ajuste a pronúncia no passo 2 ou a fala no roteiro e grave de novo.</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* 5. Motion */}
            {f.passo === 5 && (
              <div className="space-y-4">
                <div>
                  <FieldLabel>Visual</FieldLabel>
                  <PillGroup options={[...ESTILOS]} value={f.estilo === "premium" ? "premium" : "produto"} onChange={(v) => patch({ estilo: v })} />
                  <p className="text-[11px] text-muted-foreground mt-1.5">{f.estilo === "premium" ? "Fundo escuro com brilho, tipografia enorme e botão com reflexo. Bom para cursos, lançamentos e marcas premium." : "Fundo claro, interfaces realistas e cursor clicando. Bom para serviços, apps, clínicas e lojas."}</p>
                </div>
                <div>
                  <FieldLabel optional>Cores da marca</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {f.cores.map((c, i) => (
                      <button key={`${c}-${i}`} type="button" onClick={() => patch({ cores: f.cores.filter((_, j) => j !== i) })} className="group relative w-8 h-8 rounded-full border shadow-sm" style={{ background: c }} title="Clique para remover">
                        <X className="w-3.5 h-3.5 absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                      </button>
                    ))}
                    {f.cores.length < 2 && (
                      <button type="button" onClick={() => colorRef.current?.click()} className="h-8 px-3 rounded-full border border-dashed flex items-center gap-1.5 text-xs text-muted-foreground hover:bg-muted">
                        <Plus className="w-3.5 h-3.5" /> {f.cores.length ? "" : "Adicionar cor"}
                      </button>
                    )}
                    <input ref={colorRef} type="color" className="sr-only" onChange={(ev) => patch({ cores: [...f.cores, ev.target.value] })} />
                  </div>
                </div>
                {f.html && (
                  <div>
                    <FieldLabel optional>Quer mudar algo?</FieldLabel>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input value={instrucao} onChange={(ev) => setInstrucao(ev.target.value)} placeholder="Ex.: deixa a cena 2 mais chamativa, números maiores" />
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
            sub={f.html ? "Dê play para ver o motion com voz, trilha e efeitos." : eExemplo ? "Exemplo real feito aqui no Motion. Dê play! O seu aparece no lugar." : f.audioUrl ? "A dublagem está pronta. Agora crie a animação." : "O vídeo aparece aqui depois dos passos."}
            actions={<><DownloadButton url={f.audioUrl || null} label="Baixar áudio" /><Button variant="outline" className="h-10 w-full" disabled title="Em breve: exportar em MP4">MP4 em breve</Button></>}
          >
            <div className="relative">
              {eExemplo && <span className="absolute -top-2 right-0 z-20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-[color-mix(in_srgb,var(--muted)_100%,transparent)] rounded px-1.5 py-0.5">Exemplo</span>}
              <MotionPlayer
                key={eExemplo ? "exemplo" : "meu"}
                html={busy === "motion" && !f.html ? "" : mostra.html}
                audioUrl={busy === "motion" && !f.html ? "" : mostra.audioUrl}
                words={mostra.words} scenes={mostra.timed} duration={mostra.duration} formato={mostra.formato} busy={busy === "motion"}
                assets={(mostra.anexos || []).filter((a: Anexo) => a.url).map((a: Anexo) => ({ url: a.url!, tipo: a.tipo, descricao: a.descricao }))}
                theme={mostra.estilo === "premium" ? "premium" : "produto"} palette={mostra.cores || []}
                musicaUrl={mostra.musicaUrl || ""} efeitos={f.efeitos && !eExemplo ? mostra.efeitosUrls || {} : {}}
              />
            </div>
          </PreviewPanel>
        }
      />
    </div>
  );
}

function VoiceRow({ name, tag, preview, active, onSelect }: { name: string; tag?: string; preview?: string; active: boolean; onSelect: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border pl-1.5 pr-3 py-1.5 transition ${active ? "border-[color-mix(in_srgb,var(--primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)]" : "hover:bg-muted"}`}>
      <button type="button" onClick={() => playPreview(preview)} disabled={!preview} className="w-8 h-8 rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] flex items-center justify-center disabled:opacity-40" aria-label={`Ouvir ${name}`}>
        <Play className="w-3.5 h-3.5 text-primary fill-current" />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
        <p className={`text-xs font-semibold truncate ${active ? "text-primary" : ""}`}>{name}</p>
        {tag && <p className="text-[10px] text-muted-foreground truncate">{tag}</p>}
      </button>
      {active && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
    </div>
  );
}

/**
 * Player: a animação roda isolada num iframe (sandbox sem acesso ao site) e recebe o tempo do
 * áudio a cada quadro via postMessage. Vídeos feitos com o kit trazem a manchete sincronizada
 * (sem legenda por cima) e mandam as deixas de som; a trilha abaixa quando a voz fala.
 */
function MotionPlayer({ html, audioUrl, words, scenes, duration, formato, busy, assets, theme, palette, musicaUrl, efeitos }: {
  html: string; audioUrl: string; words: Palavra[]; scenes: Cena[]; duration: number; formato: Formato; busy: boolean;
  assets: { url: string; tipo?: string; descricao?: string }[]; theme: string; palette: string[]; musicaUrl: string; efeitos: Record<string, string>;
}) {
  const size = SIZE[formato] || SIZE["9:16"];
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const cuesRef = useRef<Cue[]>([]);
  const lastT = useRef(0);
  const sfxPool = useRef<Record<string, HTMLAudioElement>>({});
  const [scale, setScale] = useState(0.25);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const kit = html.includes("<!--motion-kit-->");

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / size.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w]);

  // Deixas de som que a animação manda ao carregar.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source === frameRef.current?.contentWindow && Array.isArray(ev.data?.motionCues)) cuesRef.current = ev.data.motionCues;
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    sfxPool.current = Object.fromEntries(Object.entries(efeitos).map(([k, url]) => { const a = new Audio(url); a.preload = "auto"; return [k, a]; }));
  }, [efeitos]);

  const srcDoc = useMemo(() => {
    if (!html) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const data = JSON.stringify({
      duration, width: size.w, height: size.h,
      scenes: scenes.map((s) => ({ start: s.start, end: s.end, tela: s.tela || "", fala: s.fala || s.texto || "", visual: s.visual, anexo: s.anexo ?? null })),
      words, assets, palette, theme,
    }).replace(/</g, "\\u003c");
    const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob: ${origin};">
<script>window.MOTION=${data};window.addEventListener("message",function(e){var d=e.data;if(d&&typeof d.t==="number"&&typeof window.renderFrame==="function"){try{window.renderFrame(d.t)}catch(err){}}});</script>`;
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
  }, [html, duration, scenes, words, assets, palette, theme, size.w, size.h]);

  // Loop do play: tempo do áudio → animação, efeitos nas deixas e trilha com "ducking".
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      const now = a ? a.currentTime : 0;
      setT(now);
      frameRef.current?.contentWindow?.postMessage({ t: now }, "*");
      const prev = lastT.current;
      if (now > prev && now - prev < 0.5) {
        for (const c of cuesRef.current) {
          if (c.t > prev && c.t <= now) {
            const base = sfxPool.current[c.sfx];
            if (base) { const s = base.cloneNode(true) as HTMLAudioElement; s.volume = c.sfx === "whoosh" ? 0.35 : 0.45; void s.play().catch(() => {}); }
          }
        }
      }
      lastT.current = now;
      const m = musicRef.current;
      if (m) {
        const falando = words.some((w) => now >= w.start - 0.05 && now <= w.end + 0.15);
        const alvo = falando ? 0.07 : 0.16;
        m.volume = m.volume + (alvo - m.volume) * 0.15;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, words]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };

  // Legenda por cima só para vídeos antigos (sem o kit): nos novos a manchete já é a fala.
  const legenda = useMemo(() => {
    if (kit || !words.length) return null;
    let i = words.findIndex((w) => t >= w.start && t < w.end + 0.15);
    if (i < 0) i = words.findIndex((w) => w.start > t) - 1;
    if (i < 0) return null;
    const ini = Math.floor(i / 4) * 4;
    return { grupo: words.slice(ini, ini + 4), ativo: i - ini };
  }, [words, t, kit]);

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
            <p className="text-xs text-white/60">{busy ? "Leva de 2 a 5 minutos" : "Briefing → roteiro → voz → animação"}</p>
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
            onPlay={() => { setPlaying(true); const m = musicRef.current; if (m) { m.currentTime = (audioRef.current?.currentTime || 0) % (m.duration || 60); m.volume = 0.12; void m.play().catch(() => {}); } }}
            onPause={() => { setPlaying(false); musicRef.current?.pause(); }}
            onEnded={() => { setPlaying(false); setT(0); lastT.current = 0; musicRef.current?.pause(); frameRef.current?.contentWindow?.postMessage({ t: 0 }, "*"); }}
            className="hidden"
          />
          {musicaUrl && <audio ref={musicRef} src={musicaUrl} loop preload="auto" className="hidden" />}
        </div>
      )}
    </div>
  );
}
