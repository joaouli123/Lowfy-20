import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  DollarSign,
  Activity,
  Users,
  ArrowUpDown,
  FileText,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, TableCard, EmptyState,
  TableSkeleton, FilterBar, formatNumber,
} from "@/components/admin";

type DateRange = "today" | "yesterday" | "last7days" | "last30days" | "custom";

const RANGE_PRESETS: { value: DateRange; label: string; testId: string }[] = [
  { value: "today", label: "Hoje", testId: "filter-today" },
  { value: "yesterday", label: "Ontem", testId: "filter-yesterday" },
  { value: "last7days", label: "7D", testId: "filter-last7days" },
  { value: "last30days", label: "30D", testId: "filter-last30days" },
  { value: "custom", label: "Personalizado", testId: "filter-custom" },
];

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
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("totalTokens");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("users");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("range", dateRange);
    if (dateRange === "custom" && customStartDate && customEndDate) {
      params.set("start", new Date(customStartDate).toISOString());
      params.set("end", new Date(customEndDate).toISOString());
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

    const filtered = userUsageData.data.filter(
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
      <div className="flex items-center gap-1 justify-end">
        {children}
        {sortField === field && <ArrowUpDown className="h-3 w-3" />}
      </div>
    </TableHead>
  );

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Uso de IA"
        description="Consumo de tokens e custos das APIs de IA"
        icon={Sparkles}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-card p-1 shadow-sm w-fit">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDateRange(p.value)}
                data-testid={p.testId}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                  dateRange === p.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 w-[150px] text-sm"
                data-testid="datepicker-start"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 w-[150px] text-sm"
                data-testid="datepicker-end"
              />
            </div>
          )}
        </div>
      </AdminPageHeader>

      <StatGrid cols={4}>
        <StatCard
          label="Total de tokens"
          value={formatNumber(summary?.totalTokens || 0)}
          icon={Zap}
          tone="success"
          hint={summary ? `In: ${formatNumber(summary.totalPromptTokens)} · Out: ${formatNumber(summary.totalCompletionTokens)}` : undefined}
          loading={summaryLoading}
          testId="card-total-tokens"
        />
        <StatCard
          label="Custo USD"
          value={formatCurrency(summary?.totalCostUsd || 0, "USD")}
          icon={DollarSign}
          tone="info"
          loading={summaryLoading}
          testId="card-cost-usd"
        />
        <StatCard
          label="Custo BRL"
          value={formatCurrency(summary?.totalCostBrl || 0, "BRL")}
          icon={TrendingUp}
          tone="violet"
          loading={summaryLoading}
          testId="card-cost-brl"
        />
        <StatCard
          label="Chamadas à API"
          value={formatNumber(summary?.totalCalls || 0)}
          icon={Activity}
          tone="warning"
          loading={summaryLoading}
          testId="card-total-calls"
        />
      </StatGrid>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Por usuário
          </TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <Activity className="w-4 h-4 mr-2" />
            Por operação
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="w-4 h-4 mr-2" />
            Logs detalhados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <FilterBar
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Buscar por nome ou e-mail..."
          />
          <TableCard title="Uso por usuário" count={filteredAndSortedUsers.length}>
            {userUsageLoading ? (
              <TableSkeleton />
            ) : filteredAndSortedUsers.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="Nenhum uso de IA registrado"
                description="Os dados aparecerão aqui quando houver uso de funcionalidades de IA (Estúdio IA, Chat IA, geração de quiz etc.)."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead data-testid="header-user">Usuário</TableHead>
                    <SortableHeader field="totalPromptTokens" testId="sort-prompt-tokens">
                      Tokens input
                    </SortableHeader>
                    <SortableHeader field="totalCompletionTokens" testId="sort-completion-tokens">
                      Tokens output
                    </SortableHeader>
                    <SortableHeader field="totalTokens" testId="sort-tokens">
                      Total tokens
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
                  {filteredAndSortedUsers.map((user, index) => (
                    <TableRow
                      key={user.userId || `system-${index}`}
                      data-testid={`row-user-${user.userId || index}`}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[220px]">{user.userName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {user.userEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatNumber(user.totalPromptTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatNumber(user.totalCompletionTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {formatNumber(user.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-emerald-600">
                        {formatCurrency(user.totalCostUsd, "USD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-sky-600">
                        {formatCurrency(user.totalCostBrl, "BRL")}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Badge variant="secondary" className="tabular-nums">{user.callCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <TableCard title="Uso por operação" count={operationUsageData?.data?.length ?? 0}>
            {operationUsageLoading ? (
              <TableSkeleton />
            ) : !operationUsageData?.data?.length ? (
              <EmptyState
                icon={Activity}
                title="Nenhuma operação registrada"
                description="O sistema registra automaticamente cada chamada à API de IA por tipo de operação."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Operação</TableHead>
                    <TableHead className="text-right">Tokens input</TableHead>
                    <TableHead className="text-right">Tokens output</TableHead>
                    <TableHead className="text-right">Total tokens</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                    <TableHead className="text-right">Custo BRL</TableHead>
                    <TableHead className="text-right pr-4">Chamadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operationUsageData.data.map((op) => (
                    <TableRow key={op.operation} data-testid={`row-operation-${op.operation}`}>
                      <TableCell>
                        <Badge variant="outline">{formatOperationName(op.operation)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatNumber(op.totalPromptTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatNumber(op.totalCompletionTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {formatNumber(op.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-emerald-600">
                        {formatCurrency(op.totalCostUsd, "USD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-sky-600">
                        {formatCurrency(op.totalCostBrl, "BRL")}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Badge variant="secondary" className="tabular-nums">{op.callCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <TableCard title="Logs detalhados" count={logsData?.data?.length ?? 0}>
            {logsLoading ? (
              <TableSkeleton rows={8} />
            ) : !logsData?.data?.length ? (
              <EmptyState
                icon={FileText}
                title="Nenhum log detalhado disponível"
                description="Os logs individuais de cada chamada à API aparecerão aqui quando houver uso de IA."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Tokens (in / total)</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                    <TableHead className="text-right">Custo BRL</TableHead>
                    <TableHead className="text-right pr-4">Câmbio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="text-sm whitespace-nowrap tabular-nums text-muted-foreground">
                        {format(new Date(log.usageDate), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatOperationName(log.operation)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">{log.model}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        <span className="text-muted-foreground">{formatNumber(log.promptTokens)}</span>
                        {" / "}
                        <span className="font-semibold">{formatNumber(log.totalTokens)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-emerald-600">
                        {formatCurrency(log.costUsd, "USD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-sky-600">
                        {formatCurrency(log.costBrl, "BRL")}
                      </TableCell>
                      <TableCell className="text-right pr-4 text-muted-foreground tabular-nums text-xs">
                        {log.exchangeRate.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
