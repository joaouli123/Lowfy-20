import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Wallet,
  ArrowUpRight,
  CreditCard,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle,
  Receipt,
  FileText,
  Settings,
  BarChart3,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { TablePagination } from "@/components/TablePagination";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SellerWallet, SellerTransaction } from "@shared/schema";

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDateTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'pending': 'Aguardando',
    'completed': 'Concluído',
    'failed': 'Recusado',
    'refunded': 'Reembolsado',
    'cancelled': 'Cancelado',
    'refund_requested': 'Reembolso Solicitado',
  };
  return labels[status] || status;
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'completed': 'default', // Verde
    'pending': 'secondary', // Amarelo/Cinza
    'failed': 'destructive', // Vermelho
    'refunded': 'destructive', // Vermelho
    'cancelled': 'outline', // Cinza outline
    'refund_requested': 'outline',
  };
  return variants[status] || 'secondary';
};

const ITEMS_PER_PAGE = 15;

export default function Financeiro() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [pixFormData, setPixFormData] = useState({ pixKey: "", pixKeyType: "" });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  
  const [salesPage, setSalesPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);

  const { data: wallet } = useQuery<SellerWallet>({
    queryKey: ["/api/marketplace/wallet"],
  });

  const { data: availableBalance } = useQuery<{
    balancePending: number;
    balanceAvailable: number;
    pixKey?: string;
    pixKeyType?: string;
  }>({
    queryKey: ["/api/marketplace/available-balance"],
  });

  const { data: transactions } = useQuery<SellerTransaction[]>({
    queryKey: ["/api/marketplace/transactions"],
  });

  const { data: withdrawals } = useQuery<any[]>({
    queryKey: ["/api/marketplace/withdrawals"],
  });

  const pixMutation = useMutation({
    mutationFn: async (data: { pixKey: string; pixKeyType: string }) => {
      return await apiRequest("PUT", "/api/marketplace/pix-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/available-balance"] });
      toast({
        title: "PIX configurado!",
        description: "Sua chave PIX foi salva com sucesso.",
      });
      setIsPixDialogOpen(false);
      setPixFormData({ pixKey: "", pixKeyType: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao configurar PIX",
        description: error.message || "Não foi possível configurar a chave PIX.",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amountCents: number) => {
      return await apiRequest("POST", "/api/marketplace/request-withdrawal", { amountCents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/available-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/withdrawals"] });
      toast({
        title: "Saque solicitado!",
        description: "Seu saque via PIX será processado em breve.",
      });
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar saque",
        description: error.message || "Não foi possível solicitar o saque.",
        variant: "destructive",
      });
    },
  });

  const handlePixSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixFormData.pixKey || !pixFormData.pixKeyType) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a chave e o tipo de PIX.",
        variant: "destructive",
      });
      return;
    }
    pixMutation.mutate(pixFormData);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (amountInCents < 1000) {
      toast({
        title: "Valor mínimo",
        description: "O valor mínimo para saque é R$ 10,00. A taxa de R$ 2,49 será descontada desse valor.",
        variant: "destructive",
      });
      return;
    }
    const currentBalance = availableBalance?.balanceAvailable || wallet?.balanceAvailable || 0;
    if (amountInCents > currentBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não tem saldo disponível suficiente para este saque.",
        variant: "destructive",
      });
      return;
    }
    if (!availableBalance?.pixKey && !wallet?.pixKey) {
      toast({
        title: "Configure sua chave PIX",
        description: "Você precisa configurar uma chave PIX antes de solicitar um saque.",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate(amountInCents);
  };

  const salesTransactions = useMemo(() => {
    return transactions?.filter((t: SellerTransaction) => {
      if (t.type !== "sale") return false;

      const transactionDate = new Date(t.createdAt);
      const now = new Date();

      if (dateFilter === "today") {
        const startDate = startOfDay(now);
        const endDate = endOfDay(now);
        if (transactionDate < startDate || transactionDate > endDate) return false;
      } else if (dateFilter === "7days") {
        const startDate = startOfDay(subDays(now, 7));
        const endDate = endOfDay(now);
        if (transactionDate < startDate || transactionDate > endDate) return false;
      } else if (dateFilter === "30days") {
        const startDate = startOfDay(subDays(now, 30));
        const endDate = endOfDay(now);
        if (transactionDate < startDate || transactionDate > endDate) return false;
      } else if (dateFilter === "custom") {
        if (customStartDate) {
          const startDate = startOfDay(customStartDate);
          if (transactionDate < startDate) return false;
        }
        if (customEndDate) {
          const endDate = endOfDay(customEndDate);
          if (transactionDate > endDate) return false;
        }
      }

      return true;
    }) || [];
  }, [transactions, dateFilter, customStartDate, customEndDate]);

  const refundTransactions = useMemo(() => {
    return transactions?.filter((t) => t.type === "refund") || [];
  }, [transactions]);

  const withdrawalTransactions = useMemo(() => {
    return transactions?.filter((t) => t.type === "withdrawal") || [];
  }, [transactions]);

  const paginatedSalesTransactions = useMemo(() => {
    const start = (salesPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return salesTransactions.slice(start, end);
  }, [salesTransactions, salesPage]);

  const paginatedRefundTransactions = useMemo(() => {
    const start = (refundsPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return refundTransactions.slice(start, end);
  }, [refundTransactions, refundsPage]);

  const paginatedWithdrawalTransactions = useMemo(() => {
    const start = (withdrawalsPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return withdrawalTransactions.slice(start, end);
  }, [withdrawalTransactions, withdrawalsPage]);

  const salesTotalPages = Math.ceil(salesTransactions.length / ITEMS_PER_PAGE);
  const refundsTotalPages = Math.ceil(refundTransactions.length / ITEMS_PER_PAGE);
  const withdrawalsTotalPages = Math.ceil(withdrawalTransactions.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Financeiro</h1>
          <p className="text-muted-foreground">Gerencie seus ganhos e saques</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="gap-2" data-testid="tab-fees">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Taxas</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2" data-testid="tab-sales">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2" data-testid="tab-refunds">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Reembolsos</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2" data-testid="tab-payment">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Recebimento</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2" data-testid="tab-reports">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA: VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Saldo Bloqueado (8 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold" data-testid="balance-pending">
                      {formatCurrency(availableBalance?.balancePending || wallet?.balancePending || 0)}
                    </p>
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Liberado em até 8 dias após venda
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Saldo Disponível para Saque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-green-600" data-testid="balance-available">
                      {formatCurrency(availableBalance?.balanceAvailable || wallet?.balanceAvailable || 0)}
                    </p>
                    <Wallet className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    Pronto para saque via PIX
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Ganho
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold">
                      {formatCurrency(wallet?.totalEarned || 0)}
                    </p>
                    <TrendingUp className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Sacado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold">
                      {formatCurrency(wallet?.totalWithdrawn || 0)}
                    </p>
                    <ArrowUpRight className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPixFormData({
                        pixKey: wallet?.pixKey || "",
                        pixKeyType: wallet?.pixKeyType || "",
                      });
                      setIsPixDialogOpen(true);
                    }}
                    data-testid="button-configure-pix"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {wallet?.pixKey ? "Atualizar PIX" : "Configurar PIX"}
                  </Button>
                  <Button
                    onClick={() => setIsWithdrawDialogOpen(true)}
                    disabled={
                      (!availableBalance?.pixKey && !wallet?.pixKey) || 
                      ((availableBalance?.balanceAvailable || wallet?.balanceAvailable || 0) < 1000)
                    }
                    data-testid="button-request-withdrawal"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Solicitar Saque
                  </Button>
                </div>

                {wallet?.pixKey && (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 rounded-md" data-testid="pix-configured-indicator">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      PIX configurado: {wallet.pixKeyType && `${PIX_KEY_TYPES.find(t => t.value === wallet.pixKeyType)?.label} - `}
                      <span className="font-semibold">{wallet.pixKey}</span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: TAXAS */}
          <TabsContent value="fees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Informações de Taxas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  As taxas são cobradas automaticamente em cada venda realizada.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48">
                        <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76        l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"></path>
                        <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76        l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"></path>
                        <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0        l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17     l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26        C46.65,21.88,46.65,26.12,44.04,28.74z"></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">PIX</p>
                      <p className="text-2xl font-bold text-primary mb-2">R$ 2,49 + 2,99%</p>
                      <p className="text-sm text-muted-foreground">Taxa fixa + percentual por venda via PIX</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">Cartão de Crédito</p>
                      <p className="text-2xl font-bold text-primary mb-2">R$ 2,49 + 6,99%</p>
                      <p className="text-sm text-muted-foreground">Taxa fixa + percentual por venda com cartão</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Exemplo de Cálculo:</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>• Venda de R$ 100,00 via PIX: Taxa de R$ 5,48 = Você recebe R$ 94,52</p>
                    <p>• Venda de R$ 100,00 via Cartão: Taxa de R$ 9,48 = Você recebe R$ 90,52</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Saldo Bloqueado</h4>
                  <p className="text-sm text-muted-foreground">
                    Por segurança, o saldo de cada venda fica bloqueado por 8 dias antes de estar disponível para saque. 
                    Isso garante tempo suficiente para processar possíveis reembolsos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: VENDAS */}
          <TabsContent value="sales" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 space-y-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Filter className="h-4 w-4" />
                    Filtrar por período
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'today', label: 'Hoje' },
                      { value: '7days', label: 'Últimos 7 dias' },
                      { value: '30days', label: 'Últimos 30 dias' },
                      { value: 'custom', label: 'Período personalizado' }
                    ].map((period) => (
                      <Button
                        key={period.value}
                        variant={dateFilter === period.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateFilter(period.value)}
                      >
                        {period.label}
                      </Button>
                    ))}
                  </div>

                  {dateFilter === "custom" && (
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <Label className="mb-2 block">Data inicial</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="button-select-start-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customStartDate}
                              onSelect={(date) => {
                                setCustomStartDate(date);
                                if (date && customEndDate && date > customEndDate) {
                                  setCustomEndDate(undefined);
                                }
                              }}
                              initialFocus
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <Label className="mb-2 block">Data final</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="button-select-end-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customEndDate}
                              onSelect={setCustomEndDate}
                              initialFocus
                              locale={ptBR}
                              disabled={(date) => customStartDate ? date < customStartDate : false}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  {salesTransactions.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Taxas</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedSalesTransactions.map((transaction: SellerTransaction) => {
                            const grossAmount = transaction.grossAmountCents ?? transaction.amount;
                            const systemFee = transaction.systemFeeCents ?? 0;
                            const cleanDescription = transaction.description?.replace(/^Venda do produto:\s*/i, '') || "-";
                            
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell className="whitespace-nowrap">{formatDateTime(transaction.createdAt)}</TableCell>
                                <TableCell className="max-w-xs truncate">
                                  {cleanDescription}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(grossAmount)}
                                </TableCell>
                                <TableCell className="text-red-600">
                                  -{formatCurrency(systemFee)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getStatusVariant(transaction.status)}>
                                    {getStatusLabel(transaction.status)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {((salesPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(salesPage * ITEMS_PER_PAGE, salesTransactions.length)} de {salesTransactions.length} vendas
                        </p>
                        <TablePagination
                          currentPage={salesPage}
                          totalPages={salesTotalPages}
                          onPageChange={setSalesPage}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhuma venda encontrada neste período
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: REEMBOLSOS */}
          <TabsContent value="refunds" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Reembolso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {refundTransactions.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRefundTransactions.map((transaction: SellerTransaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.description || "Reembolso automático"}
                              </TableCell>
                              <TableCell className="font-semibold text-red-600">
                                -{formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(transaction.status)}>
                                  {getStatusLabel(transaction.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {((refundsPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(refundsPage * ITEMS_PER_PAGE, refundTransactions.length)} de {refundTransactions.length} reembolsos
                        </p>
                        <TablePagination
                          currentPage={refundsPage}
                          totalPages={refundsTotalPages}
                          onPageChange={setRefundsPage}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum reembolso encontrado
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2">Sobre os Reembolsos</h4>
                  <p className="text-sm text-muted-foreground">
                    Os compradores têm até 7 dias para solicitar reembolso. Quando um reembolso é aprovado, 
                    o valor é automaticamente descontado do seu saldo disponível ou bloqueado.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: RECEBIMENTO */}
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Recebimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Chave PIX</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure sua chave PIX para receber os saques. Os saques são processados em até 2 dias úteis.
                  </p>
                  
                  {wallet?.pixKey ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 rounded-md">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">PIX Configurado</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {PIX_KEY_TYPES.find(t => t.value === wallet.pixKeyType)?.label}: {wallet.pixKey}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPixFormData({
                            pixKey: wallet?.pixKey || "",
                            pixKeyType: wallet?.pixKeyType || "",
                          });
                          setIsPixDialogOpen(true);
                        }}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Atualizar Chave PIX
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setIsPixDialogOpen(true)}
                      data-testid="button-configure-pix-initial"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Configurar Chave PIX
                    </Button>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-2">Regras de Saque</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Valor mínimo para saque: R$ 10,00</p>
                    <p>• Taxa de saque: R$ 2,49 (descontada do valor solicitado)</p>
                    <p>• Prazo de processamento: Imediato</p>
                    <p>• Sem limite diário de saque</p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Histórico de Saques</h3>
                  {withdrawalTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedWithdrawalTransactions.map((transaction: SellerTransaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                              <TableCell className="font-semibold text-red-600">
                                -{formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    transaction.status === "completed"
                                      ? "default"
                                      : transaction.status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {transaction.status === "pending" && "Pendente"}
                                  {transaction.status === "completed" && "Concluído"}
                                  {transaction.status === "failed" && "Falhou"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {((withdrawalsPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(withdrawalsPage * ITEMS_PER_PAGE, withdrawalTransactions.length)} de {withdrawalTransactions.length} saques
                        </p>
                        <TablePagination
                          currentPage={withdrawalsPage}
                          totalPages={withdrawalsTotalPages}
                          onPageChange={setWithdrawalsPage}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum saque realizado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: RELATÓRIOS */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios e Análises</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Vendas</p>
                    <p className="text-2xl font-bold">
                      {salesTransactions.length}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Reembolsos</p>
                    <p className="text-2xl font-bold text-red-600">
                      {refundTransactions.length}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Saques</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {withdrawalTransactions.length}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Filtrar Relatórios</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'today', label: 'Hoje' },
                        { value: '7days', label: 'Últimos 7 dias' },
                        { value: '30days', label: 'Últimos 30 dias' },
                        { value: 'custom', label: 'Período personalizado' }
                      ].map((period) => (
                        <Button
                          key={period.value}
                          variant={dateFilter === period.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDateFilter(period.value)}
                        >
                          {period.label}
                        </Button>
                      ))}
                    </div>

                    {dateFilter === "custom" && (
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Label className="mb-2 block">Data inicial</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={customStartDate}
                                onSelect={setCustomStartDate}
                                initialFocus
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1">
                          <Label className="mb-2 block">Data final</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={customEndDate}
                                onSelect={setCustomEndDate}
                                initialFocus
                                locale={ptBR}
                                disabled={(date) => customStartDate ? date < customStartDate : false}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Resumo Financeiro</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm">Receita Total (Vendas)</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(salesTransactions.reduce((sum, t) => sum + t.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm">Reembolsos Totais</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(refundTransactions.reduce((sum, t) => sum + t.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm">Saques Realizados</span>
                      <span className="font-semibold text-purple-600">
                        -{formatCurrency(withdrawalTransactions.reduce((sum, t) => sum + t.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                      <span className="font-semibold">Saldo Líquido</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(
                          salesTransactions.reduce((sum, t) => sum + t.amount, 0) -
                          refundTransactions.reduce((sum, t) => sum + t.amount, 0) -
                          withdrawalTransactions.reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar PIX</DialogTitle>
              <DialogDescription>
                Informe sua chave PIX para receber os pagamentos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePixSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="pixKeyType">Tipo de Chave</Label>
                  <Select
                    value={pixFormData.pixKeyType}
                    onValueChange={(value) =>
                      setPixFormData({ ...pixFormData, pixKeyType: value })
                    }
                  >
                    <SelectTrigger data-testid="select-pix-type">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pixKey">Chave PIX</Label>
                  <Input
                    id="pixKey"
                    value={pixFormData.pixKey}
                    onChange={(e) =>
                      setPixFormData({ ...pixFormData, pixKey: e.target.value })
                    }
                    placeholder="Digite sua chave PIX"
                    required
                    data-testid="input-pix-key"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPixDialogOpen(false)} data-testid="button-cancel-pix">
                  Cancelar
                </Button>
                <Button type="submit" disabled={pixMutation.isPending} data-testid="button-confirm-pix">
                  {pixMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Saque</DialogTitle>
              <DialogDescription>
                Informe o valor que deseja sacar. Mínimo: R$ 10,00. A taxa de R$ 2,49 será descontada deste valor.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleWithdrawSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="10"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0,00"
                    required
                    data-testid="input-withdraw-amount"
                  />
                  <p className="text-sm text-muted-foreground">
                    Saldo disponível: {formatCurrency(wallet?.balanceAvailable || 0)}
                  </p>
                  {withdrawAmount && !isNaN(parseFloat(withdrawAmount)) && parseFloat(withdrawAmount) >= 10 && (
                    <div className="mt-3 p-3 bg-muted rounded-md space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span>Valor solicitado:</span>
                        <span className="font-medium">{formatCurrency(Math.round(parseFloat(withdrawAmount) * 100))}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Taxa de saque:</span>
                        <span>- R$ 2,49</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-1.5">
                        <span>Você receberá:</span>
                        <span className="text-green-600">{formatCurrency(Math.max(0, Math.round((parseFloat(withdrawAmount) * 100) - 249)))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsWithdrawDialogOpen(false)} data-testid="button-cancel-withdraw">
                  Cancelar
                </Button>
                <Button type="submit" disabled={withdrawMutation.isPending} data-testid="button-confirm-withdraw">
                  {withdrawMutation.isPending ? "Processando..." : "Solicitar Saque"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
