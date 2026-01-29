import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { XCircle, CreditCard, AlertTriangle, RefreshCw, ArrowLeft, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trackAdAbandonedCheckout } from "@/hooks/useGoogleAnalytics";

type FailureReason = "card_declined" | "insufficient_funds" | "pix_expired" | "unknown";

const FAILURE_MESSAGES: Record<FailureReason, { title: string; description: string; icon: React.ReactNode }> = {
  card_declined: {
    title: "Cartão Recusado",
    description: "Seu cartão foi recusado pela operadora. Verifique os dados ou tente outro cartão.",
    icon: <CreditCard className="w-6 h-6 text-red-600" />,
  },
  insufficient_funds: {
    title: "Saldo Insuficiente",
    description: "Não há saldo disponível no cartão para concluir esta transação.",
    icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
  },
  pix_expired: {
    title: "PIX Expirado",
    description: "O código PIX expirou. Gere um novo código para concluir sua compra.",
    icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
  },
  unknown: {
    title: "Erro no Pagamento",
    description: "Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.",
    icon: <XCircle className="w-6 h-6 text-red-600" />,
  },
};

export default function OrderFailure() {
  const [, setLocation] = useLocation();
  const [failureReason] = useState<FailureReason>("unknown");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedError = sessionStorage.getItem('paymentError');
    if (storedError) {
      setErrorMessage(storedError);
      sessionStorage.removeItem('paymentError');
    }

    // Rastrear checkout abandonado (falha no pagamento)
    const cartTotal = sessionStorage.getItem('cartTotal');
    if (cartTotal) {
      const total = parseFloat(cartTotal);
      if (total > 0) {
        trackAdAbandonedCheckout(total / 100, 'BRL', 1);
      }
    }
  }, []);

  const message = FAILURE_MESSAGES[failureReason];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-none shadow-xl">
        <CardContent className="p-8 sm:p-12 text-center">
          {/* Failure Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              {message.icon}
            </div>
          </div>

          {/* Failure Message */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {message.title}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {errorMessage || message.description}
          </p>

          {/* Detailed Error Message */}
          {errorMessage && (
            <Alert className="mb-8 text-left border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Detalhes do erro:</p>
                <p className="text-sm">{errorMessage}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Common Issues */}
          <Alert className="mb-8 text-left border-blue-200 bg-blue-50">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-gray-700">
              <p className="font-semibold mb-2">Problemas comuns e soluções:</p>
              <ul className="space-y-1 text-sm">
                <li>• Verifique se os dados do cartão estão corretos</li>
                <li>• Confirme se há saldo disponível</li>
                <li>• Tente usar outro cartão de crédito</li>
                <li>• Entre em contato com seu banco se o problema persistir</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">
              Detalhes da Tentativa
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Data da tentativa</span>
                <span className="font-medium text-gray-900">
                  {new Date().toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Falhou
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Motivo</span>
                <span className="font-medium text-gray-900">{message.title}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Button
              size="lg"
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              onClick={() => setLocation("/checkout")}
              data-testid="button-try-again"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/marketplace/cart")}
              data-testid="button-back-to-cart"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Carrinho
            </Button>
          </div>

          {/* Alternative Payment */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Experimente o PIX!</span> Pagamento instantâneo
            </p>
          </div>

          {/* Support Link */}
          <p className="text-sm text-gray-500">
            Continua com problemas?{" "}
            <button
              onClick={() => setLocation("/support")}
              className="text-blue-600 hover:text-blue-700 font-medium"
              data-testid="link-support"
            >
              Fale com nosso suporte
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
