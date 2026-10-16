import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Search, Trash2, Copy as CopyIcon, Library } from "lucide-react";
import { useStudio } from "./store";
import { Chip, EmptyState, KIND_ICON, SectionTitle, SendToMenu } from "./ui";
import type { Asset, AssetKind } from "./types";

interface Gen {
  id: string; type: string; url?: string; text?: string; title: string; prompt?: string; createdAt: string;
}

const FILTERS = [
  { v: "all", label: "Tudo" },
  { v: "image", label: "Criativos" },
  { v: "copy", label: "Copies" },
  { v: "audio", label: "Áudios" },
  { v: "video", label: "Vídeos" },
];

const asKind = (t: string): AssetKind => (t === "image" || t === "copy" || t === "audio" || t === "video" ? t : "image");

/** Biblioteca: tudo o que você já gerou no Estúdio, com busca e reaproveitamento. */
export default function LibraryPanel() {
  const { sendTo } = useStudio();
  const { toast } = useToast();
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  const { data: items = [], isFetching, refetch } = useQuery({
    queryKey: ["/api/ai-studio/history", type, q],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (type !== "all") p.set("type", type);
      if (q) p.set("q", q);
      const r = await apiRequest("GET", `/api/ai-studio/history?${p.toString()}`);
      return (await r.json()) as Gen[];
    },
    staleTime: 0,
  });

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/ai-studio/history/${id}`);
      refetch();
    } catch {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
    }
  };

  const toAsset = (g: Gen): Asset => ({
    id: g.id,
    kind: asKind(g.type),
    url: g.url,
    text: g.text,
    label: g.title || "Sem título",
    from: "Biblioteca",
    createdAt: new Date(g.createdAt).getTime() || Date.now(),
  });

  return (
    <div className="rounded-2xl border bg-card shadow-sm p-5">
      <SectionTitle right={isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : <span className="text-[11px] text-muted-foreground">{items.length} itens</span>}>
        Biblioteca do projeto
      </SectionTitle>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por produto, prompt ou texto…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => <Chip key={f.v} active={type === f.v} onClick={() => setType(f.v)}>{f.label}</Chip>)}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={Library}
            title={q || type !== "all" ? "Nada encontrado" : "Sua biblioteca está vazia"}
            sub={q || type !== "all" ? "Tente outro filtro ou outra busca." : "Tudo o que você gerar no Estúdio fica guardado aqui."}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((g) => {
            const Icon = KIND_ICON[asKind(g.type)];
            const asset = toAsset(g);
            return (
              <div key={g.id} className="rounded-xl border bg-card overflow-hidden group">
                <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                  {g.type === "image" && g.url ? <img src={g.url} alt={g.title} className="w-full h-full object-cover" />
                    : g.type === "video" && g.url ? <video src={g.url} muted playsInline className="w-full h-full object-cover" />
                    : g.type === "copy" ? <p className="p-3 text-[10px] leading-snug text-muted-foreground line-clamp-6 text-left w-full">{g.text}</p>
                    : <Icon className="w-7 h-7 text-primary/50" />}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate">{g.title || "Sem título"}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">{new Date(g.createdAt).toLocaleDateString("pt-BR")}</p>
                  <div className="flex items-center gap-1">
                    <SendToMenu asset={asset} onSend={(t) => sendTo(asset, t)} />
                    {g.url && (
                      <a href={g.url} download target="_blank" rel="noreferrer" title="Baixar">
                        <Button variant="ghost" size="sm" className="h-7 px-2"><Download className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    {g.text && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" title="Copiar"
                        onClick={() => { navigator.clipboard.writeText(g.text || ""); toast({ title: "Copiado!" }); }}>
                        <CopyIcon className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 ml-auto text-muted-foreground hover:text-red-600" title="Excluir"
                      onClick={() => void remove(g.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
