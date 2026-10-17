import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Search, Trash2, Copy as CopyIcon, History } from "lucide-react";
import { useStudio } from "./store";
import { KIND_ICON, SendToMenu } from "./ui";
import type { Asset, AssetKind, ToolId } from "./types";

interface Gen {
  id: string; type: string; url?: string; text?: string; title: string; prompt?: string; createdAt: string;
}

const NOME: Partial<Record<ToolId, string>> = {
  criativo: "criativos", copy: "copies", narracao: "narrações", avatar: "avatares", video: "vídeos", motion: "motions",
};

const asKind = (t: string): AssetKind => (t === "image" || t === "copy" || t === "audio" || t === "video" ? t : "image");
const POR_PAGINA = 8;

/** Histórico de UMA ferramenta do Estúdio: o que a pessoa já gerou ali, com busca e reaproveitamento. */
export default function ToolHistory({ tool }: { tool: ToolId }) {
  const { sendTo } = useStudio();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const { data: items = [], isFetching, refetch } = useQuery({
    queryKey: ["/api/ai-studio/history", tool, q],
    queryFn: async () => {
      const p = new URLSearchParams({ tool });
      if (q) p.set("q", q);
      return (await (await apiRequest("GET", `/api/ai-studio/history?${p.toString()}`)).json()) as Gen[];
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });

  if (!items.length && !q) return null;

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/ai-studio/history/${id}`);
      void refetch();
    } catch {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
    }
  };

  const toAsset = (g: Gen): Asset => ({
    id: g.id, kind: asKind(g.type), url: g.url, text: g.text, label: g.title || "Sem título", from: "Histórico",
    createdAt: new Date(g.createdAt).getTime() || Date.now(),
  });

  return (
    <section className="rounded-2xl border bg-card shadow-sm p-4 sm:p-5 mt-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] flex items-center justify-center flex-shrink-0">
            <History className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Seu histórico</p>
            <p className="text-[11px] text-muted-foreground">{items.length} {NOME[tool] || "itens"} gerados aqui</p>
          </div>
          {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no histórico…" className="pl-9 h-9" />
        </div>
      </div>

      {!items.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nada encontrado para “{q}”.</p>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {items.slice(0, limite).map((g) => {
              const Icon = KIND_ICON[asKind(g.type)];
              const asset = toAsset(g);
              return (
                <div key={g.id} className="rounded-xl border bg-card overflow-hidden min-w-0">
                  <div className="aspect-video bg-[color-mix(in_srgb,var(--muted)_40%,transparent)] flex items-center justify-center overflow-hidden">
                    {g.type === "image" && g.url ? <img src={g.url} alt={g.title} loading="lazy" className="w-full h-full object-cover" />
                      : g.type === "video" && g.url ? <video src={g.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      : g.type === "audio" && g.url ? <div className="w-full px-2"><audio src={g.url} controls preload="none" className="w-full h-8" /></div>
                      : g.type === "copy" ? <p className="p-3 text-[10px] leading-snug text-muted-foreground line-clamp-6 text-left w-full whitespace-pre-line">{g.text}</p>
                      : <Icon className="w-7 h-7 text-primary/50" />}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate" title={g.title}>{g.title || "Sem título"}</p>
                    <p className="text-[10px] text-muted-foreground mb-2">{new Date(g.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                    <div className="flex items-center gap-1">
                      <SendToMenu asset={asset} onSend={(t) => sendTo(asset, t)} />
                      {g.url && (
                        <a href={g.url} download target="_blank" rel="noreferrer" title="Baixar">
                          <Button variant="ghost" size="sm" className="h-7 px-2"><Download className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                      {g.text && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" title="Copiar"
                          onClick={() => { void navigator.clipboard.writeText(g.text || ""); toast({ title: "Copiado!" }); }}>
                          <CopyIcon className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-2 ml-auto text-muted-foreground hover:text-red-600" title="Excluir" onClick={() => void remove(g.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {items.length > limite && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + POR_PAGINA * 2)}>Ver mais ({items.length - limite})</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
