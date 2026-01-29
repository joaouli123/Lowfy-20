import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Package, ArrowRight, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackCompleteRegistration, trackCustomEvent } from "@/hooks/useMetaPixel";
import { trackPurchase, trackAdConversion } from "@/hooks/useGoogleAnalytics";
import { queryClient } from "@/lib/queryClient";

export default function OrderSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    sessionStorage.removeItem('pixPaymentData');
    sessionStorage.removeItem('payment_success');
    
    // Invalidar cache para garantir que as compras apareçam imediatamente
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-purchases"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
    
    // Meta Pixel
    trackCustomEvent('MarketplacePurchaseComplete', {
      status: 'success',
    });
    trackCompleteRegistration({
      content_name: 'Marketplace Purchase',
      status: 'completed',
    });
    
    // Google Analytics - rastrear compra no marketplace
    const orderId = `marketplace-${Date.now()}`;
    trackPurchase(orderId, 0, 'BRL', [
      {
        item_id: 'marketplace_purchase',
        item_name: 'Marketplace Purchase',
        quantity: 1,
      }
    ]);
    
    // Google Ads conversion tracking
    trackAdConversion();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-none shadow-xl">
        <CardContent className="p-8 sm:p-12 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Compra Realizada!
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Seu pagamento foi processado com sucesso. Você já pode acessar seus produtos.
          </p>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">
              Detalhes do Pedido
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Número do pedido</span>
                <span className="font-mono font-medium text-gray-900">#ORD-{Date.now().toString().slice(-8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Data</span>
                <span className="font-medium text-gray-900">
                  {new Date().toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Pago
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Próximos Passos
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Um e-mail de confirmação foi enviado para você</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Acesse seus produtos na área "Minhas Compras"</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Você tem 7 dias de garantia para solicitar reembolso</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1 bg-green-700 hover:bg-green-800 text-white"
              onClick={() => setLocation("/marketplace/compras")}
              data-testid="button-view-purchases"
            >
              <Download className="w-4 h-4 mr-2" />
              Ver Meus Produtos
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/marketplace/vitrine")}
              data-testid="button-continue-shopping"
            >
              Continuar Comprando
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Support Link */}
          <p className="text-sm text-gray-500 mt-6">
            Precisa de ajuda?{" "}
            <button
              onClick={() => setLocation("/support")}
              className="text-blue-600 hover:text-blue-700 font-medium"
              data-testid="link-support"
            >
              Entre em contato com o suporte
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
