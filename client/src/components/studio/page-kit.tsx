import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, CloudUpload, X, Trash2, ArrowRight, Loader2, FileAudio, FileVideo, Download, Maximize2 } from "lucide-react";

// Peças visuais comuns às páginas do Estúdio (Criativo, Copy, Narração, Avatar, Vídeo):
// cabeçalho com dica, card de formulário, chips, upload e coluna de preview.

export const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring cursor-pointer";

export function PageHeader({ icon: Icon, title, sub, tip }: { icon: any; title: string; sub: string; tip: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_70%,transparent)] via-card to-card p-4 sm:p-5 flex items-center gap-3 sm:gap-4 flex-wrap">
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0 basis-[220px]">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-[13px] sm:text-sm text-muted-foreground">{sub}</p>
      </div>
      <div className="flex w-full md:w-auto items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_60%,transparent)] px-4 py-3 max-w-sm">
        <Lightbulb className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="text-xs leading-snug"><span className="font-semibold text-primary">Dica:</span> {tip}</p>
      </div>
    </div>
  );
}

export function PageGrid({ form, preview }: { form: React.ReactNode; preview: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px] items-start [&>*]:min-w-0">{form}{preview}</div>;
}

export function FormPanel({ icon: Icon, title, sub, children, footer }: {
  icon: any; title: string; sub: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-5 min-w-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-primary" />
        </div>
        <div>
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
      <div className="pt-1">{footer}</div>
    </div>
  );
}

export function PreviewPanel({ icon: Icon, title = "Preview", sub, children, actions, busy }: {
  icon: any; title?: string; sub: string; children: React.ReactNode; actions?: React.ReactNode; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // No celular o preview fica embaixo do formulário: ao gerar, rola até ele.
  useEffect(() => {
    if (busy && window.innerWidth < 1280) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [busy]);
  return (
    <div ref={ref} className="scroll-mt-20 rounded-2xl border bg-card p-4 sm:p-5 flex flex-col gap-4 xl:sticky xl:top-4 w-full min-w-0">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
        <div>
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
      {actions && <div className="grid grid-cols-2 gap-2 sm:gap-3 [&_button]:text-xs sm:[&_button]:text-sm">{actions}</div>}
    </div>
  );
}

/** Caixinha com ícone + título (Tamanho e formato, Estilo visual...). */
export function OptionCard({ icon: Icon, title, sub, optional, children, className = "" }: {
  icon: any; title: string; sub?: string; optional?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-3.5 sm:p-4 min-w-0 ${className}`}>
      <div className="flex items-start gap-2.5 mb-3">
        <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold leading-tight">
            {title} {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function FieldLabel({ children, required, optional, upper }: { children: React.ReactNode; required?: boolean; optional?: boolean; upper?: boolean }) {
  return (
    <label className={`block mb-1.5 ${upper ? "text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]" : "text-[13px] font-semibold"}`}>
      {children}
      {required && <span className="text-primary"> *</span>}
      {optional && <span className="font-normal text-muted-foreground normal-case"> (opcional)</span>}
    </label>
  );
}

export function Pill({ active, onClick, children, icon: Icon, className = "" }: {
  active: boolean; onClick: () => void; children: React.ReactNode; icon?: any; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition whitespace-nowrap ${
        active ? "border-[color-mix(in_srgb,var(--primary)_50%,transparent)] bg-accent text-primary shadow-sm" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

export function PillGroup<T extends string>({ options, value, onChange, cols }: {
  options: { v: T; label: string; icon?: any }[]; value: T; onChange: (v: T) => void; cols?: number;
}) {
  return (
    <div className={cols ? "grid gap-2" : "flex flex-wrap gap-2"} style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => (
        <Pill key={o.v} active={value === o.v} onClick={() => onChange(o.v)} icon={o.icon}>{o.label}</Pill>
      ))}
    </div>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  return <p className={`text-right text-[11px] mt-1 ${value.length > max ? "text-red-600" : "text-muted-foreground"}`}>{value.length}/{max}</p>;
}

export interface UploadedFile { data: string; type: string; name: string }

/** Área tracejada de upload. Lê o arquivo como data URL. */
export function UploadBox({ accept, hint, maxMb, value, onChange, multiple, label = "Clique para enviar uma imagem" }: {
  accept: string; hint: string; maxMb: number; value: UploadedFile[]; onChange: (f: UploadedFile[]) => void; multiple?: boolean; label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [drag, setDrag] = useState(false);

  const read = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, multiple ? 5 : 1);
    for (const f of list) {
      if (f.size > maxMb * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: `${f.name} passa de ${maxMb}MB.`, variant: "destructive" });
        return;
      }
    }
    Promise.all(list.map((f) => new Promise<UploadedFile>((res) => {
      const r = new FileReader();
      r.onload = () => res({ data: String(r.result), type: f.type, name: f.name });
      r.readAsDataURL(f);
    }))).then((got) => onChange(multiple ? [...value, ...got].slice(0, 5) : got));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((f, i) => (
            <div key={i} className="relative group flex items-center gap-2 rounded-lg border bg-[color-mix(in_srgb,var(--muted)_30%,transparent)] p-1.5 pr-7 max-w-full">
              {f.type.startsWith("image/") ? (
                <img src={f.data} alt={f.name} className="w-10 h-10 rounded-md object-cover" />
              ) : f.type.startsWith("video/") ? (
                <FileVideo className="w-8 h-8 text-primary" />
              ) : (
                <FileAudio className="w-8 h-8 text-primary" />
              )}
              <span className="text-[11px] truncate max-w-[140px]">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Remover arquivo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {(multiple ? value.length < 5 : value.length === 0) && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files); }}
          className={`w-full rounded-lg border-2 border-dashed py-4 px-3 flex items-center justify-center gap-3 transition ${
            drag ? "border-primary bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]" : "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
          }`}
        >
          <CloudUpload className="w-6 h-6 text-muted-foreground flex-shrink-0" />
          <span className="text-left">
            <span className="block text-xs font-semibold">{label}</span>
            <span className="block text-[11px] text-muted-foreground">{hint}</span>
          </span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { read(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

export function FormFooter({ onClear, onSubmit, busy, disabled, label, busyLabel, icon: Icon }: {
  onClear: () => void; onSubmit: () => void; busy: boolean; disabled?: boolean; label: string; busyLabel: string; icon: any;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-t pt-4">
      <Button variant="outline" onClick={onClear} className="h-10 px-5 w-full sm:w-auto"><Trash2 className="w-4 h-4 mr-2" /> Limpar</Button>
      <Button onClick={onSubmit} disabled={disabled || busy} className="h-11 sm:h-10 w-full sm:w-auto sm:min-w-[220px]">
        {busy
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {busyLabel}</>
          : <><Icon className="w-4 h-4 mr-2" /> {label} <ArrowRight className="w-4 h-4 ml-2" /></>}
      </Button>
    </div>
  );
}

export function PreviewLoading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 bg-[color-mix(in_srgb,var(--card)_70%,transparent)] backdrop-blur-[1px]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Mostra quais campos obrigatórios faltam, embaixo do botão de gerar. */
export function MissingHint({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return <p className="text-[11px] text-muted-foreground text-center sm:text-right -mt-1">Falta preencher: {missing.join(", ")}</p>;
}

/** Campos obrigatórios que ainda estão vazios. */
export const missingOf = (fields: [string, unknown][]) =>
  fields.filter(([, v]) => !(typeof v === "string" ? v.trim() : v)).map(([k]) => k);

/** Estado de formulário da página, guardado no navegador (sobrevive ao recarregar). */
export function useLocalForm<T extends object>(key: string, defaults: T) {
  const storageKey = `lowfy.studio.form.${key}`;
  const [form, setForm] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  });
  const patch = (p: Partial<T>) => setForm((f) => {
    const next = { ...f, ...p };
    try {
      // Arquivos (data URL) não vão pro localStorage: estouram a cota.
      const light = Object.fromEntries(Object.entries(next).filter(([, v]) => !(Array.isArray(v) && v.some((x: any) => x?.data))));
      localStorage.setItem(storageKey, JSON.stringify(light));
    } catch { /* sem persistência */ }
    return next;
  });
  const reset = () => { try { localStorage.removeItem(storageKey); } catch { /* ok */ } setForm(defaults); };
  return [form, patch, reset] as const;
}

/** Botão de baixar: baixa o arquivo pela URL; fica desabilitado até existir resultado. */
export function DownloadButton({ url, label = "Baixar", filename }: { url: string | null; label?: string; filename?: string }) {
  return (
    <Button
      variant="outline"
      className="h-10 w-full"
      disabled={!url}
      onClick={() => {
        if (!url) return;
        const a = Object.assign(document.createElement("a"), { href: url, download: filename || url.split("/").pop() || "lowfy" });
        document.body.appendChild(a);
        a.click();
        a.remove();
      }}
    >
      <Download className="w-4 h-4 mr-2 flex-shrink-0" /> <span className="truncate">{label}</span>
    </Button>
  );
}

/** Abre o resultado em outra aba, em tela cheia. */
export function FullscreenButton({ url }: { url: string | null }) {
  return (
    <Button variant="outline" className="h-10 w-full" disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")}>
      <Maximize2 className="w-4 h-4 mr-2 flex-shrink-0" /> <span className="truncate hidden sm:inline">Abrir em tela cheia</span><span className="sm:hidden">Tela cheia</span>
    </Button>
  );
}
