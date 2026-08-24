import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCode, Users, Eye, Globe, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod,
  TableCard, EmptyState, TableSkeleton, formatNumber, type Period,
} from "@/components/admin";

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

export default function AdminClonagemAnalytics() {
  const [period, setPeriod] = useState<Period>(defaultPeriod("all"));
  const isAll = period.preset === "all";
  const startDate = isAll ? undefined : period.startDate;
  const endDate = isAll ? undefined : period.endDate;

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
      const response = await fetch(`/api/admin/cloning-analytics/pages${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
  });

  const { data: userStats, isLoading: userStatsLoading } = useQuery<UserPagesStats[]>({
    queryKey: ["/api/admin/cloning-analytics/user-stats", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/admin/cloning-analytics/user-stats${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch user stats");
      return response.json();
    },
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const pages = pagesData?.pages || [];
  const totalPages = pages.length;
  const totalUsers = userStats?.length || 0;
  const totalViews = pages.reduce((sum, page) => sum + (page.viewCount || 0), 0);
  const periodLabel = isAll ? "no sistema" : "no período";

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Analytics de clonagem"
        description="Páginas clonadas e estatísticas de uso do clonador"
        icon={Copy}
      >
        <PeriodFilter value={period} onChange={setPeriod} />
      </AdminPageHeader>

      <StatGrid cols={3}>
        <StatCard
          label="Páginas clonadas"
          value={formatNumber(totalPages)}
          icon={FileCode}
          tone="success"
          hint={periodLabel}
          loading={pagesLoading}
          testId="card-total-pages"
        />
        <StatCard
          label="Usuários com páginas"
          value={formatNumber(totalUsers)}
          icon={Users}
          tone="info"
          hint={periodLabel}
          loading={userStatsLoading}
          testId="card-total-users"
        />
        <StatCard
          label="Visualizações"
          value={formatNumber(totalViews)}
          icon={Eye}
          tone="violet"
          hint={`acessos ${periodLabel}`}
          loading={pagesLoading}
          testId="card-total-views"
        />
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <TableCard title="Páginas por usuário" count={totalUsers} className="xl:col-span-2">
          {userStatsLoading ? (
            <TableSkeleton rows={4} />
          ) : !userStats || userStats.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum usuário" description={`Nenhum usuário com páginas clonadas ${periodLabel}.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right pr-4">Páginas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats.map((user) => (
                  <TableRow key={user.userId || 'unknown'} data-testid={`user-stats-${user.userId}`}>
                    <TableCell>
                      <p className="font-medium truncate max-w-[220px]">{user.userName || 'Usuário desconhecido'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{user.userEmail || 'N/A'}</p>
                    </TableCell>
                    <TableCell className="text-right pr-4 font-semibold tabular-nums">{user.pageCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>

        <TableCard title="Todas as páginas clonadas" count={totalPages} className="xl:col-span-3">
          {pagesLoading ? (
            <TableSkeleton rows={4} />
          ) : pages.length === 0 ? (
            <EmptyState icon={FileCode} title="Nenhuma página clonada" description={`Nenhuma página clonada ${periodLabel}.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Página</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right pr-4">Atualizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.name} data-testid={`page-${page.name}`}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[260px]">{page.originalName || page.name}</p>
                          <a
                            href={`${window.location.origin}/pages/${page.name}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-sky-600 font-mono hover:underline truncate block max-w-[260px]"
                          >
                            /pages/{page.name}
                          </a>
                          <p className="text-xs text-muted-foreground">Criada em {formatDate(page.createdAt)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{(page.size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{page.viewCount || 0}</TableCell>
                    <TableCell className="text-right pr-4 tabular-nums text-muted-foreground">{formatDate(page.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      </div>
    </AdminPage>
  );
}
