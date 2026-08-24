import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Mail,
  User,
  Calendar,
  Loader2,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod,
  TableCard, EmptyState, TableSkeleton, StatusBadge, formatBRL, type Period,
} from "@/components/admin";

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

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [period, setPeriod] = useState<Period>(defaultPeriod("30days"));

  const isAll = period.preset === "all";
  const startDate = isAll ? "" : period.startDate;
  const endDate = isAll ? "" : period.endDate;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString() ? `?${params.toString()}` : '';
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isFetching: statsFetching } = useQuery<RefundStats>({
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

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <StatusBadge tone="warning" dot>Pendente</StatusBadge>;
      case "processing": return <StatusBadge tone="info" dot>Processando</StatusBadge>;
      case "completed": return <StatusBadge tone="success" dot>Concluído</StatusBadge>;
      case "rejected": return <StatusBadge tone="danger" dot>Rejeitado</StatusBadge>;
      default: return <StatusBadge>{status}</StatusBadge>;
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === 'pix') {
      return <StatusBadge tone="info">PIX</StatusBadge>;
    }
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <CreditCard className="h-3 w-3" />
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
    <AdminPage data-testid="admin-subscription-refunds">
      <AdminPageHeader
        title="Reembolsos de assinatura"
        description="Gerencie solicitações de reembolso de assinaturas Lowfy"
        icon={Undo2}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchStats(); refetchRefunds(); }}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${statsFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm" data-testid="select-status-filter">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminPageHeader>

      <StatGrid cols={4}>
        <StatCard
          label="Pendentes"
          value={stats?.pending || 0}
          icon={Clock}
          tone={(stats?.pending ?? 0) > 0 ? "warning" : "default"}
          colorValue={(stats?.pending ?? 0) > 0}
          hint={stats ? `${formatBRL(stats.totalAmountPending || 0)} a processar` : undefined}
          loading={statsLoading}
          testId="stat-pending"
        />
        <StatCard
          label="Processando"
          value={stats?.processing || 0}
          icon={RefreshCw}
          tone="info"
          loading={statsLoading}
          testId="stat-processing"
        />
        <StatCard
          label="Concluídos"
          value={stats?.completed || 0}
          icon={CheckCircle}
          tone="success"
          hint={stats ? `${stats.rejected || 0} rejeitados` : undefined}
          loading={statsLoading}
          testId="stat-completed"
        />
        <StatCard
          label="Total reembolsado"
          value={formatBRL(stats?.totalAmountRefunded || 0)}
          icon={DollarSign}
          tone="violet"
          loading={statsLoading}
          testId="stat-amount"
        />
      </StatGrid>

      {(stats?.pending ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">
              {stats!.pending} solicitação(ões) aguardando processamento
            </p>
            <p className="text-sm text-amber-700">
              Total pendente: {formatBRL(stats!.totalAmountPending || 0)}
            </p>
          </div>
        </div>
      )}

      <TableCard title="Solicitações de reembolso" count={refunds?.length ?? 0}>
        {refundsLoading ? (
          <TableSkeleton />
        ) : refunds && refunds.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((refund) => (
                <TableRow key={refund.id} data-testid={`row-refund-${refund.id}`}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[220px]">{refund.user?.name || '-'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{refund.user?.email || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatBRL(refund.amountCents)}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(refund.paymentMethod)}</TableCell>
                  <TableCell>{getStatusBadge(refund.status)}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums text-sm">
                    {formatDate(refund.createdAt)}
                  </TableCell>
                  <TableCell className="text-right pr-4">
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
          <EmptyState
            icon={DollarSign}
            title="Nenhuma solicitação"
            description="Nenhuma solicitação de reembolso encontrada nos filtros atuais."
          />
        )}
      </TableCard>

      <Dialog open={!!selectedRefund} onOpenChange={() => setSelectedRefund(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Detalhes do reembolso
            </DialogTitle>
            <DialogDescription>
              Gerencie esta solicitação de reembolso
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Usuário
                  </p>
                  <p className="font-medium text-sm">{selectedRefund.user?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium text-sm break-all">{selectedRefund.user?.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Valor
                  </p>
                  <p className="font-semibold text-lg tabular-nums">{formatBRL(selectedRefund.amountCents)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Método
                  </p>
                  {getPaymentMethodBadge(selectedRefund.paymentMethod)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Solicitado em
                  </p>
                  <p className="font-medium text-sm tabular-nums">{formatDate(selectedRefund.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status atual</p>
                  {getStatusBadge(selectedRefund.status)}
                </div>
              </div>

              {selectedRefund.reason && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Motivo do usuário</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedRefund.reason}</p>
                </div>
              )}

              {selectedRefund.refundedViaProvider && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-700">
                    Reembolso processado automaticamente via provedor de pagamento
                  </p>
                </div>
              )}

              {selectedRefund.paymentMethod === 'pix' && selectedRefund.status !== 'completed' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    Pagamento PIX requer processamento manual do reembolso
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Alterar status</Label>
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
                <Label htmlFor="admin-notes">Notas do admin</Label>
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
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
