import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Wallet,
  Ban,
  HelpCircle,
  QrCode,
  RefreshCw,
  AlertCircle,
  FileText,
  DollarSign,
  Loader2
} from "lucide-react";
import type { LowfySubscription, LowfySubscriptionPayment } from "@shared/schema";

const sanitizeCardNumber = (value: string): string => {
  return value.replace(/\D/g, '');
};

const sanitizeCpf = (value: string): string => {
  return value.replace(/[.\-]/g, '');
};

const sanitizePostalCode = (value: string): string => {
  return value.replace(/-/g, '');
};

const sanitizePhone = (value: string): string => {
  return value.replace(/[()\s\-]/g, '');
};

const formatCardNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const formatCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const formatPostalCode = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

const changeCardFormSchema = z.object({
  number: z.string()
    .min(1, "Número do cartão é obrigatório")
    .refine((val) => sanitizeCardNumber(val).length >= 13, {
      message: "Número do cartão deve ter pelo menos 13 dígitos",
    })
    .refine((val) => sanitizeCardNumber(val).length <= 16, {
      message: "Número do cartão deve ter no máximo 16 dígitos",
    }),
  holderName: z.string()
    .min(1, "Nome no cartão é obrigatório")
    .min(3, "Nome deve ter pelo menos 3 caracteres"),
  expiryMonth: z.string()
    .min(1, "Mês é obrigatório")
    .regex(/^(0[1-9]|1[0-2])$/, "Mês inválido (01-12)"),
  expiryYear: z.string()
    .min(1, "Ano é obrigatório")
    .regex(/^\d{2}$/, "Ano deve ter 2 dígitos"),
  cvv: z.string()
    .min(1, "CVV é obrigatório")
    .regex(/^\d{3,4}$/, "CVV deve ter 3 ou 4 dígitos"),
});

type ChangeCardFormData = z.infer<typeof changeCardFormSchema>;

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isChangePaymentModalOpen, setIsChangePaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  
  const changeCardForm = useForm<ChangeCardFormData>({
    resolver: zodResolver(changeCardFormSchema),
    defaultValues: {
      number: "",
      holderName: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
    },
  });

  const { data: subscription, isLoading } = useQuery<LowfySubscription | null>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user,
  });

  const { data: payments, isLoading: isLoadingPayments } = useQuery<LowfySubscriptionPayment[]>({
    queryKey: ["/api/user/subscription/payments"],
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason?: string) => {
      return await apiRequest("DELETE", "/api/user/subscription/cancel", reason ? { reason } : undefined);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Assinatura cancelada",
        description: data.message || "Sua assinatura foi cancelada com sucesso.",
      });
      setIsCancelModalOpen(false);
      setCancelReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar sua assinatura.",
        variant: "destructive",
      });
    },
  });

  const changePaymentMutation = useMutation({
    mutationFn: async (data: ChangeCardFormData) => {
      const cardData = {
        card: {
          number: sanitizeCardNumber(data.number),
          holderName: data.holderName,
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear,
          cvv: data.cvv,
        }
      };
      return await apiRequest("PUT", "/api/user/subscription/update-card", cardData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Cartão atualizado",
        description: data.message || "Seu cartão de crédito foi atualizado com sucesso.",
      });
      setIsChangePaymentModalOpen(false);
      changeCardForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o cartão de crédito.",
        variant: "destructive",
      });
    },
  });

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const { data: refundEligibility } = useQuery<{
    eligible: boolean;
    reason?: string;
    daysFromFirstPayment?: number;
    subscriptionId?: string;
    amountCents?: number;
    paymentMethod?: string;
  }>({
    queryKey: ["/api/user/subscription/refund/eligibility"],
    enabled: !!subscription && subscription.status === 'canceled',
  });

  const refundMutation = useMutation({
    mutationFn: async (data: { subscriptionId: string; reason?: string }) => {
      return await apiRequest("POST", "/api/user/subscription/refund", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Solicitação enviada",
        description: data.message || "Sua solicitação de reembolso foi recebida. Atualizando...",
      });
      setIsRefundModalOpen(false);
      setRefundReason("");
      
      // Recarregar a página para garantir que o status do usuário seja atualizado
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar reembolso",
        description: error.message || "Não foi possível processar sua solicitação.",
        variant: "destructive",
      });
    },
  });

  const handleRefundRequest = () => {
    if (refundEligibility?.subscriptionId) {
      refundMutation.mutate({
        subscriptionId: refundEligibility.subscriptionId,
        reason: refundReason || undefined,
      });
    }
  };

  // Mutation para reativar assinatura (apenas cartão de crédito)
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/user/subscription/reactivate', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });

      // Tratar resposta vazia ou não-JSON
      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = { message: text };
          }
        }
      }
      
      if (!response.ok) {
        // Preservar os campos extras do erro
        const error = new Error(data.message || 'Erro ao reativar') as any;
        error.requiresCheckout = data.requiresCheckout;
        error.checkoutUrl = data.checkoutUrl;
        throw error;
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Assinatura reativada!",
        description: data.message || "Sua assinatura foi reativada com sucesso.",
      });
    },
    onError: (error: any) => {
      // Se precisa ir para checkout, redireciona
      if (error.requiresCheckout || error.checkoutUrl) {
        toast({
          title: "Redirecionando para checkout",
          description: error.message || "Você será redirecionado para completar a reativação.",
        });
        window.location.href = error.checkoutUrl || '/assinatura/checkout';
      } else {
        toast({
          title: "Erro ao reativar",
          description: error.message || "Não foi possível reativar sua assinatura.",
          variant: "destructive",
        });
      }
    },
  });

  // Handler para reativação baseado no método de pagamento
  const handleReactivate = () => {
    if (!subscription) return;
    
    // Para PIX: vai direto para checkout
    if (subscription.paymentMethod === 'pix') {
      window.location.href = `/assinatura/checkout?plan=${subscription.plan}`;
      return;
    }
    
    // Para cartão: tenta reativar via API
    reactivateMutation.mutate();
  };

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amountInCents / 100);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  };

  const formatShortDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "dd/MM/yy", { locale: ptBR });
  };

  const formatFullDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "HH:mm", { locale: ptBR });
  };

  const calculateAccessValidUntil = (sub: LowfySubscription | null | undefined): Date | null => {
    if (!sub) return null;
    
    let accessValidUntil: Date;
    
    if (sub.nextPaymentDate) {
      accessValidUntil = new Date(sub.nextPaymentDate);
    } else if (sub.paidAt) {
      accessValidUntil = new Date(sub.paidAt);
      if (sub.plan === 'anual') {
        accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
      } else {
        accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
      }
    } else {
      accessValidUntil = new Date();
      if (sub.plan === 'anual') {
        accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
      } else {
        accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
      }
    }
    
    return accessValidUntil;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      active: { label: "Ativa", variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      pending: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
      awaiting_payment: { label: "Aguardando Pagamento", variant: "secondary", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      canceled: { label: "Cancelada", variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
      expired: { label: "Expirada", variant: "destructive", icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
      refunded: { label: "Reembolsada", variant: "outline", icon: <RefreshCw className="h-3 w-3 mr-1" /> },
    };
    
    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    
    return (
      <Badge variant={config.variant} className="flex items-center w-fit" data-testid="badge-subscription-status">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "Pago", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      failed: { label: "Falhou", variant: "destructive" },
      refunded: { label: "Reembolsado", variant: "outline" },
    };
    
    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    const isAnual = plan === 'anual';
    return (
      <span 
        className="text-sm font-medium"
        data-testid="badge-subscription-plan"
      >
        {isAnual ? "Plano Anual" : "Plano Mensal"}
      </span>
    );
  };

  const getCardBrandLogo = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case "visa":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="25" viewBox="0 0 80 50" fill="none">
            <rect width="80" height="50" rx="6" fill="#1A1F71"/>
            <text x="40" y="32" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif" fontStyle="italic">VISA</text>
          </svg>
        );
      case "mastercard":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="25" viewBox="0 0 48 32" fill="none">
            <rect width="48" height="32" rx="4" fill="#252525"/>
            <circle cx="18" cy="16" r="10" fill="#EB001B"/>
            <circle cx="30" cy="16" r="10" fill="#F79E1B"/>
          </svg>
        );
      case "amex":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="25" viewBox="0 0 48 32" fill="none">
            <rect width="48" height="32" rx="4" fill="#0075d1"/>
            <path d="M14.38 20.88h-2.38v-7.76h2.38v7.76zm5.16-.08c-1.76 0-2.98-1.14-2.98-2.74 0-1.6.98-2.74 2.88-2.74 1.72 0 2.74 1.14 2.74 2.74 0 1.6-1.02 2.74-2.64 2.74zm7.32 0h-2.34v-7.76h2.34v3.2h1.14v4.56zM33.68 13.12h-4.84v7.76h2.28v-3.32h2.56v3.32h2.36v-7.76z" fill="white"/>
          </svg>
        );
      default:
        return <CreditCard className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    return method === 'pix' ? 'PIX' : 'Cartão de Crédito';
  };

  const getPaymentMethodIcon = (method: string) => {
    if (method === 'pix') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
          <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
          <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
        </svg>
      );
    }
    return <CreditCard className="h-4.5 w-4.5 text-muted-foreground" />;
  };

  const getPaymentMethodDisplay = () => {
    if (subscription.paymentMethod === 'pix') {
      return (
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
            <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
            <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
          </svg>
          <span className="font-medium">PIX</span>
        </div>
      );
    }
    
    // Credit card
    return (
      <div className="flex items-center gap-2">
        {getCardBrandLogo(subscription.cardBrand)}
        <span className="font-medium" data-testid="text-card-last4">
          {subscription.cardLastDigits ? `****${subscription.cardLastDigits}` : 'Cartão de Crédito'}
        </span>
      </div>
    );
  };

  const handleCancelSubscription = () => {
    cancelMutation.mutate(cancelReason);
  };

  const onSubmitChangeCard = (data: ChangeCardFormData) => {
    changePaymentMutation.mutate(data);
  };

  const openChangePaymentModal = () => {
    changeCardForm.reset({
      number: "",
      holderName: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      name: user?.name || "",
      email: user?.email || "",
      cpfCnpj: user?.cpf ? formatCpfCnpj(user.cpf) : "",
      postalCode: "",
      addressNumber: "",
      phone: user?.phone ? formatPhone(user.phone) : "",
      mobilePhone: user?.phone ? formatPhone(user.phone) : "",
    });
    setIsChangePaymentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Minha Assinatura</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua assinatura da plataforma Lowfy</p>
        </div>

        {/* Pricing Section for users who never had a subscription */}
        {user?.subscriptionStatus === 'none' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold">Escolha seu plano</h2>
              <p className="text-muted-foreground">Acesso completo a todas as ferramentas premium da plataforma</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Monthly Plan */}
              <Card className="relative hover:shadow-lg transition-shadow overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                  <CardTitle className="text-xl">Plano Mensal</CardTitle>
                  <CardDescription>Compromisso mínimo, máxima flexibilidade</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">R$ 99,90</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Renovação automática. Cancele a qualquer hora.</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    {[
                      '+39 Ferramentas de IA Premium',
                      'Criador e Clonador de Páginas',
                      '+350 Cursos Exclusivos',
                      'PLRs Globais em 7 idiomas',
                      'Automações com N8n',
                      'Suporte prioritário'
                    ].map((feature, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.location.href = '/assinatura/checkout?plan=mensal'}
                    data-testid="button-subscribe-monthly"
                  >
                    Começar agora
                  </Button>
                </CardContent>
              </Card>

              {/* Annual Plan */}
              <Card className="relative hover:shadow-lg transition-shadow overflow-hidden border-emerald-500 border-2">
                <div className="absolute top-4 right-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Melhor valor
                </div>
                <CardHeader className="bg-gradient-to-br from-emerald-600 to-teal-600">
                  <CardTitle className="text-xl text-white">Plano Anual</CardTitle>
                  <CardDescription className="text-emerald-100">Economize + de 70% comparado ao mensal</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">R$ 360,90</span>
                      <span className="text-muted-foreground">/ano</span>
                    </div>
                    <div className="flex items-baseline gap-1 text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Apenas R$ 30,08/mês</span>
                      <span className="text-muted-foreground">(economize R$ 83,88)</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    {[
                      '+39 Ferramentas de IA Premium',
                      'Criador e Clonador de Páginas',
                      '+350 Cursos Exclusivos',
                      'PLRs Globais em 7 idiomas',
                      'Automações com N8n',
                      'Suporte prioritário'
                    ].map((feature, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.location.href = '/assinatura/checkout?plan=anual'}
                    data-testid="button-subscribe-annual"
                  >
                    Começar agora
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Trust Badges */}
            <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center space-y-2">
                <CreditCard className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Pagamento Seguro</p>
                <p className="text-xs text-muted-foreground">Protegido por encriptação SSL</p>
              </div>
              <div className="text-center space-y-2">
                <RefreshCw className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Cancele a qualquer momento</p>
                <p className="text-xs text-muted-foreground">Sem taxas ocultas</p>
              </div>
              <div className="text-center space-y-2">
                <CheckCircle className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Acesso imediato</p>
                <p className="text-xs text-muted-foreground">Após confirmação do pagamento</p>
              </div>
            </div>
          </div>
        )}

        {/* Fallback message for other subscription statuses */}
        {user?.subscriptionStatus !== 'none' && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma assinatura ativa</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Você ainda não possui uma assinatura ativa. Assine agora para ter acesso a todos os recursos da plataforma.
              </p>
              <Button 
                onClick={() => window.location.href = '/assinatura/checkout'}
                data-testid="button-subscribe"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Assinar Agora
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const isSubscriptionActive = subscription.status === 'active';
  const isSubscriptionExpired = subscription.status === 'expired' || 
    (subscription.accessValidUntil && new Date(subscription.accessValidUntil) < new Date());
  const isSubscriptionRefunded = subscription.status === 'refunded';
  const canCancel = subscription.status === 'active';
  const canChangePayment = subscription.status === 'active';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Minha Assinatura</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura da plataforma Lowfy</p>
      </div>

      {isSubscriptionExpired && (
        <div className="flex items-start gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 dark:text-red-200 text-lg">
              Sua assinatura expirou
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              O acesso à plataforma foi bloqueado. Reative sua assinatura para continuar usando todos os recursos.
            </p>
            {subscription.paymentMethod === 'credit_card' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Seu cartão ****{subscription.cardLastDigits} será cobrado automaticamente.
              </p>
            )}
            {subscription.paymentMethod === 'pix' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Como você paga via PIX, será necessário fazer um novo pagamento.
              </p>
            )}
            <Button 
              className="mt-4 bg-red-600 hover:bg-red-700"
              onClick={handleReactivate}
              disabled={reactivateMutation.isPending}
              data-testid="button-reactivate-expired"
            >
              {reactivateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {subscription.paymentMethod === 'pix' ? 'Fazer Novo Pagamento' : 'Reativar Assinatura Agora'}
            </Button>
          </div>
        </div>
      )}

      {isSubscriptionRefunded && (
        <div className="flex items-start gap-4 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-orange-800 dark:text-orange-200 text-lg">
              Assinatura reembolsada
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
              Seu acesso à plataforma foi bloqueado. Você perdeu acesso aos recursos premium ao solicitar o reembolso.
            </p>
            <Button 
              className="mt-4 bg-orange-600 hover:bg-orange-700"
              onClick={() => window.location.href = '/assinatura/checkout'}
              data-testid="button-resubscribe-after-refund"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar Novamente
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-subscription-details">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plano</span>
              {getPlanBadge(subscription.plan)}
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge(subscription.status)}
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Método de Pagamento</span>
              {getPaymentMethodDisplay()}
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-lg" data-testid="text-subscription-amount">
                {formatCurrency(subscription.amount)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{subscription.plan === 'anual' ? 'ano' : 'mês'}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-billing-info">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Informações de Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Período Atual</span>
              <span className="font-medium" data-testid="text-current-period">
                {subscription.currentPeriod || 1}º período
              </span>
            </div>
            
            <Separator />
            
            {subscription.paidAt && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Último Pagamento</span>
                  <span className="font-medium" data-testid="text-last-payment">
                    {formatFullDate(subscription.paidAt)}
                  </span>
                </div>
                <Separator />
              </>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próxima Cobrança</span>
              <span className="font-medium" data-testid="text-next-payment">
                {subscription.status === 'canceled' || subscription.status === 'expired' || subscription.status === 'refunded'
                  ? "-"
                  : subscription.nextPaymentDate 
                    ? formatFullDate(subscription.nextPaymentDate)
                    : formatFullDate(calculateAccessValidUntil(subscription))
                }
              </span>
            </div>

            {subscription.canceledAt && subscription.status === 'canceled' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cancelada em</span>
                  <span className="font-medium text-destructive" data-testid="text-canceled-at">
                    {formatDate(subscription.canceledAt)}
                  </span>
                </div>
              </>
            )}

            {subscription.accessValidUntil && subscription.status === 'canceled' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Acesso válido até</span>
                  <span className="font-medium text-amber-600" data-testid="text-access-until">
                    {formatDate(subscription.accessValidUntil)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-payment-history">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Histórico de Pagamentos
          </CardTitle>
          <CardDescription>
            Visualize os pagamentos realizados da sua assinatura
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Período</TableHead>
                    <TableHead className="whitespace-nowrap">Método</TableHead>
                    <TableHead className="whitespace-nowrap">Valor</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} data-testid={`payment-row-${payment.id}`}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatFullDate(payment.paidAt || payment.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {payment.billingPeriod || 1}º período
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {payment.paymentMethod === 'pix' ? (
                            <QrCode className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {payment.paymentMethod === 'pix' ? 'PIX' : 
                              payment.cardBrand && payment.cardLast4 
                                ? `${payment.cardBrand} ****${payment.cardLast4}` 
                                : 'Cartão'
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(payment.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {subscription.canceledAt && (
                    <TableRow data-testid="payment-row-canceled" className="bg-red-50/50 dark:bg-red-950/10">
                      <TableCell className="font-medium whitespace-nowrap text-red-600 dark:text-red-400">
                        {formatFullDate(subscription.canceledAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center pl-8 text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell>
                        <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
                          Cancelado
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : subscription.paidAt ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Período</TableHead>
                    <TableHead className="whitespace-nowrap">Método</TableHead>
                    <TableHead className="whitespace-nowrap">Valor</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="payment-row-initial">
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatFullDate(subscription.paidAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {subscription.currentPeriod || 1}º período
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center pl-8">
                      {getPaymentMethodIcon(subscription.paymentMethod)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatCurrency(subscription.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                        Pago
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {subscription.canceledAt && (
                    <TableRow data-testid="payment-row-canceled" className="bg-red-50/50 dark:bg-red-950/10">
                      <TableCell className="font-medium whitespace-nowrap text-red-600 dark:text-red-400">
                        {formatFullDate(subscription.canceledAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center pl-8 text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap text-red-600 dark:text-red-400">
                        —
                      </TableCell>
                      <TableCell>
                        <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
                          Cancelado
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum pagamento registrado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-subscription-management">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Gerenciar Assinatura
          </CardTitle>
          <CardDescription>
            Opções para gerenciar sua assinatura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Button 
              variant="outline" 
              disabled={!canChangePayment}
              className="justify-start h-auto py-4 px-4 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-200 dark:hover:border-green-900/30 hover:!text-foreground dark:hover:!text-foreground [&:hover_*]:!text-foreground dark:[&:hover_*]:!text-foreground"
              onClick={openChangePaymentModal}
              data-testid="button-change-payment-method"
            >
              <div className="flex items-center gap-3">
                <CreditCard className={`h-5 w-5 ${canChangePayment ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="font-medium">Alterar Método de Pagamento</p>
                  <p className="text-xs text-muted-foreground">
                    {canChangePayment 
                      ? `Atual: ${getPaymentMethodLabel(subscription.paymentMethod)}`
                      : 'Disponível apenas para assinaturas ativas'
                    }
                  </p>
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              disabled={!canCancel}
              className="justify-start h-auto py-4 px-4 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/30 hover:!text-foreground dark:hover:!text-foreground [&:hover_*]:!text-foreground dark:[&:hover_*]:!text-foreground"
              onClick={() => setIsCancelModalOpen(true)}
              data-testid="button-cancel-subscription"
            >
              <div className="flex items-center gap-3">
                <Ban className={`h-5 w-5 ${canCancel ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="font-medium">Cancelar Assinatura</p>
                  <p className="text-xs text-muted-foreground">
                    {canCancel 
                      ? 'Continue usando até o fim do ciclo'
                      : 'Sua assinatura já foi cancelada'
                    }
                  </p>
                </div>
              </div>
            </Button>
          </div>

          {!canCancel && !canChangePayment && (subscription.status === 'canceled' || isSubscriptionExpired) && !isSubscriptionRefunded && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isSubscriptionExpired 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                isSubscriptionExpired 
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div>
                <p className={`font-medium ${
                  isSubscriptionExpired 
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}>
                  {isSubscriptionExpired ? 'Assinatura expirada' : 'Assinatura cancelada'}
                </p>
                <p className={`text-sm mt-1 ${
                  isSubscriptionExpired 
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {isSubscriptionExpired
                    ? 'Seu acesso foi bloqueado. Reative agora para continuar.'
                    : subscription.accessValidUntil 
                      ? `Você ainda tem acesso até ${formatDate(subscription.accessValidUntil)}. Deseja reativar?`
                      : 'Deseja reativar sua assinatura?'
                  }
                </p>
                {subscription.paymentMethod === 'credit_card' && (
                  <p className={`text-xs mt-1 ${
                    isSubscriptionExpired 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    Seu cartão ****{subscription.cardLastDigits} será cobrado automaticamente.
                  </p>
                )}
                {subscription.paymentMethod === 'pix' && (
                  <p className={`text-xs mt-1 ${
                    isSubscriptionExpired 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    Como você paga via PIX, será necessário fazer um novo pagamento.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button 
                    className={isSubscriptionExpired ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={handleReactivate}
                    disabled={reactivateMutation.isPending}
                    data-testid="button-reactivate"
                  >
                    {reactivateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {subscription.paymentMethod === 'pix' ? 'Fazer Novo Pagamento' : 'Reativar Assinatura'}
                  </Button>
                  {refundEligibility?.eligible && (
                    <Button 
                      variant="outline"
                      onClick={() => setIsRefundModalOpen(true)}
                      data-testid="button-request-refund"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Solicitar Reembolso
                    </Button>
                  )}
                </div>
                {refundEligibility?.eligible && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Você ainda tem {7 - (refundEligibility.daysFromFirstPayment || 0)} dia(s) para solicitar reembolso.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-subscriber-info">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Dados do Assinante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium" data-testid="text-buyer-name">{subscription.buyerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium" data-testid="text-buyer-email">{subscription.buyerEmail}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CPF</p>
              <p className="font-medium" data-testid="text-buyer-cpf">
                {subscription.buyerCpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium" data-testid="text-buyer-phone">
                {subscription.buyerPhone?.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Cancelar Assinatura
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar sua assinatura?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Você continuará tendo acesso
                </p>
                <p className="mt-1">
                  Após o cancelamento, você poderá usar a plataforma até{' '}
                  <strong>
                    {formatDate(calculateAccessValidUntil(subscription))}
                  </strong>.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Conte-nos por que está cancelando..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                data-testid="input-cancel-reason"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              data-testid="button-cancel-modal-close"
            >
              Manter Assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isChangePaymentModalOpen} onOpenChange={setIsChangePaymentModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Trocar Cartão de Crédito
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do seu cartão de crédito para pagamento da assinatura
            </DialogDescription>
          </DialogHeader>

          <Form {...changeCardForm}>
            <form onSubmit={changeCardForm.handleSubmit(onSubmitChangeCard)} className="space-y-6 py-4">
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados do Cartão</h4>
                
                <FormField
                  control={changeCardForm.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Cartão *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0000 0000 0000 0000"
                          {...field}
                          onChange={(e) => field.onChange(formatCardNumber(e.target.value))}
                          maxLength={19}
                          data-testid="input-card-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={changeCardForm.control}
                  name="holderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome no Cartão *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="NOME COMO ESTÁ NO CARTÃO"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-card-holder"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={changeCardForm.control}
                    name="expiryMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mês *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="MM"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
                            maxLength={2}
                            data-testid="input-card-month"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changeCardForm.control}
                    name="expiryYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="AA"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
                            maxLength={2}
                            data-testid="input-card-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changeCardForm.control}
                    name="cvv"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CVV *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4}
                            type="password"
                            data-testid="input-card-cvv"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>


              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangePaymentModalOpen(false)}
                  data-testid="button-payment-modal-close"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={changePaymentMutation.isPending}
                  data-testid="button-confirm-payment-change"
                >
                  {changePaymentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    'Atualizar Cartão'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Solicitar Reembolso
            </DialogTitle>
            <DialogDescription>
              Você pode solicitar o reembolso da sua assinatura dentro dos primeiros 7 dias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Valor a ser reembolsado
                </p>
                <p className="mt-1 text-lg font-bold">
                  {formatCurrency(refundEligibility?.amountCents || 0)}
                </p>
                <p className="mt-1 text-xs">
                  Método: {refundEligibility?.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'PIX'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Restrição de Acesso
                </p>
                <p className="text-sm mb-2">
                  Ao solicitar o reembolso, você perderá acesso aos seguintes recursos:
                </p>
                <ul className="text-xs space-y-1 ml-2">
                  <li>✗ Ferramentas IA</li>
                  <li>✗ Meus PLRs</li>
                  <li>✗ Cursos Online</li>
                  <li>✗ Quiz Interativo</li>
                  <li>✗ Plugins</li>
                  <li>✗ Templates e Páginas</li>
                  <li>✗ Serviços</li>
                  <li>✗ Meta Ads Andromeda</li>
                </ul>
                <p className="text-xs mt-2 font-medium">
                  Você manterá acesso apenas a: Timeline, Fórum, Marketplace e Sistema de Afiliados.
                </p>
              </div>
            </div>

            {refundEligibility?.paymentMethod === 'credit_card' && (
              <div className="text-sm text-muted-foreground">
                O valor será estornado automaticamente para o cartão utilizado na compra em até 2 faturas (60 dias).
              </div>
            )}

            {refundEligibility?.paymentMethod === 'pix' && (
              <div className="text-sm text-muted-foreground">
                Nossa equipe entrará em contato para processar o reembolso via PIX. O prazo é de até 5 dias úteis.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Motivo do reembolso (opcional)</Label>
              <Textarea
                id="refund-reason"
                placeholder="Conte-nos por que está solicitando o reembolso..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                data-testid="input-refund-reason"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsRefundModalOpen(false)}
              data-testid="button-refund-modal-close"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRefundRequest}
              disabled={refundMutation.isPending}
              data-testid="button-confirm-refund"
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Reembolso'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
