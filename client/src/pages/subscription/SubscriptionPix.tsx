import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";
import { trackSubscriptionPurchase, trackCompleteRegistration } from "@/hooks/useMetaPixel";

const isDev = import.meta.env.DEV;

async function checkSubscriptionPaymentStatus(transactionId: string) {
  const response = await fetch(`/api/subscriptions/payment-status/${transactionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || `Erro ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

export default function SubscriptionPix() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [pixData, setPixData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    const savedData = sessionStorage.getItem('pixSubscriptionData');
    if (!savedData) {
      console.error('[SubscriptionPix] No pixSubscriptionData found in sessionStorage');
      toast({
        title: "Erro ao carregar PIX",
        description: "Dados de pagamento não encontrados.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }

    try {
      const data = JSON.parse(savedData);
      if (isDev) console.log('[SubscriptionPix] Loaded payment data:', data);
      
      if (!data.qrCode && !data.transactionId) {
        console.error('[SubscriptionPix] Missing essential fields in payment data');
        toast({
          title: "Erro ao carregar PIX",
          description: "Dados de pagamento incompletos. Tente novamente.",
          variant: "destructive",
        });
        setLocation("/");
        return;
      }
      
      setPixData(data);
      
      if (data.transactionId) {
        window.history.replaceState({}, '', `/assinatura/checkout/pix/${data.transactionId}`);
      }
    } catch (error) {
      console.error('[SubscriptionPix] Error parsing PIX data:', error);
      toast({
        title: "Erro ao carregar PIX",
        description: "Não foi possível carregar os dados de pagamento.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [setLocation, toast]);

  // Timer countdown
  useEffect(() => {
    if (!pixData) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          toast({
            title: "QR Code expirado",
            description: "O tempo para pagamento expirou. Tente novamente.",
            variant: "destructive",
          });
          setTimeout(() => setLocation("/"), 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pixData, setLocation, toast]);

  // Polling otimizado para payment status (detecta mais rápido)
  useEffect(() => {
    if (!pixData || !pixData.transactionId) return;

    let pollCount = 0;
    const maxPolls = 900; // 30 minutes (900 * 2 seconds)
    let shouldStopPolling = false;
    let consecutiveErrors = 0;

    const checkPaymentStatus = async () => {
      if (shouldStopPolling) return;

      try {
        setCheckingPayment(true);
        const data = await checkSubscriptionPaymentStatus(pixData.transactionId);
        consecutiveErrors = 0; // Reset errors on success

        if (isDev) console.log('[SubscriptionPix] Payment status:', data);

        if (data.status === 'paid' || data.status === 'approved' || data.status === 'completed' || data.status === 'active') {
          shouldStopPolling = true;
          if (isDev) console.log('[SubscriptionPix] Payment confirmed!');
          
          const plan = (pixData.plan || 'mensal') as 'mensal' | 'anual';
          const priceInCents = plan === 'mensal' ? 9990 : 36090;
          trackSubscriptionPurchase(plan, priceInCents, pixData.transactionId);
          trackCompleteRegistration({
            content_name: `Assinatura PIX Lowfy ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
            status: 'completed',
            value: priceInCents / 100,
            currency: 'BRL',
          });
          
          toast({
            title: "Pagamento confirmado!",
            description: "Seu pagamento foi processado com sucesso.",
          });
          
          sessionStorage.removeItem('pixSubscriptionData');
          
          if (user) {
            if (isDev) console.log('[SubscriptionPix] User already logged in - redirecting to success page');
            setLocation(`/assinatura/checkout/sucesso?plan=${plan}`);
          } else {
            if (isDev) console.log('[SubscriptionPix] New user - redirecting to account activation');
            if (data.activationToken) {
              setLocation(`/ativar-conta?token=${data.activationToken}`);
            } else {
              toast({
                title: "Erro",
                description: "Token de ativação não encontrado. Entre em contato com o suporte.",
                variant: "destructive",
              });
            }
          }
        } else if (data.status === 'refused' || data.status === 'cancelled' || data.status === 'refunded') {
          shouldStopPolling = true;
          toast({
            title: "Pagamento recusado",
            description: "O pagamento não foi aprovado. Tente novamente.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/");
          }, 2000);
        }
      } catch (error: any) {
        consecutiveErrors++;
        console.error('[SubscriptionPix] Error checking payment status:', error);
        
        if (error.status === 404) {
          shouldStopPolling = true;
          toast({
            title: "Transação não encontrada",
            description: "Não foi possível localizar sua transação.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/");
          }, 2000);
        }
        
        // Se muitos erros consecutivos, aumentar intervalo temporariamente
        if (consecutiveErrors >= 5) {
          if (isDev) console.log('[SubscriptionPix] Too many errors, backing off...');
        }
      } finally {
        setCheckingPayment(false);
      }
    };

    // Check immediately
    checkPaymentStatus();

    // Polling com intervalo de 2 segundos (mais rápido que antes)
    const interval = setInterval(() => {
      if (shouldStopPolling) {
        clearInterval(interval);
        return;
      }

      pollCount++;
      if (pollCount >= maxPolls) {
        clearInterval(interval);
        toast({
          title: "Tempo esgotado",
          description: "O tempo de verificação expirou. Tente novamente.",
          variant: "destructive",
        });
      } else {
        // Se não tem muitos erros, continua polling normalmente
        if (consecutiveErrors < 5) {
          checkPaymentStatus();
        } else {
          // Com muitos erros, poll a cada 3 requests (6 segundos)
          if (pollCount % 3 === 0) checkPaymentStatus();
        }
      }
    }, 2000); // Reduzido de 3000 para 2000ms

    // Verificar quando a página ganha foco (usuário voltou do app do banco)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !shouldStopPolling) {
        if (isDev) console.log('[SubscriptionPix] Page visible, checking payment...');
        checkPaymentStatus();
      }
    };

    // Verificar quando a janela ganha foco
    const handleFocus = () => {
      if (!shouldStopPolling) {
        if (isDev) console.log('[SubscriptionPix] Window focused, checking payment...');
        checkPaymentStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      shouldStopPolling = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pixData, toast, setLocation]);

  const handleCopyCode = () => {
    if (!pixData?.qrCode) return;

    navigator.clipboard.writeText(pixData.qrCode).then(() => {
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "Código PIX copiado para a área de transferência",
      });
      
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!pixData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-2 py-1.5 sm:px-4 sm:py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
            className="text-gray-600 hover:text-gray-900 h-7 px-1.5 sm:h-8 sm:px-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
            <span className="text-xs sm:text-sm">Voltar</span>
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-2 py-3 sm:px-4 sm:py-4">
        {/* Timer */}
        <div className="mb-2 sm:mb-3 flex items-center justify-center gap-1 sm:gap-1.5 text-xs">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
          <span className="text-gray-600">Tempo:</span>
          <span className={`font-semibold px-1.5 py-0.5 rounded-full text-xs ${
            timeLeft < 300 ? "text-red-700 bg-red-50" : "text-blue-700 bg-blue-50"
          }`} data-testid="text-timer">
            {formatTime(timeLeft)}
          </span>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-3 sm:p-5">
            {/* Header */}
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full mb-1.5 sm:mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" className="text-blue-600 sm:w-6 sm:h-6">
                  <path fill="currentColor" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
                  <path fill="currentColor" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
                  <path fill="currentColor" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 mb-0.5 sm:mb-1" data-testid="text-pix-title">
                Pagamento via PIX
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-600">Escaneie o QR Code para finalizar sua assinatura</p>
            </div>

            {/* Real-time indicator */}
            <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2 animate-pulse" data-testid="realtime-indicator">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] sm:text-xs text-green-700 font-medium">
                Aguardando pagamento • Atualização em tempo real
              </p>
            </div>

            {/* Amount */}
            <div className="text-center mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5">Valor a pagar</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900" data-testid="text-amount">
                {formatCurrency(pixData.totalAmount || pixData.amount)}
              </p>
              {pixData.planName && (
                <p className="text-xs text-gray-500 mt-1">{pixData.planName}</p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="bg-white p-2 sm:p-3 rounded-lg shadow-md border border-gray-200">
                {pixData.qrCode ? (
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG 
                      value={pixData.qrCode}
                      size={180}
                      level="M"
                      className="w-full h-auto max-w-[160px] sm:max-w-[180px]"
                      data-testid="qrcode-pix"
                    />
                    <p className="text-[9px] text-gray-500 text-center">Escaneie com o app do banco</p>
                  </div>
                ) : (
                  <div className="w-[160px] h-[160px] sm:w-[180px] sm:h-[180px] bg-gray-100 flex items-center justify-center rounded">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Copy code */}
            {pixData.qrCode && (
              <div className="mb-3 sm:mb-4">
                <p className="text-[11px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5 text-center">
                  Ou copie o código:
                </p>
                <div className="relative">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 pr-16 sm:p-2.5 sm:pr-20 overflow-x-auto">
                    <code className="text-[9px] sm:text-[10px] text-gray-700 break-all leading-tight block" data-testid="text-pix-code">
                      {pixData.qrCode}
                    </code>
                  </div>
                  <Button
                    onClick={handleCopyCode}
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 text-[10px] px-1.5 sm:h-7 sm:text-xs sm:px-2"
                    data-testid="button-copy-pix"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
                        <span className="hidden sm:inline">Copiado!</span>
                        <span className="sm:hidden">OK</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
                        <span className="hidden sm:inline">Copiar</span>
                        <span className="sm:hidden">+</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 sm:p-3">
              <h3 className="font-semibold text-blue-900 mb-1 sm:mb-1.5 text-[11px] sm:text-xs">Como pagar:</h3>
              <ol className="text-[10px] sm:text-xs text-blue-800 space-y-0.5 list-decimal list-inside leading-snug">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar com PIX</li>
                <li>Escaneie o QR Code</li>
                <li>Confirme o pagamento</li>
              </ol>
              <p className="text-[10px] sm:text-xs text-blue-700 mt-1.5 sm:mt-2 font-medium">
                ✓ Após o pagamento, você será redirecionado automaticamente para ativar sua conta
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
