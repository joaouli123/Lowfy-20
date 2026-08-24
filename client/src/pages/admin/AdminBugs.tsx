import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

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
  attachments?: Array<{
    id: string;
    url: string;
    type: 'image' | 'video';
    name: string;
    size: number;
  }>;
}

export default function AdminBugs() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/support-tickets"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/support-tickets/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({
        title: "Status atualizado",
        description: "O status do bug foi atualizado com sucesso.",
      });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/support-tickets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({
        title: "Bug removido",
        description: "O bug foi removido com sucesso.",
      });
      setSelectedTicket(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Aberto</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1 bg-yellow-500 hover:bg-yellow-600"><Clock className="h-3 w-3" /> Em Progresso</Badge>;
      case "closed":
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> Fechado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "medium":
        return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Média</Badge>;
      case "low":
        return <Badge variant="secondary">Baixa</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const openTickets = tickets.filter(t => t.status === "open");
  const inProgressTickets = tickets.filter(t => t.status === "in_progress");
  const closedTickets = tickets.filter(t => t.status === "closed");

  return (
    <div className="max-w-7xl mx-auto p-8" data-testid="admin-bugs-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Bug className="h-8 w-8 text-orange-500" />
          Bugs Reportados
        </h1>
        <p className="text-muted-foreground">
          Gerencie e acompanhe os bugs reportados pelos usuários
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Abertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-count">{openTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Em Progresso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-progress-count">{inProgressTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-closed-count">{closedTickets.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Bugs</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state-bugs">
              <Bug className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum bug reportado
              </h3>
              <p className="text-muted-foreground">
                Os bugs reportados aparecerão aqui
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`row-ticket-${ticket.id}`}
                  >
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.name}</div>
                        <div className="text-xs text-muted-foreground">{ticket.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(ticket.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTicketMutation.mutate(ticket.id);
                        }}
                        data-testid={`button-delete-${ticket.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-ticket-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-500" />
              {selectedTicket?.subject}
            </DialogTitle>
            <DialogDescription>
              Reportado por {selectedTicket?.name} em{" "}
              {selectedTicket && format(new Date(selectedTicket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Mensagem:</h4>
              <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg whitespace-pre-wrap">
                {selectedTicket?.message}
              </p>
            </div>

            {selectedTicket?.attachments && selectedTicket.attachments.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Anexos ({selectedTicket.attachments.length}):</h4>
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
                          <video
                            src={attachment.url}
                            controls
                            className="w-full h-full object-cover"
                            data-testid={`video-attachment-${index}`}
                          />
                        )}
                      </div>
                      <div className="p-2 bg-background">
                        <p className="text-xs font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div>
                <span className="text-sm font-medium">Status: </span>
                {selectedTicket && getStatusBadge(selectedTicket.status)}
              </div>
              <div>
                <span className="text-sm font-medium">Prioridade: </span>
                {selectedTicket && getPriorityBadge(selectedTicket.priority)}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              {selectedTicket?.status !== "closed" && (
                <>
                  {selectedTicket?.status === "open" && (
                    <Button
                      variant="default"
                      onClick={() => {
                        if (selectedTicket) {
                          updateStatusMutation.mutate({ id: selectedTicket.id, status: "in_progress" });
                        }
                      }}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-mark-progress"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Marcar em Progresso
                    </Button>
                  )}
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      if (selectedTicket) {
                        updateStatusMutation.mutate({ id: selectedTicket.id, status: "closed" });
                      }
                    }}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-mark-closed"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Resolvido
                  </Button>
                </>
              )}
              {selectedTicket?.status === "closed" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedTicket) {
                      updateStatusMutation.mutate({ id: selectedTicket.id, status: "open" });
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-reopen"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Reabrir
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
