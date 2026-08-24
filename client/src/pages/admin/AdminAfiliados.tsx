import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Download, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Percent,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Mail,
  Hash,
  ShoppingBag,
  UserPlus
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  
  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [preset, setPreset] = useState("30days");
  
  const [affiliatesPage, setAffiliatesPage] = useState(1);
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<AffiliateSummary>({
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


  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();
    
    switch (value) {
      case "today":
        setStartDate(format(now, "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "7days":
        setStartDate(format(subDays(now, 7), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "30days":
        setStartDate(format(subDays(now, 30), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "thisMonth":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
      case "thisYear":
        setStartDate(format(startOfYear(now), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "custom":
        break;
    }
    setAffiliatesPage(1);
  };

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

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid="badge-pending">Pendente</Badge>;
      case "released":
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-released">Liberado</Badge>;
      case "canceled":
        return <Badge variant="destructive" data-testid="badge-canceled">Cancelado</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-other">{status}</Badge>;
    }
  };

  const affiliates = affiliatesData?.affiliates || [];
  const affiliatesPagination = affiliatesData || { page: 1, limit: 15, total: 0, totalPages: 1 };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Gestão de Afiliados</h1>
          <p className="text-muted-foreground">Gerencie afiliados e comissões da plataforma</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtros de Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="space-y-2">
              <Label>Período Predefinido</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]" data-testid="select-preset">
                  <SelectValue placeholder="Selecione período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="thisMonth">Este mês</SelectItem>
                  <SelectItem value="lastMonth">Mês passado</SelectItem>
                  <SelectItem value="thisYear">Este ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); setAffiliatesPage(1); }}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); setAffiliatesPage(1); }}
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Comissões Pagas</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-total-paid">
                    {summary ? formatCurrency(summary.totalPaid || 0) : 'R$ 0,00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                  <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comissões Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600" data-testid="stat-total-pending">
                    {summary ? formatCurrency(summary.totalPending || 0) : 'R$ 0,00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Total</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="stat-total-revenue">
                    {summary ? formatCurrency(summary.totalRevenue || 0) : 'R$ 0,00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
                  <Hash className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Vendas</p>
                  <p className="text-2xl font-bold text-indigo-600" data-testid="stat-total-sales">
                    {summary?.totalSales || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-100 dark:bg-cyan-900 rounded-full">
                  <DollarSign className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold text-cyan-600" data-testid="stat-average-ticket">
                    {summary ? formatCurrency(summary.averageTicket || 0) : 'R$ 0,00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Users className="h-6 w-6 text-orange-600 dark:text-orange-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Afiliados</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="stat-total-affiliates">
                    {summary?.totalAffiliates || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <Percent className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-purple-600" data-testid="stat-conversion-rate">
                    {summary?.averageConversionRate || '0.00'}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary?.totalConversions || 0} / {summary?.totalClicks || 0} cliques
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-pink-100 dark:bg-pink-900 rounded-full">
                  <UserPlus className="h-6 w-6 text-pink-600 dark:text-pink-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Conversões</p>
                  <p className="text-2xl font-bold text-pink-600" data-testid="stat-total-conversions">
                    {summary?.totalConversions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top Afiliados</CardTitle>
          <CardDescription>Lista dos principais afiliados da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {affiliatesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : affiliates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum afiliado encontrado no período selecionado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Comissão Total</TableHead>
                      <TableHead>Indicados Ativos</TableHead>
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
                              className="cursor-pointer hover:bg-muted/50"
                              data-testid={`affiliate-row-${affiliate.id}`}
                            >
                              <TableCell>
                                {expandedAffiliate === affiliate.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium" data-testid={`affiliate-name-${affiliate.id}`}>
                                {affiliate.name}
                              </TableCell>
                              <TableCell data-testid={`affiliate-email-${affiliate.id}`}>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  {affiliate.email}
                                </div>
                              </TableCell>
                              <TableCell data-testid={`affiliate-code-${affiliate.id}`}>
                                <div className="flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-muted-foreground" />
                                  <Badge variant="outline">{affiliate.referralCode}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-green-600" data-testid={`affiliate-commission-${affiliate.id}`}>
                                {formatCurrency(affiliate.totalCommission)}
                              </TableCell>
                              <TableCell data-testid={`affiliate-referrals-${affiliate.id}`}>
                                <div className="flex items-center gap-2">
                                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                                  {affiliate.activeReferrals}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={6}>
                                <div className="p-4 space-y-3">
                                  <h4 className="font-semibold text-sm">Detalhes do Afiliado</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Cadastrado em</p>
                                      <p className="font-medium">{formatDate(affiliate.createdAt)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Email</p>
                                      <p className="font-medium">{affiliate.email}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Código de Referência</p>
                                      <p className="font-medium">{affiliate.referralCode}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Ticket Médio</p>
                                      <p className="font-medium">
                                        {formatCurrency(affiliate.averageTicket)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t">
                                    <div>
                                      <p className="text-muted-foreground">Cliques</p>
                                      <p className="font-medium">{affiliate.clicks || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Conversões</p>
                                      <p className="font-medium">{affiliate.conversions || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Total Vendas</p>
                                      <p className="font-medium">{affiliate.totalSales || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Faturamento Gerado</p>
                                      <p className="font-medium">{formatCurrency(affiliate.totalRevenue || 0)}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t">
                                    <div>
                                      <p className="text-muted-foreground">Comissão Total</p>
                                      <p className="font-medium text-green-600">{formatCurrency(affiliate.totalCommission || 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Comissão Pendente</p>
                                      <p className="font-medium text-yellow-600">{formatCurrency(affiliate.pendingCommission || 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Comissão Paga</p>
                                      <p className="font-medium text-blue-600">{formatCurrency(affiliate.paidCommission || 0)}</p>
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
              </div>

              <div className="flex items-center justify-between">
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
                  
                  <span className="text-sm px-4" data-testid="affiliates-pagination-info">
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
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
