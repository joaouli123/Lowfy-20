import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Download,
  Users,
  DollarSign,
  TrendingUp,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Hash,
  ShoppingBag,
  UserPlus,
  Handshake,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod,
  TableCard, EmptyState, TableSkeleton, formatBRL, formatNumber, type Period,
} from "@/components/admin";

interface AffiliateSummary {
  totalPaid: number;
  totalPending: number;
  totalAffiliates: number;
  averageConversionRate: string;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
}

interface Affiliate {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  clicks: number;
  conversions: number;
  totalSales: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  totalRevenue: number;
  averageTicket: number;
  activeReferrals: number;
  createdAt: string;
}

interface AffiliatesListResponse {
  affiliates: Affiliate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminAfiliados() {
  const [period, setPeriod] = useState<Period>(defaultPeriod("30days"));
  const { startDate, endDate } = period;

  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setAffiliatesPage(1);
  };

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: summaryFetching } = useQuery<AffiliateSummary>({
    queryKey: ["/api/admin/affiliates/summary", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await apiRequest("GET", `/api/admin/affiliates/summary?${params}`);
      return response.json();
    }
  });

  const { data: affiliatesData, isLoading: affiliatesLoading, refetch: refetchAffiliates } = useQuery<AffiliatesListResponse>({
    queryKey: ["/api/admin/affiliates/list", affiliatesPage, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: affiliatesPage.toString(),
        limit: "15",
        startDate,
        endDate
      });
      const response = await apiRequest("GET", `/api/admin/affiliates/list?${params}`);
      return response.json();
    }
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchAffiliates();
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());
    window.open(`/api/admin/affiliates/export-csv?${params.toString()}`, '_blank');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const affiliates = affiliatesData?.affiliates || [];
  const affiliatesPagination = affiliatesData || { page: 1, limit: 15, total: 0, totalPages: 1 };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Gestão de afiliados"
        description="Afiliados, comissões e desempenho do programa de indicações"
        icon={Handshake}
        actions={
          <>
            <Button onClick={handleRefresh} variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${summaryFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm" data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </>
        }
      >
        <PeriodFilter value={period} onChange={handlePeriodChange} />
      </AdminPageHeader>

      <StatGrid cols={4}>
        <StatCard
          label="Comissões pagas"
          value={formatBRL(summary?.totalPaid || 0)}
          icon={DollarSign}
          tone="success"
          loading={summaryLoading}
          testId="stat-total-paid"
        />
        <StatCard
          label="Comissões pendentes"
          value={formatBRL(summary?.totalPending || 0)}
          icon={TrendingUp}
          tone="warning"
          loading={summaryLoading}
          testId="stat-total-pending"
        />
        <StatCard
          label="Faturamento gerado"
          value={formatBRL(summary?.totalRevenue || 0)}
          icon={ShoppingBag}
          tone="info"
          hint={summary ? `${formatNumber(summary.totalSales)} vendas` : undefined}
          loading={summaryLoading}
          testId="stat-total-revenue"
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(summary?.averageTicket || 0)}
          icon={Hash}
          tone="violet"
          loading={summaryLoading}
          testId="stat-average-ticket"
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard
          label="Afiliados"
          value={formatNumber(summary?.totalAffiliates || 0)}
          icon={Users}
          loading={summaryLoading}
          testId="stat-total-affiliates"
        />
        <StatCard
          label="Vendas via afiliados"
          value={formatNumber(summary?.totalSales || 0)}
          icon={ShoppingBag}
          loading={summaryLoading}
          testId="stat-total-sales"
        />
        <StatCard
          label="Taxa de conversão"
          value={`${summary?.averageConversionRate || "0.00"}%`}
          icon={Percent}
          hint={summary ? `${formatNumber(summary.totalConversions)} de ${formatNumber(summary.totalClicks)} cliques` : undefined}
          loading={summaryLoading}
          testId="stat-conversion-rate"
        />
        <StatCard
          label="Conversões"
          value={formatNumber(summary?.totalConversions || 0)}
          icon={UserPlus}
          loading={summaryLoading}
          testId="stat-total-conversions"
        />
      </StatGrid>

      <TableCard
        title="Top afiliados"
        count={affiliatesPagination.total}
        footer={
          affiliates.length > 0 ? (
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-muted-foreground">
                Mostrando {affiliates.length} de {affiliatesPagination.total} afiliados
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAffiliatesPage(p => Math.max(1, p - 1))}
                  disabled={affiliatesPage === 1}
                  data-testid="button-affiliates-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm px-2 tabular-nums" data-testid="affiliates-pagination-info">
                  Página {affiliatesPagination.page} de {affiliatesPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAffiliatesPage(p => Math.min(affiliatesPagination.totalPages, p + 1))}
                  disabled={affiliatesPage >= affiliatesPagination.totalPages}
                  data-testid="button-affiliates-next-page"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {affiliatesLoading ? (
          <TableSkeleton />
        ) : affiliates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum afiliado"
            description="Nenhum afiliado encontrado no período selecionado."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead>Afiliado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Comissão total</TableHead>
                <TableHead className="text-right pr-4">Indicados ativos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((affiliate) => (
                <Collapsible
                  key={affiliate.id}
                  open={expandedAffiliate === affiliate.id}
                  onOpenChange={(open) => setExpandedAffiliate(open ? affiliate.id : null)}
                  asChild
                >
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className="cursor-pointer"
                        data-testid={`affiliate-row-${affiliate.id}`}
                      >
                        <TableCell>
                          {expandedAffiliate === affiliate.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell data-testid={`affiliate-name-${affiliate.id}`}>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[240px]">{affiliate.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[240px]" data-testid={`affiliate-email-${affiliate.id}`}>
                              {affiliate.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`affiliate-code-${affiliate.id}`}>
                          <Badge variant="outline" className="font-mono text-xs">{affiliate.referralCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-600" data-testid={`affiliate-commission-${affiliate.id}`}>
                          {formatBRL(affiliate.totalCommission)}
                        </TableCell>
                        <TableCell className="text-right pr-4 tabular-nums" data-testid={`affiliate-referrals-${affiliate.id}`}>
                          {affiliate.activeReferrals}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5}>
                          <div className="p-3 sm:p-4 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Cadastrado em</p>
                                <p className="font-medium tabular-nums">{formatDate(affiliate.createdAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Cliques</p>
                                <p className="font-medium tabular-nums">{formatNumber(affiliate.clicks || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Conversões</p>
                                <p className="font-medium tabular-nums">{formatNumber(affiliate.conversions || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Vendas</p>
                                <p className="font-medium tabular-nums">{formatNumber(affiliate.totalSales || 0)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3 border-t">
                              <div>
                                <p className="text-xs text-muted-foreground">Faturamento gerado</p>
                                <p className="font-medium tabular-nums">{formatBRL(affiliate.totalRevenue || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Ticket médio</p>
                                <p className="font-medium tabular-nums">{formatBRL(affiliate.averageTicket || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Comissão pendente</p>
                                <p className="font-medium tabular-nums text-amber-600">{formatBRL(affiliate.pendingCommission || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Comissão paga</p>
                                <p className="font-medium tabular-nums text-emerald-600">{formatBRL(affiliate.paidCommission || 0)}</p>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </AdminPage>
  );
}
