import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar,
  RefreshCw,
  BarChart3
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface FinanceSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  totalRevenue: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface TimeseriesData {
  date: string;
  newSubscriptions: number;
  canceledSubscriptions: number;
  revenue: number;
}

interface TimeseriesResponse {
  timeseries: TimeseriesData[];
  period: {
    startDate: string;
    endDate: string;
    groupBy: string;
  };
}

export default function AdminFinanceiro() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  
  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [groupBy, setGroupBy] = useState("day");
  const [preset, setPreset] = useState("30days");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<FinanceSummary>({
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

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();
    
    switch (value) {
      case "today":
        setStartDate(format(now, "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("day");
        break;
      case "7days":
        setStartDate(format(subDays(now, 7), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("day");
        break;
      case "30days":
        setStartDate(format(subDays(now, 30), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("day");
        break;
      case "thisMonth":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        setGroupBy("day");
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        setGroupBy("day");
        break;
      case "3months":
        setStartDate(format(subMonths(now, 3), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("week");
        break;
      case "6months":
        setStartDate(format(subMonths(now, 6), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("week");
        break;
      case "12months":
        setStartDate(format(subMonths(now, 12), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        setGroupBy("month");
        break;
      case "custom":
        break;
    }
  };

  const handleRefresh = () => {
    refetchSummary();
    refetchTimeseries();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value / 100);
  };

  const formatChartDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (groupBy === "month") {
        return format(date, "MMM/yy", { locale: ptBR });
      } else if (groupBy === "week") {
        return format(date, "dd/MM", { locale: ptBR });
      }
      return format(date, "dd/MM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const chartData = timeseries?.timeseries.map(item => ({
    ...item,
    dateFormatted: formatChartDate(item.date),
    revenueFormatted: item.revenue / 100,
  })) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Financeiro</h1>
          <p className="text-muted-foreground">Métricas e análises de assinaturas</p>
        </div>
        
        <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
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
                  <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="12months">Últimos 12 meses</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
                data-testid="input-end-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[150px]" data-testid="select-group-by">
                  <SelectValue placeholder="Agrupar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-revenue">
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assinaturas</p>
                  <p className="text-2xl font-bold" data-testid="stat-total">
                    {summary?.totalSubscriptions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                  <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Novas</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="stat-new">
                    {summary?.newSubscriptions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                  <p className="text-2xl font-bold text-purple-600" data-testid="stat-active">
                    {summary?.activeSubscriptions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Canceladas</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="stat-canceled">
                    {summary?.canceledSubscriptions || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receita ao Longo do Tempo</CardTitle>
            <CardDescription>Evolução da receita no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {timeseriesLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateFormatted" fontSize={12} />
                    <YAxis 
                      fontSize={12}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenueFormatted" 
                      stroke="#10b981" 
                      fill="#10b98133" 
                      name="Receita"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novas vs Canceladas</CardTitle>
            <CardDescription>Comparativo de assinaturas novas e canceladas</CardDescription>
          </CardHeader>
          <CardContent>
            {timeseriesLoading ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateFormatted" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="newSubscriptions" name="Novas" fill="#10b981" />
                    <Bar dataKey="canceledSubscriptions" name="Canceladas" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendência de Assinaturas</CardTitle>
          <CardDescription>Evolução das assinaturas ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          {timeseriesLoading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateFormatted" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="newSubscriptions" 
                    name="Novas Assinaturas"
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: "#10b981" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="canceledSubscriptions" 
                    name="Cancelamentos"
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: "#ef4444" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
