
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash, Pin, PinOff, Lock, Unlock } from "lucide-react";
import {
  type ForumTopicWithRelations,
  type SupportTicketWithRelations,
} from "@shared/schema";

export default function AdminComunidade() {
  return (
    <div className="p-[50px]">
      <CommunityManagement />
    </div>
  );
}

function CommunityManagement() {
  return (
    <Tabs defaultValue="forum" className="mt-6">
      <TabsList className="grid w-full grid-cols-2 bg-white">
        <TabsTrigger value="forum" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Fórum</TabsTrigger>
        <TabsTrigger value="tickets" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Tickets de Suporte</TabsTrigger>
      </TabsList>
      <TabsContent value="forum"><ForumManagement /></TabsContent>
      <TabsContent value="tickets"><TicketsManagement /></TabsContent>
    </Tabs>
  );
}

function ForumManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Moderação do Fórum</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Visualizações</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics?.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell data-testid={`topic-title-${topic.id}`}>{topic.title}</TableCell>
                  <TableCell data-testid={`topic-author-${topic.id}`}>{topic.author?.name}</TableCell>
                  <TableCell data-testid={`topic-views-${topic.id}`}>{topic.viewCount}</TableCell>
                  <TableCell data-testid={`topic-replies-${topic.id}`}>{topic.replyCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {topic.isSticky && <Badge variant="secondary" data-testid={`topic-sticky-${topic.id}`}>Fixado</Badge>}
                      {topic.isClosed && <Badge variant="destructive" data-testid={`topic-closed-${topic.id}`}>Fechado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => toggleSticky(topic)} data-testid={`button-toggle-sticky-${topic.id}`}>
                      {topic.isSticky ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleClosed(topic)} data-testid={`button-toggle-closed-${topic.id}`}>
                      {topic.isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(topic.id)} data-testid={`button-delete-topic-${topic.id}`}>
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

function TicketsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Tickets de Suporte</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assunto</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell data-testid={`ticket-subject-${ticket.id}`}>{ticket.subject}</TableCell>
                  <TableCell data-testid={`ticket-user-${ticket.id}`}>{ticket.user?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={ticket.status === 'open' ? 'default' : ticket.status === 'in_progress' ? 'secondary' : 'outline'}
                      data-testid={`ticket-status-${ticket.id}`}
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ticket.priority === 'high' ? 'destructive' : ticket.priority === 'medium' ? 'secondary' : 'outline'}
                      data-testid={`ticket-priority-${ticket.id}`}
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select onValueChange={(value) => updateStatus(ticket.id, value)}>
                      <SelectTrigger className="w-36" data-testid={`select-status-${ticket.id}`}>
                        <SelectValue placeholder="Alterar Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="in_progress">Em Progresso</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
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
