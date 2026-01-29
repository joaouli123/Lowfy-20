import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutAwaitingConfirmation() {
  const [, setLocation] = useLocation();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [transactionId, setTransactionId] = useState<string>("");
  const [paymentFailed, setPaymentFailed] = useState(false);
  
  useEffect(() => {
    // Recuperar transaction ID do storage
    const cardData = sessionStorage.getItem('cardPaymentData');
    if (cardData) {
      const data = JSON.parse(cardData);
      setTransactionId(data.transactionId);
    }
  }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Poll payment status a cada 5 segundos
  useEffect(() => {
    if (!transactionId) return;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/marketplace/payment-status/${transactionId}`);
        const data = await response.json();
        
        // CONFIRMED = pagamento aprovado
        if (data.status === 'CONFIRMED' || data.status === 'confirmed') {
          sessionStorage.setItem('payment_success', 'true');
          setLocation("/marketplace/order/success");
        }
        // FAILED ou outros status de rejeição
        else if (data.status === 'FAILED' || data.status === 'failed' || data.status === 'REJECTED') {
          setPaymentFailed(true);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };
    
    const interval = setInterval(checkStatus, 5000);
    checkStatus(); // Verificar imediatamente na primeira vez
    
    return () => clearInterval(interval);
  }, [transactionId, setLocation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (paymentFailed) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative w-24 h-24">
              <X className="w-24 h-24 text-red-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pagamento Rejeitado</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Seu pagamento foi rejeitado pelo banco ou processadora. Por favor, tente novamente com outro cartão.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-semibold mb-1">Motivo da rejeição</p>
                <p>Verifique com seu banco se o cartão está bloqueado para compras online ou se há saldo disponível.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setLocation("/marketplace/cart")}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Voltar e Tentar Novamente
            </Button>
            
            <Button
              onClick={() => setLocation("/marketplace")}
              variant="outline"
              className="w-full"
            >
              Continuar Comprando
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative w-24 h-24">
            <Clock className="w-24 h-24 text-yellow-500 animate-spin" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirmando Pagamento</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Seu pagamento foi enviado para processamento. Estamos aguardando a confirmação do Asaas...
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Por favor, NÃO feche esta página</p>
              <p>A confirmação pode levar até 2 minutos. Você receberá um email quando o pagamento for confirmado.</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-600 mb-1">Tempo decorrido</p>
          <p className="text-2xl font-bold text-gray-900">{formatTime(timeElapsed)}</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => setLocation("/marketplace/compras")}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Ir para Minhas Compras
          </Button>
          
          <Button
            onClick={() => setLocation("/marketplace")}
            variant="outline"
            className="w-full"
          >
            Continuar Comprando
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Seu transactionId: {transactionId || 'N/A'}
        </p>
      </div>
    </div>
  );
}
