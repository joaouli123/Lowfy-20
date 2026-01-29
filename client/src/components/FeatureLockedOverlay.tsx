import { Lock, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

interface FeatureLockedOverlayProps {
  featureName: string;
  description?: string;
}

export function FeatureLockedOverlay({ 
  featureName, 
  description = "Este recurso está disponível apenas para assinantes." 
}: FeatureLockedOverlayProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <Card className="max-w-md w-full border-2 border-primary/20 shadow-xl">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2" data-testid="text-feature-locked-title">
            {featureName}
          </h2>
          
          <p className="text-muted-foreground mb-6" data-testid="text-feature-locked-description">
            {description}
          </p>
          
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-primary font-medium mb-2">
              <Crown className="w-5 h-5" />
              <span>Benefícios do Plano Completo</span>
            </div>
            <ul className="text-sm text-left space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                Clonador de Páginas ilimitado
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                Criador de Pre-Sells automático
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                Meta Ads Andromeda - Campanhas completas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                Quiz Interativo para vendas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                Automações N8N prontas
              </li>
            </ul>
          </div>
          
          <Button 
            size="lg" 
            className="w-full gap-2"
            onClick={() => setLocation("/assinatura")}
            data-testid="button-unlock-feature"
          >
            Desbloquear Agora
            <ArrowRight className="w-4 h-4" />
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            Assine e tenha acesso completo a todas as ferramentas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
