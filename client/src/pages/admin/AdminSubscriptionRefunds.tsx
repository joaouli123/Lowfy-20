import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  DollarSign, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Mail,
  User,
  Calendar,
  Loader2,
  Filter
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface RefundStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  rejected: number;
  totalAmountPending: number;
  totalAmountRefunded: number;
}

interface RefundRequest {
  id: string;
  subscriptionId: string;
  userId: string;
  amountCents: number;
  paymentMethod: string;
  providerPaymentId: string | null;
  status: string;
  reason: string | null;
  adminNotes: string | null;
  processedBy: string | null;
  processedAt: string | null;
  refundedViaProvider: boolean;
  createdAt: string;
  updatedAt: string;
  subscription: any;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AdminSubscriptionRefunds() {
  const { toast } = useToast();
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [preset, setPreset] = useState("30days");

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
      case "90days":
        setStartDate(format(subDays(now, 90), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "all":
        setStartDate("");
        setEndDate("");
        break;
      case "custom":
        break;
    }
  };

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString() ? `?${params.toString()}` : '';
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<RefundStats>({
    queryKey: ["/api/admin/subscription-refunds/stats"],
  });

  const { data: refunds, isLoading: refundsLoading, refetch: refetchRefunds } = useQuery<RefundRequest[]>({
    queryKey: ["/api/admin/subscription-refunds", statusFilter, startDate, endDate],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/subscription-refunds${buildQueryString()}`);
      return response.json();
    }
  });

  const updateRefundMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      return await apiRequest("PATCH", `/api/admin/subscription-refunds/${id}`, { status, adminNotes });
    },
    onSuccess: () => {
      refetchRefunds();
      refetchStats();
      toast({
        title: "Reembolso atualizado",
        description: "O status do reembolso foi atualizado com sucesso.",
      });
      setSelectedRefund(null);
      setAdminNotes("");
      setNewStatus("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o reembolso.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amountInCents / 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
      processing: { label: "Processando", variant: "outline", icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> },
      completed: { label: "Concluído", variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      rejected: { label: "Rejeitado", variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    
    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="flex items-center w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === 'pix') {
      return (
        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 48 48" className="mr-1">
            <path fill="currentColor" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
          </svg>
          PIX
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <CreditCard className="h-3 w-3 mr-1" />
        Cartão
      </Badge>
    );
  };

  const handleOpenDetails = (refund: RefundRequest) => {
    setSelectedRefund(refund);
    setAdminNotes(refund.adminNotes || "");
    setNewStatus(refund.status);
  };

  const handleUpdateRefund = () => {
    if (selectedRefund && newStatus) {
      updateRefundMutation.mutate({
        id: selectedRefund.id,
        status: newStatus,
        adminNotes,
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="admin-subscription-refunds">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Reembolsos de Assinatura</h1>
          <p className="text-muted-foreground">Gerencie solicitações de reembolso de assinaturas Lowfy</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => { refetchStats(); refetchRefunds(); }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="stat-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-processing">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processando</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{stats?.processing || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-completed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="stat-amount">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reembolsado</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalAmountRefunded || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {(stats?.pending ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {stats.pending} solicitação(ões) aguardando processamento
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Total pendente: {formatCurrency(stats.totalAmountPending || 0)}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Filtros de Período</CardTitle>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Período Predefinido</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger data-testid="select-preset">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="90days">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Data Início</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Data Fim</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
                data-testid="input-end-date"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Solicitações de Reembolso
                {!refundsLoading && refunds && (
                  <Badge variant="secondary" className="ml-2" data-testid="refunds-count">
                    {refunds.length} registro{refunds.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Lista de todas as solicitações de reembolso de assinaturas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {refundsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : refunds && refunds.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={refund.id} data-testid={`row-refund-${refund.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{refund.user?.name || '-'}</p>
                        <p className="text-sm text-muted-foreground">{refund.user?.email || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(refund.amountCents)}
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodBadge(refund.paymentMethod)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(refund.status)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatDate(refund.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(refund)}
                        data-testid={`button-details-${refund.id}`}
                      >
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma solicitação de reembolso encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRefund} onOpenChange={() => setSelectedRefund(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Detalhes do Reembolso
            </DialogTitle>
            <DialogDescription>
              Gerencie esta solicitação de reembolso
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Usuário
                  </p>
                  <p className="font-medium">{selectedRefund.user?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium">{selectedRefund.user?.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Valor
                  </p>
                  <p className="font-medium text-lg">{formatCurrency(selectedRefund.amountCents)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Método
                  </p>
                  {getPaymentMethodBadge(selectedRefund.paymentMethod)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Solicitado em
                  </p>
                  <p className="font-medium">{formatDate(selectedRefund.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status Atual</p>
                  {getStatusBadge(selectedRefund.status)}
                </div>
              </div>

              {selectedRefund.reason && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Motivo do Usuário</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedRefund.reason}</p>
                </div>
              )}

              {selectedRefund.refundedViaProvider && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Reembolso processado automaticamente via provedor de pagamento
                  </p>
                </div>
              )}

              {selectedRefund.paymentMethod === 'pix' && selectedRefund.status !== 'completed' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Pagamento PIX requer processamento manual do reembolso
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Alterar Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Notas do Admin</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Adicione notas sobre o processamento..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  data-testid="input-admin-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedRefund(null)}
              data-testid="button-close-modal"
            >
              Fechar
            </Button>
            <Button
              onClick={handleUpdateRefund}
              disabled={updateRefundMutation.isPending || !newStatus}
              data-testid="button-save-changes"
            >
              {updateRefundMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
