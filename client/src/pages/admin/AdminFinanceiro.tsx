import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Users, RefreshCw, BarChart3, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  CartesianGrid, Tooltip, XAxis, YAxis, Legend, ResponsiveContainer,
} from "recharts";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod,
  ChartCard, CHART_COLORS, gridProps, axisProps, tooltipStyle, formatBRL,
} from "@/components/admin";

interface FinanceSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  totalRevenue: number;
  period: { startDate: string; endDate: string };
}

interface TimeseriesData {
  date: string;
  newSubscriptions: number;
  canceledSubscriptions: number;
  revenue: number;
}

interface TimeseriesResponse {
  timeseries: TimeseriesData[];
  period: { startDate: string; endDate: string; groupBy: string };
}

export default function AdminFinanceiro() {
  const [period, setPeriod] = useState(defaultPeriod("30days"));
  const { startDate, endDate, groupBy } = period;

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: summaryFetching } = useQuery<FinanceSummary>({
    queryKey: ["/api/admin/finance/summary", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await apiRequest("GET", `/api/admin/finance/summary?${params}`);
      return response.json();
    }
  });

  const { data: timeseries, isLoading: timeseriesLoading, refetch: refetchTimeseries } = useQuery<TimeseriesResponse>({
    queryKey: ["/api/admin/finance/timeseries", startDate, endDate, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, groupBy });
      const response = await apiRequest("GET", `/api/admin/finance/timeseries?${params}`);
      return response.json();
    }
  });

  const formatChartDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, groupBy === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const chartData = timeseries?.timeseries.map(item => ({
    ...item,
    dateFormatted: formatChartDate(item.date),
    revenueFormatted: item.revenue / 100,
  })) || [];

  const noData = chartData.length === 0;
  const churnPct = summary && summary.newSubscriptions > 0
    ? (summary.canceledSubscriptions / summary.newSubscriptions) * 100
    : null;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Financeiro"
        description="Receita e assinaturas da plataforma"
        icon={Wallet}
        actions={
          <Button onClick={() => { refetchSummary(); refetchTimeseries(); }} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${summaryFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} showGroupBy />
      </AdminPageHeader>

      <StatGrid cols={5}>
        <StatCard
          label="Receita no período"
          value={formatBRL(summary?.totalRevenue)}
          icon={DollarSign}
          tone="success"
          colorValue
          loading={summaryLoading}
          testId="stat-revenue"
        />
        <StatCard
          label="Novas assinaturas"
          value={summary?.newSubscriptions ?? 0}
          icon={TrendingUp}
          tone="success"
          loading={summaryLoading}
          testId="stat-new"
        />
        <StatCard
          label="Canceladas"
          value={summary?.canceledSubscriptions ?? 0}
          icon={TrendingDown}
          tone="danger"
          hint={churnPct !== null ? `${churnPct.toFixed(0)}% das novas` : undefined}
          loading={summaryLoading}
          testId="stat-canceled"
        />
        <StatCard
          label="Assinaturas ativas"
          value={summary?.activeSubscriptions ?? 0}
          icon={BarChart3}
          tone="info"
          loading={summaryLoading}
          testId="stat-active"
        />
        <StatCard
          label="Total histórico"
          value={summary?.totalSubscriptions ?? 0}
          icon={Users}
          loading={summaryLoading}
          testId="stat-total"
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Receita ao longo do tempo"
          description="Evolução da receita no período selecionado"
          loading={timeseriesLoading}
          empty={noData}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...axisProps} dataKey="dateFormatted" dy={6} />
              <YAxis {...axisProps} width={60} tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [
                value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Receita",
              ]} />
              <Area type="monotone" dataKey="revenueFormatted" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#revGradient)" name="Receita" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Novas vs. canceladas"
          description="Comparativo de entradas e saídas de assinantes"
          loading={timeseriesLoading}
          empty={noData}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis {...axisProps} dataKey="dateFormatted" dy={6} />
              <YAxis {...axisProps} width={40} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="newSubscriptions" name="Novas" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="canceledSubscriptions" name="Canceladas" fill={CHART_COLORS.rose} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Tendência de assinaturas"
        description="Evolução de novas assinaturas e cancelamentos"
        height={360}
        loading={timeseriesLoading}
        empty={noData}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...axisProps} dataKey="dateFormatted" dy={6} />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="newSubscriptions" name="Novas assinaturas" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="canceledSubscriptions" name="Cancelamentos" stroke={CHART_COLORS.rose} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </AdminPage>
  );
}
