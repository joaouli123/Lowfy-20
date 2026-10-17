import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Target, Search, Loader2, Bookmark, BookmarkCheck, Radar, ExternalLink, Flame, Play, SlidersHorizontal, X, Copy, Download,
  MoreVertical, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, Pause, Link2, ShoppingCart, History, CheckCircle2, FlaskConical,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PLATAFORMAS } from "./hackAdsPlatforms";

// ---------------- tipos ----------------
interface Ad {
  id: number; extId: string; pageId: string | null; pageName: string | null; pageKey: string; text: string; mediaType: string;
  libraryUrl: string; destinationUrl: string | null; domain: string | null; checkoutUrl: string | null; checkoutPlatform: string | null;
  countries: string[]; platforms: string[]; language: string | null; category: string | null; startedAt: string | null; active: boolean | null;
  days: number | null; duplicates: number; pageAds: number; hot: boolean; selo: "teste" | "validado" | null;
  hasImage: boolean; hasVideo: boolean; hasAvatar: boolean; favorite: boolean; monitored: boolean; lastSeen: string;
}
interface Monitor {
  pageKey: string; pageName: string; lastCheckedAt: string | null; lastError: string | null; avatarAd: number | null; adsNaBase: number;
  snapshots: { at: string; activeAds: number }[]; activeAds: number | null; status: string; variacao: number | null; checando: boolean;
}
type Aba = "biblioteca" | "alta" | "salvos" | "monitorando" | "buscas";

const PAISES = [
  { v: "BR", l: "Brasil" }, { v: "PT", l: "Portugal" }, { v: "US", l: "Estados Unidos" }, { v: "ES", l: "Espanha" },
  { v: "MX", l: "México" }, { v: "AR", l: "Argentina" }, { v: "CO", l: "Colômbia" }, { v: "ALL", l: "Todos os países" },
];
const ORDENS = [
  { v: "recent", l: "Vistos por último" }, { v: "duplicates", l: "Mais anúncios (escalando)" }, { v: "days", l: "Há mais tempo no ar" },
  { v: "started", l: "Começaram há pouco" }, { v: "page_ads", l: "Anunciante com mais anúncios" },
];
const ESCALA: Record<string, { l: string; cls: string; icon: any }> = {
  escalando: { l: "Escalando", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp },
  estavel: { l: "Estável", cls: "bg-slate-50 text-slate-600 border-slate-200", icon: Minus },
  em_queda: { l: "Em queda", cls: "bg-red-50 text-red-700 border-red-200", icon: TrendingDown },
  pausado: { l: "Pausado", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Pause },
  primeira_leitura: { l: "1ª leitura", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: Radar },
  sem_leitura: { l: "Aguardando", cls: "bg-slate-50 text-slate-500 border-slate-200", icon: Loader2 },
};

const media = (id: number, kind: "image" | "video" | "avatar") => `/api/hack-ads/media/${id}/${kind}`;
const fmtData = (d?: string | null) => (d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const getJson = async <T,>(url: string) => (await apiRequest("GET", url)).json() as Promise<T>;
const qs = (o: Record<string, any>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v != null && v !== false).map(([k, v]) => [k, String(v)])).toString();

export default function HackAds() {
  const { isFeatureBlocked } = useFeatureAccess();
  if (isFeatureBlocked("hack-ads")) {
    return <FeatureLockedOverlay featureName="Hack Ads" description="Minere os anúncios que estão vendendo, salve e acompanhe concorrentes. Disponível no plano completo." />;
  }
  return <HackAdsApp />;
}

function HackAdsApp() {
  const { toast } = useToast();
  const [aba, setAba] = useState<Aba>("biblioteca");
  const [detalhe, setDetalhe] = useState<number | null>(null);

  // filtros da biblioteca
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  useEffect(() => { const t = setTimeout(() => setQDeb(q), 350); return () => clearTimeout(t); }, [q]);
  const [f, setF] = useState({ sort: "recent", media: "", category: "", country: "", min_days: "", min_dups: "", checkout: "", platform: "", placement: "", active: "", search_id: "", page_key: "", from: "", to: "" });
  const [rotulo, setRotulo] = useState<{ search?: string; page?: string }>({});
  const patchF = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const { data: facets } = useQuery<{ total: number; paginas: number; categorias: { v: string; n: number }[]; paises: { v: string; n: number }[]; plataformas: { v: string; n: number }[]; veiculacao: { v: string; n: number }[] }>({
    queryKey: ["/api/hack-ads/facets"], queryFn: () => getJson("/api/hack-ads/facets"), staleTime: 60_000,
  });

  const modo = aba === "alta" ? "trending" : "library";
  const params = { ...f, q: qDeb, favorites: aba === "salvos" ? "1" : "", modo, limit: 24 };
  const lista = useInfiniteQuery({
    queryKey: ["/api/hack-ads/ads", params],
    enabled: aba === "biblioteca" || aba === "alta" || aba === "salvos",
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getJson<{ rows: Ad[]; total: number; limit: number; offset: number }>(`/api/hack-ads/ads?${qs({ ...params, offset: pageParam })}`),
    getNextPageParam: (last) => (last.offset + last.rows.length < last.total ? last.offset + last.rows.length : undefined),
  });
  const ads = useMemo(() => lista.data?.pages.flatMap((p) => p.rows) || [], [lista.data]);
  const total = lista.data?.pages[0]?.total ?? 0;
  const atualizar = () => { void queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/ads"] }); void queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/facets"] }); };

  // Rolagem infinita: primeiro as próximas páginas da base; no fim de uma busca, continua minerando na Meta.
  const buscas = useQuery<{ searches: { id: number; term: string; found: number; metaTotal: number | null; podeMais: boolean; status: string }[] }>({
    queryKey: ["/api/hack-ads/searches"], queryFn: () => getJson("/api/hack-ads/searches"),
  });
  const buscaAtual = f.search_id ? buscas.data?.searches.find((b) => String(b.id) === f.search_id) : undefined;
  const [mais, setMais] = useState<{ jobId: string; searchId: number; antes: number } | null>(null);
  const [esgotadas, setEsgotadas] = useState<number[]>([]);
  const podeMais = !!buscaAtual && buscaAtual.podeMais && !esgotadas.includes(buscaAtual.id) && aba === "biblioteca";
  // Ref por callback: a lista é remontada ao trocar de aba/filtro e o sensor precisa seguir o elemento novo.
  const [noFim, setNoFim] = useState(false);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const fim = useCallback((el: HTMLDivElement | null) => {
    ioRef.current?.disconnect();
    ioRef.current = null;
    if (!el) { setNoFim(false); return; }
    ioRef.current = new IntersectionObserver((e) => setNoFim(e[0].isIntersecting), { rootMargin: "600px" });
    ioRef.current.observe(el);
  }, []);
  useEffect(() => {
    if (!noFim || lista.isLoading || lista.isFetchingNextPage) return;
    if (lista.hasNextPage) { void lista.fetchNextPage(); return; }
    if (podeMais && !mais && buscaAtual) {
      apiRequest("POST", `/api/hack-ads/searches/${buscaAtual.id}/more`)
        .then((r) => r.json())
        .then((r) => setMais({ jobId: r.jobId, searchId: buscaAtual.id, antes: buscaAtual.found }))
        .catch(() => setEsgotadas((x) => [...x, buscaAtual.id]));
    }
  }, [noFim, lista.hasNextPage, lista.isFetchingNextPage, lista.isLoading, podeMais, mais, ads.length]);
  useEffect(() => {
    if (!mais) return;
    let vivo = true;
    const tick = async () => {
      try {
        const j = await getJson<any>(`/api/hack-ads/jobs/${mais.jobId}`);
        if (!vivo) return;
        if (j.status === "done" || j.status === "error") {
          if (j.status === "error" || !j.result || j.result.found <= mais.antes) setEsgotadas((x) => [...x, mais.searchId]);
          await queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/searches"] });
          atualizar();
          setMais(null);
          return;
        }
      } catch { /* tenta de novo */ }
      if (vivo) setTimeout(tick, 2000);
    };
    void tick();
    return () => { vivo = false; };
  }, [mais]);

  const favoritar = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => apiRequest("POST", `/api/hack-ads/favorites/${id}`, { on }),
    onSuccess: (_d, v) => { toast({ title: v.on ? "Salvo" : "Removido dos salvos" }); atualizar(); },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: e?.message, variant: "destructive" }),
  });
  const monitorar = useMutation({
    mutationFn: (adId: number) => apiRequest("POST", "/api/hack-ads/monitors", { adId }),
    onSuccess: () => { toast({ title: "Página em monitoramento", description: "Conferimos os anúncios ativos dela todo dia." }); atualizar(); void queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/monitors"] }); },
    onError: (e: any) => toast({ title: "Não deu para monitorar", description: e?.message?.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const verPagina = (a: { pageKey: string; pageName: string | null }) => {
    setAba("biblioteca"); setQ(""); patchF({ page_key: a.pageKey, search_id: "" }); setRotulo({ page: a.pageName || "Página" }); setDetalhe(null);
  };
  const verBusca = (id: number, termo: string) => {
    setAba("biblioteca"); setQ(""); patchF({ search_id: String(id), page_key: "" }); setRotulo({ search: termo });
  };

  const acoes = { favoritar: (a: Ad) => favoritar.mutate({ id: a.id, on: !a.favorite }), monitorar: (a: Ad) => monitorar.mutate(a.id), abrir: (a: Ad) => setDetalhe(a.id), verPagina };

  return (
    <div className="space-y-5" data-testid="hack-ads-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2.5"><Target className="w-7 h-7 text-primary" /> Hack Ads</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Encontre os anúncios que estão vendendo na Biblioteca da Meta, salve os melhores e acompanhe os concorrentes.</p>
        </div>
        {facets && <p className="text-xs text-muted-foreground tabular-nums">{facets.total.toLocaleString("pt-BR")} anúncios · {facets.paginas.toLocaleString("pt-BR")} anunciantes na base</p>}
      </div>

      <Minerador onDone={(r) => { atualizar(); void queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/searches"] }); verBusca(r.searchId, r.term); }} />

      {/* abas */}
      <div className="flex gap-1 border-b overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([["biblioteca", "Biblioteca"], ["alta", "Em alta"], ["salvos", "Salvos"], ["monitorando", "Monitorando"], ["buscas", "Minhas buscas"]] as [Aba, string][]).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setAba(v)} className={`px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${aba === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {(aba === "biblioteca" || aba === "alta" || aba === "salvos") && (
        <>
          <Filtros q={q} setQ={setQ} f={f} patchF={patchF} facets={facets} aba={aba} rotulo={rotulo} limparRotulo={() => { patchF({ search_id: "", page_key: "" }); setRotulo({}); }} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">{lista.isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} criativo${total === 1 ? "" : "s"}`}</span>
            {aba === "alta" && <span>Ativos, vistos nos últimos 21 dias, com mais anúncios no mesmo criativo</span>}
          </div>
          {lista.isLoading ? (
            <Grade>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="rounded-xl border bg-card h-[420px] animate-pulse" />)}</Grade>
          ) : !ads.length ? (
            <Vazio aba={aba} filtrando={!!(qDeb || Object.values(f).some((v) => v && v !== "recent"))} />
          ) : (
            <Grade>{ads.map((a) => <AdCard key={a.id} a={a} {...acoes} />)}</Grade>
          )}
          <div ref={fim} className="min-h-10 py-3 flex items-center justify-center text-sm text-muted-foreground text-center">
            {lista.isFetchingNextPage ? <Loader2 className="w-5 h-5 animate-spin" />
              : mais ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Buscando mais anúncios na Meta…{buscaAtual?.metaTotal ? ` (${buscaAtual.found.toLocaleString("pt-BR")} de ~${buscaAtual.metaTotal.toLocaleString("pt-BR")})` : ""}</span>
              : !lista.hasNextPage && ads.length > 0 && buscaAtual && !podeMais ? <span>Fim desta busca: {buscaAtual.found.toLocaleString("pt-BR")} anúncios{buscaAtual.found >= 300 ? " (limite por busca; use um termo mais específico para ver outros)" : ""}.</span>
              : !lista.hasNextPage && ads.length > 0 && !buscaAtual && aba === "biblioteca" ? <span>Esses são todos os anúncios da base com esses filtros. Minere um termo lá em cima para trazer mais.</span>
              : null}
          </div>
        </>
      )}

      {aba === "monitorando" && <Monitorando verPagina={verPagina} />}
      {aba === "buscas" && <Buscas verBusca={verBusca} />}

      <Detalhe id={detalhe} onClose={() => setDetalhe(null)} acoes={acoes} />
    </div>
  );
}

const Grade = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">{children}</div>;

// ---------------- minerar ----------------
function Minerador({ onDone }: { onDone: (r: { searchId: number; term: string }) => void }) {
  const { toast } = useToast();
  const [term, setTerm] = useState("");
  const [country, setCountry] = useState("BR");
  const [limit, setLimit] = useState("50");
  const [ativos, setAtivos] = useState(true);
  const [job, setJob] = useState<{ id: string; term: string; searchId: number } | null>(null);
  const [st, setSt] = useState<{ status: string; position: number; progress: number; error?: string; result?: any } | null>(null);

  useEffect(() => {
    if (!job) return;
    let vivo = true;
    const tick = async () => {
      try {
        const s = await getJson<any>(`/api/hack-ads/jobs/${job.id}`);
        if (!vivo) return;
        setSt(s);
        if (s.status === "done") {
          toast({ title: `${s.result?.found ?? 0} anúncios minerados`, description: s.result?.added ? `${s.result.added} novos na base.` : "Todos já estavam na base." });
          onDone({ searchId: job.searchId, term: job.term });
          setJob(null);
          return;
        }
        if (s.status === "error") { toast({ title: "A busca não deu certo", description: s.error, variant: "destructive" }); setJob(null); return; }
      } catch { /* tenta de novo */ }
      if (vivo) setTimeout(tick, 2000);
    };
    void tick();
    return () => { vivo = false; };
  }, [job]);

  const minerar = async () => {
    try {
      const r = await (await apiRequest("POST", "/api/hack-ads/search", { term, country, limit: Number(limit), active: ativos })).json();
      setSt({ status: "queued", position: r.position, progress: 0 });
      setJob({ id: r.jobId, term: term.trim(), searchId: r.searchId });
    } catch (e: any) {
      toast({ title: "Não deu para minerar", description: e?.message?.replace(/^\d+:\s*/, ""), variant: "destructive" });
    }
  };
  const sel = "h-11 rounded-lg border bg-background px-3 text-sm";

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && term.trim().length >= 2 && !job && void minerar()}
            placeholder="O que você quer minerar? Ex.: emagrecimento, renda extra, skincare, pet" className="h-11 pl-10 text-[15px]" disabled={!!job} data-testid="input-hack-term" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2.5">
          <select className={sel} value={country} onChange={(e) => setCountry(e.target.value)} disabled={!!job} aria-label="País">
            {PAISES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <select className={sel} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!!job} aria-label="Quantidade">
            {["30", "50", "100"].map((n) => <option key={n} value={n}>{n} anúncios</option>)}
          </select>
          <label className="h-11 flex items-center gap-2 rounded-lg border px-3 text-sm col-span-2 sm:col-span-1 whitespace-nowrap">
            <Switch checked={ativos} onCheckedChange={setAtivos} disabled={!!job} /> Só ativos
          </label>
          <Button className="h-11 px-6 col-span-2 sm:col-span-1" disabled={term.trim().length < 2 || !!job} onClick={() => void minerar()} data-testid="button-minerar">
            {job ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />} Minerar
          </Button>
        </div>
      </div>
      {job && st && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          {st.status === "queued" ? `Na fila (${st.position}º). Outras buscas estão rodando, já já é a sua.` : `Coletando "${job.term}" na Biblioteca da Meta… ${st.progress} anúncios`}
        </div>
      )}
    </div>
  );
}

// ---------------- filtros ----------------
function Filtros({ q, setQ, f, patchF, facets, aba, rotulo, limparRotulo }: any) {
  const chip = (on: boolean) => `h-8 px-3 rounded-full border text-xs font-medium transition whitespace-nowrap ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`;
  const validado = f.min_days === "7" && f.min_dups === "3";
  const nFiltros = ["category", "country", "platform", "placement", "from", "to", "active"].filter((k) => f[k]).length + (f.min_days && !validado ? 1 : 0);
  const cats: string[] = f.category ? f.category.split(",") : [];
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por texto da copy, página ou domínio" className="h-10 pl-9" />
        </div>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={aba === "alta" ? "duplicates" : f.sort} disabled={aba === "alta"} onChange={(e) => patchF({ sort: e.target.value })} aria-label="Ordenar">
          {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(rotulo.search || rotulo.page) && (
          <span className="h-8 pl-3 pr-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
            {rotulo.search ? `Busca: ${rotulo.search}` : `Página: ${rotulo.page}`}
            <button type="button" onClick={limparRotulo} className="w-5 h-5 rounded-full hover:bg-primary/20 flex items-center justify-center" aria-label="Limpar"><X className="w-3 h-3" /></button>
          </span>
        )}
        <button type="button" className={chip(validado)} onClick={() => patchF(validado ? { min_days: "", min_dups: "" } : { min_days: "7", min_dups: "3" })}>Validados (7+ dias e 3+ anúncios)</button>
        <button type="button" className={chip(f.min_dups === "40")} onClick={() => patchF({ min_dups: f.min_dups === "40" ? "" : "40", min_days: validado ? "" : f.min_days })}>Escalando forte (40+)</button>
        <button type="button" className={chip(f.checkout === "1")} onClick={() => patchF({ checkout: f.checkout === "1" ? "" : "1" })}>Com checkout</button>
        <button type="button" className={chip(f.media === "video")} onClick={() => patchF({ media: f.media === "video" ? "" : "video" })}>Vídeo</button>
        <button type="button" className={chip(f.media === "image")} onClick={() => patchF({ media: f.media === "image" ? "" : "image" })}>Imagem</button>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={`${chip(nFiltros > 0)} flex items-center gap-1.5`}><SlidersHorizontal className="w-3.5 h-3.5" /> Mais filtros{nFiltros ? ` (${nFiltros})` : ""}</button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,380px)] space-y-4">
            <div>
              <p className="text-xs font-semibold mb-1.5">Nicho</p>
              <div className="flex flex-wrap gap-1.5">
                {(facets?.categorias || []).map((c: any) => {
                  const on = cats.includes(c.v);
                  return <button key={c.v} type="button" className={chip(on)} onClick={() => patchF({ category: (on ? cats.filter((x: string) => x !== c.v) : [...cats, c.v]).join(",") })}>{c.v} <span className="opacity-60">{c.n}</span></button>;
                })}
                {!facets?.categorias?.length && <p className="text-xs text-muted-foreground">Aparece conforme a base cresce.</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1.5">Onde roda</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATAFORMAS.map((p) => {
                  const sel: string[] = f.placement ? f.placement.split(",") : [];
                  const on = sel.includes(p.id);
                  const n = facets?.veiculacao?.find((x: any) => x.v === p.id)?.n;
                  return (
                    <button key={p.id} type="button" className={`${chip(on)} flex items-center gap-1.5`} onClick={() => patchF({ placement: (on ? sel.filter((x) => x !== p.id) : [...sel, p.id]).join(",") })}>
                      <svg viewBox="0 0 12 12" width={12} height={12} fill={on ? "currentColor" : p.cor}>{p.paths.map((d, i) => <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />)}</svg>
                      {p.nome}{n ? <span className="opacity-60">{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold mb-1.5">País</p>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={f.country} onChange={(e) => patchF({ country: e.target.value })}>
                  <option value="">Todos</option>
                  {(facets?.paises || []).map((p: any) => <option key={p.v} value={p.v}>{p.v} ({p.n})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">Checkout</p>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={f.platform} onChange={(e) => patchF({ platform: e.target.value })}>
                  <option value="">Qualquer</option>
                  {(facets?.plataformas || []).map((p: any) => <option key={p.v} value={p.v}>{p.v} ({p.n})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">No ar há pelo menos</p>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={f.min_days} onChange={(e) => patchF({ min_days: e.target.value })}>
                  {[["", "Qualquer"], ["3", "3 dias"], ["7", "7 dias"], ["14", "14 dias"], ["30", "30 dias"], ["60", "60 dias"], ["90", "90 dias"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">Status</p>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={f.active} onChange={(e) => patchF({ active: e.target.value })}>
                  <option value="">Ativos e inativos</option>
                  <option value="1">Só ativos</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">Começou depois de</p>
                <Input type="date" className="h-9" value={f.from} onChange={(e) => patchF({ from: e.target.value })} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">Começou antes de</p>
                <Input type="date" className="h-9" value={f.to} onChange={(e) => patchF({ to: e.target.value })} />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => patchF({ category: "", country: "", platform: "", placement: "", min_days: "", min_dups: "", from: "", to: "", active: "", checkout: "", media: "" })}>Limpar filtros</Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Vazio({ aba, filtrando }: { aba: Aba; filtrando: boolean }) {
  const txt = aba === "salvos" ? ["Nada salvo ainda", "Toque no marcador de um anúncio para guardar aqui. Salvos guardam o vídeo para sempre."]
    : filtrando ? ["Nenhum anúncio com esses filtros", "Tire algum filtro ou minere um termo novo lá em cima."]
    : ["Sua base está vazia", "Digite um nicho ou produto lá em cima e clique em Minerar. Os anúncios aparecem aqui em segundos."];
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <Target className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="font-semibold mt-3">{txt[0]}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{txt[1]}</p>
    </div>
  );
}

// ---------------- plataformas ----------------
function PlatformIcons({ ids, size = 14, nomes = false }: { ids: string[]; size?: number; nomes?: boolean }) {
  const lista = PLATAFORMAS.filter((p) => ids.includes(p.id));
  if (!lista.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {lista.map((p) => (
        <span key={p.id} title={p.nome} className={`inline-flex items-center gap-1 ${nomes ? "h-6 pl-1.5 pr-2 rounded-full border bg-card text-[11px] font-medium" : ""}`}>
          <svg viewBox="0 0 12 12" width={size} height={size} fill={p.cor} aria-label={p.nome} role="img">
            {p.paths.map((d, i) => <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />)}
          </svg>
          {nomes && p.nome}
        </span>
      ))}
    </div>
  );
}

// ---------------- cartão ----------------
function Avatar({ a, size = 36 }: { a: { id: number; hasAvatar: boolean; pageName: string | null }; size?: number }) {
  const [erro, setErro] = useState(false);
  const ini = (a.pageName || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return a.hasAvatar && !erro
    ? <img src={media(a.id, "avatar")} alt="" referrerPolicy="no-referrer" onError={() => setErro(true)} className="rounded-full object-cover border bg-muted flex-shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 text-xs" style={{ width: size, height: size }}>{ini}</span>;
}

function Selos({ a }: { a: Ad }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {a.selo === "validado" && <span className="h-6 px-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Validado</span>}
      {a.selo === "teste" && <span className="h-6 px-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1"><FlaskConical className="w-3 h-3" /> Em teste</span>}
      <span className={`h-6 px-2 rounded-full border text-[11px] font-semibold flex items-center gap-1 ${a.hot ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
        {a.hot && <Flame className="w-3 h-3" />}{a.duplicates} anúncio{a.duplicates === 1 ? "" : "s"}
      </span>
      {a.checkoutPlatform && <span className="h-6 px-2 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-semibold flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {a.checkoutPlatform}</span>}
    </div>
  );
}

function AdCard({ a, favoritar, monitorar, abrir, verPagina }: { a: Ad; favoritar: (a: Ad) => void; monitorar: (a: Ad) => void; abrir: (a: Ad) => void; verPagina: (a: Ad) => void }) {
  const [erroImg, setErroImg] = useState(false);
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col hover:shadow-md transition" data-testid={`card-ad-${a.id}`}>
      <div className="p-3 flex items-center gap-2.5">
        <Avatar a={a} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => verPagina(a)} className="text-sm font-semibold truncate block max-w-full text-left hover:underline">{a.pageName || "Página sem nome"}</button>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {a.startedAt ? `Desde ${fmtData(a.startedAt)}` : "Início desconhecido"}{a.days != null ? ` · ${a.days} dia${a.days === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.active ? "bg-emerald-500" : "bg-slate-300"}`} title={a.active ? "Ativo" : "Inativo"} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Mais ações"><MoreVertical className="w-4 h-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => monitorar(a)} disabled={a.monitored}><Radar className="w-4 h-4 mr-2" /> {a.monitored ? "Página já monitorada" : "Monitorar página"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => verPagina(a)}><Target className="w-4 h-4 mr-2" /> Ver anúncios da página</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(a.libraryUrl, "_blank", "noopener")}><ExternalLink className="w-4 h-4 mr-2" /> Ver na Biblioteca da Meta</DropdownMenuItem>
            {a.destinationUrl && <DropdownMenuItem onClick={() => window.open(a.destinationUrl!, "_blank", "noopener")}><Link2 className="w-4 h-4 mr-2" /> Abrir página de destino</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button type="button" onClick={() => abrir(a)} className="relative aspect-square bg-muted overflow-hidden group">
        {a.hasImage && !erroImg ? (
          <img src={media(a.id, "image")} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setErroImg(true)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 p-5 flex flex-col">
            <span className="self-start text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-white/80 border rounded-full px-2 py-0.5">Prévia só na Biblioteca da Meta</span>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600 text-left line-clamp-[9] whitespace-pre-line">{a.text || "Anúncio sem texto"}</p>
          </div>
        )}
        {a.mediaType === "video" && a.hasImage && !erroImg && (
          <span className="absolute inset-0 flex items-center justify-center"><span className="w-12 h-12 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm"><Play className="w-5 h-5 fill-current ml-0.5" /></span></span>
        )}
      </button>
      <div className="p-3 space-y-2.5 flex-1 flex flex-col">
        {a.platforms?.length > 0 && <div className="flex items-center gap-2 text-[11px] text-muted-foreground">Roda em <PlatformIcons ids={a.platforms} size={15} /></div>}
        <Selos a={a} />
        {a.text && <p className="text-[13px] text-muted-foreground line-clamp-3 whitespace-pre-line">{a.text}</p>}
        <div className="mt-auto pt-1 flex items-center gap-1.5">
          <Button size="sm" variant={a.favorite ? "default" : "outline"} className="h-8 flex-1" onClick={() => favoritar(a)}>
            {a.favorite ? <BookmarkCheck className="w-4 h-4 mr-1.5" /> : <Bookmark className="w-4 h-4 mr-1.5" />} {a.favorite ? "Salvo" : "Salvar"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => abrir(a)}>Ver detalhes</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- detalhe ----------------
function Detalhe({ id, onClose, acoes }: { id: number | null; onClose: () => void; acoes: any }) {
  const { toast } = useToast();
  const q = useQuery<{ ad: Ad; observations: { dia: string; uses: number | null }[]; related: Ad[]; page: { escala: { status: string; variacao: number | null } } }>({
    queryKey: ["/api/hack-ads/ads", id], queryFn: () => getJson(`/api/hack-ads/ads/${id}`), enabled: id != null,
  });
  const d = q.data;
  const a = d?.ad;
  const copiar = () => { if (a?.text) { void navigator.clipboard.writeText(a.text); toast({ title: "Copy copiada" }); } };
  return (
    <Dialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden max-h-[92vh]">
        <DialogTitle className="sr-only">{a?.pageName || "Anúncio"}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes do anúncio</DialogDescription>
        {!a ? (
          <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid md:grid-cols-[1.05fr_1fr] max-h-[92vh] overflow-y-auto md:overflow-hidden">
            <div className="bg-black flex items-center justify-center md:max-h-[92vh]">
              {a.mediaType === "video" && a.hasVideo ? (
                <video key={a.id} src={media(a.id, "video")} poster={a.hasImage ? media(a.id, "image") : undefined} controls playsInline className="w-full max-h-[55vh] md:max-h-[92vh]" />
              ) : a.hasImage ? (
                <img src={media(a.id, "image")} alt="" referrerPolicy="no-referrer" className="w-full max-h-[55vh] md:max-h-[92vh] object-contain" />
              ) : (
                <div className="p-10 text-center">
                  <p className="text-white/80 text-sm">A Meta não mostra a prévia deste anúncio na busca (comum em anúncios de parceria).</p>
                  <a href={a.libraryUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 mt-3 text-sm text-white underline"><ExternalLink className="w-4 h-4" /> Ver o criativo na Biblioteca da Meta</a>
                </div>
              )}
            </div>
            <div className="p-5 space-y-4 md:overflow-y-auto md:max-h-[92vh]">
              <div className="flex items-center gap-3">
                <Avatar a={a} size={44} />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.pageName || "Página sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{a.active ? "Ativo agora" : "Inativo"} · ID {a.extId}</p>
                </div>
              </div>
              <Selos a={a} />
              {a.platforms?.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Onde roda</p>
                  <PlatformIcons ids={a.platforms} size={14} nomes />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[["Dias no ar", a.days ?? "—"], ["Anúncios deste criativo", a.duplicates], ["Anúncios da página na base", a.pageAds], ["Começou em", fmtData(a.startedAt)]].map(([l, v]) => (
                  <div key={String(l)} className="rounded-lg border p-2.5"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
                ))}
              </div>
              {d!.observations.filter((o) => o.uses != null).length > 1 && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground mb-1">Anúncios deste criativo ao longo do tempo</p>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={d!.observations.map((o) => ({ dia: fmtData(o.dia), n: o.uses }))}>
                        <XAxis dataKey="dia" hide /><YAxis hide domain={["dataMin", "dataMax"]} /><Tooltip />
                        <Line type="monotone" dataKey="n" stroke="hsl(161, 84%, 33%)" strokeWidth={2} dot={false} name="Anúncios" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {a.text && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold">Copy</p>
                    <button type="button" onClick={copiar} className="text-xs text-primary flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar</button>
                  </div>
                  <p className="text-[13px] whitespace-pre-line text-muted-foreground max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3">{a.text}</p>
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                {a.destinationUrl && <a href={a.destinationUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline truncate"><Link2 className="w-4 h-4 flex-shrink-0" /> {a.domain || a.destinationUrl}</a>}
                {a.checkoutUrl && <a href={a.checkoutUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline truncate"><ShoppingCart className="w-4 h-4 flex-shrink-0" /> Checkout {a.checkoutPlatform}</a>}
                <a href={a.libraryUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-primary hover:underline"><ExternalLink className="w-4 h-4" /> Ver na Biblioteca da Meta</a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={a.favorite ? "default" : "outline"} onClick={() => acoes.favoritar(a)}>{a.favorite ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}{a.favorite ? "Salvo" : "Salvar"}</Button>
                <Button variant="outline" onClick={() => acoes.monitorar(a)} disabled={a.monitored}><Radar className="w-4 h-4 mr-2" />{a.monitored ? "Monitorando" : "Monitorar página"}</Button>
                {(a.hasVideo || a.hasImage) && (
                  <a href={`${media(a.id, a.mediaType === "video" && a.hasVideo ? "video" : "image")}?download=1`} download className="col-span-2">
                    <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" /> Baixar {a.mediaType === "video" ? "vídeo" : "imagem"}</Button>
                  </a>
                )}
              </div>
              {d!.related.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold">Outros anúncios desta página</p>
                    <button type="button" onClick={() => acoes.verPagina(a)} className="text-xs text-primary">Ver todos</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {d!.related.slice(0, 8).map((r) => (
                      <button key={r.id} type="button" onClick={() => acoes.abrir(r)} className="relative aspect-square rounded-md overflow-hidden bg-muted border">
                        {r.hasImage && <img src={media(r.id, "image")} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />}
                        {r.mediaType === "video" && <Play className="absolute bottom-1 right-1 w-3.5 h-3.5 text-white fill-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- monitorando ----------------
function Monitorando({ verPagina }: { verPagina: (a: { pageKey: string; pageName: string | null }) => void }) {
  const { toast } = useToast();
  const q = useQuery<{ monitors: Monitor[] }>({
    queryKey: ["/api/hack-ads/monitors"], queryFn: () => getJson("/api/hack-ads/monitors"),
    refetchInterval: (query) => ((query.state.data as any)?.monitors?.some((m: Monitor) => m.checando) ? 5000 : false),
  });
  const conferir = useMutation({
    mutationFn: (pageKey: string) => apiRequest("POST", `/api/hack-ads/monitors/${encodeURIComponent(pageKey)}/check`),
    onSuccess: () => { toast({ title: "Conferindo agora", description: "Leva cerca de meio minuto." }); void q.refetch(); },
    onError: (e: any) => toast({ title: "Não deu", description: e?.message?.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const remover = useMutation({
    mutationFn: (pageKey: string) => apiRequest("DELETE", `/api/hack-ads/monitors/${encodeURIComponent(pageKey)}`),
    onSuccess: () => { void q.refetch(); void queryClient.invalidateQueries({ queryKey: ["/api/hack-ads/ads"] }); },
  });
  const ms = q.data?.monitors || [];
  if (q.isLoading) return <div className="h-40 rounded-xl border animate-pulse" />;
  if (!ms.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Radar className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold mt-3">Nenhum concorrente monitorado</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">Em qualquer anúncio, abra o menu ⋮ e escolha "Monitorar página". Todo dia contamos os anúncios ativos dela e avisamos se está escalando ou caindo.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {ms.map((m) => {
        const e = ESCALA[m.status] || ESCALA.sem_leitura;
        const Ic = e.icon;
        return (
          <div key={m.pageKey} className="rounded-xl border bg-card p-4 flex gap-4 items-center">
            <Avatar a={{ id: m.avatarAd || 0, hasAvatar: !!m.avatarAd, pageName: m.pageName }} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{m.pageName}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`h-6 px-2 rounded-full border text-[11px] font-semibold flex items-center gap-1 ${e.cls}`}><Ic className={`w-3 h-3 ${m.status === "sem_leitura" ? "animate-spin" : ""}`} /> {e.l}{m.variacao != null && m.status !== "pausado" ? ` ${m.variacao > 0 ? "+" : ""}${m.variacao}%` : ""}</span>
                <span className="text-[11px] text-muted-foreground">{m.checando ? "Conferindo…" : m.lastCheckedAt ? `Conferido ${new Date(m.lastCheckedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Aguardando 1ª leitura"}</span>
              </div>
              {m.lastError && <p className="text-[11px] text-red-600 mt-1 truncate">{m.lastError}</p>}
            </div>
            <div className="w-24 h-10 hidden sm:block">
              {m.snapshots.length > 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.snapshots}><Line type="monotone" dataKey="activeAds" stroke="hsl(161, 84%, 33%)" strokeWidth={2} dot={false} /></LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums leading-none">{m.activeAds != null ? m.activeAds.toLocaleString("pt-BR") : "—"}</p>
              <p className="text-[11px] text-muted-foreground">ativos</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Ações"><MoreVertical className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => verPagina({ pageKey: m.pageKey, pageName: m.pageName })}><Target className="w-4 h-4 mr-2" /> Ver anúncios ({m.adsNaBase})</DropdownMenuItem>
                <DropdownMenuItem onClick={() => conferir.mutate(m.pageKey)} disabled={m.checando}><RefreshCw className="w-4 h-4 mr-2" /> Conferir agora</DropdownMenuItem>
                <DropdownMenuItem onClick={() => remover.mutate(m.pageKey)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Parar de monitorar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- buscas ----------------
function Buscas({ verBusca }: { verBusca: (id: number, termo: string) => void }) {
  const q = useQuery<{ searches: { id: number; term: string; country: string; found: number; added: number; status: string; error: string | null; created_at: string }[] }>({
    queryKey: ["/api/hack-ads/searches"], queryFn: () => getJson("/api/hack-ads/searches"),
  });
  const ss = q.data?.searches || [];
  if (q.isLoading) return <div className="h-40 rounded-xl border animate-pulse" />;
  if (!ss.length) return <div className="rounded-xl border border-dashed p-10 text-center"><History className="w-8 h-8 mx-auto text-muted-foreground" /><p className="font-semibold mt-3">Nenhuma busca ainda</p></div>;
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2.5 px-4 font-medium">Termo</th><th className="py-2.5 px-3 font-medium hidden sm:table-cell">País</th><th className="py-2.5 px-3 font-medium hidden md:table-cell">Quando</th><th className="py-2.5 px-3 font-medium text-right">Encontrados</th><th className="py-2.5 px-4 font-medium text-right">Novos</th></tr></thead>
        <tbody>
          {ss.map((s) => (
            <tr key={s.id} onClick={() => s.status === "done" && verBusca(s.id, s.term)} className={`border-b last:border-0 ${s.status === "done" ? "hover:bg-muted/40 cursor-pointer" : ""}`}>
              <td className="py-2.5 px-4 font-medium">{s.term}{s.status === "error" && <span className="block text-[11px] text-red-600 font-normal truncate max-w-xs">{s.error}</span>}{(s.status === "queued" || s.status === "running") && <span className="block text-[11px] text-muted-foreground font-normal">Em andamento…</span>}</td>
              <td className="py-2.5 px-3 hidden sm:table-cell">{s.country}</td>
              <td className="py-2.5 px-3 hidden md:table-cell text-muted-foreground tabular-nums">{new Date(s.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{s.found}</td>
              <td className="py-2.5 px-4 text-right tabular-nums">{s.added}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
