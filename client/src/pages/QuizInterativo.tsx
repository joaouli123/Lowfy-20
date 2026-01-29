import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, ExternalLink, Zap, MousePointerClick, Video, Users, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { QuizInterativoSettings } from "@shared/schema";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";
import { useTour } from "@/hooks/useTour";
import { quizInterativoTour } from "@/config/tours";
import { TourOverlay } from "@/components/ui/tour/TourOverlay";
import { TourButton } from "@/components/ui/tour/TourButton";

export default function QuizInterativo() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("quiz");
  
  // Tour system
  const tour = useTour(quizInterativoTour);
  
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<QuizInterativoSettings>({
    queryKey: ["/api/quiz-interativo/settings"],
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos (dados raramente mudam)
    gcTime: 30 * 60 * 1000, // Manter em cache por 30 minutos
    refetchOnWindowFocus: false, // Não refetch ao focar janela (economia de requests)
  });

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência.",
    });
  }, [toast]);

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Quiz Interativo" 
        description="Crie funis interativos para capturar leads. Disponível apenas para assinantes."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <div className="grid lg:grid-cols-2 gap-8">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <p className="text-muted-foreground">Configurações não disponíveis no momento.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-end mb-3 md:hidden">
            <TourButton onClick={tour.start} label="Como Usar" />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-3">Funil Interativo</h1>
              <p className="text-xl text-muted-foreground">
                Crie uma experiência única para os seus clientes e observe o seu{" "}
                <span className="font-semibold text-primary">custo por lead cair drasticamente</span>
              </p>
            </div>
            <div className="hidden md:block">
              <TourButton onClick={tour.start} label="Como Usar" />
            </div>
          </div>
        </div>

        {/* Features and Pricing Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Features Column */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <MousePointerClick className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1.5">Simples, prático e intuitivo</h3>
                    <p className="text-muted-foreground text-sm">
                      Construa o seu funil com um Flow 100% arrasta e solta.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1.5">Rápido e Flexível</h3>
                    <p className="text-muted-foreground text-sm">
                      Crie o seu funil interativo em poucos cliques, com a liberdade e a praticidade de um flow 100% de arrasta e solta.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1.5">Tudo em um só lugar</h3>
                    <p className="text-muted-foreground text-sm">
                      Com o XQuiz, você não precisa mais de hospedagem ou qualquer outro serviço.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Access Card Column */}
          <Card className="h-fit">
            <CardContent className="p-6">
                {/* Acesso à Plataforma */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" />
                    Acesso à Plataforma
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    {/* Credenciais - Wrapper para tour com itens individuais */}
                    <div data-testid="quiz-credentials-section" data-tour-group="credentials">
                      {/* Login */}
                      <div data-tour-credentials-item="true" className="mb-4">
                        <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                          E-mail
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-background/80 rounded-lg p-3 border">
                            <p className="text-sm font-mono font-medium break-all">
                              {settings.login}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(settings?.login || '', 'login')}
                            data-testid="button-copy-login"
                          >
                            {copiedField === 'login' ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Senha */}
                      <div data-tour-credentials-item="true">
                        <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                          Senha
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-background/80 rounded-lg p-3 border">
                            <p className="text-sm font-mono font-medium">
                              {settings.password}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(settings?.password || '', 'password')}
                            data-testid="button-copy-password"
                          >
                            {copiedField === 'password' ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Botão Acessar */}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => window.open(settings?.platformUrl || '#', '_blank')}
                      data-testid="quiz-access-button"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Acessar Plataforma
                    </Button>

                    {/* Observação */}
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900 dark:text-blue-100">
                          <p className="font-semibold mb-1">Observação Importante</p>
                          <p className="text-blue-800 dark:text-blue-200">
                            O acesso ao quiz é um rateio da ferramenta onde possui outras pastas de outros usuários, 
                            mas é de <span className="font-semibold">uso ilimitado e organizado</span>! Sua pasta 
                            é exclusiva e você pode criar quantos quizzes quiser sem restrições.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Video className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Veja como funciona</h2>
            </div>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
              <video
                width="100%"
                height="100%"
                controls
                controlsList="nodownload"
                preload="auto"
                playsInline
                className="w-full h-full object-contain"
                style={{ maxHeight: '600px' }}
              >
                <source src="/xquiz-demo.mp4" type="video/mp4" />
                Seu navegador não suporta o elemento de vídeo.
              </video>
            </div>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => window.open('https://conhecer.xpages.co/', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver um Exemplo
            </Button>
          </CardContent>
        </Card>

        {/* Tour Overlay */}
        <TourOverlay
          isActive={tour.isActive}
          step={tour.getCurrentStep()}
          currentStep={tour.currentStep}
          totalSteps={quizInterativoTour.steps.length}
          onNext={tour.next}
          onPrev={tour.prev}
          onSkip={tour.skip}
          elementRef={tour.getCurrentElement()}
        />
      </div>
    </div>
  );
}
