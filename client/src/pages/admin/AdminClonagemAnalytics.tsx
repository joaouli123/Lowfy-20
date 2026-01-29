import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCode, Users, Clock, Globe, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClonedPage {
  name: string;
  originalName?: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  viewCount?: number;
}

interface UserPagesStats {
  userId: string;
  userName: string;
  userEmail: string;
  pageCount: number;
}

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

export default function AdminClonagemAnalytics() {
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (datePreset) {
      case "today":
        startDate = today;
        endDate = today;
        break;
      case "7days":
        startDate = subDays(today, 6);
        endDate = today;
        break;
      case "30days":
        startDate = subDays(today, 29);
        endDate = today;
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(now), 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case "thisWeek":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "custom":
        startDate = customStartDate ? new Date(customStartDate) : undefined;
        endDate = customEndDate ? new Date(customEndDate) : undefined;
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

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const queryString = buildQueryString();

  const { data: pagesData, isLoading: pagesLoading } = useQuery<{ pages: ClonedPage[] }>({
    queryKey: ["/api/admin/cloning-analytics/pages", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/admin/cloning-analytics/pages${queryString}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
  });

  const { data: userStats, isLoading: userStatsLoading } = useQuery<UserPagesStats[]>({
    queryKey: ["/api/admin/cloning-analytics/user-stats", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/admin/cloning-analytics/user-stats${queryString}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch user stats");
      return response.json();
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const totalPages = pagesData?.pages.length || 0;
  const totalUsers = userStats?.length || 0;
  const totalViews = pagesData?.pages.reduce((sum, page) => sum + (page.viewCount || 0), 0) || 0;

  const getDateRangeLabel = () => {
    const preset = DATE_PRESETS.find(p => p.value === datePreset);
    if (datePreset === "custom" && startDate && endDate) {
      return `${format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return preset?.label || "Todo período";
  };

  return (
    <div className="p-[50px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics de Clonagem</h1>
          <p className="text-muted-foreground">Controle completo de páginas clonadas e estatísticas de uso</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-preset">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-end-date"
              />
            </div>
          )}

          {datePreset !== "all" && (
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md">
              {getDateRangeLabel()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card data-testid="card-total-pages">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Páginas</p>
                {pagesLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {totalPages.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileCode className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Páginas clonadas {datePreset !== "all" ? "no período" : "no sistema"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Usuários Ativos</p>
                {userStatsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {totalUsers.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Usuários com páginas clonadas {datePreset !== "all" ? "no período" : ""}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-views">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Visualizações</p>
                {pagesLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {totalViews.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Acessos às páginas clonadas {datePreset !== "all" ? "no período" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Páginas por Usuário
          </CardTitle>
          <CardDescription>
            Quantidade de páginas clonadas por cada usuário {datePreset !== "all" ? "no período selecionado" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userStatsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {!userStats || userStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum usuário com páginas clonadas {datePreset !== "all" ? "no período selecionado" : "ainda"}
                </p>
              ) : (
                userStats.map((user) => (
                  <div
                    key={user.userId || 'unknown'}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`user-stats-${user.userId}`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {user.userName || 'Usuário Desconhecido'}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.userEmail || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-sm">Páginas Clonadas</p>
                      <p className="font-semibold text-lg">{user.pageCount}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Todas as Páginas Clonadas
          </CardTitle>
          <CardDescription>
            Lista completa de páginas clonadas {datePreset !== "all" ? "no período selecionado" : "no sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {!pagesData?.pages || pagesData.pages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma página clonada {datePreset !== "all" ? "no período selecionado" : "ainda"}
                </p>
              ) : (
                pagesData.pages.map((page) => (
                  <div
                    key={page.name}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`page-${page.name}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{page.originalName || page.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Criada em {formatDate(page.createdAt)}
                      </p>
                      <p className="text-xs text-blue-600 font-mono mt-1">
                        {window.location.origin}/pages/{page.name}
                      </p>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground">Tamanho</p>
                        <p className="font-semibold">
                          {(page.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Visualizações</p>
                        <p className="font-semibold">{page.viewCount || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Atualizada</p>
                        <p className="font-semibold">{formatDate(page.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
