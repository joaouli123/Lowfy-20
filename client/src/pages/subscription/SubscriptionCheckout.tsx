import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, Lock, CheckCircle, Clock, 
  ArrowLeft, Crown, Sparkles, ShieldCheck,
  User, Mail, IdCard, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  trackSubscriptionCheckoutStart, 
  trackSubscriptionPurchase, 
  trackAddPaymentInfo,
  trackViewContent 
} from "@/hooks/useMetaPixel";
import { trackAdBeginCheckout, trackAdAbandonedCheckout } from "@/hooks/useGoogleAnalytics";

const isDev = import.meta.env.DEV;

// Helper function to get Meta cookies for EMQ (Event Match Quality)
function getMetaCookies() {
  const getCookie = (name: string): string => {
    const match = document.cookie.split(';').find(c => c.trim().startsWith(`${name}=`));
    return match?.split('=')[1] || '';
  };
  return {
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
  };
}

const PLANS = {
  mensal: {
    name: "Plano Mensal",
    price: 9990, // R$ 99,90 in cents
    displayPrice: "R$ 99,90",
    period: "/mês",
    description: "Acesso completo à plataforma Lowfy",
    savings: undefined
  },
  anual: {
    name: "Plano Anual",
    price: 36090, // R$ 360,90 in cents
    displayPrice: "R$ 360,90",
    period: "/ano",
    description: "Economize com o plano anual",
    savings: "Economize R$ 837,90"
  }
};

const formatCurrency = (cents: number) => {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getCardBrandLogo = (brand: string) => {
  const commonClasses = "absolute right-3 top-1/2 -translate-y-1/2 w-12 h-8 object-contain";
  switch (brand) {
    case "visa":
      return (
        <svg className={commonClasses} viewBox="0 0 80 50" fill="none">
          <rect width="80" height="50" rx="6" fill="#1A1F71"/>
          <text x="40" y="32" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif" fontStyle="italic">VISA</text>
        </svg>
      );
    case "mastercard":
      return (
        <svg className={commonClasses} viewBox="0 0 48 32" fill="none">
          <rect width="48" height="32" rx="4" fill="#252525"/>
          <circle cx="18" cy="16" r="10" fill="#EB001B"/>
          <circle cx="30" cy="16" r="10" fill="#F79E1B"/>
        </svg>
      );
    case "amex":
      return (
        <svg className={commonClasses} viewBox="0 0 48 32" fill="none">
          <rect width="48" height="32" rx="4" fill="#0075d1"/>
          <path d="M14.38 20.88h-2.38v-7.76h2.38v7.76zm5.16-.08c-1.76 0-2.98-1.14-2.98-2.74 0-1.6.98-2.74 2.88-2.74 1.72 0 2.74 1.14 2.74 2.74 0 1.6-1.02 2.74-2.64 2.74zm7.32 0h-2.34v-7.76h2.34v3.2h1.14v4.56zM33.68 13.12h-4.84v7.76h2.28v-3.32h2.56v3.32h2.36v-7.76z" fill="white"/>
        </svg>
      );
    default:
      return <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />;
  }
};

export default function SubscriptionCheckout() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user } = useAuth();

  // Parse URL params
  const urlParams = new URLSearchParams(searchString);
  const planType = urlParams.get("plan") as "mensal" | "anual" || "mensal";
  const couponCode = urlParams.get("cupom") || null;
  const recoveryId = urlParams.get("recoveryId") || null;
  
  let basePlan = PLANS[planType] || PLANS.mensal;
  
  // State for discount
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(basePlan);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Buscar código de referência do cookie (se existir)
  const { data: referralData } = useQuery<{ referralCode: string | null; referrerId?: string }>({
    queryKey: ['/api/referrals/current'],
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  // Validate coupon if present
  useEffect(() => {
    if (couponCode) {
      (async () => {
        try {
          const response = await fetch(`/api/subscriptions/validate-coupon?coupon=${encodeURIComponent(couponCode)}&plan=${planType}`);
          const data = await response.json();
          
          if (data.valid && (data.discountPercentage || data.discountPercent)) {
            const discount = data.discountPercentage || data.discountPercent;
            setDiscountPercentage(discount);
            const discountedPrice = Math.floor(basePlan.price * (1 - discount / 100));
            setSelectedPlan({
              ...basePlan,
              price: discountedPrice,
              displayPrice: `R$ ${(discountedPrice / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            });
            toast({
              title: "Cupom aplicado! 🎉",
              description: `${discount}% de desconto ativado!`,
              duration: 3000
            });
          }
        } catch (error) {
          console.error('Erro ao validar cupom:', error);
        }
      })();
    } else {
      setSelectedPlan(basePlan);
    }
  }, [couponCode, planType, basePlan, toast]);

  // Personal data - auto-populated from logged-in user or recovery API
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  
  // Buscar dados do cliente via API para recuperação de checkout (seguro)
  useEffect(() => {
    if (recoveryId && !user) {
      setIsRecoveryMode(true);
      setRecoveryLoading(true);
      
      (async () => {
        try {
          const response = await fetch(`/api/subscriptions/recovery/${encodeURIComponent(recoveryId)}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.buyerName) {
              setName(data.buyerName);
            }
            if (data.buyerEmail) {
              setEmail(data.buyerEmail);
            }
            if (data.buyerCpf) {
              setCpf(formatCpf(data.buyerCpf));
            }
            if (data.buyerPhone) {
              setPhone(formatPhone(data.buyerPhone));
            }
            
            if (isDev) {
              console.log('[SubscriptionCheckout] Recovery data loaded:', { 
                recoveryId, 
                name: data.buyerName,
                email: data.buyerEmail,
                hasCpf: !!data.buyerCpf,
                hasPhone: !!data.buyerPhone
              });
            }
            
            toast({
              title: "Dados restaurados! ✨",
              description: "Seus dados foram preenchidos automaticamente. Finalize sua assinatura!",
              duration: 4000
            });
          } else {
            if (isDev) {
              console.log('[SubscriptionCheckout] Recovery data not found or expired');
            }
          }
        } catch (error) {
          console.error('Erro ao buscar dados de recuperação:', error);
        } finally {
          setRecoveryLoading(false);
        }
      })();
    }
  }, [recoveryId, user, toast]);

  // Card data
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardExpirationDate, setCardExpirationDate] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardBrand, setCardBrand] = useState("");

  // Timer
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  
  // Track if checkout was completed
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);

  // Auto-populate user data from logged-in user
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setCpf(user.cpf ? formatCpf(user.cpf) : "");
      setPhone(user.phone ? formatPhone(user.phone) : "");
    }
  }, [user]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rastrear checkout abandonado quando usuário sai da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Só rastreia se nunca completou o checkout
      if (!checkoutCompleted) {
        trackAdAbandonedCheckout(selectedPlan.price / 100, 'BRL', 1);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedPlan.price, checkoutCompleted]);

  // Meta Pixel & Google Ads: Track InitiateCheckout when page loads
  useEffect(() => {
    trackSubscriptionCheckoutStart(planType, selectedPlan.price);
    trackViewContent({
      content_name: selectedPlan.name,
      content_category: 'subscription',
      content_type: 'product',
      content_ids: [`lowfy_${planType}`],
      value: selectedPlan.price / 100,
      currency: 'BRL',
    });
    
    // Google Ads
    trackAdBeginCheckout(selectedPlan.price / 100, 'BRL', 1);
  }, [planType, selectedPlan]);

  const processSubscriptionMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest("POST", "/api/subscriptions/checkout", paymentData);
      return await response.json();
    },
    onSuccess: (data) => {
      if (isDev) console.log('[SubscriptionCheckout] Payment response:', data);
      
      // Mark checkout as completed to avoid abandoned checkout tracking
      setCheckoutCompleted(true);

      if (data.paymentMethod === 'pix') {
        if (isDev) console.log('[SubscriptionCheckout] PIX payment - redirecting to QR Code page');
        const pixDataToSave = { ...data, plan: planType };
        sessionStorage.setItem('pixSubscriptionData', JSON.stringify(pixDataToSave));
        setLocation("/assinatura/checkout/pix");
      } else {
        if (isDev) console.log('[SubscriptionCheckout] Card payment response:', { status: data.status });
        
        // CRITICAL: Verificar se o pagamento foi REALMENTE aprovado
        // Status 'pending' significa que está em análise anti-fraude
        if (data.status === 'active') {
          if (isDev) console.log('[SubscriptionCheckout] Card payment CONFIRMED');
          trackSubscriptionPurchase(planType, selectedPlan.price, data.subscriptionId);
          if (user) {
            if (isDev) console.log('[SubscriptionCheckout] User already logged in - redirecting to success page');
            setLocation(`/assinatura/checkout/sucesso?plan=${planType}`);
          } else {
            if (isDev) console.log('[SubscriptionCheckout] New user - redirecting to account activation');
            setLocation(`/ativar-conta?token=${data.activationToken}`);
          }
        } else {
          // Status 'pending' ou 'awaiting_payment' - pagamento em análise
          if (isDev) console.log('[SubscriptionCheckout] Payment PENDING - redirecting to awaiting confirmation');
          sessionStorage.setItem('subscriptionAwaitingData', JSON.stringify({
            subscriptionId: data.subscriptionId,
            transactionId: data.transactionId,
            activationToken: data.activationToken,
            plan: planType,
          }));
          setLocation("/assinatura/checkout/aguardando");
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Não foi possível processar o pagamento.";
      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const detectCardBrand = (number: string) => {
    const cleaned = number.replace(/\s/g, "");
    if (/^4/.test(cleaned)) return "visa";
    if (/^5[1-5]/.test(cleaned)) return "mastercard";
    if (/^3[47]/.test(cleaned)) return "amex";
    return "";
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\s/g, "");
    value = value.replace(/[^\d]/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.match(/.{1,4}/g)?.join(" ") || value;
    setCardNumber(formatted);
    setCardBrand(detectCardBrand(value));
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const validatePersonalData = () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Preencha seu nome completo.", variant: "destructive" });
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Email inválido", description: "Preencha um email válido.", variant: "destructive" });
      return false;
    }
    const cpfNumbers = cpf.replace(/\D/g, "");
    if (cpfNumbers.length !== 11) {
      toast({ title: "CPF inválido", description: "Preencha um CPF válido.", variant: "destructive" });
      return false;
    }
    const phoneNumbers = phone.replace(/\D/g, "");
    if (phoneNumbers.length < 10) {
      toast({ title: "Telefone inválido", description: "Preencha um telefone válido.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = (paymentMethod: "card" | "pix") => {
    if (!validatePersonalData()) return;

    // Get Meta cookies for EMQ (Event Match Quality)
    const metaCookies = getMetaCookies();

    const basePayload = {
      paymentMethod: paymentMethod === "card" ? "credit_card" : "pix",
      plan: planType,
      buyerName: name.trim(),
      buyerEmail: email.trim(),
      buyerCpf: cpf.replace(/\D/g, ""),
      buyerPhone: phone.replace(/\D/g, ""),
      referralCode: referralData?.referralCode || null,
      cupom: couponCode || null,
      // Meta EMQ parameters
      fbc: metaCookies.fbc || undefined,
      fbp: metaCookies.fbp || undefined,
    };

    if (paymentMethod === "card") {
      if (!cardNumber || !cardHolderName || !cardExpirationDate || !cardCvv) {
        toast({ title: "Dados incompletos", description: "Preencha todos os dados do cartão.", variant: "destructive" });
        return;
      }
      if (!cardExpirationDate.includes("/")) {
        toast({ title: "Data de validade inválida", description: "Use o formato MM/AA (ex: 12/25)", variant: "destructive" });
        return;
      }

      const [month, year] = cardExpirationDate.split("/");
      if (!month || !year || month.length !== 2 || (year.length !== 2 && year.length !== 4)) {
        toast({ title: "Data de validade inválida", description: "Use o formato MM/AA (ex: 12/25)", variant: "destructive" });
        return;
      }

      const monthNum = parseInt(month, 10);
      if (monthNum < 1 || monthNum > 12) {
        toast({ title: "Mês inválido", description: "O mês deve estar entre 01 e 12", variant: "destructive" });
        return;
      }

      const fullYear = year.length === 2 ? `20${year}` : year;

      trackAddPaymentInfo({
        content_category: 'subscription',
        content_ids: [`lowfy_${planType}`],
        value: selectedPlan.price / 100,
        currency: 'BRL',
      });

      processSubscriptionMutation.mutate({
        ...basePayload,
        card: {
          number: cardNumber.replace(/\s/g, ""),
          holderName: cardHolderName,
          expiryMonth: month,
          expiryYear: fullYear,
          cvv: cardCvv,
        },
      });
    } else {
      processSubscriptionMutation.mutate(basePayload);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(65 57 61 / 0%)' }}>
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
              className="text-gray-600 hover:bg-transparent hover:text-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <div className="flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-500">Pagamento seguro</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Timer */}
        <div className="mb-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Finalize em</span>
          <span className={cn(
            "font-medium px-2 py-0.5 rounded text-red-700"
          )}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-6">
          {/* Order Summary - Mobile Only (shown first) */}
          <div className="lg:hidden">
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <h2 className="text-sm font-medium text-gray-900 mb-3">Resumo do Pedido</h2>
                
                <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img src="/lowfy-checkout-logo.png" alt="Lowfy" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm" data-testid="text-plan-name">
                      {selectedPlan.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedPlan.description}</p>
                    {selectedPlan.savings && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        <Sparkles className="w-3 h-3" />
                        {selectedPlan.savings}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">Total</span>
                    <span className="font-semibold text-lg text-gray-900" data-testid="text-total">
                      {selectedPlan.displayPrice}
                      <span className="text-sm font-normal text-gray-500">{selectedPlan.period}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <Card className="border-gray-200">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-8">
                  <h1 className="text-xl font-semibold text-gray-900 mb-1" data-testid="text-checkout-title">
                    Assinar {selectedPlan.name}
                  </h1>
                  <p className="text-sm text-gray-500">Preencha seus dados para continuar</p>
                </div>

                {/* Personal Data Section */}
                <div className="mb-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!!user}
                        className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-gray-100"
                        data-testid="input-name"
                      />
                    </div>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!!user}
                        className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-gray-100"
                        data-testid="input-email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative group">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        disabled={!!user}
                        className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-gray-100"
                        maxLength={14}
                        data-testid="input-cpf"
                      />
                    </div>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="phone"
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        disabled={!!user}
                        className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-gray-100"
                        maxLength={15}
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="card" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-50 p-0.5 rounded-md mb-8 h-11">
                    <TabsTrigger 
                      value="card" 
                      className="rounded text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 font-medium"
                      data-testid="tab-credit-card"
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Cartão
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pix" 
                      className="rounded text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 font-medium"
                      data-testid="tab-pix"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48" className="mr-1.5">
                        <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
                        <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
                        <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
                      </svg>
                      PIX
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="space-y-3">
                    {/* Card Data */}
                    <div className="relative group">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        className="pl-10 pr-16 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md"
                        maxLength={19}
                        data-testid="input-card-number"
                      />
                      {cardBrand && (
                        <div className="pointer-events-none">
                          {getCardBrandLogo(cardBrand)}
                        </div>
                      )}
                    </div>

                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors z-10" />
                      <Input
                        id="cardHolderName"
                        type="text"
                        placeholder="Como está escrito no cartão"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                        className="pl-10 h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md"
                        data-testid="input-card-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        id="cardExpiry"
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpirationDate}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "");
                          if (value.length >= 2) {
                            value = value.slice(0, 2) + "/" + value.slice(2, 4);
                          }
                          setCardExpirationDate(value);
                        }}
                        className="h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md"
                        maxLength={5}
                        data-testid="input-card-expiry"
                      />
                      <Input
                        id="cardCvv"
                        type="text"
                        placeholder="000"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                        className="h-10 bg-gray-50 border border-gray-200 rounded-[10px] text-sm transition-all duration-200 focus:bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:shadow-md"
                        maxLength={4}
                        data-testid="input-card-cvv"
                      />
                    </div>

                    <Button 
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium mt-6 text-base"
                      onClick={() => handleSubmit("card")}
                      disabled={processSubscriptionMutation.isPending}
                      data-testid="button-pay-card"
                    >
                      {processSubscriptionMutation.isPending ? "Processando..." : `Assinar por ${selectedPlan.displayPrice}${selectedPlan.period}`}
                    </Button>
                  </TabsContent>

                  <TabsContent value="pix" className="space-y-4">
                    <div className="bg-gradient-to-br from-[#32BCAD]/5 to-[#4db6ac]/10 rounded-[10px] p-8 text-center border border-[#4db6ac]/30">
                      <div className="w-14 h-14 mx-auto mb-4 bg-white rounded-full flex items-center justify-center border-2 border-[#4db6ac]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 48 48">
                          <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
                          <path fill="#4db6ac" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
                          <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-[#4db6ac] mb-1">Pagamento via PIX</h3>
                      <p className="text-sm text-gray-600 mb-5">Aprovação instantânea</p>
                      <div className="text-3xl font-bold text-[#4db6ac] mb-6" data-testid="text-pix-price">
                        {selectedPlan.displayPrice}
                      </div>
                      <Button 
                        className="w-full h-12 bg-[#4db6ac] hover:bg-[#32BCAD] text-white font-medium text-base"
                        onClick={() => handleSubmit("pix")}
                        disabled={processSubscriptionMutation.isPending}
                        data-testid="button-pay-pix"
                      >
                        {processSubscriptionMutation.isPending ? "Gerando QR Code..." : "Gerar QR Code PIX"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Pagamento seguro</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Dados protegidos</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary - Desktop Sidebar / Mobile Bottom */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 space-y-4">
              {/* Desktop Only Summary */}
              <div className="hidden lg:block">
                <Card className="border-gray-200">
                  <CardContent className="p-6">
                    <h2 className="text-sm font-medium text-gray-900 mb-4">Resumo do Pedido</h2>
                    
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                      <div className="w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/lowfy-checkout-logo.png" alt="Lowfy" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm" data-testid="text-plan-name">
                          {selectedPlan.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{selectedPlan.description}</p>
                        {selectedPlan.savings && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                            <Sparkles className="w-3 h-3" />
                            {selectedPlan.savings}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">Total</span>
                        <span className="font-semibold text-lg text-gray-900" data-testid="text-total">
                          {selectedPlan.displayPrice}
                          <span className="text-sm font-normal text-gray-500">{selectedPlan.period}</span>
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 mt-4 pt-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">O que está incluso:</h3>
                      <ul className="space-y-2">
                        {[
                          "Acesso completo à plataforma",
                          "+39 Ferramentas de IA Premium",
                          "+350 Cursos exclusivos",
                          "Criador e Clonador de Páginas",
                          "Suporte prioritário",
                          "e muito mais..."
                        ].map((benefit, index) => (
                          <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mobile Only Benefits */}
              <div className="lg:hidden">
                <Card className="border-gray-200">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">O que está incluso:</h3>
                    <ul className="space-y-2">
                      {[
                        "Acesso completo à plataforma",
                        "+39 Ferramentas de IA Premium",
                        "+350 Cursos exclusivos",
                        "Criador e Clonador de Páginas",
                        "Suporte prioritário",
                        "e muito mais..."
                      ].map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 pb-8 text-center lg:text-left space-y-3">
          <div className="flex items-center justify-center lg:justify-start gap-1.5 text-xs text-green-600">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Compra 100% segura</span>
          </div>
          
          <p className="text-[10px] text-gray-400">
            Este site é protegido pelo reCAPTCHA do Google
          </p>
          
          <p className="text-[10px] text-gray-500">
            <Link href="/privacidade" className="font-medium text-gray-600 hover:text-gray-900 hover:underline">
              Política de privacidade
            </Link>
            {" e "}
            <Link href="/termos" className="font-medium text-gray-600 hover:text-gray-900 hover:underline">
              Termos de serviço
            </Link>
          </p>
          
          <p className="text-[10px] text-gray-400">
            * Parcelamento com acréscimo
          </p>
          
          <p className="text-[10px] text-gray-400">
            Ao continuar, você concorda com os{" "}
            <Link href="/termos" className="font-medium text-gray-500 hover:text-gray-900 hover:underline">
              Termos de Compra
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
