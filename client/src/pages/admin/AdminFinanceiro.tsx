import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wallet, RefreshCw, TrendingUp, Repeat, Users, UserPlus, UserMinus, Undo2, Scale, ExternalLink, CalendarClock, Receipt, Info, Hourglass,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from "recharts";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, ChartCard, EmptyState, TableSkeleton, StatusBadge,
  CHART_COLORS, gridProps, axisProps, tooltipStyle, formatBRLValue, formatNumber,
} from "@/components/admin";

interface Revenue { grossBrl: number; refundsBrl: number; feesBrl: number; commissionsBrl: number; netBrl: number; payments: number; payingUsers: number }
interface Finance {
  period: { from: string; to: string; groupBy: string };
  revenue: Revenue; revenuePrev: Revenue;
  mrrBrl: number;
  subscribers: { active: number; monthly: number; yearly: number };
  newSubs: number; newSubsPrev: number; cancels: number; cancelsPrev: number; lostMrrBrl: number; churnPct: number | null;
  refundsCount: number;
  pendingRefunds: { count: number; brl: number };
  awaitingPayment: { count: number; brl: number };
  marketplace: { orders: number; gmvBrl: number; feeBrl: number };
  aiCostBrl: number; resultBrl: number; resultPrevBrl: number;
  series: { date: string; revenueBrl: number; refundsBrl: number; marketplaceFeeBrl: number; newSubs: number; cancels: number }[];
  byPlan: { plan: string; count: number; brl: number }[];
  byMethod: { method: string; count: number; brl: number }[];
  recentPayments: { userId: string; name: string; email: string; brl: number; paidAt: string; method: string; plan: string; renewal: boolean }[];
  upcomingRenewals: { id: string; name: string; email: string; plan: string; brl: number; method: string; at: string }[];
}

const delta = (a?: number, b?: number) => (a == null || !b ? null : ((a - b) / Math.abs(b)) * 100);
const PLANO: Record<string, string> = { mensal: "Mensal", anual: "Anual" };
const METODO: Record<string, string> = { pix: "Pix", credit_card: "Cartão", boleto: "Boleto", "—": "Não informado" };
const nomePlano = (p?: string) => PLANO[p || ""] || p || "—";
const nomeMetodo = (m?: string) => METODO[m || ""] || m || "—";

export default function AdminFinanceiro() {
  const [period, setPeriod] = useState(defaultPeriod("30days"));
  const params = new URLSearchParams({ startDate: period.startDate, endDate: period.endDate, groupBy: period.groupBy }).toString();
  const f = useQuery<Finance>({
    queryKey: ["/api/admin/finance/v2/overview", params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/finance/v2/overview?${params}`)).json(),
    staleTime: 30_000,
  });
  const d = f.data;
  const r = d?.revenue;
  const dados = (d?.series || []).map((s) => ({
    ...s,
    label: (() => { try { return format(new Date(`${s.date}T12:00:00`), d!.period.groupBy === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR }); } catch { return s.date; } })(),
  }));

  return (
    <AdminPage>
      <AdminPageHeader
        title="Financeiro"
        description="Quanto entrou, quanto saiu e o que sobrou no período."
        icon={Wallet}
        actions={
          <Button onClick={() => f.refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${f.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} showGroupBy />
      </AdminPageHeader>

      {f.error ? (
        <EmptyState icon={Info} title="Não deu para carregar o financeiro" description={String((f.error as any)?.message || "").replace(/^\d+:\s*/, "") || "Tente de novo."} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Receita bruta" icon={TrendingUp} tone="success" colorValue loading={f.isLoading} value={formatBRLValue(r?.grossBrl)}
              delta={delta(r?.grossBrl, d?.revenuePrev.grossBrl)} testId="stat-gross" />
            <StatCard label="Receita líquida" icon={Wallet} tone="success" loading={f.isLoading} value={formatBRLValue(r?.netBrl)}
              delta={delta(r?.netBrl, d?.revenuePrev.netBrl)} testId="stat-net" />
            <StatCard label="MRR" icon={Repeat} tone="info" loading={f.isLoading} value={formatBRLValue(d?.mrrBrl)}
              hint={d ? `${formatBRLValue(d.mrrBrl * 12)} por ano` : undefined} testId="stat-mrr" />
            <StatCard label="Assinantes ativos" icon={Users} loading={f.isLoading} value={formatNumber(d?.subscribers.active)}
              hint={d ? `${formatNumber(d.subscribers.monthly)} mensais · ${formatNumber(d.subscribers.yearly)} anuais` : undefined} testId="stat-active" />
          </StatGrid>
          <StatGrid cols={4}>
            <StatCard label="Novas assinaturas" icon={UserPlus} tone="success" loading={f.isLoading} value={formatNumber(d?.newSubs)} delta={delta(d?.newSubs, d?.newSubsPrev)} />
            <StatCard label="Cancelamentos" icon={UserMinus} tone="danger" loading={f.isLoading} value={formatNumber(d?.cancels)}
              hint={d?.churnPct != null ? `churn de ${d.churnPct.toFixed(1).replace(".", ",")}%` : undefined} />
            <StatCard label="Reembolsos" icon={Undo2} tone={d?.pendingRefunds.count ? "warning" : "default"} loading={f.isLoading} value={formatBRLValue(r?.refundsBrl)}
              hint={d ? (d.pendingRefunds.count ? <Link href="/admin/subscription-refunds" className="text-amber-700 font-medium hover:underline">{d.pendingRefunds.count} pedido{d.pendingRefunds.count === 1 ? "" : "s"} para analisar</Link> : `${formatNumber(d.refundsCount)} no período`) : undefined} />
            <StatCard label="Resultado" icon={Scale} tone={d && d.resultBrl < 0 ? "danger" : "success"} colorValue loading={f.isLoading} value={formatBRLValue(d?.resultBrl)}
              delta={delta(d?.resultBrl, d?.resultPrevBrl)} testId="stat-result" />
          </StatGrid>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard title="Receita por intervalo" description="Assinaturas e taxa do marketplace; linha: reembolsos" loading={f.isLoading} empty={!dados.length} className="xl:col-span-2" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={60} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, k: any) => [formatBRLValue(Number(v)), k]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenueBrl" name="Assinaturas" stackId="r" fill={CHART_COLORS.primary} maxBarSize={30} />
                  <Bar dataKey="marketplaceFeeBrl" name="Marketplace (taxa)" stackId="r" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line dataKey="refundsBrl" name="Reembolsos" stroke={CHART_COLORS.rose} strokeWidth={2} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <DaReceitaAoResultado d={d} loading={f.isLoading} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard title="Entradas e saídas de assinantes" loading={f.isLoading} empty={!dados.length} className="xl:col-span-2" height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={28} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="newSubs" name="Novas" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="cancels" name="Canceladas" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="space-y-4">
              <Quebra titulo="Por plano" itens={(d?.byPlan || []).map((p) => ({ nome: nomePlano(p.plan), qtd: p.count, brl: p.brl }))} loading={f.isLoading} />
              <Quebra titulo="Por forma de pagamento" itens={(d?.byMethod || []).map((p) => ({ nome: nomeMetodo(p.method), qtd: p.count, brl: p.brl }))} loading={f.isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Painel titulo="Renovações nos próximos 7 dias" descricao={d ? `${formatNumber(d.upcomingRenewals.length)} cobranças · ${formatBRLValue(d.upcomingRenewals.reduce((s, x) => s + x.brl, 0))} previstos` : undefined} icone={CalendarClock}>
              {f.isLoading ? <TableSkeleton rows={4} /> : !d?.upcomingRenewals.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma renovação nos próximos 7 dias.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Assinante</TableHead><TableHead className="hidden sm:table-cell">Plano</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Quando</TableHead></TableRow></TableHeader>
                  <TableBody>{d.upcomingRenewals.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell><p className="font-medium truncate max-w-[180px]">{x.name}</p><p className="text-xs text-muted-foreground truncate max-w-[180px]">{x.email}</p></TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{nomePlano(x.plan)} · {nomeMetodo(x.method)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRLValue(x.brl)}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{format(new Date(x.at), "dd/MM")}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Painel>
            <Painel titulo="Últimos pagamentos" icone={Receipt}
              acao={d?.awaitingPayment.count ? <Link href="/admin/checkout-abandonado" className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"><Hourglass className="w-3 h-3" /> {d.awaitingPayment.count} aguardando pagamento <ExternalLink className="w-3 h-3" /></Link> : undefined}>
              {f.isLoading ? <TableSkeleton rows={5} /> : !d?.recentPayments.length ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum pagamento no período.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Assinante</TableHead><TableHead className="hidden sm:table-cell">Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Pago</TableHead></TableRow></TableHeader>
                  <TableBody>{d.recentPayments.map((x, i) => (
                    <TableRow key={i}>
                      <TableCell><p className="font-medium truncate max-w-[180px]">{x.name || "—"}</p><p className="text-xs text-muted-foreground truncate max-w-[180px]">{x.email}</p></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge tone={x.renewal ? "info" : "success"}>{x.renewal ? "Renovação" : "Nova"}</StatusBadge>
                        <p className="text-xs text-muted-foreground mt-1">{nomePlano(x.plan)} · {nomeMetodo(x.method)}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatBRLValue(x.brl)}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{formatDistanceToNowStrict(new Date(x.paidAt), { locale: ptBR, addSuffix: true })}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Painel>
          </div>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            *A taxa do gateway é estimada pelo percentual configurado em Consumo e custos. MRR conta as assinaturas ativas hoje (anuais divididas por 12). A mesma receita aparece em Consumo e custos.
          </p>
        </>
      )}
    </AdminPage>
  );
}

function Painel({ titulo, descricao, icone: Icone, acao, children }: { titulo: string; descricao?: string; icone?: any; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">{Icone && <Icone className="w-4 h-4 text-muted-foreground" />}{titulo}</h3>
          {descricao && <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {children}
    </div>
  );
}

function Quebra({ titulo, itens, loading }: { titulo: string; itens: { nome: string; qtd: number; brl: number }[]; loading: boolean }) {
  const total = itens.reduce((s, x) => s + x.brl, 0) || 1;
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <p className="text-sm font-semibold mb-3">{titulo}</p>
      {loading ? <div className="h-14 rounded bg-muted animate-pulse" /> : !itens.length ? <p className="text-sm text-muted-foreground">Sem pagamentos no período.</p> : (
        <ul className="space-y-2.5">{itens.map((x) => (
          <li key={x.nome}>
            <div className="flex justify-between text-sm"><span>{x.nome} <span className="text-xs text-muted-foreground">({formatNumber(x.qtd)})</span></span><span className="font-semibold tabular-nums">{formatBRLValue(x.brl)}</span></div>
            <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden"><div className="h-full rounded-full bg-primary/80" style={{ width: `${(x.brl / total) * 100}%` }} /></div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

// Cascata: da receita bruta até o resultado do período.
function DaReceitaAoResultado({ d, loading }: { d?: Finance; loading: boolean }) {
  if (loading || !d) return <div className="rounded-xl border bg-card shadow-sm h-[360px] animate-pulse" />;
  const r = d.revenue;
  const linhas: { rotulo: string; valor: number; tipo: "base" | "menos" | "mais" | "total"; link?: string }[] = [
    { rotulo: "Receita bruta (assinaturas)", valor: r.grossBrl, tipo: "base" },
    { rotulo: "Reembolsos", valor: -r.refundsBrl, tipo: "menos", link: "/admin/subscription-refunds" },
    { rotulo: "Taxa do gateway*", valor: -r.feesBrl, tipo: "menos" },
    { rotulo: "Comissões de afiliados", valor: -r.commissionsBrl, tipo: "menos", link: "/admin/afiliados" },
    { rotulo: "Receita líquida", valor: r.netBrl, tipo: "total" },
    { rotulo: "Taxa do marketplace", valor: d.marketplace.feeBrl, tipo: "mais", link: "/admin/vendedores" },
    { rotulo: "Custo de IA", valor: -d.aiCostBrl, tipo: "menos", link: "/admin/ai-usage" },
    { rotulo: "Resultado", valor: d.resultBrl, tipo: "total" },
  ];
  return (
    <div className="rounded-xl border bg-card shadow-sm p-5">
      <p className="text-sm font-semibold">Da receita ao resultado</p>
      <p className="text-xs text-muted-foreground mb-3">Tudo no período escolhido</p>
      <ul className="text-sm">
        {linhas.map((l) => (
          <li key={l.rotulo} className={`flex items-center justify-between gap-3 py-2 ${l.tipo === "total" ? "border-t font-semibold" : ""}`}>
            <span className={l.tipo === "menos" || l.tipo === "mais" ? "text-muted-foreground pl-3" : ""}>
              {l.link ? <Link href={l.link} className="hover:underline">{l.rotulo}</Link> : l.rotulo}
            </span>
            <span className={`tabular-nums ${l.tipo === "menos" && l.valor ? "text-red-600" : l.tipo === "mais" && l.valor ? "text-emerald-600" : l.tipo === "total" && l.valor < 0 ? "text-red-600" : ""}`}>
              {l.tipo === "mais" && l.valor ? "+" : ""}{formatBRLValue(l.valor)}
            </span>
          </li>
        ))}
      </ul>
      {d.marketplace.orders > 0 && (
        <p className="text-xs text-muted-foreground mt-2">Marketplace: {formatNumber(d.marketplace.orders)} vendas, {formatBRLValue(d.marketplace.gmvBrl)} transacionados.</p>
      )}
    </div>
  );
}
