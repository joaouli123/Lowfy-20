import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShoppingCart, ChevronLeft, ChevronRight, RefreshCw, Mail, Clock,
  AlertTriangle, Copy, MessageSquare, Check, MoreHorizontal,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCheckoutUrl } from "@shared/domainConfig";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod,
  TableCard, EmptyState, TableSkeleton, StatusBadge, formatBRL,
} from "@/components/admin";

interface AbandonedCheckout {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  plan: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  pixExpiresAt: string | null;
}

interface AbandonedCheckoutsResponse {
  checkouts: AbandonedCheckout[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function AdminCheckoutAbandonado() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [period, setPeriodState] = useState(defaultPeriod("30days"));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { startDate, endDate } = period;

  const setPeriod = (p: typeof period) => { setPeriodState(p); setPage(1); };

  const getCheckoutRecoveryUrl = (checkout: AbandonedCheckout) => {
    const params = new URLSearchParams({ plan: checkout.plan, recoveryId: checkout.id });
    return getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
  };

  const handleCopyLink = async (checkout: AbandonedCheckout) => {
    try {
      await navigator.clipboard.writeText(getCheckoutRecoveryUrl(checkout));
      setCopiedId(checkout.id);
      toast({ title: "Link copiado!", description: "Link de recuperação copiado para a área de transferência." });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Erro ao copiar", description: "Não foi possível copiar o link.", variant: "destructive" });
    }
  };

  const handleSendWhatsApp = (checkout: AbandonedCheckout) => {
    const url = getCheckoutRecoveryUrl(checkout);
    const message = encodeURIComponent(
      `Olá ${checkout.buyerName}! 👋\n\n` +
      `Notamos que você iniciou sua assinatura Lowfy mas não finalizou. ` +
      `Que tal continuar de onde parou? 🚀\n\n` +
      `👉 Clique aqui para finalizar: ${url}\n\n` +
      `Qualquer dúvida, estamos à disposição! 💚`
    );
    const phone = checkout.buyerPhone?.replace(/\D/g, '') || '';
    window.open(phone ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`, '_blank');
  };

  const handleSendEmail = (checkout: AbandonedCheckout) => {
    const url = getCheckoutRecoveryUrl(checkout);
    const subject = encodeURIComponent("Finalize sua assinatura Lowfy! 🚀");
    const body = encodeURIComponent(
      `Olá ${checkout.buyerName}!\n\n` +
      `Notamos que você iniciou sua assinatura Lowfy mas não finalizou.\n\n` +
      `Clique no link abaixo para continuar de onde parou:\n${url}\n\n` +
      `Qualquer dúvida, estamos à disposição!\n\nEquipe Lowfy`
    );
    window.open(`mailto:${checkout.buyerEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const { data, isLoading, refetch, isFetching } = useQuery<AbandonedCheckoutsResponse>({
    queryKey: ["/api/admin/checkouts-abandonados", page, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "15", startDate, endDate });
      const response = await apiRequest("GET", `/api/admin/checkouts-abandonados?${params}`);
      return response.json();
    }
  });

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try { return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return "-"; }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "awaiting_payment": return <StatusBadge tone="warning" dot>Aguardando pagamento</StatusBadge>;
      case "pending": return <StatusBadge tone="neutral" dot>Pendente</StatusBadge>;
      default: return <StatusBadge tone="neutral">{status}</StatusBadge>;
    }
  };

  const planLabel = (plan: string) => plan === "mensal" ? "Mensal" : plan === "anual" ? "Anual" : plan;
  const methodLabel = (m: string) => m === "pix" ? "PIX" : m === "credit_card" ? "Cartão" : m;

  const checkouts = data?.checkouts || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };
  const potentialRevenue = checkouts.reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Checkouts abandonados"
        description="Leads que iniciaram mas não concluíram a assinatura"
        icon={ShoppingCart}
        actions={
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} />
      </AdminPageHeader>

      <StatGrid cols={4}>
        <StatCard
          label="Abandonados no período"
          value={pagination.total}
          icon={ShoppingCart}
          tone="warning"
          colorValue
          loading={isLoading}
          testId="stat-total"
        />
        <StatCard
          label="Receita potencial (página)"
          value={formatBRL(potentialRevenue)}
          icon={AlertTriangle}
          tone="violet"
          hint="soma dos itens exibidos"
          loading={isLoading}
        />
        <StatCard
          label="Via PIX (página)"
          value={checkouts.filter(c => c.paymentMethod === "pix").length}
          icon={Clock}
          tone="info"
          loading={isLoading}
          testId="stat-pix"
        />
        <StatCard
          label="Via cartão (página)"
          value={checkouts.filter(c => c.paymentMethod === "credit_card").length}
          icon={AlertTriangle}
          loading={isLoading}
          testId="stat-card"
        />
      </StatGrid>

      <TableCard
        title="Contatos para recuperação"
        count={pagination.total}
        footer={
          checkouts.length > 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {checkouts.length} de {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <span className="text-sm px-2 tabular-nums" data-testid="pagination-info">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} data-testid="button-next-page">
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {isLoading ? (
          <TableSkeleton />
        ) : checkouts.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum checkout abandonado"
            description="Nenhum lead abandonou o checkout no período selecionado."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkouts.map((checkout) => (
                <TableRow key={checkout.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums" data-testid={`checkout-date-${checkout.id}`}>
                    {formatDateTime(checkout.createdAt)}
                  </TableCell>
                  <TableCell data-testid={`checkout-name-${checkout.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[220px]">{checkout.buyerName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <a href={`mailto:${checkout.buyerEmail}`} className="hover:text-foreground hover:underline truncate max-w-[200px]" data-testid={`checkout-email-${checkout.id}`}>
                          {checkout.buyerEmail}
                        </a>
                        {checkout.buyerPhone && (
                          <a
                            href={`https://wa.me/55${checkout.buyerPhone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline whitespace-nowrap"
                            data-testid={`checkout-phone-${checkout.id}`}
                          >
                            {checkout.buyerPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`checkout-plan-${checkout.id}`}>
                    <Badge variant="outline">{planLabel(checkout.plan)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums" data-testid={`checkout-amount-${checkout.id}`}>
                    {formatBRL(checkout.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`checkout-method-${checkout.id}`}>
                    {methodLabel(checkout.paymentMethod)}
                  </TableCell>
                  <TableCell data-testid={`checkout-status-${checkout.id}`}>
                    {statusBadge(checkout.status)}
                  </TableCell>
                  <TableCell className="text-right pr-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`actions-${checkout.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleCopyLink(checkout)} data-testid={`copy-link-${checkout.id}`}>
                          {copiedId === checkout.id ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2" />}
                          {copiedId === checkout.id ? "Copiado!" : "Copiar link"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSendWhatsApp(checkout)} className="text-emerald-600" data-testid={`whatsapp-${checkout.id}`}>
                          <MessageSquare className="w-4 h-4 mr-2" /> Enviar WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(checkout)} className="text-sky-600" data-testid={`email-${checkout.id}`}>
                          <Mail className="w-4 h-4 mr-2" /> Enviar e-mail
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </AdminPage>
  );
}
