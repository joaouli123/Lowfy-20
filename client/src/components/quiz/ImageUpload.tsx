import { useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Icons } from "@/lib/quizIcons";

/**
 * Upload de imagem com otimização (compressão + WebP no servidor).
 * Aceita upload de arquivo OU colar uma URL. Mostra o quanto comprimiu.
 */
export default function ImageUpload({ value, onChange, folder = "quiz-uploads", compact = false, label }: {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  compact?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");
  const [showUrl, setShowUrl] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Envie uma imagem"); return; }
    setErr(""); setLoading(true); setSaved(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const r = await apiRequest("POST", "/api/upload/image", fd);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Falha no upload");
      onChange(d.url);
      setSaved(d.savedPct ?? 0);
    } catch (e: any) { setErr(e.message || "Erro ao enviar"); }
    finally { setLoading(false); }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          className="w-10 h-10 rounded-lg border border-dashed flex items-center justify-center overflow-hidden hover:border-primary shrink-0 bg-muted/30">
          {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : value ? <img src={value} className="w-full h-full object-cover" /> : <Icons.ImagePlus className="w-4 h-4 text-muted-foreground" />}
        </button>
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="ou cole a URL"
          className="flex-1 border rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800 outline-none focus:border-primary" />
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div>
      {label && <label className="text-xs text-muted-foreground block mb-1">{label}</label>}
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          className="flex-1 border-2 border-dashed rounded-lg p-3 flex items-center justify-center gap-2 hover:border-primary/60 transition text-sm overflow-hidden min-h-[64px]">
          {loading ? <><Icons.Loader2 className="w-4 h-4 animate-spin" /> Otimizando…</>
            : value ? <img src={value} className="max-h-20 rounded object-contain" />
              : <><Icons.Upload className="w-4 h-4 text-muted-foreground" /> <span className="text-muted-foreground">Enviar imagem (otimizada)</span></>}
        </button>
        <div className="flex flex-col gap-1">
          {value && <button type="button" onClick={() => { onChange(""); setSaved(null); }} className="border rounded-lg px-2 py-1.5 hover:bg-red-50 hover:text-red-600" title="Remover"><Icons.Trash2 className="w-3.5 h-3.5" /></button>}
          <button type="button" onClick={() => setShowUrl((s) => !s)} className="border rounded-lg px-2 py-1.5 hover:bg-accent" title="Colar URL"><Icons.Link className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {showUrl && <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="mt-1.5 w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 outline-none focus:border-primary" />}
      {saved !== null && <p className="text-[11px] text-emerald-600 mt-1">✓ Otimizada {saved > 0 ? `(−${saved}% de tamanho)` : ""}</p>}
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
