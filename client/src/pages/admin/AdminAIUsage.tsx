import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  DollarSign,
  Activity,
  Users,
  Search,
  CalendarIcon,
  ArrowUpDown,
  FileText,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DateRange = "today" | "yesterday" | "last7days" | "last30days" | "custom";

interface TokenUsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostBrl: number;
  totalCalls: number;
  startDate: string;
  endDate: string;
}

interface UserUsage {
  userId: string | null;
  userName: string;
  userEmail: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostBrl: number;
  callCount: number;
}

interface OperationUsage {
  operation: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostBrl: number;
  callCount: number;
}

interface UsageLog {
  id: string;
  userId: string | null;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costBrl: number;
  exchangeRate: number;
  usageDate: string;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("pt-BR").format(num);
}

function formatCurrency(value: number, currency: "USD" | "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatOperationName(operation: string): string {
  const names: Record<string, string> = {
    andromeda_campaign: "Meta Ads Andromeda",
    ai_chat: "Chat IA",
    image_generation: "Geração de Imagens",
    quiz_generation: "Geração de Quiz",
    content_moderation: "Moderação de Conteúdo",
    text_completion: "Completar Texto",
  };
  return names[operation] || operation;
}

export default function AdminAIUsage() {
  const [dateRange, setDateRange] = useState<DateRange>("last30days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("totalTokens");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("users");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("range", dateRange);
    if (dateRange === "custom" && customStartDate && customEndDate) {
      params.set("start", customStartDate.toISOString());
      params.set("end", customEndDate.toISOString());
    }
    return params.toString();
  }, [dateRange, customStartDate, customEndDate]);

  const { data: summary, isLoading: summaryLoading } = useQuery<TokenUsageSummary>({
    queryKey: ["/api/admin/ai-usage/summary", queryParams],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/ai-usage/summary?${queryParams}`);
      return response.json();
    },
  });

  const { data: userUsageData, isLoading: userUsageLoading } = useQuery<{
    data: UserUsage[];
  }>({
    queryKey: ["/api/admin/ai-usage/by-user", queryParams],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/ai-usage/by-user?${queryParams}`);
      return response.json();
    },
  });

  const { data: operationUsageData, isLoading: operationUsageLoading } = useQuery<{
    data: OperationUsage[];
  }>({
    queryKey: ["/api/admin/ai-usage/by-operation", queryParams],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/ai-usage/by-operation?${queryParams}`);
      return response.json();
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{
    data: UsageLog[];
  }>({
    queryKey: ["/api/admin/ai-usage/logs", queryParams],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/ai-usage/logs?${queryParams}`);
      return response.json();
    },
    enabled: activeTab === "logs",
  });

  const filteredAndSortedUsers = useMemo(() => {
    if (!userUsageData?.data) return [];

    let filtered = userUsageData.data.filter(
      (user) =>
        user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aValue = a[sortField as keyof UserUsage] || 0;
      const bValue = b[sortField as keyof UserUsage] || 0;
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return ((aValue as number) - (bValue as number)) * multiplier;
    });
  }, [userUsageData?.data, searchQuery, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({
    field,
    children,
    testId,
  }: {
    field: string;
    children: React.ReactNode;
    testId?: string;
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
      data-testid={testId || `sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
            Uso de IA (OpenAI)
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o consumo de tokens e custos da API OpenAI
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={dateRange}
            onValueChange={(value) => setDateRange(value as DateRange)}
          >
            <SelectTrigger
              className="w-[180px]"
              data-testid="select-date-range"
            >
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" data-testid="filter-today">
                Hoje
              </SelectItem>
              <SelectItem value="yesterday" data-testid="filter-yesterday">
                Ontem
              </SelectItem>
              <SelectItem value="last7days" data-testid="filter-last7days">
                Últimos 7 dias
              </SelectItem>
              <SelectItem value="last30days" data-testid="filter-last30days">
                Últimos 30 dias
              </SelectItem>
              <SelectItem value="custom" data-testid="filter-custom">
                Personalizado
              </SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                    data-testid="datepicker-start"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate
                      ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    locale={ptBR}
                    data-testid="calendar-datepicker-start"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !customEndDate && "text-muted-foreground"
                    )}
                    data-testid="datepicker-end"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate
                      ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR })
                      : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    locale={ptBR}
                    data-testid="calendar-datepicker-end"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-tokens">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Tokens</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground" data-testid="value-total-tokens">
                    {formatNumber(summary?.totalTokens || 0)}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
            </div>
            {!summaryLoading && summary && (
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  In: {formatNumber(summary.totalPromptTokens)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Out: {formatNumber(summary.totalCompletionTokens)}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-cost-usd">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Custo USD</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-green-600" data-testid="value-cost-usd">
                    {formatCurrency(summary?.totalCostUsd || 0, "USD")}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cost-brl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Custo BRL</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-blue-600" data-testid="value-cost-brl">
                    {formatCurrency(summary?.totalCostBrl || 0, "BRL")}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-calls">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Chamadas</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground" data-testid="value-total-calls">
                    {formatNumber(summary?.totalCalls || 0)}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Por Usuário
          </TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <Activity className="w-4 h-4 mr-2" />
            Por Operação
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="w-4 h-4 mr-2" />
            Logs Detalhados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Uso por Usuário
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="search-input"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {userUsageLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-user">Usuário</TableHead>
                        <SortableHeader field="totalPromptTokens" testId="sort-prompt-tokens">
                          Tokens Input
                        </SortableHeader>
                        <SortableHeader field="totalCompletionTokens" testId="sort-completion-tokens">
                          Tokens Output
                        </SortableHeader>
                        <SortableHeader field="totalTokens" testId="sort-tokens">
                          Total Tokens
                        </SortableHeader>
                        <SortableHeader field="totalCostUsd" testId="sort-cost-usd">
                          Custo USD
                        </SortableHeader>
                        <SortableHeader field="totalCostBrl" testId="sort-cost-brl">
                          Custo BRL
                        </SortableHeader>
                        <SortableHeader field="callCount" testId="sort-calls">
                          Chamadas
                        </SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-12"
                          >
                            <div className="flex flex-col items-center gap-3">
                              <Zap className="w-12 h-12 text-muted-foreground/50" />
                              <div>
                                <p className="font-medium text-foreground">Nenhum uso de IA registrado</p>
                                <p className="text-sm mt-1">Os dados aparecerão aqui quando houver uso de funcionalidades como Meta Ads Andromeda ou Chat IA.</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedUsers.map((user, index) => (
                          <TableRow
                            key={user.userId || `system-${index}`}
                            data-testid={`row-user-${user.userId || index}`}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.userName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {user.userEmail}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatNumber(user.totalPromptTokens)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatNumber(user.totalCompletionTokens)}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold">
                              {formatNumber(user.totalTokens)}
                            </TableCell>
                            <TableCell className="text-green-600 font-mono text-sm">
                              {formatCurrency(user.totalCostUsd, "USD")}
                            </TableCell>
                            <TableCell className="text-blue-600 font-mono text-sm">
                              {formatCurrency(user.totalCostBrl, "BRL")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{user.callCount}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Uso por Operação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {operationUsageLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operação</TableHead>
                        <TableHead>Tokens Input</TableHead>
                        <TableHead>Tokens Output</TableHead>
                        <TableHead>Total Tokens</TableHead>
                        <TableHead>Custo USD</TableHead>
                        <TableHead>Custo BRL</TableHead>
                        <TableHead>Chamadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!operationUsageData?.data?.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-12"
                          >
                            <div className="flex flex-col items-center gap-3">
                              <Activity className="w-12 h-12 text-muted-foreground/50" />
                              <div>
                                <p className="font-medium text-foreground">Nenhuma operação registrada</p>
                                <p className="text-sm mt-1">O sistema registra automaticamente cada chamada à API OpenAI por tipo de operação.</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        operationUsageData.data.map((op) => (
                          <TableRow
                            key={op.operation}
                            data-testid={`row-operation-${op.operation}`}
                          >
                            <TableCell>
                              <Badge variant="outline">
                                {formatOperationName(op.operation)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatNumber(op.totalPromptTokens)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatNumber(op.totalCompletionTokens)}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold">
                              {formatNumber(op.totalTokens)}
                            </TableCell>
                            <TableCell className="text-green-600 font-mono text-sm">
                              {formatCurrency(op.totalCostUsd, "USD")}
                            </TableCell>
                            <TableCell className="text-blue-600 font-mono text-sm">
                              {formatCurrency(op.totalCostBrl, "BRL")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{op.callCount}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Logs Detalhados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Custo USD</TableHead>
                        <TableHead>Custo BRL</TableHead>
                        <TableHead>Taxa Câmbio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!logsData?.data?.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-12"
                          >
                            <div className="flex flex-col items-center gap-3">
                              <FileText className="w-12 h-12 text-muted-foreground/50" />
                              <div>
                                <p className="font-medium text-foreground">Nenhum log detalhado disponível</p>
                                <p className="text-sm mt-1">Os logs individuais de cada chamada à API aparecerão aqui quando houver uso de IA.</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        logsData.data.map((log) => (
                          <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                            <TableCell className="text-sm">
                              {format(new Date(log.usageDate), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {formatOperationName(log.operation)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{log.model}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              <span className="text-muted-foreground">
                                {formatNumber(log.promptTokens)}
                              </span>
                              {" / "}
                              <span className="font-semibold">
                                {formatNumber(log.totalTokens)}
                              </span>
                            </TableCell>
                            <TableCell className="text-green-600 font-mono text-sm">
                              {formatCurrency(log.costUsd, "USD")}
                            </TableCell>
                            <TableCell className="text-blue-600 font-mono text-sm">
                              {formatCurrency(log.costBrl, "BRL")}
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">
                              {log.exchangeRate.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
