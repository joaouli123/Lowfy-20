import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Users, Copy, Check, TrendingUp, DollarSign, 
  Clock, Share2, Eye, UserCheck, AlertCircle, 
  CreditCard, CheckCircle, Settings, Wallet,
  XCircle, RefreshCw, UserX, ArrowUpRight, Percent,
  Filter, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ReferralCode, ReferralWallet, ReferralCommissionWithRelations } from "@shared/schema";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { TablePagination } from "@/components/TablePagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function normalizeAmount(value: string): number {
  const trimmed = value.trim();
  if (trimmed.includes(',')) {
    const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
  }
  return parseFloat(trimmed);
}

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const pixConfigSchema = z.object({
  pixKeyType: z.string().min(1, "Selecione o tipo de chave PIX"),
  pixKey: z.string().min(1, "Digite sua chave PIX"),
});

type PixConfigFormData = z.infer<typeof pixConfigSchema>;

const withdrawalSchema = z.object({
  amount: z.string()
    .min(1, "Digite o valor do saque")
    .refine((val) => {
      const normalized = normalizeAmount(val);
      return !isNaN(normalized) && normalized >= 10;
    }, "O valor mínimo para saque é R$ 10,00"),
});

type WithdrawalFormData = z.infer<typeof withdrawalSchema>;

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDateTime = (date: Date | string) => {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const formatDate = (date: Date | string) => {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'pending': 'Bloqueado (8 dias)',
    'active': 'Ativo',
    'canceled': 'Cancelado',
    'cancelled': 'Cancelado',
    'refunded': 'Reembolsado',
    'completed': 'Disponível',
  };
  return labels[status] || status;
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'completed': 'default',
    'active': 'default',
    'pending': 'secondary',
    'canceled': 'destructive',
    'cancelled': 'destructive',
    'refunded': 'destructive',
  };
  return variants[status] || 'secondary';
};

const ITEMS_PER_PAGE = 15;

interface CompleteStats {
  overview: {
    totalClicks: number;
    totalConversions: number;
    conversionRate: string;
    totalReferredUsers: number;
  };
  financial: {
    totalEarned: number;
    totalRefunded: number;
    totalWithdrawn: number;
    balancePending: number;
    balanceAvailable: number;
    netEarnings: number;
  };
  referrals: {
    active: number;
    pending: number;
    cancelled: number;
    refunded: number;
  };
  commissionsByStatus: {
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
    refunded: number;
  };
}

interface ReferredUser {
  referredUser: {
    id: string;
    name: string;
    email: string;
    profileImageUrl?: string;
  };
  subscriptionStatus: string;
  totalCommissions: number;
  activeCommissions: number;
  createdAt: string;
  lastCommissionAt: string | null;
}

interface ReferredUsersData {
  users: ReferredUser[];
  total: number;
  byStatus: {
    active: number;
    pending: number;
    cancelled: number;
    refunded: number;
  };
}

type DateFilterOption = "all" | "today" | "7days" | "30days";

const getDateRange = (filter: DateFilterOption): { startDate?: string; endDate?: string } => {
  if (filter === "all") {
    return {};
  }
  
  const today = format(new Date(), "yyyy-MM-dd");
  
  switch (filter) {
    case "today":
      return {
        startDate: today,
        endDate: today,
      };
    case "7days":
      return {
        startDate: format(subDays(new Date(), 6), "yyyy-MM-dd"),
        endDate: today,
      };
    case "30days":
      return {
        startDate: format(subDays(new Date(), 29), "yyyy-MM-dd"),
        endDate: today,
      };
    default:
      return {};
  }
};

export default function Referrals() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [referredUsersPage, setReferredUsersPage] = useState(1);
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");

  const pixForm = useForm<PixConfigFormData>({
    resolver: zodResolver(pixConfigSchema),
    defaultValues: {
      pixKeyType: "",
      pixKey: "",
    },
  });

  const withdrawForm = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: "",
    },
  });

  const { data: referralData } = useQuery<ReferralCode & { referralLink: string }>({
    queryKey: ["/api/referrals/my-code"],
  });

  const { data: completeStats, isLoading: statsLoading } = useQuery<CompleteStats>({
    queryKey: ["/api/referrals/complete-stats"],
  });

  const { data: balance } = useQuery<{
    balancePending: number;
    balanceAvailable: number;
    pixKey?: string;
    pixKeyType?: string;
  }>({
    queryKey: ["/api/referrals/balance"],
  });

  const dateRange = getDateRange(dateFilter);
  
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const { data: commissionsData, isLoading: commissionsLoading } = useQuery<{
    commissions: ReferralCommissionWithRelations[];
    total: number;
  }>({
    queryKey: ["/api/referrals/commissions", { limit: ITEMS_PER_PAGE, offset, ...dateRange }],
  });

  const referredUsersOffset = (referredUsersPage - 1) * ITEMS_PER_PAGE;
  const { data: referredUsersData, isLoading: referredUsersLoading } = useQuery<ReferredUsersData>({
    queryKey: ["/api/referrals/referred-users", { limit: ITEMS_PER_PAGE, offset: referredUsersOffset, status: statusFilter !== 'all' ? statusFilter : undefined, ...dateRange }],
  });

  const { data: withdrawals } = useQuery<any[]>({
    queryKey: ["/api/referrals/withdrawals", { ...dateRange }],
  });

  const commissions = commissionsData?.commissions || [];
  const totalCommissions = commissionsData?.total || 0;
  const totalPages = Math.ceil(totalCommissions / ITEMS_PER_PAGE);
  const withdrawalsList = withdrawals || [];
  const withdrawalsTotalPages = Math.ceil(withdrawalsList.length / ITEMS_PER_PAGE);
  const paginatedWithdrawals = withdrawalsList.slice(
    (withdrawalsPage - 1) * ITEMS_PER_PAGE,
    withdrawalsPage * ITEMS_PER_PAGE
  );
  const referredUsers = referredUsersData?.users || [];
  const referredUsersTotalPages = Math.ceil((referredUsersData?.total || 0) / ITEMS_PER_PAGE);

  const pixMutation = useMutation({
    mutationFn: async (data: { pixKey: string; pixKeyType: string }) => {
      return await apiRequest("PUT", "/api/referrals/pix-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/balance"] });
      toast({
        title: "PIX de Comissões configurado!",
        description: "Sua chave PIX para receber comissões foi salva com sucesso.",
      });
      setIsPixDialogOpen(false);
      pixForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao configurar PIX",
        description: error.message || "Não foi possível configurar a chave PIX de comissões.",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amountCents: number) => {
      return await apiRequest("POST", "/api/referrals/request-withdrawal", { amountCents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/complete-stats"] });
      toast({
        title: "Saque de Comissões solicitado!",
        description: "Seu saque de comissões via PIX será processado em breve.",
      });
      setIsWithdrawDialogOpen(false);
      withdrawForm.reset();
    },
    onError: (error: any) => {
      // Check if it's a service unavailable error
      const isServiceUnavailable = error.response?.status === 503 || 
                                   error.response?.data?.code === 'SERVICE_TEMPORARILY_UNAVAILABLE';
      
      if (isServiceUnavailable) {
        toast({
          title: "⚠️ Instabilidade Temporária",
          description: "Estamos com uma instabilidade temporária no processamento de saques. Por favor, tente novamente em alguns minutos.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao solicitar saque",
          description: error.message || "Não foi possível solicitar o saque de comissões.",
          variant: "destructive",
        });
      }
    },
  });

  const copyToClipboard = () => {
    if (referralData?.referralLink) {
      navigator.clipboard.writeText(referralData.referralLink);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link de indicação foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePixSubmit = (data: PixConfigFormData) => {
    pixMutation.mutate(data);
  };

  const handleWithdrawSubmit = (data: WithdrawalFormData) => {
    const amountInCents = Math.round(normalizeAmount(data.amount) * 100);
    const currentBalance = balance?.balanceAvailable || 0;
    if (amountInCents > currentBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não tem saldo disponível suficiente para este saque de comissões.",
        variant: "destructive",
      });
      return;
    }
    if (!balance?.pixKey) {
      toast({
        title: "Configure sua chave PIX",
        description: "Você precisa configurar uma chave PIX para comissões antes de solicitar um saque.",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate(amountInCents);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="page-title">
          Sistema de Indicações
        </h1>
        <p className="text-muted-foreground">
          Compartilhe seu link e ganhe 50% de comissão recorrente nas assinaturas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-4 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
          <TabsTrigger value="referrals" className="text-xs sm:text-sm">Indicados</TabsTrigger>
          <TabsTrigger value="commissions" className="text-xs sm:text-sm">Comissões</TabsTrigger>
          <TabsTrigger value="withdrawals" className="text-xs sm:text-sm">Saques</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card data-testid="card-referral-link">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Seu Link de Indicação
              </CardTitle>
              <CardDescription>
                Compartilhe este link para ganhar comissão em cada assinatura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={referralData?.referralLink || "Carregando..."}
                  readOnly
                  className="font-mono text-xs sm:text-sm"
                  data-testid="input-referral-link"
                />
                <Button 
                  onClick={copyToClipboard} 
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-2">Copiar</span>
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-1">Como funciona:</p>
                    <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 text-xs leading-relaxed">
                      <li>Compartilhe seu link com outras pessoas</li>
                      <li>Quando alguém assinar usando seu link, você ganha 50% do valor da assinatura</li>
                      <li>A comissão é <strong>recorrente</strong>: você continua recebendo 50% a cada renovação</li>
                      <li>O saldo fica bloqueado por 8 dias (lei de reembolso), depois fica disponível para saque</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card data-testid="card-total-clicks">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Total de Cliques
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-xl sm:text-2xl font-bold" data-testid="text-total-clicks">
                        {completeStats?.overview.totalClicks || 0}
                      </p>
                      <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-conversions">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Conversões
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xl sm:text-2xl font-bold text-green-600" data-testid="text-conversions">
                          {completeStats?.overview.totalConversions || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Taxa: {completeStats?.overview.conversionRate || '0.00'}%
                        </p>
                      </div>
                      <Percent className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-balance-pending">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                      Saldo a Liberar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm sm:text-2xl font-bold text-yellow-600" data-testid="text-balance-pending">
                        {formatCurrency(completeStats?.financial.balancePending || 0)}
                      </p>
                      <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                    </div>
                    <p className="text-xs text-yellow-600 mt-1 hidden sm:block">
                      8 dias de reembolso
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-balance-available">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                      Disponível para Saque
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm sm:text-2xl font-bold text-green-600" data-testid="text-balance-available">
                        {formatCurrency(completeStats?.financial.balanceAvailable || 0)}
                      </p>
                      <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                    </div>
                    {(completeStats?.financial.balanceAvailable || 0) >= 1000 && balance?.pixKey ? (
                      <Button
                        onClick={() => setIsWithdrawDialogOpen(true)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        data-testid="button-quick-withdraw"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Sacar Agora
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                        <UserCheck className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                        <p className="text-xl font-bold text-green-600" data-testid="text-active-referrals">
                          {completeStats?.referrals.active || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Aguardando Liberação</p>
                        <p className="text-xl font-bold text-yellow-600" data-testid="text-pending-referrals">
                          {completeStats?.referrals.pending || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                        <UserX className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cancelados</p>
                        <p className="text-xl font-bold text-red-600" data-testid="text-cancelled-referrals">
                          {completeStats?.referrals.cancelled || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                        <RefreshCw className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reembolsados</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-refunded-referrals">
                          {completeStats?.referrals.refunded || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-financial-summary">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Ganho (Bruto)</p>
                      <p className="text-lg sm:text-xl font-bold" data-testid="text-total-earned">
                        {formatCurrency(completeStats?.financial.totalEarned || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Estornado</p>
                      <p className="text-lg sm:text-xl font-bold text-red-600" data-testid="text-total-refunded">
                        {formatCurrency(completeStats?.financial.totalRefunded || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Líquido</p>
                      <p className="text-lg sm:text-xl font-bold text-blue-600" data-testid="text-total-net">
                        {formatCurrency(completeStats?.financial.netEarnings || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Sacado</p>
                      <p className="text-lg sm:text-xl font-bold text-purple-600" data-testid="text-total-withdrawn">
                        {formatCurrency(completeStats?.financial.totalWithdrawn || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">Saldo Atual</p>
                      <p className="text-lg sm:text-xl font-bold text-green-600" data-testid="text-current-balance">
                        {formatCurrency((completeStats?.financial.balancePending || 0) + (completeStats?.financial.balanceAvailable || 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card data-testid="card-withdrawal-management">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                Gerenciamento de Saques
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Configure sua chave PIX e solicite saques das suas comissões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    pixForm.reset({
                      pixKey: balance?.pixKey || "",
                      pixKeyType: balance?.pixKeyType || "",
                    });
                    setIsPixDialogOpen(true);
                  }}
                  data-testid="button-configure-pix"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {balance?.pixKey ? "Atualizar PIX" : "Configurar PIX"}
                </Button>
                <Button
                  onClick={() => setIsWithdrawDialogOpen(true)}
                  disabled={!balance?.pixKey || ((balance?.balanceAvailable || 0) < 1000)}
                  data-testid="button-request-withdrawal"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Solicitar Saque
                </Button>
              </div>

              {/* Aviso de Taxas e Mínimo */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-3 sm:px-4 sm:py-4 rounded-md">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Taxa de Saque</p>
                  <p className="text-sm sm:text-base font-bold text-blue-700 dark:text-blue-300">R$ 2,49</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Mínimo para Saque</p>
                  <p className="text-sm sm:text-base font-bold text-blue-700 dark:text-blue-300">R$ 10,00</p>
                </div>
              </div>

              {balance?.pixKey ? (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2 sm:px-4 sm:py-3 rounded-md" data-testid="pix-configured-indicator">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">
                    PIX configurado: {balance.pixKeyType && `${PIX_KEY_TYPES.find(t => t.value === balance.pixKeyType)?.label} - `}
                    <span className="font-semibold break-all">{balance.pixKey}</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-3 py-2 sm:px-4 sm:py-3 rounded-md">
                  <Settings className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                    Configure sua chave PIX para receber as comissões de indicação
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Período:</span>
            </div>
            <Select 
              value={dateFilter} 
              onValueChange={(value: DateFilterOption) => {
                setDateFilter(value);
                setReferredUsersPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-date-filter-referrals">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card data-testid="card-referred-users">
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    Usuários Indicados
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Acompanhe o status de todos os usuários que você indicou
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setReferredUsersPage(1); }}>
                    <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                      <SelectItem value="refunded">Reembolsados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {referredUsersData?.byStatus && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 rounded-md bg-green-50 dark:bg-green-950">
                    <p className="text-xl font-bold text-green-600">{referredUsersData.byStatus.active}</p>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-yellow-50 dark:bg-yellow-950">
                    <p className="text-xl font-bold text-yellow-600">{referredUsersData.byStatus.pending}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-red-50 dark:bg-red-950">
                    <p className="text-xl font-bold text-red-600">{referredUsersData.byStatus.cancelled}</p>
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-orange-50 dark:bg-orange-950">
                    <p className="text-xl font-bold text-orange-600">{referredUsersData.byStatus.refunded}</p>
                    <p className="text-xs text-muted-foreground">Reembolsados</p>
                  </div>
                </div>
              )}

              {referredUsersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : referredUsers.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {statusFilter !== 'all' 
                      ? `Nenhum indicado com status "${getStatusLabel(statusFilter)}" encontrado.`
                      : "Você ainda não indicou ninguém. Compartilhe seu link!"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Usuário</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Total Comissões</TableHead>
                          <TableHead className="text-xs">Data Indicação</TableHead>
                          <TableHead className="text-xs">Última Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referredUsers.map((item) => (
                          <TableRow key={item.referredUser.id} data-testid={`row-referred-user-${item.referredUser.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={item.referredUser.profileImageUrl} />
                                  <AvatarFallback className="text-xs">
                                    {item.referredUser.name?.slice(0, 2).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{item.referredUser.name}</p>
                                  <p className="text-xs text-muted-foreground hidden sm:block">{item.referredUser.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(item.subscriptionStatus)} className="text-xs">
                                {getStatusLabel(item.subscriptionStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-green-600 text-xs sm:text-sm">
                              {formatCurrency(item.totalCommissions)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {item.lastCommissionAt ? formatDate(item.lastCommissionAt) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {referredUsersTotalPages > 1 && (
                    <div className="mt-4">
                      <TablePagination
                        currentPage={referredUsersPage}
                        totalPages={referredUsersTotalPages}
                        onPageChange={setReferredUsersPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Período:</span>
            </div>
            <Select 
              value={dateFilter} 
              onValueChange={(value: DateFilterOption) => {
                setDateFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-date-filter-commissions">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card data-testid="card-commissions-table">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                Histórico de Comissões
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Acompanhe todas as suas comissões de indicação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma comissão ainda. Comece a compartilhar seu link!
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Indicado</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Valor Retido</TableHead>
                          <TableHead className="text-xs">Disponível</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((commission) => (
                          <TableRow key={commission.id} data-testid={`row-commission-${commission.id}`}>
                            <TableCell className="text-xs sm:text-sm">
                              <div className="font-medium whitespace-nowrap">
                                {commission.referredUser?.name || 'Usuário'}
                              </div>
                              <div className="text-xs text-muted-foreground hidden sm:block">
                                {commission.referredUser?.email}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={commission.type === 'subscription' ? 'default' : 'outline'} className="text-xs">
                                {commission.type === 'subscription' ? '1ª' : 'Renov.'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-yellow-600 text-xs sm:text-sm whitespace-nowrap">
                              {commission.status === 'pending' ? formatCurrency(commission.commissionAmountCents) : 'R$ 0,00'}
                            </TableCell>
                            <TableCell className="font-bold text-green-600 text-xs sm:text-sm whitespace-nowrap">
                              {commission.status === 'completed' || commission.status === 'active' ? formatCurrency(commission.commissionAmountCents) : 'R$ 0,00'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={getStatusVariant(commission.status || 'pending')} className="text-xs">
                                {getStatusLabel(commission.status || 'pending')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {commission.createdAt && formatDateTime(commission.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4">
                      <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Período:</span>
            </div>
            <Select 
              value={dateFilter} 
              onValueChange={(value: DateFilterOption) => {
                setDateFilter(value);
                setWithdrawalsPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-date-filter-withdrawals">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card data-testid="card-withdrawals-table">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                Histórico de Saques
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Acompanhe todos os saques de comissões realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paginatedWithdrawals.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Você ainda não realizou nenhum saque.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Chave PIX</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedWithdrawals.map((withdrawal: any) => (
                          <TableRow key={withdrawal.id} data-testid={`row-withdrawal-${withdrawal.id}`}>
                            <TableCell className="font-bold text-green-600 text-xs sm:text-sm">
                              {formatCurrency(withdrawal.amountCents)}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <span className="font-mono">{withdrawal.pixKey}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={withdrawal.status === 'completed' ? 'default' : withdrawal.status === 'pending' ? 'secondary' : 'destructive'}
                                className="text-xs"
                              >
                                {withdrawal.status === 'completed' ? 'Concluído' : withdrawal.status === 'pending' ? 'Processando' : 'Falhou'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {withdrawal.createdAt && formatDateTime(withdrawal.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {withdrawalsTotalPages > 1 && (
                    <div className="mt-4">
                      <TablePagination
                        currentPage={withdrawalsPage}
                        totalPages={withdrawalsTotalPages}
                        onPageChange={setWithdrawalsPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
        <DialogContent data-testid="dialog-pix-config">
          <DialogHeader>
            <DialogTitle>Configurar Chave PIX</DialogTitle>
            <DialogDescription>
              Configure sua chave PIX para receber comissões de indicação
            </DialogDescription>
          </DialogHeader>
          <Form {...pixForm}>
            <form onSubmit={pixForm.handleSubmit(handlePixSubmit)} className="space-y-4">
              <FormField
                control={pixForm.control}
                name="pixKeyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Chave</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-pix-key-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PIX_KEY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pixForm.control}
                name="pixKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Digite sua chave PIX" data-testid="input-pix-key" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPixDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pixMutation.isPending} data-testid="button-save-pix">
                  {pixMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent data-testid="dialog-withdraw">
          <DialogHeader>
            <DialogTitle>Solicitar Saque de Comissões</DialogTitle>
            <DialogDescription>
              Saldo disponível: {formatCurrency(balance?.balanceAvailable || 0)}
              <br />
              <span className="text-xs text-muted-foreground">Taxa de saque: R$ 2,49</span>
            </DialogDescription>
          </DialogHeader>
          <Form {...withdrawForm}>
            <form onSubmit={withdrawForm.handleSubmit(handleWithdrawSubmit)} className="space-y-4">
              <FormField
                control={withdrawForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do Saque (R$)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: 50,00" data-testid="input-withdrawal-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={withdrawMutation.isPending} data-testid="button-confirm-withdrawal">
                  {withdrawMutation.isPending ? "Processando..." : "Solicitar Saque"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
