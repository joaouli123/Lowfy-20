import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bug, CheckCircle, Clock, AlertCircle, Archive, ArchiveRestore } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, TableCard, EmptyState,
  TableSkeleton, StatusBadge, FilterBar,
} from "@/components/admin";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  email: string;
  name: string;
  phone?: string;
  status: string;
  priority: string;
  createdAt: string;
  userId?: string;
  attachments?: Array<{ id: string; url: string; type: 'image' | 'video'; name: string; size: number }>;
}

export default function AdminBugs() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/support-tickets"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/support-tickets/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({ title: "Status atualizado", description: "O status do bug foi atualizado com sucesso." });
    },
  });

  // Nada é apagado: arquivar tira da lista e dá para desarquivar quando quiser.
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/support-tickets/${id}/status`, { status: "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({ title: "Arquivado", description: "Saiu da lista. Fica em Arquivados se precisar." });
      setSelectedTicket(null);
    },
  });

  const archiveOldMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/support-tickets/archive-old", { days: 30 })).json(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({ title: r?.archived ? `${r.archived} arquivado${r.archived === 1 ? "" : "s"}` : "Nada para arquivar", description: "Resolvidos há mais de 30 dias." });
    },
    onError: (e: any) => toast({ title: "Não deu para arquivar", description: e?.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "open": return <StatusBadge tone="danger" dot>Aberto</StatusBadge>;
      case "in_progress": return <StatusBadge tone="warning" dot>Em progresso</StatusBadge>;
      case "closed": return <StatusBadge tone="success" dot>Resolvido</StatusBadge>;
      case "archived": return <StatusBadge tone="neutral">Arquivado</StatusBadge>;
      default: return <StatusBadge>{status}</StatusBadge>;
    }
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <StatusBadge tone="danger">Alta</StatusBadge>;
      case "medium": return <StatusBadge tone="warning">Média</StatusBadge>;
      case "low": return <StatusBadge tone="neutral">Baixa</StatusBadge>;
      default: return <StatusBadge>{priority}</StatusBadge>;
    }
  };

  const counts = useMemo(() => ({
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length,
    archived: tickets.filter(t => t.status === "archived").length,
    oldClosed: tickets.filter(t => t.status === "closed" && Date.now() - new Date((t as any).updatedAt || t.createdAt).getTime() > 30 * 864e5).length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter(t => {
      if (statusFilter === "active" ? t.status === "archived" : statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q && !`${t.subject} ${t.name} ${t.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, search, statusFilter]);

  return (
    <AdminPage data-testid="admin-bugs-page">
      <AdminPageHeader
        title="Bugs reportados"
        description="Acompanhe e resolva os problemas reportados pelos usuários"
        icon={Bug}
        actions={
          <Button variant="outline" size="sm" onClick={() => archiveOldMutation.mutate()} disabled={archiveOldMutation.isPending || counts.oldClosed === 0} data-testid="button-archive-old">
            <Archive className="w-4 h-4 mr-2" /> Arquivar resolvidos antigos{counts.oldClosed ? ` (${counts.oldClosed})` : ""}
          </Button>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Abertos" value={counts.open} icon={AlertCircle} tone={counts.open > 0 ? "danger" : "default"} colorValue={counts.open > 0} loading={isLoading} testId="text-open-count" />
        <StatCard label="Em progresso" value={counts.inProgress} icon={Clock} tone="warning" loading={isLoading} testId="text-progress-count" />
        <StatCard label="Resolvidos" value={counts.closed} icon={CheckCircle} tone="success" loading={isLoading} testId="text-closed-count" />
        <StatCard label="Arquivados" value={counts.archived} icon={Archive} loading={isLoading} testId="text-archived-count" />
      </StatGrid>

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por assunto, nome ou e-mail...">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] text-sm" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Sem os arquivados</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="in_progress">Em progresso</SelectItem>
            <SelectItem value="closed">Resolvidos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <TableCard title="Lista de bugs" count={filtered.length}>
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bug}
            title={tickets.length === 0 ? "Nenhum bug reportado" : "Nenhum resultado"}
            description={tickets.length === 0 ? "Os bugs reportados pelos usuários aparecerão aqui." : "Ajuste a busca ou o filtro de status."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Assunto</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                  data-testid={`row-ticket-${ticket.id}`}
                >
                  <TableCell className="font-medium max-w-[280px] truncate">{ticket.subject}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium truncate max-w-[200px]">{ticket.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ticket.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(ticket.status)}</TableCell>
                  <TableCell>{priorityBadge(ticket.priority)}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {format(new Date(ticket.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right pr-2">
                    {ticket.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Arquivar"
                        onClick={(e) => { e.stopPropagation(); archiveMutation.mutate(ticket.id); }}
                        data-testid={`button-archive-${ticket.id}`}
                      >
                        <Archive className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-ticket-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-amber-500" />
              {selectedTicket?.subject}
            </DialogTitle>
            <DialogDescription>
              Reportado por {selectedTicket?.name} em{" "}
              {selectedTicket && format(new Date(selectedTicket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Mensagem</h4>
              <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg whitespace-pre-wrap">
                {selectedTicket?.message}
              </p>
            </div>

            {selectedTicket?.attachments && selectedTicket.attachments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Anexos ({selectedTicket.attachments.length})</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedTicket.attachments.map((attachment, index) => (
                    <div key={attachment.id} className="border rounded-lg overflow-hidden">
                      <div className="aspect-square bg-muted relative">
                        {attachment.type === 'image' ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(attachment.url, '_blank')}
                            data-testid={`img-attachment-${index}`}
                          />
                        ) : (
                          <video src={attachment.url} controls className="w-full h-full object-cover" data-testid={`video-attachment-${index}`} />
                        )}
                      </div>
                      <div className="p-2 bg-background">
                        <p className="text-xs font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Status:</span>
                {selectedTicket && statusBadge(selectedTicket.status)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Prioridade:</span>
                {selectedTicket && priorityBadge(selectedTicket.priority)}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              {selectedTicket?.status === "archived" && (
                <Button
                  variant="outline"
                  onClick={() => selectedTicket && updateStatusMutation.mutate({ id: selectedTicket.id, status: "closed" })}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-unarchive"
                >
                  <ArchiveRestore className="h-4 w-4 mr-2" /> Desarquivar
                </Button>
              )}
              {selectedTicket?.status !== "closed" && selectedTicket?.status !== "archived" && (
                <>
                  {selectedTicket?.status === "open" && (
                    <Button
                      variant="outline"
                      onClick={() => selectedTicket && updateStatusMutation.mutate({ id: selectedTicket.id, status: "in_progress" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-mark-progress"
                    >
                      <Clock className="h-4 w-4 mr-2" /> Marcar em progresso
                    </Button>
                  )}
                  <Button
                    onClick={() => selectedTicket && updateStatusMutation.mutate({ id: selectedTicket.id, status: "closed" })}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-mark-closed"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Marcar como resolvido
                  </Button>
                </>
              )}
              {selectedTicket?.status === "closed" && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => selectedTicket && archiveMutation.mutate(selectedTicket.id)}
                    disabled={archiveMutation.isPending}
                    data-testid="button-archive"
                  >
                    <Archive className="h-4 w-4 mr-2" /> Arquivar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedTicket && updateStatusMutation.mutate({ id: selectedTicket.id, status: "open" })}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-reopen"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" /> Reabrir
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
