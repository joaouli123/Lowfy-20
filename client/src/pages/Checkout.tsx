import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Lock, CheckCircle, Clock, Package, 
  ArrowLeft, ShoppingCart 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CartItemWithProduct } from "@shared/schema";
import { 
  trackMarketplaceCheckoutStart, 
  trackMarketplacePurchase, 
  trackAddPaymentInfo 
} from "@/hooks/useMetaPixel";

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

const formatCurrency = (cents: number) => {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Function to get card brand logo
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

export default function Checkout() {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardExpirationDate, setCardExpirationDate] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [installments, setInstallments] = useState(1);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutos
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // SEO Schema Markup for Checkout
  const checkoutSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Lowfy",
        "item": "https://lowfy.com.br"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Marketplace",
        "item": "https://lowfy.com.br/marketplace"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Checkout",
        "item": "https://lowfy.com.br/marketplace/checkout"
      }
    ]
  };

  const { data: cartItems, isLoading: isCartLoading } = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/marketplace/cart"],
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Calculate totals (only valid products) - moved up to use in queries
  const validCartItems = cartItems?.filter(item => item.product && item.product.isActive) || [];
  const subtotal = validCartItems.reduce((sum, item) => {
    return sum + (item.product!.price) * item.quantity;
  }, 0);
  const total = subtotal;

  // Calculate installments locally (no API calls needed - instant loading)
  const calculateInstallments = (totalCents: number) => {
    const interestRates: Record<number, number> = {
      1: 0, 2: 0, 3: 0, // Sem juros até 3x
      4: 0.0199, 5: 0.0199, 6: 0.0199, // 1.99% a.m.
      7: 0.0249, 8: 0.0249, 9: 0.0249, 10: 0.0249, // 2.49% a.m.
    };
    
    return Array.from({ length: 10 }, (_, i) => {
      const num = i + 1;
      const rate = interestRates[num];
      let totalWithInterest = totalCents;
      
      if (rate > 0) {
        // Compound interest formula
        totalWithInterest = Math.round(totalCents * Math.pow(1 + rate, num));
      }
      
      return {
        installmentCount: num,
        installmentValue: Math.round(totalWithInterest / num),
        totalValue: totalWithInterest,
        interestRate: rate * 100,
        hasInterest: rate > 0,
      };
    });
  };

  const installmentOptions = total > 0 ? calculateInstallments(total) : [];
  const selectedInstallmentData = installmentOptions[installments - 1];

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    if (!isCartLoading && (!cartItems || cartItems.length === 0)) {
      setLocation("/marketplace/cart");
    }
  }, [cartItems, isCartLoading, setLocation]);

  // Meta Pixel: Track InitiateCheckout when page loads with valid cart
  useEffect(() => {
    if (validCartItems.length > 0 && total > 0) {
      const productNames = validCartItems.map(item => item.product!.title).join(', ');
      trackMarketplaceCheckoutStart(productNames, total, validCartItems.map(item => String(item.product!.id)).join(','));
    }
  }, [validCartItems, total]);

  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      // Backend already validates and processes only active products
      const response = await apiRequest("POST", "/api/marketplace/checkout", paymentData);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });

      if (data.paymentMethod === 'pix') {
        sessionStorage.setItem('pixPaymentData', JSON.stringify(data));
        setLocation("/marketplace/checkout/pix");
      } else {
        // Para cartão: só redireciona para sucesso se pagamento foi REALMENTE confirmado (status === 'paid')
        // Se status === 'pending', significa que está aguardando webhook do Asaas
        if (data.status === 'paid') {
          const productNames = validCartItems.map(item => item.product!.title).join(', ');
          trackMarketplacePurchase(productNames, total, validCartItems.map(item => String(item.product!.id)).join(','), data.orderId);
          setLocation("/marketplace/order/success");
        } else {
          // Status === 'pending': pagamento enviado para Asaas, aguardando confirmação
          sessionStorage.setItem('cardPaymentData', JSON.stringify(data));
          setLocation("/marketplace/checkout/awaiting-confirmation");
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Não foi possível processar o pagamento.";

      // Store error message for the failure page to display
      sessionStorage.setItem('paymentError', errorMessage);

      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // If all products are invalid, redirect to cart
      if (errorMessage.includes("válido") || errorMessage.includes("vazio")) {
        setTimeout(() => setLocation("/marketplace/cart"), 2000);
      } else {
        // Add delay to allow user to see the toast message
        setTimeout(() => setLocation("/marketplace/order/failure"), 1500);
      }
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = (paymentMethod: "card" | "pix") => {
    if (!currentUser?.cpf) {
      toast({
        title: "CPF não cadastrado",
        description: "Por favor, adicione seu CPF no perfil antes de finalizar a compra.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/profile"), 2000);
      return;
    }

    if (paymentMethod === "card") {
      // Validate card data
      if (!cardNumber || !cardHolderName || !cardExpirationDate || !cardCvv) {
        toast({
          title: "Dados incompletos",
          description: "Preencha todos os dados do cartão.",
          variant: "destructive",
        });
        return;
      }

      // Validate and extract month and year from expiration date (MM/YY or MM/YYYY)
      if (!cardExpirationDate.includes("/")) {
        toast({
          title: "Data de validade inválida",
          description: "Use o formato MM/AA (ex: 12/25)",
          variant: "destructive",
        });
        return;
      }

      const [month, year] = cardExpirationDate.split("/");

      if (!month || !year || month.length !== 2 || (year.length !== 2 && year.length !== 4)) {
        toast({
          title: "Data de validade inválida",
          description: "Use o formato MM/AA (ex: 12/25)",
          variant: "destructive",
        });
        return;
      }

      // Validate month range
      const monthNum = parseInt(month, 10);
      if (monthNum < 1 || monthNum > 12) {
        toast({
          title: "Mês inválido",
          description: "O mês deve estar entre 01 e 12",
          variant: "destructive",
        });
        return;
      }

      const fullYear = year.length === 2 ? `20${year}` : year;

      // Get Meta cookies for EMQ (Event Match Quality)
      const metaCookies = getMetaCookies();

      processPaymentMutation.mutate({
        paymentMethod,
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardHolderName,
        cardExpirationMonth: month,
        cardExpirationYear: fullYear,
        cardCvv,
        installments,
        // Meta EMQ parameters
        fbc: metaCookies.fbc || undefined,
        fbp: metaCookies.fbp || undefined,
      });
    } else {
      // Get Meta cookies for EMQ (Event Match Quality)
      const metaCookies = getMetaCookies();
      processPaymentMutation.mutate({ 
        paymentMethod,
        // Meta EMQ parameters
        fbc: metaCookies.fbc || undefined,
        fbp: metaCookies.fbp || undefined,
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/marketplace/cart")}
              data-testid="button-back-to-cart"
              className="text-gray-600 hover:text-gray-900"
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
        {/* Minimal Timer */}
        <div className="mb-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Finalize em</span>
          <span className={cn(
            "font-medium px-2 py-0.5 rounded",
            timeLeft < 120 ? "text-red-700" : "text-gray-700"
          )}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Payment Form */}
          <div className="lg:col-span-3">
            <div className="border border-gray-200 rounded-lg">
              <div className="p-6 sm:p-8">
                <div className="mb-8">
                  <h1 className="text-xl font-semibold text-gray-900 mb-1">Finalizar Compra</h1>
                  <p className="text-sm text-gray-500">Escolha como deseja pagar</p>
                </div>

                <Tabs defaultValue="card" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-50 p-0.5 rounded-md mb-8 h-11">
                    <TabsTrigger 
                      value="card" 
                      className="rounded text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900"
                      data-testid="tab-credit-card"
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Cartão
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pix" 
                      className="rounded text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900"
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

                  <TabsContent value="card" className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Número do Cartão</label>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          className="h-12 border-gray-300 focus:border-gray-900 focus:ring-gray-900 pr-16"
                          maxLength={19}
                          data-testid="input-card-number"
                        />
                        {cardBrand && (
                          <div className="pointer-events-none">
                            {getCardBrandLogo(cardBrand)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Nome no Cartão</label>
                      <Input
                        type="text"
                        placeholder="Como está escrito no cartão"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                        className="h-12 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                        data-testid="input-card-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Validade</label>
                        <Input
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
                          className="h-12 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                          maxLength={5}
                          data-testid="input-card-expiry"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">CVV</label>
                        <Input
                          type="text"
                          placeholder="000"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                          className="h-12 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                          maxLength={4}
                          data-testid="input-card-cvv"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-5">
                      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Parcelas</label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full h-12 border border-gray-300 rounded-md px-3 focus:border-gray-900 focus:ring-gray-900 bg-white"
                        data-testid="select-installments"
                      >
                        {installmentOptions.map((option) => (
                          <option key={option.installmentCount} value={option.installmentCount}>
                            {option.installmentCount}x de {formatCurrency(option.installmentValue)}
                            {option.hasInterest ? ' com juros' : ' sem juros'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button 
                      className="w-full h-13 bg-primary hover:bg-primary/90 text-white font-medium mt-8 text-base"
                      onClick={() => handleSubmit("card")}
                      disabled={processPaymentMutation.isPending}
                      data-testid="button-pay-card"
                    >
                      {processPaymentMutation.isPending ? "Processando pagamento..." : (
                        installments === 1 
                          ? `Pagar ${formatCurrency(selectedInstallmentData?.installmentValue || total)}` 
                          : `Pagar ${installments}x de ${formatCurrency(selectedInstallmentData?.installmentValue || Math.round(total / installments))}`
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="pix" className="space-y-4">
                    <div className="bg-gradient-to-br from-[#32BCAD]/5 to-[#4db6ac]/10 rounded-lg p-8 text-center border border-[#4db6ac]/30">
                      <div className="w-14 h-14 mx-auto mb-4 bg-white rounded-full flex items-center justify-center border-2 border-[#4db6ac]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 48 48">
                          <path fill="#4db6ac" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
                          <path fill="#4db6ac" d="M36.1,36h0.68l8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
                          <path fill="#4db6ac" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-[#4db6ac] mb-1">Pagamento via PIX</h3>
                      <p className="text-sm text-gray-600 mb-5">
                        Aprovação instantânea
                      </p>
                      <div className="text-3xl font-bold text-[#4db6ac] mb-6">
                        {formatCurrency(total)}
                      </div>
                      <Button 
                        className="w-full h-13 bg-[#4db6ac] hover:bg-[#32BCAD] text-white font-medium text-base"
                        onClick={() => handleSubmit("pix")}
                        disabled={processPaymentMutation.isPending}
                        data-testid="button-pay-pix"
                      >
                        {processPaymentMutation.isPending ? "Gerando QR Code..." : "Gerar QR Code PIX"}
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
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 space-y-4">
              <div className="border border-gray-200 rounded-lg">
                <div className="p-6">
                  <h2 className="font-medium text-gray-900 mb-5 text-sm uppercase tracking-wide">Resumo</h2>

                  <div className="space-y-4 mb-5">
                    {validCartItems.map((item) => (
                      <div key={item.id} className="flex gap-3" data-testid={`summary-item-${item.productId}`}>
                        <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded border border-gray-200 overflow-hidden">
                          {item.product?.images && item.product.images.length > 0 ? (
                            <img
                              src={item.product.images[0]}
                              alt={item.product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1 mb-0.5">
                            {item.product?.title}
                          </p>
                          <p className="text-xs text-gray-400">Qtd: {item.quantity}</p>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency((item.product?.price || 0) * item.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-4 mt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>
                    {selectedInstallmentData && selectedInstallmentData.hasInterest && (
                      <div className="flex justify-between">
                        <span className="text-gray-500" data-testid="text-card-interest">Juros ({selectedInstallmentData.interestRate.toFixed(2)}% a.m.)</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(selectedInstallmentData.totalValue - total)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-gray-900">Total</span>
                      <span className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(selectedInstallmentData?.totalValue || total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Garantia de 7 dias</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}