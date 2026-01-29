import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AwaitingData {
  subscriptionId: string;
  transactionId: string;
  activationToken: string;
  plan: string;
}

export default function SubscriptionCheckoutAwaiting() {
  const [, setLocation] = useLocation();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [awaitingData, setAwaitingData] = useState<AwaitingData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  
  useEffect(() => {
    const data = sessionStorage.getItem('subscriptionAwaitingData');
    if (data) {
      setAwaitingData(JSON.parse(data));
    } else {
      setLocation("/assinatura");
    }
  }, [setLocation]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    if (!awaitingData?.subscriptionId) return;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/subscriptions/payment-status/${awaitingData.subscriptionId}`);
        const data = await response.json();
        
        if (data.status === 'active') {
          setPaymentStatus('confirmed');
          sessionStorage.removeItem('subscriptionAwaitingData');
          setTimeout(() => {
            if (data.activationToken) {
              setLocation(`/ativar-conta?token=${data.activationToken}`);
            } else {
              setLocation(`/assinatura/checkout/sucesso?plan=${awaitingData.plan}`);
            }
          }, 1500);
        } else if (data.status === 'cancelled' || data.status === 'refunded') {
          setPaymentStatus('failed');
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    };
    
    const interval = setInterval(checkStatus, 5000);
    checkStatus();
    
    return () => clearInterval(interval);
  }, [awaitingData, setLocation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (paymentStatus === 'confirmed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-emerald-600" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h1>
          <p className="text-gray-600 mb-6">
            Redirecionando para ativação da sua conta...
          </p>
          
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
              <X className="w-16 h-16 text-red-500" />
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
                <p className="font-semibold mb-1">Possíveis motivos</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Cartão bloqueado para compras online</li>
                  <li>Saldo ou limite insuficiente</li>
                  <li>Dados do cartão incorretos</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setLocation("/assinatura")}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-try-again"
          >
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="relative w-24 h-24">
                  <Clock className="w-24 h-24 text-amber-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
                  </div>
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificando Pagamento</h1>
              <p className="text-gray-600 mb-4 text-sm">
                Seu pagamento está sendo processado e verificado pela operadora do cartão. Isso pode levar alguns segundos.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-amber-800">
                  <span className="text-sm font-medium">Tempo de espera:</span>
                  <span className="text-lg font-bold">{formatTime(timeElapsed)}</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm text-gray-600">
                <p className="font-semibold text-gray-900 mb-2">O que está acontecendo?</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Dados do cartão enviados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin mt-0.5 shrink-0" />
                    <span>Verificação anti-fraude em andamento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span>Aguardando confirmação do banco</span>
                  </li>
                </ul>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Não feche esta página. Você será redirecionado automaticamente quando o pagamento for confirmado.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
