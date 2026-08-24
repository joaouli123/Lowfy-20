import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceProductWithRelations } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, ShoppingCart, Users, Package,
  RefreshCw, ArrowUpDown, Trophy, Eye, Percent,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  Trash, CreditCard, Star, Store,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TablePagination } from "@/components/TablePagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  AdminPage,
  AdminPageHeader,
  StatCard,
  StatGrid,
  PeriodFilter,
  defaultPeriod,
  type Period,
  ChartCard,
  FilterBar,
  TableCard,
  EmptyState,
  TableSkeleton,
  StatusBadge,
  type BadgeTone,
  CHART_COLORS,
  gridProps,
  axisProps,
  tooltipStyle,
  formatBRL,
  formatNumber,
} from "@/components/admin";

const formatDate = (date: string | Date) => {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTime = (date: string | Date) => {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

interface MarketplaceOverview {
  sales: {
    total: number;
    grossRevenue: number;
    netRevenue: number;
    systemFees: number;
    discounts: number;
  };
  refunds: {
    total: number;
    totalRefunded: number;
  };
  pending: {
    total: number;
    totalPending: number;
  };
  sellers: number;
  activeProducts: number;
  profit: number;
}

interface Seller {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
  systemFees: number;
  refundCount: number;
  totalRefunded: number;
  activeProducts: number;
  balancePending: number;
  balanceAvailable: number;
  totalEarned: number;
  totalWithdrawn: number;
}

interface TopSeller {
  rank: number;
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
}

interface SalesHistoryItem {
  date: string;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
  systemFees: number;
  refundCount: number;
  totalRefunded: number;
}

interface Sale {
  order: {
    id: string;
    buyerId: string;
    sellerId: string;
    productId: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
    grossAmountCents: number;
    netAmountCents: number;
    systemFeeCents: number;
    discountCents: number;
  };
  product: {
    id: string;
    title: string;
    price: number;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  seller?: {
    id: string;
    name: string;
    email: string;
  };
}

const ITEMS_PER_PAGE = 15;

const SALE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  completed: { label: "Concluído", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  refunded: { label: "Reembolsado", tone: "danger" },
  refund_requested: { label: "Reembolso solicitado", tone: "info" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

function SaleStatusBadge({ status }: { status: string }) {
  const config = SALE_STATUS[status] || { label: status, tone: "neutral" as BadgeTone };
  return <StatusBadge tone={config.tone} dot>{config.label}</StatusBadge>;
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  boleto: "Boleto",
};

export default function AdminVendedores() {
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("30days"));
  const [sortBy, setSortBy] = useState("revenue");
  const [sortOrder, setSortOrder] = useState("desc");
  const [sellersPage, setSellersPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatus, setSalesStatus] = useState("all");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerSalesPage, setSellerSalesPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const { startDate, endDate, groupBy } = period;

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setSellersPage(1);
    setSalesPage(1);
  };

  const buildUrl = (base: string, params: Record<string, any>) => {
    const url = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.append(key, String(value));
      }
    });
    const queryString = url.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  const fetchWithAuth = async (url: string) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers, credentials: 'include' });
    if (!res.ok) {
      throw new Error(`Erro ${res.status}: ${res.statusText}`);
    }
    return res.json();
  };

  const { data: overview, isLoading: overviewLoading } = useQuery<MarketplaceOverview>({
    queryKey: ["/api/admin/marketplace/overview", startDate, endDate],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/overview", { startDate, endDate })),
  });

  const rankingDays = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1);
  const { data: topSellers, isLoading: topSellersLoading } = useQuery<TopSeller[]>({
    queryKey: ["/api/admin/marketplace/top-sellers", rankingDays],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/top-sellers", { period: rankingDays })),
  });

  const { data: salesHistory, isLoading: historyLoading } = useQuery<SalesHistoryItem[]>({
    queryKey: ["/api/admin/marketplace/sales-history", startDate, endDate, groupBy],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/sales-history", { startDate, endDate, groupBy })),
  });

  const sellersOffset = (sellersPage - 1) * ITEMS_PER_PAGE;
  const { data: sellersData, isLoading: sellersLoading, error: sellersError } = useQuery<{ sellers: Seller[]; total: number }>({
    queryKey: ["/api/admin/marketplace/sellers", startDate, endDate, sortBy, sortOrder, ITEMS_PER_PAGE, sellersOffset],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/sellers", {
      startDate, endDate, sortBy, order: sortOrder, limit: ITEMS_PER_PAGE, offset: sellersOffset
    })),
    retry: false,
  });

  const salesOffset = (salesPage - 1) * ITEMS_PER_PAGE;
  const salesStatusParam = salesStatus !== "all" ? salesStatus : undefined;
  const { data: allSalesData, isLoading: allSalesLoading } = useQuery<{ sales: Sale[]; total: number }>({
    queryKey: ["/api/admin/marketplace/all-sales", startDate, endDate, salesStatusParam, ITEMS_PER_PAGE, salesOffset],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/all-sales", {
      startDate, endDate, status: salesStatusParam, limit: ITEMS_PER_PAGE, offset: salesOffset
    })),
  });

  const sellerSalesOffset = (sellerSalesPage - 1) * ITEMS_PER_PAGE;
  const { data: sellerSalesData, isLoading: sellerSalesLoading } = useQuery<{ sales: Sale[]; total: number }>({
    queryKey: ["/api/admin/marketplace/sellers", selectedSeller?.id, "sales", ITEMS_PER_PAGE, sellerSalesOffset],
    queryFn: () => fetchWithAuth(buildUrl(`/api/admin/marketplace/sellers/${selectedSeller?.id}/sales`, {
      limit: ITEMS_PER_PAGE, offset: sellerSalesOffset
    })),
    enabled: !!selectedSeller,
  });

  const sellers = sellersData?.sellers || [];
  const sellersTotalPages = Math.ceil((sellersData?.total || 0) / ITEMS_PER_PAGE);
  const allSales = allSalesData?.sales || [];
  const allSalesTotalPages = Math.ceil((allSalesData?.total || 0) / ITEMS_PER_PAGE);
  const sellerSales = sellerSalesData?.sales || [];
  const sellerSalesTotalPages = Math.ceil((sellerSalesData?.total || 0) / ITEMS_PER_PAGE);

  const filteredSellers = searchTerm
    ? sellers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()))
    : sellers;

  const chartData = salesHistory?.map(item => ({
    date: groupBy === "day" && item.date.includes("-") && item.date.length === 10
      ? format(new Date(`${item.date}T12:00:00`), "dd/MM", { locale: ptBR })
      : item.date,
    receita: item.grossRevenue / 100,
    lucro: item.systemFees / 100,
  })) || [];

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Vendedores"
        description="Vendas, métricas e desempenho dos vendedores do marketplace"
        icon={Store}
      >
        <PeriodFilter value={period} onChange={handlePeriodChange} showGroupBy />
      </AdminPageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Resumo</TabsTrigger>
          <TabsTrigger value="sellers" data-testid="tab-sellers">Vendedores</TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">Vendas</TabsTrigger>
          <TabsTrigger value="ranking" data-testid="tab-ranking">Ranking</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
          <TabsTrigger value="refunds" data-testid="tab-refunds">Reembolsos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 mt-5">
          <StatGrid cols={4}>
            <StatCard
              label="Receita bruta"
              value={formatBRL(overview?.sales.grossRevenue || 0)}
              icon={DollarSign}
              tone="success"
              colorValue
              hint={`${formatNumber(overview?.sales.total || 0)} vendas no período`}
              loading={overviewLoading}
              testId="text-gross-revenue"
            />
            <StatCard
              label="Seu lucro (taxas)"
              value={formatBRL(overview?.profit || 0)}
              icon={Percent}
              tone="info"
              colorValue
              hint="Taxas do sistema"
              loading={overviewLoading}
              testId="text-profit"
            />
            <StatCard
              label="Reembolsos"
              value={formatBRL(overview?.refunds.totalRefunded || 0)}
              icon={RefreshCw}
              tone="danger"
              colorValue={(overview?.refunds.total || 0) > 0}
              hint={`${formatNumber(overview?.refunds.total || 0)} reembolsos`}
              loading={overviewLoading}
              testId="text-refunds"
            />
            <StatCard
              label="Pendentes"
              value={formatBRL(overview?.pending.totalPending || 0)}
              icon={Clock}
              tone="warning"
              colorValue={(overview?.pending.total || 0) > 0}
              hint={`${formatNumber(overview?.pending.total || 0)} pedidos aguardando`}
              loading={overviewLoading}
              testId="text-pending"
            />
          </StatGrid>

          <StatGrid cols={4}>
            <StatCard
              label="Vendedores ativos"
              value={formatNumber(overview?.sellers || 0)}
              icon={Users}
              tone="violet"
              loading={overviewLoading}
            />
            <StatCard
              label="Produtos ativos"
              value={formatNumber(overview?.activeProducts || 0)}
              icon={Package}
              tone="info"
              loading={overviewLoading}
            />
            <StatCard
              label="Recebido pelos vendedores"
              value={formatBRL(overview?.sales.netRevenue || 0)}
              icon={ArrowUpRight}
              tone="success"
              loading={overviewLoading}
            />
            <StatCard
              label="Descontos aplicados"
              value={formatBRL(overview?.sales.discounts || 0)}
              icon={ArrowDownRight}
              tone="default"
              loading={overviewLoading}
            />
          </StatGrid>

          <ChartCard
            title="Evolução de vendas"
            description="Receita bruta e lucro da plataforma no período"
            loading={historyLoading}
            empty={chartData.length === 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vendReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vendLucro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.sky} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.sky} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis {...axisProps} dataKey="date" />
                <YAxis {...axisProps} tickFormatter={(v: number) => `R$ ${v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : v}`} width={70} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#vendReceita)" />
                <Area type="monotone" dataKey="lucro" name="Lucro" stroke={CHART_COLORS.sky} strokeWidth={2} fill="url(#vendLucro)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="sellers" className="space-y-4 mt-5">
          <FilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por nome ou e-mail..."
          >
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-[150px] text-sm" data-testid="select-sort-by">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Receita</SelectItem>
                <SelectItem value="sales">Vendas</SelectItem>
                <SelectItem value="refunds">Reembolsos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              data-testid="button-sort-order"
              title={sortOrder === "desc" ? "Maior primeiro" : "Menor primeiro"}
            >
              {sortOrder === "desc" ? "↓ Desc" : "↑ Asc"}
            </Button>
          </FilterBar>

          <TableCard
            title="Vendedores do marketplace"
            count={sellersData?.total}
            footer={sellersTotalPages > 1 ? (
              <TablePagination
                currentPage={sellersPage}
                totalPages={sellersTotalPages}
                onPageChange={setSellersPage}
              />
            ) : undefined}
          >
            {sellersLoading ? (
              <TableSkeleton rows={6} />
            ) : sellersError ? (
              <EmptyState
                icon={Users}
                title="Erro ao carregar vendedores"
                description={sellersError.message.includes("401")
                  ? "Você precisa estar autenticado como administrador para ver esta página."
                  : sellersError.message}
              />
            ) : filteredSellers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum vendedor encontrado"
                description="Nenhum vendedor com atividade para o período e filtros selecionados."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita bruta</TableHead>
                    <TableHead className="text-right">Receita líquida</TableHead>
                    <TableHead className="text-right">Reembolsos</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSellers.map((seller) => (
                    <TableRow key={seller.id} data-testid={`row-seller-${seller.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={seller.profileImageUrl} />
                            <AvatarFallback className="text-xs">{seller.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[220px]">{seller.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[220px]">{seller.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{seller.totalSales}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-emerald-600">{formatBRL(seller.grossRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(seller.netRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {seller.refundCount > 0 ? (
                          <span className="text-red-600">{seller.refundCount} ({formatBRL(seller.totalRefunded)})</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{seller.activeProducts}</TableCell>
                      <TableCell className="text-right" data-testid={`cell-balance-${seller.id}`}>
                        <div className="space-y-0.5 min-w-[150px] text-xs tabular-nums">
                          <div>
                            <span className="text-muted-foreground">Pendente: </span>
                            <span className="font-medium text-amber-600">{formatBRL(seller.balancePending)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disponível: </span>
                            <span className="font-medium text-emerald-600">{formatBRL(seller.balanceAvailable)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedSeller(seller); setSellerSalesPage(1); }}
                          data-testid={`button-view-seller-${seller.id}`}
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4 mt-5">
          <FilterBar>
            <Select value={salesStatus} onValueChange={(v) => { setSalesStatus(v); setSalesPage(1); }}>
              <SelectTrigger className="h-9 w-[190px] text-sm" data-testid="select-sales-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="refunded">Reembolsados</SelectItem>
                <SelectItem value="refund_requested">Reembolso solicitado</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <TableCard
            title="Todas as vendas"
            count={allSalesData?.total}
            footer={allSalesTotalPages > 1 ? (
              <TablePagination
                currentPage={salesPage}
                totalPages={allSalesTotalPages}
                onPageChange={setSalesPage}
              />
            ) : undefined}
          >
            {allSalesLoading ? (
              <TableSkeleton rows={6} />
            ) : allSales.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma venda encontrada"
                description="Nenhuma venda para o período e filtros selecionados."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Valor bruto</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSales.map((sale) => (
                    <TableRow key={sale.order.id} data-testid={`row-sale-${sale.order.id}`}>
                      <TableCell>
                        <p className="font-medium text-sm truncate max-w-[160px]">{sale.product?.title || 'Produto'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{sale.buyer?.name || 'Comprador'}</p>
                        <p className="text-xs text-muted-foreground">{sale.buyer?.email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{sale.seller?.name || 'Vendedor'}</p>
                        <p className="text-xs text-muted-foreground">{sale.seller?.email}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatBRL(sale.order.grossAmountCents || sale.order.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sky-600">
                        {formatBRL(sale.order.systemFeeCents || 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatBRL(sale.order.netAmountCents || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PAYMENT_LABELS[sale.order.paymentMethod] || sale.order.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell><SaleStatusBadge status={sale.order.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(sale.order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="ranking" className="mt-5">
          <TableCard title="Top vendedores" count={topSellers?.length}>
            {topSellersLoading ? (
              <TableSkeleton rows={5} />
            ) : !topSellers || topSellers.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Sem vendas no período"
                description="Nenhum vendedor registrou vendas concluídas no período selecionado."
              />
            ) : (
              <div className="divide-y">
                {topSellers.map((seller, index) => (
                  <div
                    key={seller.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/50 transition-colors"
                    data-testid={`row-top-seller-${seller.id}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                      index === 0 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                      : index === 1 ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-300'
                      : index === 2 ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                      : 'bg-secondary text-muted-foreground'
                    }`}>
                      {seller.rank}
                    </div>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={seller.profileImageUrl} />
                      <AvatarFallback className="text-xs">{seller.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{seller.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{seller.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums text-emerald-600">{formatBRL(seller.grossRevenue)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{seller.totalSales} vendas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="reviews" className="mt-5">
          <ReviewsManagement />
        </TabsContent>

        <TabsContent value="refunds" className="space-y-5 mt-5">
          <RefundManagement />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSeller} onOpenChange={(open) => !open && setSelectedSeller(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedSeller?.profileImageUrl} />
                <AvatarFallback className="text-xs">{selectedSeller?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p>{selectedSeller?.name}</p>
                <p className="text-sm font-normal text-muted-foreground">{selectedSeller?.email}</p>
              </div>
            </DialogTitle>
            <DialogDescription>
              Detalhes e histórico de vendas do vendedor
            </DialogDescription>
          </DialogHeader>

          {selectedSeller && (
            <div className="space-y-5 mt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-secondary/60 border">
                  <p className="text-xs text-muted-foreground">Receita total</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-600">{formatBRL(selectedSeller.grossRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/60 border">
                  <p className="text-xs text-muted-foreground">Total de vendas</p>
                  <p className="text-base font-semibold tabular-nums">{selectedSeller.totalSales}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/60 border">
                  <p className="text-xs text-muted-foreground">Produtos ativos</p>
                  <p className="text-base font-semibold tabular-nums">{selectedSeller.activeProducts}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/60 border">
                  <p className="text-xs text-muted-foreground">Reembolsos</p>
                  <p className={`text-base font-semibold tabular-nums ${selectedSeller.refundCount > 0 ? "text-red-600" : ""}`}>{selectedSeller.refundCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Saldo pendente</p>
                  <p className="text-base font-semibold tabular-nums text-amber-600">{formatBRL(selectedSeller.balancePending)}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Saldo disponível</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-600">{formatBRL(selectedSeller.balanceAvailable)}</p>
                </div>
              </div>

              {sellerSalesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : sellerSales.length > 0 ? (
                <>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Comprador</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellerSales.map((sale) => (
                          <TableRow key={sale.order.id}>
                            <TableCell className="font-medium text-sm">{sale.product?.title}</TableCell>
                            <TableCell className="text-sm">{sale.buyer?.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatBRL(sale.order.amount)}</TableCell>
                            <TableCell><SaleStatusBadge status={sale.order.status} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(sale.order.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {sellerSalesTotalPages > 1 && (
                    <TablePagination
                      currentPage={sellerSalesPage}
                      totalPages={sellerSalesTotalPages}
                      onPageChange={setSellerSalesPage}
                    />
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhuma venda encontrada</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

interface RefundRequest {
  order: {
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    refundReason: string | null;
    refundRequestedAt: Date | null;
    createdAt: Date;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    title: string;
    price: number;
  };
  seller: {
    id: string;
    name: string;
    email: string;
  };
}

function ReviewsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products } = useQuery<MarketplaceProductWithRelations[]>({
    queryKey: ["/api/marketplace/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: string; reviewId: string }) => {
      await apiRequest("DELETE", `/api/marketplace/products/${productId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      toast({ title: "Review excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir review", description: error.message, variant: "destructive" });
    },
  });

  const allReviews = products?.flatMap(product =>
    (product.reviews || []).map(review => ({ ...review, productName: product.name, productId: product.id }))
  ) || [];

  return (
    <TableCard title="Moderação de reviews" count={allReviews.length}>
      {allReviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma review encontrada"
          description="As avaliações dos produtos do marketplace aparecerão aqui."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Comentário</TableHead>
              <TableHead className="w-[70px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allReviews.map((review: any) => (
              <TableRow key={review.id}>
                <TableCell className="font-medium text-sm" data-testid={`review-product-${review.id}`}>{review.productName}</TableCell>
                <TableCell data-testid={`review-rating-${review.id}`}>
                  <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {review.rating}/5
                  </span>
                </TableCell>
                <TableCell data-testid={`review-comment-${review.id}`} className="max-w-xs truncate text-sm text-muted-foreground">{review.comment}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate({ productId: review.productId, reviewId: review.id })}
                    data-testid={`button-delete-review-${review.id}`}
                    title="Excluir review"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  );
}

function RefundManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: refundRequests, isLoading } = useQuery<RefundRequest[]>({
    queryKey: ["/api/admin/marketplace/refund-requests"],
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("POST", `/api/admin/marketplace/approve-refund/${orderId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Reembolso aprovado!", description: "O reembolso foi processado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/refund-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar reembolso",
        description: error.message || "Não foi possível processar o reembolso.",
        variant: "destructive",
      });
    },
  });

  const formatRefundDate = (date: Date | null | string) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingRequests = refundRequests?.filter(r => r.order.status === 'refund_requested') || [];
  const completedRefunds = refundRequests?.filter(r => r.order.status === 'refunded') || [];

  return (
    <>
      <TableCard title="Solicitações pendentes" count={pendingRequests.length}>
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : pendingRequests.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="Nenhuma solicitação pendente"
            description="Novas solicitações de reembolso aparecerão aqui para aprovação."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comprador</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests.map((request) => (
                <TableRow key={request.order.id}>
                  <TableCell data-testid={`refund-buyer-${request.order.id}`}>
                    <p className="font-medium text-sm">{request.buyer.name}</p>
                    <p className="text-xs text-muted-foreground">{request.buyer.email}</p>
                  </TableCell>
                  <TableCell data-testid={`refund-product-${request.order.id}`}>
                    <p className="font-medium text-sm">{request.product.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(request.product.price)}</p>
                  </TableCell>
                  <TableCell data-testid={`refund-seller-${request.order.id}`}>
                    <p className="font-medium text-sm">{request.seller.name}</p>
                    <p className="text-xs text-muted-foreground">{request.seller.email}</p>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`refund-amount-${request.order.id}`}>
                    <span className="font-semibold tabular-nums text-red-600">{formatBRL(request.order.amount)}</span>
                  </TableCell>
                  <TableCell data-testid={`refund-method-${request.order.id}`}>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                      <CreditCard className="w-3 h-3" />
                      {PAYMENT_LABELS[request.order.paymentMethod] || request.order.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`refund-reason-${request.order.id}`}>
                    <span className="text-sm max-w-[150px] truncate block" title={request.order.refundReason || undefined}>
                      {request.order.refundReason || 'Não informado'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`refund-date-${request.order.id}`}>
                    {formatRefundDate(request.order.refundRequestedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(request.order.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-refund-${request.order.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <TableCard title="Reembolsos processados" count={completedRefunds.length}>
        {completedRefunds.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="Nenhum reembolso processado"
            description="Reembolsos já aprovados aparecerão neste histórico."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comprador</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Data solicitação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedRefunds.map((request) => (
                <TableRow key={request.order.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{request.buyer.name}</p>
                    <p className="text-xs text-muted-foreground">{request.buyer.email}</p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{request.product.title}</TableCell>
                  <TableCell className="text-sm">{request.seller.name}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatBRL(request.order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{PAYMENT_LABELS[request.order.paymentMethod] || request.order.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatRefundDate(request.order.refundRequestedAt)}</TableCell>
                  <TableCell>
                    {request.order.status === 'refunded'
                      ? <StatusBadge tone="success" dot>Reembolsado</StatusBadge>
                      : <StatusBadge tone="warning" dot>Pendente</StatusBadge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </>
  );
}
