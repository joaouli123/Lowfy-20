import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  BarChart3, Users, MousePointerClick, MessagesSquare, ShoppingBag, LifeBuoy, Share2, Copy, LayoutDashboard,
  UserPlus, Activity, Eye, CreditCard, MessageSquare, Ticket, Search, ChevronLeft, ChevronRight, ExternalLink,
  Smartphone, Flag, Info, Store, TrendingUp, FileStack, Target,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, ChartCard, EmptyState, TableSkeleton,
  StatusBadge, CHART_COLORS, gridProps, axisProps, tooltipStyle, formatBRL, formatNumber, type BadgeTone, type Period,
} from "@/components/admin";

// ---------- tipos ----------
type Params = { startDate: string; endDate: string; groupBy: string };
interface Overview {
  period: { from: string; to: string; groupBy: string; previous: { from: string; to: string } };
  tracking: { pageViews: boolean };
  kpis: {
    signups: number; signupsPrev: number; activeUsers: number; activeUsersPrev: number; pageViews: number; pageViewsPrev: number;
    totalUsers: number; subscribersActive: number; newSubscribers: number;
    topics: number; replies: number; posts: number; comments: number; reactions: number; products: number; ordersPaid: number; gmvCents: number;
    ticketsOpened: number; ticketsOpen: number; refClicks: number; refConversions: number; clonedPages: number;
  };
  subscriptionStatus: { status: string; count: number }[];
  series: Record<string, any>[];
}

// ---------- utilidades ----------
const qs = (o: Record<string, any>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
function useAdmin<T>(endpoint: string, params: Record<string, any>, enabled = true) {
  return useQuery<T>({
    queryKey: [`/api/admin/analytics/v2/${endpoint}`, params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/analytics/v2/${endpoint}?${qs(params)}`)).json(),
    staleTime: 60_000,
    enabled,
  });
}
const delta = (cur?: number, prev?: number) => (cur == null || !prev ? null : ((cur - prev) / prev) * 100);
const labelData = (d: string, g: string) => {
  try { return format(new Date(`${d}T12:00:00`), g === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR }); } catch { return d; }
};
const ha = (iso?: string | null) => {
  if (!iso) return "—";
  try { return formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true }); } catch { return "—"; }
};
const dataCurta = (iso?: string | null) => (iso ? format(new Date(iso), "dd/MM/yy", { locale: ptBR }) : "—");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");

const STATUS_ASSINATURA: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Ativa", tone: "success" }, trial: { label: "Teste", tone: "info" }, none: { label: "Sem assinatura", tone: "neutral" },
  canceled: { label: "Cancelada", tone: "warning" }, cancelled: { label: "Cancelada", tone: "warning" }, expired: { label: "Expirada", tone: "danger" },
  pending: { label: "Pendente", tone: "neutral" }, refunded: { label: "Reembolsada", tone: "danger" },
};
const statusAssinatura = (s?: string) => STATUS_ASSINATURA[s || "none"] || { label: s || "—", tone: "neutral" as BadgeTone };

// Nome amigável das páginas da plataforma.
const PAGINA: Record<string, string> = {
  "/": "Início", "/timeline": "Timeline", "/dashboard": "Painel", "/plrs": "PLRs", "/ai-tools": "Ferramentas IA", "/ai-studio": "Estúdio IA",
  "/ebooks": "Criador de e-books", "/quiz-builder": "Quiz Builder", "/quiz-interativo": "Quiz interativo", "/clonador": "Clonador",
  "/presell-dashboard": "Presells", "/presell-builder": "Editor de presell", "/courses": "Cursos", "/plugins": "Plugins", "/hack-ads": "Hack Ads",
  "/templates": "Templates", "/services": "White Label", "/marketplace": "Marketplace", "/marketplace/vitrine": "Marketplace · vitrine",
  "/marketplace/meus-produtos": "Marketplace · meus produtos", "/marketplace/compras": "Marketplace · compras", "/marketplace/financeiro": "Marketplace · financeiro",
  "/marketplace/cart": "Marketplace · carrinho", "/marketplace/produto/:id": "Marketplace · produto", "/notifications": "Notificações", "/support": "Suporte",
  "/forum": "Fórum", "/forum/:id": "Fórum · tópico", "/profile": "Perfil", "/users/:id": "Perfil de usuário", "/indicacoes": "Indicações",
  "/assinatura": "Assinatura", "/assinatura/checkout": "Checkout da assinatura", "/modelos-n8n": "Modelos n8n", "/login": "Login", "/checkout": "Checkout",
};
const nomePagina = (p: string) => PAGINA[p] || (p.startsWith("/ai-studio/") ? `Estúdio IA · ${p.split("/")[2]}` : p.startsWith("/admin") ? `Admin · ${p.split("/")[2] || "início"}` : p);

const TABS = [
  { id: "geral", label: "Visão geral", icon: LayoutDashboard },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "paginas", label: "Páginas", icon: MousePointerClick },
  { id: "comunidade", label: "Comunidade", icon: MessagesSquare },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "suporte", label: "Suporte", icon: LifeBuoy },
  { id: "indicacoes", label: "Indicações", icon: Share2 },
  { id: "criadores", label: "Criadores", icon: Copy },
] as const;
type TabId = typeof TABS[number]["id"];

function abaInicial(): TabId {
  try {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((x) => x.id === t)) return t as TabId;
  } catch {}
  return "geral";
}

// ---------- página ----------
export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>(defaultPeriod("30days"));
  const [tab, setTab] = useState<TabId>(abaInicial);
  const params: Params = { startDate: period.startDate, endDate: period.endDate, groupBy: period.groupBy };
  const ov = useAdmin<Overview>("overview", params);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (tab === "geral") u.searchParams.delete("tab"); else u.searchParams.set("tab", tab);
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch {}
  }, [tab]);

  return (
    <AdminPage>
      <AdminPageHeader title="Analytics" description="Tudo o que aconteceu na plataforma no período, por assunto." icon={BarChart3}>
        <PeriodFilter value={period} onChange={setPeriod} showGroupBy />
      </AdminPageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <div className="-mx-1 px-1 overflow-x-auto">
          <TabsList className="inline-flex w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5" data-testid={`tab-analytics-${t.id}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="geral" className="mt-5 space-y-5"><AbaGeral ov={ov.data} loading={ov.isLoading} error={ov.error} /></TabsContent>
        <TabsContent value="usuarios" className="mt-5 space-y-5"><AbaUsuarios params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="paginas" className="mt-5 space-y-5"><AbaPaginas params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="comunidade" className="mt-5 space-y-5"><AbaComunidade params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="marketplace" className="mt-5 space-y-5"><AbaMarketplace params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="suporte" className="mt-5 space-y-5"><AbaSuporte params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="indicacoes" className="mt-5 space-y-5"><AbaIndicacoes params={params} ov={ov.data} loading={ov.isLoading} /></TabsContent>
        <TabsContent value="criadores" className="mt-5 space-y-5"><AbaCriadores params={params} /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}

// ---------- peças comuns ----------
function Painel({ title, description, actions, children, className = "" }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
function LinkAdmin({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline whitespace-nowrap">
      {children} <ExternalLink className="w-3 h-3" />
    </Link>
  );
}
// Lista de barras horizontais (ranking simples).
function Ranking({ itens, vazio }: { itens: { label: ReactNode; sub?: ReactNode; value: number; display?: ReactNode }[]; vazio: string }) {
  const max = Math.max(1, ...itens.map((i) => i.value));
  if (!itens.length) return <p className="px-5 pb-5 text-sm text-muted-foreground">{vazio}</p>;
  return (
    <ul className="px-5 pb-4 space-y-3">
      {itens.map((i, k) => (
        <li key={k}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}{i.sub && <span className="text-xs text-muted-foreground ml-1.5">{i.sub}</span>}</span>
            <span className="font-semibold tabular-nums shrink-0">{i.display ?? formatNumber(i.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
function serie(ov: Overview | undefined) {
  return (ov?.series || []).map((s) => ({ ...s, label: labelData(s.date, ov!.period.groupBy) }));
}
function Erro({ error }: { error: any }) {
  return <EmptyState icon={Info} title="Não deu para carregar" description={String(error?.message || "").replace(/^\d+:\s*/, "") || "Tente de novo em instantes."} />;
}

// ---------- Visão geral ----------
function AbaGeral({ ov, loading, error }: { ov?: Overview; loading: boolean; error: any }) {
  if (error) return <Erro error={error} />;
  const k = ov?.kpis;
  const dados = serie(ov);
  const comunidade = k ? k.topics + k.replies + k.posts + k.comments : undefined;
  const totalStatus = (ov?.subscriptionStatus || []).reduce((s, x) => s + x.count, 0);
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Novos cadastros" icon={UserPlus} tone="success" loading={loading} value={formatNumber(k?.signups)}
          delta={delta(k?.signups, k?.signupsPrev)} hint={k ? `de ${formatNumber(k.totalUsers)} no total` : undefined} testId="kpi-signups" />
        <StatCard label="Usuários ativos" icon={Activity} tone="info" loading={loading} value={formatNumber(k?.activeUsers)}
          delta={delta(k?.activeUsers, k?.activeUsersPrev)} hint={k ? `${pct(k.activeUsers, k.totalUsers)} da base` : undefined} testId="kpi-active" />
        <StatCard label="Páginas vistas" icon={Eye} tone="violet" loading={loading} value={formatNumber(k?.pageViews)}
          delta={ov?.tracking.pageViews ? delta(k?.pageViews, k?.pageViewsPrev) : null}
          hint={ov && !ov.tracking.pageViews ? "registro ainda não ativado" : undefined} testId="kpi-views" />
        <StatCard label="Assinantes ativos" icon={CreditCard} tone="success" loading={loading} value={formatNumber(k?.subscribersActive)}
          hint={k ? `+${formatNumber(k.newSubscribers)} novos no período` : undefined} testId="kpi-subscribers" />
      </StatGrid>
      <StatGrid cols={4}>
        <StatCard label="Comunidade" icon={MessageSquare} loading={loading} value={formatNumber(comunidade)}
          hint={k ? `${formatNumber(k.topics + k.replies)} no fórum · ${formatNumber(k.posts + k.comments)} na timeline` : undefined} />
        <StatCard label="Vendas no marketplace" icon={ShoppingBag} loading={loading} value={formatNumber(k?.ordersPaid)}
          hint={k ? formatBRL(k.gmvCents) : undefined} />
        <StatCard label="Tickets em aberto" icon={Ticket} tone={k && k.ticketsOpen > 0 ? "warning" : "default"} colorValue={!!k && k.ticketsOpen > 0}
          loading={loading} value={formatNumber(k?.ticketsOpen)} hint={k ? `${formatNumber(k.ticketsOpened)} abertos no período` : undefined} />
        <StatCard label="Cliques em indicações" icon={Share2} loading={loading} value={formatNumber(k?.refClicks)}
          hint={k ? `${formatNumber(k.refConversions)} cadastros (${pct(k.refConversions, k.refClicks)})` : undefined} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Cadastros e usuários ativos" description="Barras: novos cadastros · linha: usuários ativos"
          loading={loading} empty={!dados.length} className="xl:col-span-2" height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis yAxisId="a" {...axisProps} width={36} allowDecimals={false} />
              <YAxis yAxisId="b" orientation="right" {...axisProps} width={36} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="a" dataKey="signups" name="Cadastros" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line yAxisId="b" dataKey="active" name="Ativos" stroke={CHART_COLORS.sky} strokeWidth={2} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <Painel title="Situação das contas" description="Assinatura de todos os usuários hoje">
          {loading ? <TableSkeleton rows={4} /> : (
            <Ranking vazio="Sem usuários."
              itens={(ov?.subscriptionStatus || []).map((s) => ({ label: statusAssinatura(s.status).label, value: s.count, display: `${formatNumber(s.count)} · ${pct(s.count, totalStatus)}` }))} />
          )}
        </Painel>
      </div>

      <ChartCard title="Engajamento" description="Tópicos e respostas no fórum, posts e comentários na timeline" loading={loading} empty={!dados.length} height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={36} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="topics" name="Tópicos" stackId="e" fill={CHART_COLORS.primary} />
            <Bar dataKey="replies" name="Respostas" stackId="e" fill={CHART_COLORS.teal} />
            <Bar dataKey="posts" name="Posts" stackId="e" fill={CHART_COLORS.sky} />
            <Bar dataKey="comments" name="Comentários" stackId="e" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

// ---------- Usuários ----------
interface UserRow {
  id: string; name: string; email: string; createdAt: string; lastSeenAt: string | null; subscriptionStatus: string; accessPlan: string;
  accountStatus: string; isAdmin: boolean; views: number; topics: number; replies: number; posts: number; comments: number;
}
function AbaUsuarios({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("lastSeen");
  const [page, setPage] = useState(1);
  const [aberto, setAberto] = useState<UserRow | null>(null);
  useEffect(() => { const t = setTimeout(() => { setBusca(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [filter, sort, params.startDate, params.endDate]);
  const us = useAdmin<{ users: UserRow[]; total: number; page: number; perPage: number }>("users", { ...params, search: busca, filter, sort, page });
  const paginas = us.data ? Math.max(1, Math.ceil(us.data.total / us.data.perPage)) : 1;
  const dados = serie(ov);
  const k = ov?.kpis;

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Usuários" icon={Users} loading={loading} value={formatNumber(k?.totalUsers)} />
        <StatCard label="Novos no período" icon={UserPlus} tone="success" loading={loading} value={formatNumber(k?.signups)} delta={delta(k?.signups, k?.signupsPrev)} />
        <StatCard label="Ativos no período" icon={Activity} tone="info" loading={loading} value={formatNumber(k?.activeUsers)}
          hint={k ? `${pct(k.activeUsers, k.totalUsers)} da base` : undefined} />
        <StatCard label="Assinantes ativos" icon={CreditCard} tone="success" loading={loading} value={formatNumber(k?.subscribersActive)}
          hint={k ? `${pct(k.subscribersActive, k.totalUsers)} da base` : undefined} />
      </StatGrid>

      <ChartCard title="Novos cadastros" description="Use o agrupamento do filtro para ver por dia, semana ou mês" loading={loading} empty={!dados.length} height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={32} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="signups" name="Cadastros" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9 h-9" data-testid="input-analytics-user-search" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              <SelectItem value="new">Cadastrados no período</SelectItem>
              <SelectItem value="subscribers">Assinantes ativos</SelectItem>
              <SelectItem value="inactive">Sumidos há 30+ dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lastSeen">Visto por último</SelectItem>
              <SelectItem value="signup">Cadastro mais recente</SelectItem>
              <SelectItem value="views">Mais páginas vistas</SelectItem>
              <SelectItem value="activity">Mais ativos na comunidade</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{us.data ? `${formatNumber(us.data.total)} usuário${us.data.total === 1 ? "" : "s"}` : ""}</span>
        </div>
        {us.error ? <Erro error={us.error} /> : us.isLoading ? <TableSkeleton rows={8} /> : !us.data?.users.length ? (
          <EmptyState icon={Users} title="Ninguém encontrado" description="Mude a busca ou o filtro." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                <TableHead>Visto por último</TableHead>
                <TableHead className="hidden sm:table-cell">Assinatura</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Páginas</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Comunidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {us.data.users.map((u) => {
                const st = statusAssinatura(u.subscriptionStatus);
                return (
                  <TableRow key={u.id} className="cursor-pointer" onClick={() => setAberto(u)} data-testid={`row-analytics-user-${u.id}`}>
                    <TableCell>
                      <p className="font-medium truncate max-w-[220px]">{u.name}{u.isAdmin && <span className="ml-1.5 text-[10px] font-semibold text-primary uppercase">admin</span>}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{u.email}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular-nums">{dataCurta(u.createdAt)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{ha(u.lastSeenAt)}</TableCell>
                    <TableCell className="hidden sm:table-cell"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                    <TableCell className="text-right tabular-nums hidden lg:table-cell">{formatNumber(u.views)}</TableCell>
                    <TableCell className="text-right tabular-nums hidden lg:table-cell">{formatNumber(u.topics + u.replies + u.posts + u.comments)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {us.data && paginas > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground">Página {page} de {paginas}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Páginas e comunidade contam só o período escolhido. Clique num usuário para ver o que ele abriu.</p>
      <PaginasDoUsuario user={aberto} params={params} onClose={() => setAberto(null)} />
    </>
  );
}

function PaginasDoUsuario({ user, params, onClose }: { user: UserRow | null; params: Params; onClose: () => void }) {
  const q = useQuery<{ recent: { path: string; device: string; at: string }[]; top: { path: string; views: number }[] }>({
    queryKey: ["/api/admin/analytics/v2/users/pages", user?.id, params.startDate, params.endDate],
    queryFn: async () => (await apiRequest("GET", `/api/admin/analytics/v2/users/${user!.id}/pages?${qs(params)}`)).json(),
    enabled: !!user,
  });
  const st = statusAssinatura(user?.subscriptionStatus);
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user?.name}</SheetTitle>
          <SheetDescription>{user?.email}</SheetDescription>
        </SheetHeader>
        {user && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Cadastro</p><p className="font-medium">{dataCurta(user.createdAt)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Visto por último</p><p className="font-medium">{ha(user.lastSeenAt)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Assinatura</p><StatusBadge tone={st.tone} className="mt-1">{st.label}</StatusBadge></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">No período</p><p className="font-medium">{formatNumber(user.views)} páginas · {formatNumber(user.topics + user.replies + user.posts + user.comments)} interações</p></div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Mais abertas no período</p>
              {q.isLoading ? <TableSkeleton rows={3} /> : !q.data?.top.length ? <p className="text-sm text-muted-foreground">Nenhuma página registrada no período.</p> : (
                <ul className="space-y-1.5">{q.data.top.map((t) => (
                  <li key={t.path} className="flex justify-between gap-3 text-sm"><span className="truncate">{nomePagina(t.path)}</span><span className="tabular-nums text-muted-foreground">{formatNumber(t.views)}×</span></li>
                ))}</ul>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Últimas páginas</p>
              {q.isLoading ? <TableSkeleton rows={5} /> : !q.data?.recent.length ? <p className="text-sm text-muted-foreground">Ainda sem registro.</p> : (
                <ul className="divide-y rounded-lg border">{q.data.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate flex items-center gap-1.5">{r.device === "mobile" && <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}{nomePagina(r.path)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.at), "dd/MM HH:mm")}</span>
                  </li>
                ))}</ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Páginas ----------
function AbaPaginas({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const pg = useAdmin<{
    tracking: boolean; visitors?: { loggedIn: number; anonymous: number };
    top: { path: string; views: number; visitors: number }[]; sections: { section: string; views: number; visitors: number }[];
    devices: { device: string; views: number }[]; hours: { hour: number; views: number }[];
  }>("pages", params);
  if (pg.error) return <Erro error={pg.error} />;
  if (pg.data && !pg.data.tracking) {
    return <EmptyState icon={MousePointerClick} title="O registro de páginas ainda não começou" description="Assim que a atualização estiver no ar, cada página aberta passa a ser contada aqui." />;
  }
  const d = pg.data;
  const totalDisp = (d?.devices || []).reduce((s, x) => s + x.views, 0);
  const mobile = d?.devices.find((x) => x.device === "mobile")?.views || 0;
  const dados = serie(ov);
  const pico = d?.hours.reduce((a, b) => (b.views > a.views ? b : a), { hour: 0, views: 0 });
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Páginas vistas" icon={Eye} tone="violet" loading={loading} value={formatNumber(ov?.kpis.pageViews)} delta={delta(ov?.kpis.pageViews, ov?.kpis.pageViewsPrev)} />
        <StatCard label="Usuários logados" icon={Users} tone="success" loading={pg.isLoading} value={formatNumber(d?.visitors?.loggedIn)} hint="abriram pelo menos uma página" />
        <StatCard label="Visitantes sem login" icon={Activity} loading={pg.isLoading} value={formatNumber(d?.visitors?.anonymous)} hint="sessões no site público" />
        <StatCard label="No celular" icon={Smartphone} loading={pg.isLoading} value={pct(mobile, totalDisp)} hint={pico && pico.views ? `pico às ${pico.hour}h` : undefined} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Páginas vistas" description="Total por intervalo" loading={loading} empty={!dados.length} className="xl:col-span-2" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={40} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="views" name="Páginas vistas" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Horário de acesso" description="Horário de Brasília" loading={pg.isLoading} empty={!d?.hours.some((h) => h.views)} height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d?.hours || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="hour" {...axisProps} tickFormatter={(h) => `${h}h`} interval={3} />
              <YAxis {...axisProps} width={32} allowDecimals={false} />
              <Tooltip {...tooltipStyle} labelFormatter={(h) => `${h}h`} />
              <Bar dataKey="views" name="Páginas vistas" fill={CHART_COLORS.sky} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Painel title="Páginas mais abertas" description="Visualizações e pessoas diferentes" className="xl:col-span-2">
          {pg.isLoading ? <TableSkeleton rows={8} /> : !d?.top.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma página registrada no período.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Página</TableHead><TableHead className="text-right">Vistas</TableHead><TableHead className="text-right">Pessoas</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.top.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell><p className="font-medium">{nomePagina(p.path)}</p><p className="text-xs text-muted-foreground font-mono">{p.path}</p></TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.visitors)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Painel>
        <Painel title="Por área da plataforma">
          {pg.isLoading ? <TableSkeleton rows={6} /> : (
            <Ranking vazio="Sem dados." itens={(d?.sections || []).map((s) => ({ label: nomePagina(s.section === "inicio" ? "/" : `/${s.section}`), sub: `${formatNumber(s.visitors)} pessoas`, value: s.views }))} />
          )}
        </Painel>
      </div>
    </>
  );
}

// ---------- Comunidade ----------
function AbaComunidade({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const c = useAdmin<{
    topTopics: { id: string; title: string; slug: string; author: string; replies: number; views: number; likes: number }[];
    topPosts: { id: string; content: string; author: string; likes: number; comments: number; views: number; createdAt: string }[];
    contributors: { id: string; name: string; email: string; total: number; topics: number; replies: number; posts: number; comments: number }[];
    pendingReports: { posts: number; comments: number; topics: number; replies: number };
  }>("community", params);
  const k = ov?.kpis;
  const dados = serie(ov);
  const den = c.data?.pendingReports;
  const totalDen = den ? den.posts + den.comments + den.topics + den.replies : 0;
  if (c.error) return <Erro error={c.error} />;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Fórum" icon={MessagesSquare} tone="success" loading={loading} value={formatNumber(k?.topics)} hint={k ? `tópicos · ${formatNumber(k.replies)} respostas` : undefined} />
        <StatCard label="Timeline" icon={MessageSquare} tone="info" loading={loading} value={formatNumber(k?.posts)} hint={k ? `posts · ${formatNumber(k.comments)} comentários` : undefined} />
        <StatCard label="Reações" icon={TrendingUp} tone="violet" loading={loading} value={formatNumber(k?.reactions)} />
        <StatCard label="Denúncias pendentes" icon={Flag} tone={totalDen ? "danger" : "default"} colorValue={!!totalDen} loading={c.isLoading} value={formatNumber(totalDen)}
          hint={<LinkAdmin href="/admin/comunidade">Moderar</LinkAdmin>} />
      </StatGrid>

      <ChartCard title="Atividade por intervalo" loading={loading} empty={!dados.length} height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={36} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="topics" name="Tópicos" stackId="c" fill={CHART_COLORS.primary} />
            <Bar dataKey="replies" name="Respostas" stackId="c" fill={CHART_COLORS.teal} />
            <Bar dataKey="posts" name="Posts" stackId="c" fill={CHART_COLORS.sky} />
            <Bar dataKey="comments" name="Comentários" stackId="c" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Painel title="Tópicos mais movimentados" description="Respostas no período">
          {c.isLoading ? <TableSkeleton rows={6} /> : !c.data?.topTopics.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum tópico com atividade no período.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Tópico</TableHead><TableHead className="text-right">Respostas</TableHead><TableHead className="text-right hidden sm:table-cell">Visitas</TableHead></TableRow></TableHeader>
              <TableBody>{c.data.topTopics.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><a href={`/forum/${t.slug || t.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline line-clamp-1">{t.title}</a><p className="text-xs text-muted-foreground">{t.author}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(t.replies)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatNumber(t.views)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </Painel>
        <Painel title="Quem mais participa" description="Tópicos, respostas, posts e comentários">
          {c.isLoading ? <TableSkeleton rows={6} /> : (
            <Ranking vazio="Ninguém participou no período."
              itens={(c.data?.contributors || []).slice(0, 10).map((u) => ({ label: u.name, sub: `${u.topics + u.replies} fórum · ${u.posts + u.comments} timeline`, value: u.total }))} />
          )}
        </Painel>
      </div>

      <Painel title="Posts com mais engajamento na timeline">
        {c.isLoading ? <TableSkeleton rows={5} /> : !c.data?.topPosts.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum post no período.</p> : (
          <ul className="divide-y border-t">{c.data.topPosts.map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0"><p className="text-sm line-clamp-2">{p.content}</p><p className="text-xs text-muted-foreground mt-0.5">{p.author} · {dataCurta(p.createdAt)}</p></div>
              <div className="text-xs text-muted-foreground text-right whitespace-nowrap tabular-nums">{formatNumber(p.likes)} curtidas<br />{formatNumber(p.comments)} comentários</div>
            </li>
          ))}</ul>
        )}
      </Painel>
    </>
  );
}

// ---------- Marketplace ----------
const STATUS_PEDIDO: Record<string, { label: string; tone: BadgeTone }> = {
  completed: { label: "Pago", tone: "success" }, pending: { label: "Aguardando pagamento", tone: "neutral" }, refunded: { label: "Reembolsado", tone: "danger" },
  refund_requested: { label: "Reembolso pedido", tone: "warning" }, cancelled: { label: "Cancelado", tone: "neutral" }, canceled: { label: "Cancelado", tone: "neutral" },
};
function AbaMarketplace({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const m = useAdmin<{
    topProducts: { id: string; title: string; seller: string; orders: number; cents: number }[];
    topSellers: { id: string; name: string; email: string; orders: number; cents: number; netCents: number }[];
    ordersByStatus: { status: string; count: number; cents: number }[];
    catalog: { active: number; blocked: number; sellers: number };
  }>("marketplace", params);
  const k = ov?.kpis;
  const dados = serie(ov);
  if (m.error) return <Erro error={m.error} />;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Vendas pagas" icon={ShoppingBag} tone="success" loading={loading} value={formatNumber(k?.ordersPaid)} />
        <StatCard label="Transacionado" icon={TrendingUp} tone="success" colorValue loading={loading} value={formatBRL(k?.gmvCents)}
          hint={k?.ordersPaid ? `ticket médio ${formatBRL(k.gmvCents / k.ordersPaid)}` : undefined} />
        <StatCard label="Produtos novos" icon={FileStack} loading={loading} value={formatNumber(k?.products)} />
        <StatCard label="Catálogo ativo" icon={Store} loading={m.isLoading} value={formatNumber(m.data?.catalog.active)}
          hint={m.data ? `${formatNumber(m.data.catalog.sellers)} vendedores · ${formatNumber(m.data.catalog.blocked)} bloqueados` : undefined} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Vendas e produtos novos" loading={loading} empty={!dados.length} className="xl:col-span-2" height={250}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={32} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="orders" name="Vendas pagas" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="products" name="Produtos novos" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Painel title="Pedidos criados no período" actions={<LinkAdmin href="/admin/marketplace">Moderar</LinkAdmin>}>
          {m.isLoading ? <TableSkeleton rows={4} /> : !m.data?.ordersByStatus.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Sem pedidos no período.</p> : (
            <ul className="px-5 pb-4 space-y-2.5">{m.data.ordersByStatus.map((s) => {
              const st = STATUS_PEDIDO[s.status] || { label: s.status, tone: "neutral" as BadgeTone };
              return (
                <li key={s.status} className="flex items-center justify-between gap-3 text-sm">
                  <StatusBadge tone={st.tone} dot>{st.label}</StatusBadge>
                  <span className="tabular-nums"><b>{formatNumber(s.count)}</b> <span className="text-muted-foreground">· {formatBRL(s.cents)}</span></span>
                </li>
              );
            })}</ul>
          )}
        </Painel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Painel title="Produtos que mais venderam">
          {m.isLoading ? <TableSkeleton rows={5} /> : !m.data?.topProducts.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma venda paga no período.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{m.data.topProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><p className="font-medium line-clamp-1">{p.title}</p><p className="text-xs text-muted-foreground">{p.seller}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatBRL(p.cents)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </Painel>
        <Painel title="Vendedores que mais faturaram" actions={<LinkAdmin href="/admin/vendedores">Vendedores</LinkAdmin>}>
          {m.isLoading ? <TableSkeleton rows={5} /> : !m.data?.topSellers.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma venda paga no período.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right hidden sm:table-cell">Líquido</TableHead></TableRow></TableHeader>
              <TableBody>{m.data.topSellers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><p className="font-medium truncate max-w-[180px]">{s.name}</p><p className="text-xs text-muted-foreground truncate max-w-[180px]">{s.email}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(s.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(s.cents)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatBRL(s.netCents)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </Painel>
      </div>
    </>
  );
}

// ---------- Suporte ----------
const STATUS_TICKET: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "Aberto", tone: "warning" }, in_progress: { label: "Em atendimento", tone: "info" }, closed: { label: "Resolvido", tone: "success" },
};
const PRIORIDADE: Record<string, { label: string; tone: BadgeTone }> = {
  high: { label: "Alta", tone: "danger" }, urgent: { label: "Urgente", tone: "danger" }, normal: { label: "Normal", tone: "neutral" }, low: { label: "Baixa", tone: "neutral" },
};
function AbaSuporte({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const s = useAdmin<{
    byStatus: { status: string; count: number }[]; byPriority: { priority: string; count: number }[];
    open: { id: string; subject: string; status: string; priority: string; createdAt: string; name: string; email: string }[];
  }>("support", params);
  const k = ov?.kpis;
  const dados = serie(ov);
  const resolvidos = s.data?.byStatus.find((x) => x.status === "closed")?.count || 0;
  const noPeriodo = (s.data?.byStatus || []).reduce((a, b) => a + b.count, 0);
  if (s.error) return <Erro error={s.error} />;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Abertos no período" icon={Ticket} loading={loading} value={formatNumber(k?.ticketsOpened)} />
        <StatCard label="Esperando resposta agora" icon={LifeBuoy} tone={k?.ticketsOpen ? "warning" : "default"} colorValue={!!k?.ticketsOpen} loading={loading} value={formatNumber(k?.ticketsOpen)}
          hint={<LinkAdmin href="/admin/comunidade">Responder</LinkAdmin>} />
        <StatCard label="Resolvidos" icon={Activity} tone="success" loading={s.isLoading} value={formatNumber(resolvidos)} hint={`${pct(resolvidos, noPeriodo)} dos abertos no período`} />
        <StatCard label="Prioridade alta" icon={Flag} tone="danger" loading={s.isLoading} value={formatNumber(s.data?.byPriority.filter((p) => p.priority === "high" || p.priority === "urgent").reduce((a, b) => a + b.count, 0))} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Tickets abertos por intervalo" loading={loading} empty={!dados.length} className="xl:col-span-2" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={28} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="tickets" name="Tickets" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Painel title="Situação dos tickets do período">
          {s.isLoading ? <TableSkeleton rows={3} /> : (
            <Ranking vazio="Nenhum ticket no período." itens={(s.data?.byStatus || []).map((x) => ({ label: (STATUS_TICKET[x.status] || { label: x.status }).label, value: x.count }))} />
          )}
        </Painel>
      </div>

      <Painel title="Esperando resposta" description="Do mais antigo para o mais novo" actions={<LinkAdmin href="/admin/comunidade">Abrir tickets</LinkAdmin>}>
        {s.isLoading ? <TableSkeleton rows={5} /> : !s.data?.open.length ? (
          <EmptyState icon={LifeBuoy} title="Nenhum ticket esperando" description="Tudo respondido." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Assunto</TableHead><TableHead className="hidden sm:table-cell">Situação</TableHead><TableHead className="hidden md:table-cell">Prioridade</TableHead><TableHead className="text-right">Aberto</TableHead></TableRow></TableHeader>
            <TableBody>{s.data.open.map((t) => {
              const st = STATUS_TICKET[t.status] || { label: t.status, tone: "neutral" as BadgeTone };
              const pr = PRIORIDADE[t.priority] || { label: t.priority || "Normal", tone: "neutral" as BadgeTone };
              return (
                <TableRow key={t.id}>
                  <TableCell><p className="font-medium line-clamp-1">{t.subject}</p><p className="text-xs text-muted-foreground">{t.name} · {t.email}</p></TableCell>
                  <TableCell className="hidden sm:table-cell"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                  <TableCell className="hidden md:table-cell"><StatusBadge tone={pr.tone}>{pr.label}</StatusBadge></TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">{ha(t.createdAt)}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
      </Painel>
    </>
  );
}

// ---------- Indicações ----------
const STATUS_COMISSAO: Record<string, string> = { pending: "Pendente", active: "Ativa", completed: "Liberada", canceled: "Cancelada", refunded: "Estornada" };
function AbaIndicacoes({ params, ov, loading }: { params: Params; ov?: Overview; loading: boolean }) {
  const r = useAdmin<{
    topReferrers: { id: string; name: string; email: string; code: string; clicks: number; conversions: number; cents: number }[];
    commissionsByStatus: { status: string; count: number; cents: number }[];
  }>("referrals", params);
  const k = ov?.kpis;
  const dados = serie(ov);
  const validas = (r.data?.commissionsByStatus || []).filter((c) => c.status !== "canceled" && c.status !== "refunded");
  const totalCom = validas.reduce((a, b) => a + b.cents, 0);
  if (r.error) return <Erro error={r.error} />;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Cliques nos links" icon={MousePointerClick} loading={loading} value={formatNumber(k?.refClicks)} />
        <StatCard label="Viraram cadastro" icon={UserPlus} tone="success" loading={loading} value={formatNumber(k?.refConversions)} hint={k ? `conversão de ${pct(k.refConversions, k.refClicks)}` : undefined} />
        <StatCard label="Comissões geradas" icon={CreditCard} tone="success" colorValue loading={r.isLoading} value={formatBRL(totalCom)}
          hint={`${formatNumber(validas.reduce((a, b) => a + b.count, 0))} comissões válidas`} />
        <StatCard label="Indicadores ativos" icon={Share2} loading={r.isLoading} value={formatNumber(r.data?.topReferrers.length)} hint={<LinkAdmin href="/admin/afiliados">Afiliados</LinkAdmin>} />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Cliques nos links de indicação" loading={loading} empty={!dados.length} className="xl:col-span-2" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={28} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="refClicks" name="Cliques" fill={CHART_COLORS.sky} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Painel title="Comissões do período">
          {r.isLoading ? <TableSkeleton rows={4} /> : !r.data?.commissionsByStatus.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma comissão no período.</p> : (
            <ul className="px-5 pb-4 space-y-2.5">{r.data.commissionsByStatus.map((c) => (
              <li key={c.status} className="flex items-center justify-between text-sm">
                <span>{STATUS_COMISSAO[c.status] || c.status} <span className="text-muted-foreground">({formatNumber(c.count)})</span></span>
                <span className="tabular-nums font-medium">{formatBRL(c.cents)}</span>
              </li>
            ))}</ul>
          )}
        </Painel>
      </div>

      <Painel title="Quem mais indica" description="Cliques, cadastros e comissão no período">
        {r.isLoading ? <TableSkeleton rows={5} /> : !r.data?.topReferrers.length ? <EmptyState icon={Share2} title="Nenhuma indicação no período" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Indicador</TableHead><TableHead className="hidden sm:table-cell">Código</TableHead><TableHead className="text-right">Cliques</TableHead><TableHead className="text-right">Cadastros</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow></TableHeader>
            <TableBody>{r.data.topReferrers.map((u) => (
              <TableRow key={u.id}>
                <TableCell><p className="font-medium truncate max-w-[200px]">{u.name}</p><p className="text-xs text-muted-foreground truncate max-w-[200px]">{u.email}</p></TableCell>
                <TableCell className="hidden sm:table-cell font-mono text-xs">{u.code}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(u.clicks)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(u.conversions)} <span className="text-xs text-muted-foreground">({pct(u.conversions, u.clicks)})</span></TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatBRL(u.cents)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Painel>
    </>
  );
}

// ---------- Criadores (clonador, presell, quiz) ----------
interface Criador {
  id: string; name: string; email: string; cloned: number; clonedViews: number; presells: number; presellViews: number;
  quizzes: number; quizViews: number; quizStarts: number; quizCompletions: number; leads: number; newInPeriod: number;
}
function AbaCriadores({ params }: { params: Params }) {
  const c = useAdmin<{ totals: Omit<Criador, "id" | "name" | "email"> & { creators: number }; users: Criador[] }>("creators", params);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (c.data?.users || []).filter((u) => !b || u.name.toLowerCase().includes(b) || u.email.toLowerCase().includes(b));
  }, [c.data, busca]);
  const t = c.data?.totals;
  if (c.error) return <Erro error={c.error} />;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Páginas clonadas" icon={Copy} loading={c.isLoading} value={formatNumber(t?.cloned)} hint={t ? `${formatNumber(t.clonedViews)} visitas` : undefined} />
        <StatCard label="Presells" icon={FileStack} loading={c.isLoading} value={formatNumber(t?.presells)} hint={t ? `${formatNumber(t.presellViews)} visitas` : undefined} />
        <StatCard label="Quizzes" icon={Target} loading={c.isLoading} value={formatNumber(t?.quizzes)} hint={t ? `${formatNumber(t.quizViews)} visitas · ${pct(t.quizCompletions, t.quizStarts)} concluem` : undefined} />
        <StatCard label="Leads capturados" icon={UserPlus} tone="success" colorValue loading={c.isLoading} value={formatNumber(t?.leads)}
          hint={t ? `${formatNumber(t.creators)} criadores · ${formatNumber(t.newInPeriod)} páginas novas no período` : undefined} />
      </StatGrid>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar criador" className="pl-9 h-9" />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Totais de cada criador (desde o início). "Novas" conta só o período.</span>
        </div>
        {c.isLoading ? <TableSkeleton rows={6} /> : !lista.length ? (
          <EmptyState icon={Copy} title="Nenhum criador ainda" description="Aparecem aqui os usuários que clonaram páginas, criaram presells ou quizzes." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criador</TableHead>
                <TableHead className="text-right">Clonadas</TableHead>
                <TableHead className="text-right hidden md:table-cell">Presells</TableHead>
                <TableHead className="text-right">Quizzes</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Conclusão</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Novas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{lista.map((u) => (
              <TableRow key={u.id}>
                <TableCell><p className="font-medium truncate max-w-[200px]">{u.name}</p><p className="text-xs text-muted-foreground truncate max-w-[200px]">{u.email}</p></TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(u.cloned)}<p className="text-xs text-muted-foreground">{formatNumber(u.clonedViews)} visitas</p></TableCell>
                <TableCell className="text-right tabular-nums hidden md:table-cell">{formatNumber(u.presells)}<p className="text-xs text-muted-foreground">{formatNumber(u.presellViews)} visitas</p></TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(u.quizzes)}<p className="text-xs text-muted-foreground">{formatNumber(u.quizViews)} visitas</p></TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatNumber(u.leads)}</TableCell>
                <TableCell className="text-right hidden lg:table-cell">
                  {u.quizStarts ? (
                    <div className="flex items-center justify-end gap-2"><Progress value={(u.quizCompletions / u.quizStarts) * 100} className="h-1.5 w-16" /><span className="text-xs tabular-nums w-9">{pct(u.quizCompletions, u.quizStarts)}</span></div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums hidden lg:table-cell">{formatNumber(u.newInPeriod)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Leads vêm dos quizzes. As vendas das páginas clonadas e presells acontecem no checkout de cada cliente (fora da Lowfy), então não aparecem aqui.
      </p>
    </>
  );
}
