import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, Target, Users, Frown, Gift, Palette, Crop, Mic2, UserRound, Sparkles, X, Check,
} from "lucide-react";
import { useStudio } from "./store";
import { RATIOS } from "./types";
import { Chip, Field, VoiceCard, useVoices } from "./ui";

const TONS = ["Direto", "Emocional", "Autoridade", "Divertido", "Urgente", "Sofisticado"];
const ESTILOS = ["Fotográfico", "Minimalista", "Gradiente", "Estúdio", "3D realista", "Vibrante", "Cinematográfico", "Flat / clean"];

/**
 * O briefing é preenchido uma única vez e abastece TODAS as ferramentas e fluxos.
 * Fechado, vira uma faixa de chips com o resumo do projeto; aberto, é o formulário.
 */
export default function BriefBar() {
  const { brief, patchBrief, missingFor, briefOpen: open, setBriefOpen } = useStudio();
  const { catalog, cloned, byId } = useVoices();
  const { toast } = useToast();
  const [voicesOpen, setVoicesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filled = [brief.produto, brief.publico, brief.dor, brief.beneficios, brief.estilo, brief.tom].filter(Boolean).length;
  const pct = Math.round((filled / 6) * 100);
  const missing = missingFor(null);
  const voice = byId(brief.voice);

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Foto muito grande", description: "Use uma imagem de até 8MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => patchBrief({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* faixa-resumo */}
      <button
        type="button"
        onClick={() => setBriefOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Briefing do projeto</span>
            <span className="text-[10px] font-medium text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">preenche uma vez, vale pra tudo</span>
          </div>
          {brief.produto ? (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-muted-foreground">
              <Summary icon={Target} text={brief.produto} strong />
              {brief.publico && <Summary icon={Users} text={brief.publico} />}
              {brief.dor && <Summary icon={Frown} text={brief.dor} />}
              <Summary icon={Crop} text={RATIOS.find((r) => r.id === brief.ratio)?.label || brief.ratio} />
              {voice && <Summary icon={Mic2} text={voice.name} />}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5">Diga o que você vende — a IA usa isso em criativos, copy, narração e vídeos.</p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{pct}%</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t p-4 sm:p-5 space-y-4 bg-muted/20">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="O que você vende" required hint="Produto, serviço ou oferta principal.">
              <Input value={brief.produto} onChange={(e) => patchBrief({ produto: e.target.value })} placeholder="Ex.: Curso de marketing do zero" />
            </Field>
            <Field label="Pra quem" hint="Quanto mais específico, melhor a copy.">
              <Input value={brief.publico} onChange={(e) => patchBrief({ publico: e.target.value })} placeholder="Ex.: mães empreendedoras" />
            </Field>
            <Field label="Qual a dor" hint="O problema que faz a pessoa comprar.">
              <Input value={brief.dor} onChange={(e) => patchBrief({ dor: e.target.value })} placeholder="Ex.: não sabem por onde começar" />
            </Field>
            <Field label="Headline (opcional)" hint="Deixe vazio: a IA escreve uma.">
              <Input value={brief.headline} onChange={(e) => patchBrief({ headline: e.target.value })} placeholder="Ex.: 50% OFF SÓ HOJE" />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Benefícios / o que a pessoa ganha">
              <Textarea rows={2} value={brief.beneficios} onChange={(e) => patchBrief({ beneficios: e.target.value })} placeholder="Ex.: método passo a passo, suporte no WhatsApp, garantia de 7 dias" />
            </Field>
            <Field label="Oferta / preço / condição">
              <Textarea rows={2} value={brief.oferta} onChange={(e) => patchBrief({ oferta: e.target.value })} placeholder="Ex.: R$ 97 à vista ou 12x de R$ 9,70 + bônus" />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Tom de voz">
              <div className="flex flex-wrap gap-1.5">
                {TONS.map((t) => <Chip key={t} active={brief.tom === t} onClick={() => patchBrief({ tom: brief.tom === t ? "" : t })}>{t}</Chip>)}
              </div>
            </Field>
            <Field label="Estilo visual" hint="Vale pros criativos e cenas de vídeo.">
              <div className="flex flex-wrap gap-1.5">
                {ESTILOS.map((s) => <Chip key={s} active={brief.estilo === s} onClick={() => patchBrief({ estilo: brief.estilo === s ? "" : s })}><Palette className="w-3 h-3" />{s}</Chip>)}
              </div>
            </Field>
            <Field label="Formato mestre" hint="Define a proporção de imagens e vídeos do projeto.">
              <div className="flex flex-wrap gap-1.5">
                {RATIOS.map((r) => (
                  <Chip key={r.id} active={brief.ratio === r.id} onClick={() => patchBrief({ ratio: r.id })}>
                    <Crop className="w-3 h-3" />{r.label} <span className="text-muted-foreground/70">· {r.sub}</span>
                  </Chip>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Voz do projeto" hint="Usada em narração, avatar e vídeos. Toque no play pra ouvir.">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-lg border bg-card px-3 h-10">
                  <Mic2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{voice?.name || "Escolher voz"}</span>
                  {voice?.tag && <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">· {voice.tag}</span>}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setVoicesOpen((v) => !v)}>
                  {voicesOpen ? "Fechar" : "Trocar"}
                </Button>
              </div>
              {voicesOpen && (
                <div className="mt-2 rounded-xl border bg-card p-2 max-h-64 overflow-y-auto space-y-1.5">
                  {cloned.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">Suas vozes clonadas</p>
                      {cloned.map((v) => (
                        <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => { patchBrief({ voice: v.voiceId }); setVoicesOpen(false); }} />
                      ))}
                    </>
                  )}
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pt-1">Catálogo</p>
                  {catalog.map((v) => (
                    <VoiceCard key={v.voiceId} voice={v} active={brief.voice === v.voiceId} onSelect={() => { patchBrief({ voice: v.voiceId }); setVoicesOpen(false); }} />
                  ))}
                </div>
              )}
            </Field>

            <Field label="Foto de rosto (para avatar falante)" hint="Opcional — só é exigida em fluxos com avatar.">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 hover:border-primary/50 transition bg-card"
                >
                  {brief.photo ? <img src={brief.photo} alt="Foto" className="w-full h-full object-cover" /> : <UserRound className="w-6 h-6 text-muted-foreground/40" />}
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
                  <p className="text-[11px] text-muted-foreground mt-1">JPG/PNG até 8MB, rosto centralizado.</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || undefined)} />
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t">
            <p className="text-[11px] text-muted-foreground pt-3 flex items-center gap-1.5">
              {missing.length ? (
                <><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Falta preencher: <strong className="text-foreground">{missing.join(", ")}</strong></>
              ) : (
                <><Check className="w-3.5 h-3.5 text-primary" /> Briefing pronto — todas as ferramentas já vêm preenchidas.</>
              )}
            </p>
            <Button size="sm" className="mt-3" onClick={() => setBriefOpen(false)}>Fechar briefing</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ icon: Icon, text, strong }: { icon: any; text: string; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 max-w-[220px] ${strong ? "bg-accent text-accent-foreground font-medium" : "bg-muted"}`}>
      <Icon className="w-3 h-3 flex-shrink-0 opacity-70" />
      <span className="truncate">{text}</span>
    </span>
  );
}
