import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceProductWithRelations } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TrendingUp, DollarSign, ShoppingCart, Users, Package, 
  RefreshCw, Calendar, Filter, ArrowUpDown, Trophy,
  Search, Download, ChevronLeft, ChevronRight, Eye,
  Percent, ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  Trash, User, CreditCard
} from "lucide-react";
import { format, subDays, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TablePagination } from "@/components/TablePagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

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

const DATE_PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Últimos 30 dias", value: "30days" },
  { label: "Este mês", value: "thisMonth" },
  { label: "Mês passado", value: "lastMonth" },
  { label: "Esta semana", value: "thisWeek" },
  { label: "Todo período", value: "all" },
  { label: "Personalizado", value: "custom" },
];

export default function AdminVendedores() {
  const [activeTab, setActiveTab] = useState("overview");
  const [datePreset, setDatePreset] = useState("30days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState("revenue");
  const [sortOrder, setSortOrder] = useState("desc");
  const [sellersPage, setSellersPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatus, setSalesStatus] = useState("all");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerSalesPage, setSellerSalesPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (datePreset) {
      case "today":
        startDate = today;
        endDate = addDays(today, 1);
        break;
      case "7days":
        startDate = subDays(today, 6);
        endDate = addDays(today, 1);
        break;
      case "30days":
        startDate = subDays(today, 29);
        endDate = addDays(today, 1);
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = addDays(endOfMonth(now), 1);
        break;
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(now), 1);
        startDate = startOfMonth(lastMonth);
        endDate = addDays(endOfMonth(lastMonth), 1);
        break;
      case "thisWeek":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = addDays(endOfWeek(now, { weekStartsOn: 1 }), 1);
        break;
      case "custom":
        startDate = customStartDate ? new Date(customStartDate) : undefined;
        endDate = customEndDate ? addDays(new Date(customEndDate), 1) : undefined;
        break;
      case "all":
      default:
        startDate = undefined;
        endDate = undefined;
    }

    return {
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
    };
  };

  const { startDate, endDate } = getDateRange();

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

  const period = datePreset === "7days" ? "7" : datePreset === "today" ? "1" : "30";
  const { data: topSellers, isLoading: topSellersLoading } = useQuery<TopSeller[]>({
    queryKey: ["/api/admin/marketplace/top-sellers", period],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/top-sellers", { period })),
  });

  const { data: salesHistory, isLoading: historyLoading } = useQuery<SalesHistoryItem[]>({
    queryKey: ["/api/admin/marketplace/sales-history", startDate, endDate],
    queryFn: () => fetchWithAuth(buildUrl("/api/admin/marketplace/sales-history", { startDate, endDate })),
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      completed: { label: "Concluído", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      refunded: { label: "Reembolsado", variant: "destructive" },
      refund_requested: { label: "Solicitado Reembolso", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const chartData = salesHistory?.map(item => ({
    ...item,
    date: formatDate(item.date),
    receita: item.grossRevenue / 100,
    lucro: item.systemFees / 100,
    reembolsos: item.totalRefunded / 100,
  })) || [];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="page-title">
            Análise de Vendedores
          </h1>
          <p className="text-muted-foreground">
            Acompanhe vendas, métricas e desempenho dos vendedores do marketplace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setSellersPage(1); setSalesPage(1); }}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-preset">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {datePreset === "custom" && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data Inicial</label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[160px]"
                data-testid="input-custom-start-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[160px]"
                data-testid="input-custom-end-date"
              />
            </div>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Resumo</TabsTrigger>
          <TabsTrigger value="sellers" className="text-xs sm:text-sm">Vendedores</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs sm:text-sm">Vendas</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs sm:text-sm">Ranking</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs sm:text-sm">Reviews</TabsTrigger>
          <TabsTrigger value="refunds" className="text-xs sm:text-sm">Reembolsos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {overviewLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Receita Bruta</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-gross-revenue">
                          {formatCurrency(overview?.sales.grossRevenue || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{overview?.sales.total || 0} vendas</p>
                      </div>
                      <DollarSign className="w-10 h-10 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Seu Lucro (Taxas)</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-profit">
                          {formatCurrency(overview?.profit || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Taxas do sistema</p>
                      </div>
                      <Percent className="w-10 h-10 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Reembolsos</p>
                        <p className="text-2xl font-bold text-red-600" data-testid="text-refunds">
                          {formatCurrency(overview?.refunds.totalRefunded || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{overview?.refunds.total || 0} reembolsos</p>
                      </div>
                      <RefreshCw className="w-10 h-10 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pendentes</p>
                        <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending">
                          {formatCurrency(overview?.pending.totalPending || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{overview?.pending.total || 0} pedidos</p>
                      </div>
                      <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
                        <p className="text-xl font-bold">{overview?.sellers || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900">
                        <Package className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Produtos Ativos</p>
                        <p className="text-xl font-bold">{overview?.activeProducts || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
                        <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Recebido Vendedores</p>
                        <p className="text-xl font-bold">{formatCurrency(overview?.sales.netRevenue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900">
                        <ArrowDownRight className="w-5 h-5 text-pink-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descontos Aplicados</p>
                        <p className="text-xl font-bold">{formatCurrency(overview?.sales.discounts || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {salesHistory && salesHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Evolução de Vendas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${v}`} />
                          <Tooltip 
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                            labelFormatter={(label) => `Data: ${label}`}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                          <Area type="monotone" dataKey="lucro" name="Lucro" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="sellers" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Vendedores do Marketplace
                  </CardTitle>
                  <CardDescription>
                    Lista completa de vendedores com métricas de desempenho
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar vendedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[200px]"
                      data-testid="input-search-seller"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px]">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Receita</SelectItem>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="refunds">Reembolsos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sellersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : sellersError ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-red-400 mb-4" />
                  <p className="text-red-500 font-medium">Erro ao carregar vendedores</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {sellersError.message.includes("401") 
                      ? "Você precisa estar autenticado como administrador para ver esta página." 
                      : sellersError.message}
                  </p>
                </div>
              ) : filteredSellers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum vendedor encontrado para o período selecionado.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Receita Bruta</TableHead>
                          <TableHead className="text-right">Receita Líquida</TableHead>
                          <TableHead className="text-right">Reembolsos</TableHead>
                          <TableHead className="text-right">Produtos</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSellers.map((seller) => (
                          <TableRow key={seller.id} data-testid={`row-seller-${seller.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src={seller.profileImageUrl} />
                                  <AvatarFallback>{seller.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{seller.name}</p>
                                  <p className="text-xs text-muted-foreground">{seller.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{seller.totalSales}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">{formatCurrency(seller.grossRevenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(seller.netRevenue)}</TableCell>
                            <TableCell className="text-right">
                              {seller.refundCount > 0 ? (
                                <span className="text-red-600">{seller.refundCount} ({formatCurrency(seller.totalRefunded)})</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{seller.activeProducts}</TableCell>
                            <TableCell className="text-right" data-testid={`cell-balance-${seller.id}`}>
                              <div className="space-y-1 min-w-[150px]">
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Pendente: </span>
                                  <span className="font-medium text-yellow-600">{formatCurrency(seller.balancePending)}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Disponível: </span>
                                  <span className="font-medium text-green-600">{formatCurrency(seller.balanceAvailable)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedSeller(seller); setSellerSalesPage(1); }}
                                data-testid={`button-view-seller-${seller.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {sellersTotalPages > 1 && (
                    <div className="mt-4">
                      <TablePagination
                        currentPage={sellersPage}
                        totalPages={sellersTotalPages}
                        onPageChange={setSellersPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Todas as Vendas
                  </CardTitle>
                  <CardDescription>
                    Histórico completo de vendas do marketplace
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={salesStatus} onValueChange={(v) => { setSalesStatus(v); setSalesPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="completed">Concluídos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="refunded">Reembolsados</SelectItem>
                      <SelectItem value="refund_requested">Solicitado Reembolso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allSalesLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : allSales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma venda encontrada para os filtros selecionados.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Comprador</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Valor Bruto</TableHead>
                          <TableHead className="text-right">Taxa Sistema</TableHead>
                          <TableHead className="text-right">Líquido Vendedor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSales.map((sale) => (
                          <TableRow key={sale.order.id} data-testid={`row-sale-${sale.order.id}`}>
                            <TableCell>
                              <p className="font-medium truncate max-w-[150px]">{sale.product?.title || 'Produto'}</p>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{sale.buyer?.name || 'Comprador'}</p>
                                <p className="text-xs text-muted-foreground">{sale.buyer?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{sale.seller?.name || 'Vendedor'}</p>
                                <p className="text-xs text-muted-foreground">{sale.seller?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(sale.order.grossAmountCents || sale.order.amount)}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              {formatCurrency(sale.order.systemFeeCents || 0)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(sale.order.netAmountCents || 0)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {sale.order.paymentMethod === 'pix' ? 'PIX' : sale.order.paymentMethod === 'card' ? 'Cartão' : sale.order.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(sale.order.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(sale.order.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {allSalesTotalPages > 1 && (
                    <div className="mt-4">
                      <TablePagination
                        currentPage={salesPage}
                        totalPages={allSalesTotalPages}
                        onPageChange={setSalesPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top Vendedores
              </CardTitle>
              <CardDescription>
                Ranking dos melhores vendedores por receita no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topSellersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : !topSellers || topSellers.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum vendedor com vendas no período selecionado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topSellers.map((seller, index) => (
                    <div 
                      key={seller.id} 
                      className={`flex items-center gap-4 p-4 rounded-lg ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border border-yellow-200 dark:border-yellow-800' : index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700' : index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border border-orange-200 dark:border-orange-800' : 'bg-muted/30'}`}
                      data-testid={`row-top-seller-${seller.id}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-yellow-500 text-white' : index === 1 ? 'bg-gray-400 text-white' : index === 2 ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {seller.rank}
                      </div>
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={seller.profileImageUrl} />
                        <AvatarFallback>{seller.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{seller.name}</p>
                        <p className="text-sm text-muted-foreground">{seller.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(seller.grossRevenue)}</p>
                        <p className="text-sm text-muted-foreground">{seller.totalSales} vendas</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6 mt-6">
          <ReviewsManagement />
        </TabsContent>

        <TabsContent value="refunds" className="space-y-6 mt-6">
          <RefundManagement />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSeller} onOpenChange={(open) => !open && setSelectedSeller(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={selectedSeller?.profileImageUrl} />
                <AvatarFallback>{selectedSeller?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
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
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <p className="text-xs text-muted-foreground">Receita Total</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedSeller.grossRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <p className="text-xs text-muted-foreground">Total Vendas</p>
                  <p className="text-lg font-bold text-blue-600">{selectedSeller.totalSales}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
                  <p className="text-xs text-muted-foreground">Produtos Ativos</p>
                  <p className="text-lg font-bold text-purple-600">{selectedSeller.activeProducts}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <p className="text-xs text-muted-foreground">Reembolsos</p>
                  <p className="text-lg font-bold text-red-600">{selectedSeller.refundCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Saldo Pendente</p>
                  <p className="text-lg font-bold text-yellow-600">{formatCurrency(selectedSeller.balancePending)}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Saldo Disponível</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedSeller.balanceAvailable)}</p>
                </div>
              </div>

              {sellerSalesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : sellerSales.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
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
                            <TableCell className="font-medium">{sale.product?.title}</TableCell>
                            <TableCell>{sale.buyer?.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(sale.order.amount)}</TableCell>
                            <TableCell>{getStatusBadge(sale.order.status)}</TableCell>
                            <TableCell className="text-xs">{formatDate(sale.order.createdAt)}</TableCell>
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
                <p className="text-center text-muted-foreground py-4">Nenhuma venda encontrada</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
    <Card className="bg-white dark:bg-card">
      <CardHeader>
        <CardTitle>Moderação de Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {allReviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma review encontrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allReviews.map((review: any) => (
                <TableRow key={review.id}>
                  <TableCell data-testid={`review-product-${review.id}`}>{review.productName}</TableCell>
                  <TableCell data-testid={`review-rating-${review.id}`}>{review.rating}/5</TableCell>
                  <TableCell data-testid={`review-comment-${review.id}`} className="max-w-xs truncate">{review.comment}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate({ productId: review.productId, reviewId: review.id })}
                      data-testid={`button-delete-review-${review.id}`}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
        variant: "destructive" 
      });
    },
  });

  const formatRefundCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatRefundDate = (date: Date | null | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'pix': 'PIX',
      'card': 'Cartão',
      'boleto': 'Boleto',
    };
    return methods[method] || method;
  };

  const getRefundStatusBadge = (status: string) => {
    if (status === 'refunded') {
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Reembolsado</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-600 text-white"><RefreshCw className="w-3 h-3 mr-1" />Pendente</Badge>;
  };

  const pendingRequests = refundRequests?.filter(r => r.order.status === 'refund_requested') || [];
  const completedRefunds = refundRequests?.filter(r => r.order.status === 'refunded') || [];

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Solicitações Pendentes ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma solicitação pendente</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Valor</TableHead>
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
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{request.buyer.name}</div>
                            <div className="text-xs text-muted-foreground">{request.buyer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`refund-product-${request.order.id}`}>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{request.product.title}</div>
                            <div className="text-xs text-muted-foreground">{formatRefundCurrency(request.product.price)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`refund-seller-${request.order.id}`}>
                        <div>
                          <div className="font-medium">{request.seller.name}</div>
                          <div className="text-xs text-muted-foreground">{request.seller.email}</div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`refund-amount-${request.order.id}`}>
                        <span className="font-semibold text-red-600">{formatRefundCurrency(request.order.amount)}</span>
                      </TableCell>
                      <TableCell data-testid={`refund-method-${request.order.id}`}>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <CreditCard className="w-3 h-3" />
                          {getPaymentMethodLabel(request.order.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`refund-reason-${request.order.id}`}>
                        <span className="text-sm max-w-[150px] truncate block">{request.order.refundReason || 'Não informado'}</span>
                      </TableCell>
                      <TableCell data-testid={`refund-date-${request.order.id}`}>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatRefundDate(request.order.refundRequestedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Reembolsos Processados ({completedRefunds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completedRefunds.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum reembolso processado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedRefunds.map((request) => (
                    <TableRow key={request.order.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.buyer.name}</div>
                          <div className="text-xs text-muted-foreground">{request.buyer.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.product.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.seller.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{formatRefundCurrency(request.order.amount)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getPaymentMethodLabel(request.order.paymentMethod)}</Badge>
                      </TableCell>
                      <TableCell>{formatRefundDate(request.order.refundRequestedAt)}</TableCell>
                      <TableCell>{getRefundStatusBadge(request.order.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
