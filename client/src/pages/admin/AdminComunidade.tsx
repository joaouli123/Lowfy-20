import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Trash, Pin, PinOff, Lock, Unlock, MessagesSquare, MessageCircle,
  LifeBuoy, Eye, AlertCircle,
} from "lucide-react";
import {
  type ForumTopicWithRelations,
  type SupportTicketWithRelations,
} from "@shared/schema";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, TableCard, EmptyState,
  TableSkeleton, StatusBadge, FilterBar, formatNumber,
} from "@/components/admin";

const TICKET_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  open: { label: "Aberto", tone: "success" },
  in_progress: { label: "Em progresso", tone: "warning" },
  closed: { label: "Fechado", tone: "neutral" },
};

const TICKET_PRIORITY: Record<string, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  high: { label: "Alta", tone: "danger" },
  medium: { label: "Média", tone: "warning" },
  low: { label: "Baixa", tone: "neutral" },
};

export default function AdminComunidade() {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Comunidade"
        description="Moderação do fórum e atendimento dos tickets de suporte"
        icon={MessagesSquare}
      />
      <Tabs defaultValue="forum" className="space-y-4">
        <TabsList>
          <TabsTrigger value="forum" data-testid="tab-forum">Fórum</TabsTrigger>
          <TabsTrigger value="tickets" data-testid="tab-tickets">Tickets de suporte</TabsTrigger>
        </TabsList>
        <TabsContent value="forum" className="space-y-4 mt-0"><ForumManagement /></TabsContent>
        <TabsContent value="tickets" className="space-y-4 mt-0"><TicketsManagement /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}

function ForumManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: topics, isLoading } = useQuery<ForumTopicWithRelations[]>({
    queryKey: ["/api/forum/topics"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { isSticky?: boolean; isClosed?: boolean } }) => {
      await apiRequest("PATCH", `/api/forum/topics/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Tópico atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tópico", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/forum/topics/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Tópico excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir tópico", description: error.message, variant: "destructive" });
    },
  });

  const toggleSticky = (topic: ForumTopicWithRelations) => {
    updateMutation.mutate({ id: topic.id, data: { isSticky: !topic.isSticky } });
  };

  const toggleClosed = (topic: ForumTopicWithRelations) => {
    updateMutation.mutate({ id: topic.id, data: { isClosed: !topic.isClosed } });
  };

  const stats = useMemo(() => {
    const list = topics || [];
    return {
      total: list.length,
      views: list.reduce((sum, t) => sum + (t.viewCount || 0), 0),
      replies: list.reduce((sum, t) => sum + (t.replyCount || 0), 0),
    };
  }, [topics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topics || [];
    return (topics || []).filter(t =>
      `${t.title} ${t.author?.name || ""}`.toLowerCase().includes(q)
    );
  }, [topics, search]);

  return (
    <>
      <StatGrid cols={3}>
        <StatCard label="Tópicos" value={formatNumber(stats.total)} icon={MessagesSquare} tone="info" loading={isLoading} testId="stat-forum-topics" />
        <StatCard label="Visualizações" value={formatNumber(stats.views)} icon={Eye} tone="violet" loading={isLoading} testId="stat-forum-views" />
        <StatCard label="Respostas" value={formatNumber(stats.replies)} icon={MessageCircle} tone="success" loading={isLoading} testId="stat-forum-replies" />
      </StatGrid>

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por título ou autor..." />

      <TableCard title="Moderação do fórum" count={filtered.length}>
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={!topics || topics.length === 0 ? "Nenhum tópico" : "Nenhum resultado"}
            description={!topics || topics.length === 0 ? "Os tópicos criados no fórum aparecerão aqui." : "Ajuste o termo da busca."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Tópico</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell className="font-medium max-w-[280px] truncate" data-testid={`topic-title-${topic.id}`}>{topic.title}</TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`topic-author-${topic.id}`}>{topic.author?.name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`topic-views-${topic.id}`}>{topic.viewCount}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`topic-replies-${topic.id}`}>{topic.replyCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {topic.isSticky && <StatusBadge tone="info" data-testid={`topic-sticky-${topic.id}`}>Fixado</StatusBadge>}
                      {topic.isClosed && <StatusBadge tone="danger" data-testid={`topic-closed-${topic.id}`}>Fechado</StatusBadge>}
                      {!topic.isSticky && !topic.isClosed && <StatusBadge tone="success" dot>Aberto</StatusBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-2 space-x-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleSticky(topic)}
                      title={topic.isSticky ? "Desafixar" : "Fixar"}
                      data-testid={`button-toggle-sticky-${topic.id}`}
                    >
                      {topic.isSticky ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleClosed(topic)}
                      title={topic.isClosed ? "Reabrir" : "Fechar"}
                      data-testid={`button-toggle-closed-${topic.id}`}
                    >
                      {topic.isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(topic.id)}
                      title="Excluir"
                      data-testid={`button-delete-topic-${topic.id}`}
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
    </>
  );
}

function TicketsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets, isLoading } = useQuery<SupportTicketWithRelations[]>({
    queryKey: ["/api/admin/support-tickets"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/support-tickets/${id}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: "Status atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const updateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const stats = useMemo(() => {
    const list = tickets || [];
    return {
      total: list.length,
      open: list.filter(t => t.status === "open").length,
      inProgress: list.filter(t => t.status === "in_progress").length,
      high: list.filter(t => t.priority === "high" && t.status !== "closed").length,
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tickets || []).filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q && !`${t.subject} ${t.user?.name || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, search, statusFilter]);

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="Tickets" value={formatNumber(stats.total)} icon={LifeBuoy} tone="info" loading={isLoading} testId="stat-tickets-total" />
        <StatCard
          label="Abertos"
          value={formatNumber(stats.open)}
          icon={MessageCircle}
          tone={stats.open > 0 ? "warning" : "default"}
          colorValue={stats.open > 0}
          loading={isLoading}
          testId="stat-tickets-open"
        />
        <StatCard label="Em progresso" value={formatNumber(stats.inProgress)} icon={Eye} tone="violet" loading={isLoading} testId="stat-tickets-progress" />
        <StatCard
          label="Prioridade alta"
          value={formatNumber(stats.high)}
          icon={AlertCircle}
          tone={stats.high > 0 ? "danger" : "default"}
          colorValue={stats.high > 0}
          loading={isLoading}
          testId="stat-tickets-high"
        />
      </StatGrid>

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por assunto ou usuário...">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] text-sm" data-testid="select-ticket-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="in_progress">Em progresso</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <TableCard title="Tickets de suporte" count={filtered.length}>
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={!tickets || tickets.length === 0 ? "Nenhum ticket" : "Nenhum resultado"}
            description={!tickets || tickets.length === 0 ? "Os tickets abertos pelos usuários aparecerão aqui." : "Ajuste a busca ou o filtro de status."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Assunto</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right pr-4">Alterar status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ticket) => {
                const st = TICKET_STATUS[ticket.status] || { label: ticket.status, tone: "neutral" as const };
                const pr = TICKET_PRIORITY[ticket.priority] || { label: ticket.priority, tone: "neutral" as const };
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium max-w-[280px] truncate" data-testid={`ticket-subject-${ticket.id}`}>{ticket.subject}</TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`ticket-user-${ticket.id}`}>{ticket.user?.name || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={st.tone} dot data-testid={`ticket-status-${ticket.id}`}>{st.label}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={pr.tone} data-testid={`ticket-priority-${ticket.id}`}>{pr.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right pr-2">
                      <div className="flex justify-end">
                        <Select onValueChange={(value) => updateStatus(ticket.id, value)}>
                          <SelectTrigger className="h-8 w-36 text-sm" data-testid={`select-status-${ticket.id}`}>
                            <SelectValue placeholder="Alterar status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Aberto</SelectItem>
                            <SelectItem value="in_progress">Em progresso</SelectItem>
                            <SelectItem value="closed">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </>
  );
}
