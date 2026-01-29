import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "@/contexts/SocketContext";
import { trackMarketplacePurchase, trackCompleteRegistration } from "@/hooks/useMetaPixel";
import { queryClient } from "@/lib/queryClient";

// Função especializada para polling que não redireciona em 401
async function checkPaymentStatusRequest(transactionId: string) {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/marketplace/payment-status/${transactionId}`, {
    method: 'GET',
    headers,
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

export default function CheckoutPix() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { on, off, isConnected } = useSocket();
  const [pixData, setPixData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutos
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    // Recuperar dados do PIX do sessionStorage
    const savedData = sessionStorage.getItem('pixPaymentData');
    if (!savedData) {
      setLocation("/marketplace/cart");
      return;
    }

    try {
      const data = JSON.parse(savedData);

      if (!data.qrCode && !data.transactionId) {
        toast({
          title: "Erro ao carregar PIX",
          description: "Dados de pagamento incompletos. Tente novamente.",
          variant: "destructive",
        });
        setLocation("/marketplace/cart");
        return;
      }

      setPixData(data);

      // Atualizar URL com referência do transactionId
      if (data.transactionId) {
        window.history.replaceState({}, '', `/marketplace/checkout/pix/${data.transactionId}`);
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar PIX",
        description: "Não foi possível carregar os dados de pagamento.",
        variant: "destructive",
      });
      setLocation("/marketplace/cart");
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
          setTimeout(() => setLocation("/marketplace/cart"), 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pixData, setLocation, toast]);

  // Polling para verificar status do pagamento em tempo real
  useEffect(() => {
    if (!pixData || !pixData.transactionId) return;

    let pollCount = 0;
    const maxPolls = 600; // 30 minutos (600 * 3 segundos)
    let shouldStopPolling = false;

    const checkPaymentStatus = async () => {
      if (shouldStopPolling) return;

      try {
        setCheckingPayment(true);
        const data = await checkPaymentStatusRequest(pixData.transactionId);

        if (data.status === 'paid' || data.status === 'approved' || data.status === 'completed' || data.status === 'active') {
          shouldStopPolling = true;

          // Invalidar cache imediatamente para que as compras apareçam em tempo real
          queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-purchases"] });
          queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });

          // Track Purchase event
          if (pixData?.orderId && pixData?.totalAmount) {
            const { trackMarketplacePurchase } = await import('@/hooks/useMetaPixel');
            trackMarketplacePurchase(
              pixData.productName || 'Marketplace Product',
              pixData.totalAmount,
              pixData.orderId,
              pixData.orderId
            );
          }

          toast({
            title: "Pagamento confirmado!",
            description: "Seu pagamento foi processado com sucesso.",
          });

          sessionStorage.removeItem('pixPaymentData');
          sessionStorage.setItem('payment_success', 'true');

          setLocation("/marketplace/order/success");
        } else if (data.status === 'refused' || data.status === 'cancelled' || data.status === 'refunded') {
          // Pagamento recusado
          shouldStopPolling = true;
          toast({
            title: "Pagamento recusado",
            description: "O pagamento não foi aprovado. Tente novamente.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/marketplace/cart");
          }, 2000);
        }
      } catch (error: any) {
        shouldStopPolling = true;

        if (error.status === 401) {
          toast({
            title: "Sessão expirada",
            description: "Por favor, faça login novamente para verificar o status do pagamento.",
            variant: "destructive",
          });

          // Limpar token e redirecionar
          localStorage.removeItem('auth_token');
          setTimeout(() => {
            setLocation("/");
          }, 2000);
        } else if (error.status === 404) {
          toast({
            title: "Pedido não encontrado",
            description: "Não foi possível localizar seu pedido. Retornando ao carrinho.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/marketplace/cart");
          }, 2000);
        } else if (error.status === 403) {
          toast({
            title: "Acesso negado",
            description: "Você não tem permissão para visualizar este pedido.",
            variant: "destructive",
          });
          setTimeout(() => {
            setLocation("/marketplace/cart");
          }, 2000);
        } else {
          shouldStopPolling = false;
        }
      } finally {
        setCheckingPayment(false);
      }
    };

    // Verificar imediatamente
    checkPaymentStatus();

    // Verificar a cada 3 segundos para ser mais rápido
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
          description: "O tempo de verificação expirou. Verifique seu pedido na página 'Minhas Compras'.",
          variant: "destructive",
        });
      } else {
        checkPaymentStatus();
      }
    }, 3000);

    return () => {
      shouldStopPolling = true;
      clearInterval(interval);
    };
  }, [pixData, toast, setLocation]);

  // WebSocket para atualização em tempo real
  useEffect(() => {
    if (!pixData?.transactionId || !isConnected) {
      return;
    }

    const handlePaymentConfirmed = ({ transactionId }: { transactionId: string }) => {
      if (transactionId === pixData.transactionId) {
        // Invalidar cache imediatamente para que as compras apareçam em tempo real
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });

        toast({
          title: "Pagamento confirmado!",
          description: "Seu pedido foi processado com sucesso.",
        });

        sessionStorage.setItem('payment_success', 'true');
        setLocation("/marketplace/order/success");
      }
    };

    const handlePaymentRefused = ({ transactionId }: { transactionId: string }) => {
      if (transactionId === pixData.transactionId) {
        toast({
          title: "Pagamento recusado",
          description: "O pagamento não foi aprovado. Tente novamente.",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/marketplace/cart");
        }, 2000);
      }
    };

    on('payment_confirmed', handlePaymentConfirmed);
    on('payment_refused', handlePaymentRefused);

    return () => {
      off('payment_confirmed', handlePaymentConfirmed);
      off('payment_refused', handlePaymentRefused);
    };
  }, [pixData, toast, setLocation, isConnected, on, off]);

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
      {/* Header compacto */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-2 py-1.5 sm:px-4 sm:py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/marketplace/cart")}
            data-testid="button-back-to-cart"
            className="text-gray-600 hover:text-gray-900 h-7 px-1.5 sm:h-8 sm:px-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
            <span className="text-xs sm:text-sm">Voltar</span>
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-2 py-3 sm:px-4 sm:py-4">
        {/* Timer compacto */}
        <div className="mb-2 sm:mb-3 flex items-center justify-center gap-1 sm:gap-1.5 text-xs">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
          <span className="text-gray-600">Tempo:</span>
          <span className={`font-semibold px-1.5 py-0.5 rounded-full text-xs ${
            timeLeft < 300 ? "text-red-700 bg-red-50" : "text-blue-700 bg-blue-50"
          }`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-3 sm:p-5">
            {/* Header compacto */}
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full mb-1.5 sm:mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" className="text-blue-600 sm:w-6 sm:h-6">
                  <path fill="currentColor" d="M11.9,12h-0.68l8.04-8.04c2.62-2.61,6.86-2.61,9.48,0L36.78,12H36.1c-1.6,0-3.11,0.62-4.24,1.76l-6.8,6.77c-0.59,0.59-1.53,0.59-2.12,0l-6.8-6.77C15.01,12.62,13.5,12,11.9,12z"/>
                  <path fill="currentColor" d="M36.1,36h0.68l-8.04,8.04c-2.62,2.61-6.86,2.61-9.48,0L11.22,36h0.68c1.6,0,3.11-0.62,4.24-1.76l6.8-6.77c0.59-0.59,1.53-0.59,2.12,0l6.8,6.77C32.99,35.38,34.5,36,36.1,36z"/>
                  <path fill="currentColor" d="M44.04,28.74L38.78,34H36.1c-1.07,0-2.07-0.42-2.83-1.17l-6.8-6.78c-1.36-1.36-3.58-1.36-4.94,0l-6.8,6.78C13.97,33.58,12.97,34,11.9,34H9.22l-5.26-5.26c-2.61-2.62-2.61-6.86,0-9.48L9.22,14h2.68c1.07,0,2.07,0.42,2.83,1.17l6.8,6.78c0.68,0.68,1.58,1.02,2.47,1.02s1.79-0.34,2.47-1.02l6.8-6.78C34.03,14.42,35.03,14,36.1,14h2.68l5.26,5.26C46.65,21.88,46.65,26.12,44.04,28.74z"/>
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 mb-0.5 sm:mb-1">Pagamento via PIX</h1>
              <p className="text-[11px] sm:text-xs text-gray-600">Escaneie o QR Code</p>
            </div>

            {/* Indicador de verificação em tempo real */}
            <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2 animate-pulse" data-testid="realtime-indicator">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] sm:text-xs text-green-700 font-medium">
                Aguardando pagamento • Atualização em tempo real
              </p>
            </div>

            {/* Valor compacto */}
            <div className="text-center mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5">Valor a pagar</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {formatCurrency(pixData.totalAmount)}
              </p>
            </div>

            {/* QR Code compacto */}
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

            {/* Código PIX compacto */}
            {pixData.qrCode && (
              <div className="mb-3 sm:mb-4">
                <p className="text-[11px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5 text-center">
                  Ou copie o código:
                </p>
                <div className="relative">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 pr-16 sm:p-2.5 sm:pr-20 overflow-x-auto">
                    <code className="text-[9px] sm:text-[10px] text-gray-700 break-all leading-tight block">
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

            {/* Instruções compactas */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 sm:p-3">
              <h3 className="font-semibold text-blue-900 mb-1 sm:mb-1.5 text-[11px] sm:text-xs">Como pagar:</h3>
              <ol className="text-[10px] sm:text-xs text-blue-800 space-y-0.5 list-decimal list-inside leading-snug">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar com PIX</li>
                <li>Escaneie o QR Code</li>
                <li>Confirme o pagamento</li>
              </ol>
              <p className="text-[10px] sm:text-xs text-blue-700 mt-1.5 sm:mt-2 font-medium">
                ✓ Confirmação automática
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}