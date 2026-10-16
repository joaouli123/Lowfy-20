import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Layers, Trash2 } from "lucide-react";
import { useStudio, KIND_LABEL } from "./store";
import { AssetPreview, KIND_ICON, SendToMenu } from "./ui";

/**
 * Bandeja do projeto: tudo o que foi gerado nesta sessão fica à mão em qualquer aba.
 * É o que dá a sensação de "mesa de trabalho" — as peças não somem ao trocar de ferramenta.
 */
export default function AssetDock() {
  const { assets, removeAsset, clearAssets, sendTo } = useStudio();
  const [open, setOpen] = useState(true);

  if (!assets.length) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Bandeja do projeto</span>
          <span className="text-[11px] text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">{assets.length}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground hover:text-red-600" onClick={clearAssets}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
        </Button>
      </div>

      {open && (
        <div className="border-t px-4 py-3 overflow-x-auto">
          <div className="flex gap-3 min-w-min">
            {assets.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <div key={a.id} className="w-40 flex-shrink-0 rounded-xl border bg-card overflow-hidden">
                  <div className="h-24 bg-muted/30 flex items-center justify-center overflow-hidden">
                    <AssetPreview asset={a} />
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium truncate">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Icon className="w-3 h-3" /> {KIND_LABEL[a.kind]} · {a.from}
                    </p>
                    <SendToMenu asset={a} onSend={(t) => sendTo(a, t)} onDelete={() => removeAsset(a.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
