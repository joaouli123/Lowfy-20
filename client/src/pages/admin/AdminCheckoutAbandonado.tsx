import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingCart, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  AlertTriangle,
  User,
  Copy,
  Link,
  MessageSquare,
  Check,
  MoreHorizontal
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCheckoutUrl } from "@shared/domainConfig";

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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminCheckoutAbandonado() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const { toast } = useToast();
  
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [preset, setPreset] = useState("30days");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCheckoutRecoveryUrl = (checkout: AbandonedCheckout) => {
    const params = new URLSearchParams({
      plan: checkout.plan,
      recoveryId: checkout.id,
    });
    return getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
  };

  const handleCopyLink = async (checkout: AbandonedCheckout) => {
    const url = getCheckoutRecoveryUrl(checkout);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(checkout.id);
      toast({
        title: "Link copiado!",
        description: "Link de recuperação copiado para a área de transferência.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
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
    const whatsappUrl = phone 
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSendEmail = (checkout: AbandonedCheckout) => {
    const url = getCheckoutRecoveryUrl(checkout);
    const subject = encodeURIComponent("Finalize sua assinatura Lowfy! 🚀");
    const body = encodeURIComponent(
      `Olá ${checkout.buyerName}!\n\n` +
      `Notamos que você iniciou sua assinatura Lowfy mas não finalizou.\n\n` +
      `Clique no link abaixo para continuar de onde parou:\n` +
      `${url}\n\n` +
      `Qualquer dúvida, estamos à disposição!\n\n` +
      `Equipe Lowfy`
    );
    window.open(`mailto:${checkout.buyerEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const { data, isLoading, refetch } = useQuery<AbandonedCheckoutsResponse>({
    queryKey: ["/api/admin/checkouts-abandonados", page, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        startDate,
        endDate
      });
      const response = await apiRequest("GET", `/api/admin/checkouts-abandonados?${params}`);
      return response.json();
    }
  });

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
      case "3months":
        setStartDate(format(subMonths(now, 3), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "6months":
        setStartDate(format(subMonths(now, 6), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "all":
        setStartDate("2020-01-01");
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "custom":
        break;
    }
    setPage(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "awaiting_payment":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid="badge-awaiting">Aguardando Pagamento</Badge>;
      case "pending":
        return <Badge variant="secondary" data-testid="badge-pending">Pendente</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-other">{status}</Badge>;
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case "mensal":
        return "Mensal";
      case "anual":
        return "Anual";
      default:
        return plan;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "pix":
        return "PIX";
      case "credit_card":
        return "Cartão de Crédito";
      default:
        return method;
    }
  };

  const checkouts = data?.checkouts || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const stats = {
    total: pagination.total,
    pix: checkouts.filter(c => c.paymentMethod === "pix").length,
    card: checkouts.filter(c => c.paymentMethod === "credit_card").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Checkouts Abandonados</h1>
          <p className="text-muted-foreground">Leads que iniciaram mas não concluíram o checkout</p>
        </div>
        
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                <ShoppingCart className="h-6 w-6 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Abandonados</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-total">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aguardando PIX</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-pix">{stats.pix}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <AlertTriangle className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Falha no Cartão</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="stat-card">{stats.card}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtros de Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="space-y-2">
              <Label>Período Predefinido</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]" data-testid="select-preset">
                  <SelectValue placeholder="Selecione período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); setPage(1); }}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); setPage(1); }}
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Checkouts Abandonados</CardTitle>
          <CardDescription>Contatos para recuperação de vendas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : checkouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum checkout abandonado encontrado no período selecionado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkouts.map((checkout) => (
                      <TableRow key={checkout.id}>
                        <TableCell data-testid={`checkout-date-${checkout.id}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {formatDateTime(checkout.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`checkout-name-${checkout.id}`}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {checkout.buyerName}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`checkout-email-${checkout.id}`}>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <a 
                              href={`mailto:${checkout.buyerEmail}`} 
                              className="text-blue-600 hover:underline"
                            >
                              {checkout.buyerEmail}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`checkout-phone-${checkout.id}`}>
                          {checkout.buyerPhone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <a 
                                href={`https://wa.me/55${checkout.buyerPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:underline"
                              >
                                {checkout.buyerPhone}
                              </a>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell data-testid={`checkout-plan-${checkout.id}`}>
                          <Badge variant="outline">{getPlanLabel(checkout.plan)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`checkout-amount-${checkout.id}`}>
                          {formatCurrency(checkout.amount)}
                        </TableCell>
                        <TableCell data-testid={`checkout-method-${checkout.id}`}>
                          {getPaymentMethodLabel(checkout.paymentMethod)}
                        </TableCell>
                        <TableCell data-testid={`checkout-status-${checkout.id}`}>
                          {getStatusBadge(checkout.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`actions-${checkout.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => handleCopyLink(checkout)}
                                data-testid={`copy-link-${checkout.id}`}
                              >
                                {copiedId === checkout.id ? (
                                  <Check className="w-4 h-4 mr-2 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4 mr-2" />
                                )}
                                {copiedId === checkout.id ? "Copiado!" : "Copiar Link"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleSendWhatsApp(checkout)}
                                className="text-green-600"
                                data-testid={`whatsapp-${checkout.id}`}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Enviar WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleSendEmail(checkout)}
                                className="text-blue-600"
                                data-testid={`email-${checkout.id}`}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Enviar Email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {checkouts.length} de {pagination.total} checkouts abandonados
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  
                  <span className="text-sm px-4" data-testid="pagination-info">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
