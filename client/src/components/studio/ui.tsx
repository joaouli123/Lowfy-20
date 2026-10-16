import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ELEVEN_VOICES } from "@/lib/elevenVoices";
import {
  Check, Loader2, Volume2, ImageIcon, Type, Mic, Video, UserSquare2, Download, Copy as CopyIcon,
  Trash2, ArrowRight, Play,
} from "lucide-react";
import type { Asset, AssetKind, ToolId } from "./types";

// ---------- básicos de formulário ----------

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70 leading-snug">{hint}</p>}
    </div>
  );
}

export function Chip({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg border transition ${
        active
          ? "bg-accent text-accent-foreground border-primary/40 shadow-sm"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ChipRow<T extends string | number>({ options, value, onChange }: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip key={String(o.v)} active={value === o.v} onClick={() => onChange(o.v)}>{o.label}</Chip>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
        <span>{label}</span><span className="font-medium text-foreground">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-primary h-1.5 cursor-pointer" />
    </div>
  );
}

// ---------- estados de tela ----------

export function EmptyState({ icon: Icon, title, sub, action }: { icon: any; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="text-center px-6 py-8">
      <div className="w-14 h-14 rounded-2xl bg-card border border-dashed flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-0.5 max-w-xs mx-auto">{sub}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

export function Canvas({ children, ratio = "aspect-[4/3]", className = "" }: { children: React.ReactNode; ratio?: string; className?: string }) {
  return (
    <div className={`w-full ${ratio} rounded-xl border bg-muted/25 flex items-center justify-center overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/**
 * Esqueleto de duas colunas usado por todas as ferramentas: controles à esquerda
 * (largura fixa e confortável) e a peça sendo criada ocupando o resto da tela.
 */
export function ToolLayout({ controls, preview }: { controls: React.ReactNode; preview: React.ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
      <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-4 self-start">{controls}</div>
      <div className="rounded-2xl border bg-card shadow-sm p-5 self-start">{preview}</div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-sm font-semibold tracking-tight">{children}</h3>
      {right}
    </div>
  );
}

// ---------- assets ----------

export const KIND_ICON: Record<AssetKind, any> = { image: ImageIcon, copy: Type, audio: Mic, video: Video };

export function AssetPreview({ asset, className = "" }: { asset: Asset; className?: string }) {
  if (asset.kind === "image" && asset.url) return <img src={asset.url} alt={asset.label} className={`w-full h-full object-cover ${className}`} />;
  if (asset.kind === "video" && asset.url) return <video src={asset.url} muted playsInline className={`w-full h-full object-cover ${className}`} />;
  if (asset.kind === "audio") return <div className="w-full h-full flex items-center justify-center bg-primary/5"><Volume2 className="w-5 h-5 text-primary" /></div>;
  return <p className="p-2 text-[10px] leading-snug text-muted-foreground line-clamp-5 w-full h-full overflow-hidden text-left">{asset.text}</p>;
}

/** Menu "usar em…" — é o que transforma resultados soltos em um fluxo de trabalho. */
export function SendToMenu({ asset, onSend, onDelete }: { asset: Asset; onSend: (t: ToolId) => void; onDelete?: () => void }) {
  const targets: { id: ToolId; label: string; icon: any; hint: string }[] =
    asset.kind === "copy"
      ? [
          { id: "narracao", label: "Narrar esse texto", icon: Mic, hint: "vira áudio com voz realista" },
          { id: "avatar", label: "Avatar falando", icon: UserSquare2, hint: "vídeo com lip-sync" },
          { id: "video", label: "Roteiro do vídeo", icon: Video, hint: "usa como narração do MP4" },
          { id: "criativo", label: "Headline do criativo", icon: ImageIcon, hint: "estampa na imagem" },
        ]
      : asset.kind === "image"
      ? [
          { id: "video", label: "Animar em vídeo", icon: Video, hint: "usa como cena base" },
          { id: "avatar", label: "Usar como rosto", icon: UserSquare2, hint: "precisa ser uma foto de pessoa" },
        ]
      : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-[11px] font-medium border rounded-lg px-2 h-7 inline-flex items-center gap-1 hover:bg-accent hover:border-primary/30 transition">
          Usar em <ArrowRight className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        {targets.length ? (
          targets.map((t) => (
            <button key={t.id} onClick={() => onSend(t.id)} className="w-full flex items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted transition">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5"><t.icon className="w-3.5 h-3.5 text-primary" /></div>
              <div className="min-w-0">
                <p className="text-xs font-medium">{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.hint}</p>
              </div>
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">Baixe ou reutilize esse arquivo direto.</p>
        )}
        <div className="border-t mt-1.5 pt-1.5 flex gap-1">
          {asset.url && (
            <a href={asset.url} download target="_blank" rel="noreferrer" className="flex-1 text-[11px] rounded-lg px-2 py-1.5 hover:bg-muted inline-flex items-center justify-center gap-1.5 transition">
              <Download className="w-3.5 h-3.5" /> Baixar
            </a>
          )}
          {asset.text && (
            <button onClick={() => navigator.clipboard.writeText(asset.text || "")} className="flex-1 text-[11px] rounded-lg px-2 py-1.5 hover:bg-muted inline-flex items-center justify-center gap-1.5 transition">
              <CopyIcon className="w-3.5 h-3.5" /> Copiar
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-[11px] rounded-lg px-2 py-1.5 hover:bg-red-50 hover:text-red-600 inline-flex items-center gap-1.5 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- vozes ----------

export interface StudioVoice { voiceId: string; name: string; category?: string; previewUrl?: string; tag?: string; gender?: string }

export function useVoices() {
  const { data, refetch } = useQuery({
    queryKey: ["/api/ai-studio/voices"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ai-studio/voices");
      return (await r.json()) as { voices: StudioVoice[] };
    },
    staleTime: 5 * 60 * 1000,
  });
  const remote = data?.voices || [];
  const cloned = remote.filter((v) => ["cloned", "professional", "generated"].includes(String(v.category)));
  // Sem chave no servidor a lista vem vazia; o catálogo público garante prévias audíveis.
  const catalog: StudioVoice[] = remote.length ? remote : (ELEVEN_VOICES as StudioVoice[]);
  const byId = (id: string) => catalog.find((v) => v.voiceId === id) || ELEVEN_VOICES.find((v) => v.voiceId === id);
  return { catalog, cloned, remote, byId, refetch };
}

export function playPreview(url?: string) {
  if (!url) return;
  try { new Audio(url).play(); } catch { /* navegador bloqueou o autoplay */ }
}

export function VoiceCard({ active, voice, onSelect }: { active: boolean; voice: StudioVoice; onSelect: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${active ? "bg-accent border-primary/40 shadow-sm" : "bg-card border-border hover:bg-muted"}`}>
      {voice.previewUrl && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); playPreview(voice.previewUrl); }}
          className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 hover:bg-primary/20 transition"
          title="Ouvir amostra"
        >
          <Play className="w-3 h-3 text-primary fill-primary" />
        </button>
      )}
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
        <p className="text-xs font-semibold truncate">{voice.name}</p>
        {voice.tag && <p className="text-[10px] text-muted-foreground truncate">{voice.tag}</p>}
      </button>
      {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
    </div>
  );
}
