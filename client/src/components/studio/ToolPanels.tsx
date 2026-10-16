import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Image as ImageIcon, Type, Mic, UserSquare2, Sparkles, Wand2, Download, Copy as CopyIcon,
  RefreshCw, Loader2, Pencil, Target, Crop, UserRound, X, ArrowRight, Film, Volume2,
} from "lucide-react";
import { useStudio } from "./store";
import { RATIOS, ratioSpec } from "./types";
import type { Asset, RatioId } from "./types";
import { Canvas, Chip, EmptyState, Field, Loading, SectionTitle, SendToMenu, Slider, ToolLayout, VoiceCard, useVoices } from "./ui";

const COPY_TYPES = [
  { v: "anuncio", label: "Texto de anúncio" },
  { v: "headline", label: "Headlines" },
  { v: "legenda", label: "Legenda p/ redes" },
  { v: "vsl", label: "Roteiro de VSL" },
  { v: "email", label: "E-mail de vendas" },
  { v: "cta", label: "Chamada / CTA" },
];
const FRAMEWORKS = [
  { v: "auto", label: "Deixa a IA escolher" },
  { v: "AIDA", label: "AIDA" },
  { v: "PAS", label: "PAS" },
  { v: "BAB", label: "BAB" },
  { v: "4P", label: "4P" },
  { v: "FAB", label: "FAB" },
];
const TTS_MODELS = [
  { v: "eleven_multilingual_v2", label: "Qualidade máxima" },
  { v: "eleven_turbo_v2_5", label: "Rápido" },
];

/** Largura máxima da prévia por formato — evita um 9:16 gigante ocupando a tela toda. */
const previewWidth = (r: RatioId) =>
  r === "9:16" ? "max-w-[320px]" : r === "4:5" ? "max-w-[420px]" : r === "16:9" ? "max-w-3xl" : "max-w-lg";

// ---------------------------------------------------------------- peças comuns

/** Mostra o que a ferramenta puxou do briefing — deixa claro que não é pra redigitar. */
function FromBrief({ items }: { items: { label: string; value: string }[] }) {
  const { setBriefOpen } = useStudio();
  const filled = items.filter((i) => i.value.trim());
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
          <Target className="w-3 h-3" /> vem do briefing
        </span>
        <button type="button" onClick={() => setBriefOpen(true)} className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1">
          <Pencil className="w-3 h-3" /> editar
        </button>
      </div>
      {filled.length ? (
        <dl className="mt-2 space-y-1">
          {filled.map((i) => (
            <div key={i.label} className="flex gap-2 text-[11px] leading-snug">
              <dt className="text-muted-foreground w-20 flex-shrink-0">{i.label}</dt>
              <dd className="font-medium truncate">{i.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Preencha o briefing uma vez e todas as ferramentas já vêm prontas.</p>
      )}
    </div>
  );
}

function GenerateButton({ busy, onClick, label, busyLabel, disabled }: {
  busy: boolean; onClick: () => void; label: string; busyLabel: string; disabled?: boolean;
}) {
  return (
    <Button className="w-full h-11 text-sm font-semibold" onClick={onClick} disabled={busy || disabled}>
      {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {busyLabel}</> : <><Wand2 className="w-4 h-4 mr-2" /> {label}</>}
    </Button>
  );
}

/** Barra de ações da prévia: baixar, refazer e mandar o resultado pra outra ferramenta. */
function ResultActions({ url, asset, onRedo, busy }: { url?: string | null; asset?: Asset; onRedo: () => void; busy: boolean }) {
  const { sendTo } = useStudio();
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {url && (
        <a href={url} download target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><Download className="w-3.5 h-3.5 mr-1.5" /> Baixar</Button>
        </a>
      )}
      <Button variant="outline" size="sm" onClick={onRedo} disabled={busy}>
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy ? "animate-spin" : ""}`} /> Refazer
      </Button>
      {asset && <SendToMenu asset={asset} onSend={(t) => sendTo(asset, t)} />}
    </div>
  );
}

/** Aviso curto quando falta o essencial do briefing. */
function NeedsBrief({ children }: { children: React.ReactNode }) {
  const { brief, setBriefOpen } = useStudio();
  if (brief.produto.trim()) return <>{children}</>;
  return (
    <EmptyState
      icon={Target}
      title="Conte o que você vende"
      sub="O briefing alimenta essa e todas as outras ferramentas. Leva 30 segundos."
      action={<Button size="sm" onClick={() => setBriefOpen(true)}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Abrir briefing</Button>}
    />
  );
}

/** Seletor de formato mestre — aparece nas ferramentas visuais. */
function RatioPicker() {
  const { brief, patchBrief } = useStudio();
  return (
    <Field label="Formato" hint="Muda o formato do projeto inteiro.">
      <div className="flex flex-wrap gap-1.5">
        {RATIOS.map((r) => (
          <Chip key={r.id} active={brief.ratio === r.id} onClick={() => patchBrief({ ratio: r.id })}>
            <Crop className="w-3 h-3" />{r.label}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

/** Roteiro único do projeto — narração, avatar e vídeo leem e escrevem aqui. */
function ScriptField({ rows = 6, hint }: { rows?: number; hint?: string }) {
  const { script, setScript } = useStudio();
  const secs = Math.max(1, Math.round(script.trim().split(/\s+/).filter(Boolean).length / 2.6));
  return (
    <Field label="Roteiro do projeto" hint={hint || "Compartilhado entre narração, avatar e vídeo — escreveu uma vez, vale pra todos."}>
      <Textarea rows={rows} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Cole ou escreva o texto que vai ser falado…" className="resize-y" />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{script.length} caracteres</span>
        {script.trim() && <span>≈ {secs}s de fala</span>}
      </div>
    </Field>
  );
}

/** Voz do projeto com troca inline (a voz vive no briefing, mas ninguém quer sair da aba). */
function VoicePicker() {
  const { brief, patchBrief } = useStudio();
  const { catalog, cloned, byId } = useVoices();
  const [open, setOpen] = useState(false);
  const voice = byId(brief.voice);
  return (
    <Field label="Voz" hint="A mesma voz vale para narração, avatar e vídeo.">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-lg border bg-card px-3 h-10 min-w-0">
          <Mic className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium truncate">{voice?.name || "Escolher voz"}</span>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setOpen((o) => !o)}>{open ? "Fechar" : "Trocar"}</Button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border bg-card p-2 max-h-60 overflow-y-auto space-y-1.5">
          {cloned.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Suas vozes</p>
              {cloned.map((v) => <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => { patchBrief({ voice: v.voiceId }); setOpen(false); }} />)}
            </>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-1">Catálogo</p>
          {catalog.map((v) => <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => { patchBrief({ voice: v.voiceId }); setOpen(false); }} />)}
        </div>
      )}
    </Field>
  );
}

// ---------------------------------------------------------------- Criativo

export function CriativoPanel() {
  const { brief, patchBrief, opts, patchOpts, imageUrl, runImage, busy, assets } = useStudio();
  const spec = ratioSpec(brief.ratio);
  const asset = assets.find((a) => a.url === imageUrl);

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle right={<span className="text-[11px] text-muted-foreground">{spec.imageSize}</span>}>Criativo</SectionTitle>
          <FromBrief items={[
            { label: "Produto", value: brief.produto },
            { label: "Público", value: brief.publico },
            { label: "Estilo", value: brief.estilo },
          ]} />

          <Field label="Texto estampado na imagem" hint="Deixe vazio pra IA escrever a headline.">
            <Input value={brief.headline} onChange={(e) => patchBrief({ headline: e.target.value })} placeholder="Ex.: 50% OFF só hoje" />
          </Field>

          <RatioPicker />

          <Field label="Qualidade">
            <div className="flex flex-wrap gap-1.5">
              {[{ v: "high", l: "Alta" }, { v: "medium", l: "Média" }, { v: "low", l: "Rascunho" }].map((q) => (
                <Chip key={q.v} active={opts.image.quality === q.v} onClick={() => patchOpts("image", { quality: q.v })}>{q.l}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Arquivo">
            <div className="flex flex-wrap gap-1.5">
              {["png", "jpeg", "webp"].map((f) => (
                <Chip key={f} active={opts.image.format === f} onClick={() => patchOpts("image", { format: f })}>{f.toUpperCase()}</Chip>
              ))}
              <Chip active={opts.image.background === "transparent"} onClick={() => patchOpts("image", { background: opts.image.background === "transparent" ? "auto" : "transparent" })}>
                Fundo transparente
              </Chip>
            </div>
          </Field>

          <GenerateButton busy={busy.image} onClick={() => void runImage()} label="Gerar criativo" busyLabel="Desenhando…" disabled={!brief.produto.trim()} />
        </>
      }
      preview={
        <>
          <SectionTitle right={imageUrl ? <span className="text-[11px] text-muted-foreground">{spec.label} · {spec.sub}</span> : undefined}>Prévia</SectionTitle>
          <div className={`mx-auto w-full ${previewWidth(brief.ratio)}`}>
            <Canvas ratio={spec.cls}>
              {busy.image ? <Loading label="Criando seu criativo…" sub="Costuma levar de 10 a 30 segundos" />
                : imageUrl ? <img src={imageUrl} alt="Criativo" className="w-full h-full object-cover" />
                : <NeedsBrief><EmptyState icon={ImageIcon} title="Seu criativo aparece aqui" sub="Escolha o formato e clique em gerar." /></NeedsBrief>}
            </Canvas>
          </div>
          {imageUrl && !busy.image && <ResultActions url={imageUrl} asset={asset} onRedo={() => void runImage()} busy={busy.image} />}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- Copy

export function CopyPanel() {
  const { brief, opts, patchOpts, copyOut, runCopy, busy, setScript, patchBrief, sendTo, setTab } = useStudio();
  const { toast } = useToast();

  const asAsset = (text: string, i: number): Asset => ({
    id: `copy-${i}`, kind: "copy", text, label: `Variação ${i + 1}`, from: "Copy", createdAt: Date.now(),
  });

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle>Copy que vende</SectionTitle>
          <FromBrief items={[
            { label: "Produto", value: brief.produto },
            { label: "Público", value: brief.publico },
            { label: "Dor", value: brief.dor },
            { label: "Benefícios", value: brief.beneficios },
            { label: "Oferta", value: brief.oferta },
            { label: "Tom", value: brief.tom },
          ]} />

          <Field label="O que você quer escrever">
            <div className="flex flex-wrap gap-1.5">
              {COPY_TYPES.map((t) => (
                <Chip key={t.v} active={opts.copy.tipo === t.v} onClick={() => patchOpts("copy", { tipo: t.v })}>{t.label}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Estrutura" hint="Frameworks de copywriting. Na dúvida, deixe automático.">
            <div className="flex flex-wrap gap-1.5">
              {FRAMEWORKS.map((f) => (
                <Chip key={f.v} active={opts.copy.framework === f.v} onClick={() => patchOpts("copy", { framework: f.v })}>{f.label}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Quantas versões">
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 8].map((n) => (
                <Chip key={n} active={opts.copy.variacoes === n} onClick={() => patchOpts("copy", { variacoes: n })}>{n}</Chip>
              ))}
            </div>
          </Field>

          <GenerateButton busy={busy.copy} onClick={() => void runCopy()} label="Escrever copy" busyLabel="Escrevendo…" disabled={!brief.produto.trim()} />
        </>
      }
      preview={
        <>
          <SectionTitle right={copyOut.length ? <span className="text-[11px] text-muted-foreground">{copyOut.length} versões</span> : undefined}>Resultados</SectionTitle>
          {busy.copy ? (
            <div className="py-16"><Loading label="Escrevendo suas variações…" sub="A IA está testando ângulos diferentes" /></div>
          ) : copyOut.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {copyOut.map((t, i) => (
                <div key={i} className="rounded-xl border bg-muted/20 p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-primary bg-accent rounded px-1.5 py-0.5">#{i + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(t); toast({ title: "Copiado!" }); }}
                        className="text-[11px] rounded-md px-1.5 h-6 inline-flex items-center gap-1 hover:bg-muted transition"
                      >
                        <CopyIcon className="w-3 h-3" /> copiar
                      </button>
                      <SendToMenu asset={asAsset(t, i)} onSend={(target) => sendTo(asAsset(t, i), target)} />
                    </div>
                  </div>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap flex-1">{t}</p>
                  <div className="flex gap-3 mt-2 pt-2 border-t">
                    <button
                      onClick={() => { setScript(t); toast({ title: "Virou o roteiro do projeto" }); setTab("narracao"); }}
                      className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Mic className="w-3 h-3" /> narrar
                    </button>
                    <button
                      onClick={() => { patchBrief({ headline: t.split("\n")[0].slice(0, 70) }); toast({ title: "Virou a headline do criativo" }); setTab("criativo"); }}
                      className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" /> virar criativo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16">
              <NeedsBrief><EmptyState icon={Type} title="Suas copies aparecem aqui" sub="Escolha o tipo de texto e clique em escrever." /></NeedsBrief>
            </div>
          )}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- Narração

export function NarracaoPanel() {
  const { opts, patchOpts, script, ttsUrl, runTts, busy, assets } = useStudio();
  const [advanced, setAdvanced] = useState(false);
  const asset = assets.find((a) => a.url === ttsUrl);

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle>Narração</SectionTitle>
          <VoicePicker />
          <ScriptField rows={7} />

          <Field label="Modelo">
            <div className="flex flex-wrap gap-1.5">
              {TTS_MODELS.map((m) => (
                <Chip key={m.v} active={opts.tts.modelId === m.v} onClick={() => patchOpts("tts", { modelId: m.v })}>{m.label}</Chip>
              ))}
            </div>
          </Field>

          <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {advanced ? "Esconder ajustes finos" : "Ajustes finos de voz"}
          </button>
          {advanced && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <Slider label="Estabilidade" value={opts.tts.stability} min={0} max={1} step={0.05} onChange={(n) => patchOpts("tts", { stability: n })} />
              <Slider label="Semelhança" value={opts.tts.similarityBoost} min={0} max={1} step={0.05} onChange={(n) => patchOpts("tts", { similarityBoost: n })} />
              <Slider label="Expressividade" value={opts.tts.style} min={0} max={1} step={0.05} onChange={(n) => patchOpts("tts", { style: n })} />
              <Slider label="Velocidade" value={opts.tts.speed} min={0.7} max={1.2} step={0.05} onChange={(n) => patchOpts("tts", { speed: n })} />
            </div>
          )}

          <GenerateButton busy={busy.tts} onClick={() => void runTts()} label="Gerar narração" busyLabel="Gravando…" disabled={!script.trim()} />
        </>
      }
      preview={
        <>
          <SectionTitle>Áudio</SectionTitle>
          {busy.tts ? (
            <div className="py-16"><Loading label="Dando voz ao seu texto…" /></div>
          ) : ttsUrl ? (
            <div className="rounded-xl border bg-muted/20 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Volume2 className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Narração pronta</p>
                  <p className="text-[11px] text-muted-foreground truncate">{script.slice(0, 90)}{script.length > 90 ? "…" : ""}</p>
                </div>
              </div>
              <audio controls src={ttsUrl} className="w-full" />
              <ResultActions url={ttsUrl} asset={asset} onRedo={() => void runTts()} busy={busy.tts} />
            </div>
          ) : (
            <div className="py-16">
              <EmptyState icon={Mic} title="Sua narração aparece aqui" sub="Escreva o roteiro, escolha a voz e gere o áudio." />
            </div>
          )}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- Avatar

export function AvatarPanel() {
  const { brief, patchBrief, script, avatarUrl, runAvatar, busy, assets } = useStudio();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const spec = ratioSpec(brief.ratio);
  const asset = assets.find((a) => a.url === avatarUrl);

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Foto muito grande", description: "Use uma imagem de até 8MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => patchBrief({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle>Avatar falante</SectionTitle>
          <Field label="Foto de rosto" hint="Rosto centralizado, boa luz, JPG/PNG até 8MB.">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 hover:border-primary/50 transition bg-card"
              >
                {brief.photo ? <img src={brief.photo} alt="Rosto" className="w-full h-full object-cover" /> : <UserRound className="w-7 h-7 text-muted-foreground/40" />}
              </button>
              <div className="min-w-0">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  {brief.photo ? "Trocar foto" : "Enviar foto"}
                </Button>
                {brief.photo && (
                  <button type="button" onClick={() => patchBrief({ photo: "" })} className="ml-2 text-[11px] text-muted-foreground hover:text-red-600 inline-flex items-center gap-1">
                    <X className="w-3 h-3" /> remover
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">Fica salva no briefing.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || undefined)} />
            </div>
          </Field>

          <VoicePicker />
          <ScriptField rows={6} hint="É o que o avatar vai falar — o mesmo roteiro da narração e do vídeo." />
          <RatioPicker />

          <GenerateButton
            busy={busy.avatar}
            onClick={() => void runAvatar()}
            label="Gerar avatar"
            busyLabel="Sincronizando lábios…"
            disabled={!brief.photo || !script.trim()}
          />
          {(!brief.photo || !script.trim()) && (
            <p className="text-[11px] text-muted-foreground text-center">
              {!brief.photo ? "Envie uma foto de rosto" : "Escreva o roteiro"} para liberar a geração.
            </p>
          )}
        </>
      }
      preview={
        <>
          <SectionTitle right={<span className="text-[11px] text-muted-foreground">{spec.videoSize}</span>}>Prévia</SectionTitle>
          <div className={`mx-auto w-full ${previewWidth(brief.ratio)}`}>
            <Canvas ratio={spec.cls}>
              {busy.avatar ? <Loading label="Criando o avatar…" sub="Pode levar de 1 a 3 minutos" />
                : avatarUrl ? <video src={avatarUrl} controls playsInline className="w-full h-full object-cover" />
                : <EmptyState icon={UserSquare2} title="Seu avatar aparece aqui" sub="Foto + roteiro viram um vídeo com lip-sync." />}
            </Canvas>
          </div>
          {avatarUrl && !busy.avatar && <ResultActions url={avatarUrl} asset={asset} onRedo={() => void runAvatar()} busy={busy.avatar} />}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- Vídeo

export function VideoPanel() {
  const { brief, opts, patchOpts, videoUrl, runVideo, busy, assets, imageUrl } = useStudio();
  const spec = ratioSpec(brief.ratio);
  const asset = assets.find((a) => a.url === videoUrl);
  const base = opts.video.imageUrl || "";

  return (
    <ToolLayout
      controls={
        <>
          <SectionTitle right={<span className="text-[11px] text-muted-foreground">{spec.videoSize}</span>}>Vídeo de anúncio</SectionTitle>
          <FromBrief items={[
            { label: "Produto", value: brief.produto },
            { label: "Estilo", value: brief.estilo },
          ]} />

          <Field label="Descreva a cena" hint="Deixe vazio e a IA monta a cena a partir do briefing.">
            <Textarea rows={3} value={opts.video.prompt} onChange={(e) => patchOpts("video", { prompt: e.target.value })} placeholder="Ex.: close no produto sobre mesa de mármore, luz natural, câmera girando devagar" />
          </Field>

          <Field label="Imagem base (opcional)" hint="A cena começa a partir dessa imagem.">
            {base ? (
              <div className="flex items-center gap-3">
                <img src={base} alt="Base" className="w-16 h-16 rounded-lg object-cover border" />
                <button type="button" onClick={() => patchOpts("video", { imageUrl: "" })} className="text-[11px] text-muted-foreground hover:text-red-600 inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> remover
                </button>
              </div>
            ) : imageUrl ? (
              <button
                type="button"
                onClick={() => patchOpts("video", { imageUrl })}
                className="w-full flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 hover:border-primary/50 hover:bg-muted/40 transition text-left"
              >
                <img src={imageUrl} alt="Último criativo" className="w-10 h-10 rounded-md object-cover" />
                <span className="text-xs font-medium inline-flex items-center gap-1">Usar o último criativo <ArrowRight className="w-3 h-3" /></span>
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground">Gere um criativo na aba Criativo e mande pra cá com “usar em”.</p>
            )}
          </Field>

          <ScriptField rows={4} hint="Vira a narração do MP4." />
          <RatioPicker />

          <Field label="Resolução">
            <div className="flex flex-wrap gap-1.5">
              {["480p", "720p", "1080p"].map((r) => (
                <Chip key={r} active={opts.video.resolution === r} onClick={() => patchOpts("video", { resolution: r })}>{r}</Chip>
              ))}
            </div>
          </Field>

          <Field label="Duração">
            <div className="flex flex-wrap gap-1.5">
              {[{ v: "auto", l: "Automática" }, { v: "5", l: "5s" }, { v: "10", l: "10s" }].map((d) => (
                <Chip key={d.v} active={opts.video.duration === d.v} onClick={() => patchOpts("video", { duration: d.v })}>{d.l}</Chip>
              ))}
            </div>
          </Field>

          <GenerateButton
            busy={busy.video}
            onClick={() => void runVideo()}
            label="Gerar vídeo"
            busyLabel="Renderizando…"
            disabled={!opts.video.prompt.trim() && !base && !brief.produto.trim()}
          />
        </>
      }
      preview={
        <>
          <SectionTitle right={videoUrl ? <span className="text-[11px] text-muted-foreground">{spec.label} · {spec.sub}</span> : undefined}>Prévia</SectionTitle>
          <div className={`mx-auto w-full ${previewWidth(brief.ratio)}`}>
            <Canvas ratio={spec.cls}>
              {busy.video ? <Loading label="Renderizando seu vídeo…" sub="Pode levar alguns minutos — dá pra trocar de aba." />
                : videoUrl ? <video src={videoUrl} controls playsInline className="w-full h-full object-cover" />
                : <NeedsBrief><EmptyState icon={Film} title="Seu vídeo aparece aqui" sub="Descreva a cena ou parta de um criativo já gerado." /></NeedsBrief>}
            </Canvas>
          </div>
          {videoUrl && !busy.video && <ResultActions url={videoUrl} asset={asset} onRedo={() => void runVideo()} busy={busy.video} />}
        </>
      }
    />
  );
}
