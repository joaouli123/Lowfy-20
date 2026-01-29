import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trackCompleteRegistration } from "@/hooks/useMetaPixel";
import { trackPurchase, trackAdConversion } from "@/hooks/useGoogleAnalytics";
import confetti from 'canvas-confetti';

const PLANS: Record<string, { name: string; price: string; period: string }> = {
  mensal: {
    name: "Plano Mensal",
    price: "R$ 99,90",
    period: "/mês"
  },
  anual: {
    name: "Plano Anual",
    price: "R$ 360,90",
    period: "/ano"
  }
};

export default function SubscriptionCheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const planType = (new URLSearchParams(window.location.search).get("plan") || "mensal") as "mensal" | "anual";
  const plan = PLANS[planType] || PLANS.mensal;
  const now = new Date();

  // Se não tem usuário, redirecionar
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  // Meta Pixel & Google Analytics: Track purchase on success page
  // Note: Purchase event is fired at checkout moment (SubscriptionCheckout.tsx or SubscriptionPix.tsx)
  useEffect(() => {
    const priceInCents = planType === 'mensal' ? 9990 : 36090;
    const orderId = `subscription-${user?.id}-${Date.now()}`;
    
    // Meta Pixel
    trackCompleteRegistration({
      content_name: `Assinatura Lowfy ${plan.name}`,
      status: 'completed',
      value: priceInCents / 100,
      currency: 'BRL',
    });
    
    // Google Analytics
    trackPurchase(orderId, priceInCents / 100, 'BRL', [
      {
        item_id: `lowfy_${planType}`,
        item_name: `Lowfy ${plan.name}`,
        price: priceInCents / 100,
        quantity: 1,
      }
    ]);
    
    // Google Ads conversion tracking
    trackAdConversion(undefined, priceInCents / 100, 'BRL');
    
    // 🎉 Trigger confetti celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, [planType, plan.name, user?.id]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pagamento Aprovado!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Compra confirmada com sucesso
          </p>
        </div>

        <Card className="mb-6 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Plano escolhido:</p>
                <p className="font-semibold text-gray-900 dark:text-white">{plan.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Data e hora:</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} - {now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor:</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-lg">
                  {plan.price}
                  <span className="text-sm text-gray-600 dark:text-gray-400">{plan.period}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status:</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium text-sm">Ativo</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">Sua assinatura</span> está pronta para usar. Aproveite todos os recursos da plataforma!
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-semibold">💡 Dica:</span> Acesse sua conta a qualquer momento para gerenciar sua assinatura, alterar métodos de pagamento ou cancelar.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base"
            onClick={() => setLocation("/timeline")}
            data-testid="button-go-timeline"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Ir para Timeline
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => setLocation("/assinatura")}
            data-testid="button-go-subscription"
          >
            Gerenciar Assinatura
          </Button>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Precisa de ajuda? Entre em contato com nosso <a href="#" className="text-emerald-600 dark:text-emerald-400 hover:underline">suporte</a>
        </p>
      </div>
    </div>
  );
}
