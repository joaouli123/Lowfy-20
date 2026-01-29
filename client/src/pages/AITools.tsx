import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Info, 
  Copy, 
  Check,
  Key,
  AlertCircle,
  ExternalLink,
  Lock,
  PlayCircle,
  BookOpen,
  Wrench
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AITool, GlobalAIAccess } from "@shared/schema";
import { LazyImage } from "@/components/LazyImage";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";
import { SEO, seoConfig } from "@/components/SEO";
import { useTour } from "@/hooks/useTour";
import { aiToolsTour } from "@/config/tours";
import { TourOverlay } from "@/components/ui/tour/TourOverlay";
import { TourButton } from "@/components/ui/tour/TourButton";


export default function AITools() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("ferramentas-ia");
  
  // Tour system
  const tour = useTour(aiToolsTour);

  // SEO Schema Markup
  const aiToolsSchema = {
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
        "name": "Ferramentas de IA",
        "item": "https://lowfy.com.br/ai-tools"
      }
    ]
  };
  
  const { data: aiTools, isLoading: isLoadingTools } = useQuery<AITool[]>({
    queryKey: ["/api/ai-tools"],
    staleTime: 5 * 60 * 1000, // 5 minutos - dados mudam raramente
  });

  const { data: globalAccesses, isLoading: isLoadingAccess } = useQuery<GlobalAIAccess[]>({
    queryKey: ["/api/global-ai-access"],
    staleTime: 2 * 60 * 1000, // 2 minutos - pode mudar ocasionalmente
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);

  const reportLoginIssueMutation = useMutation({
    mutationFn: async (accessLabel: string) => {
      return apiRequest("POST", "/api/support/login-issue", {
        message: `Usuário reportou problemas com login do ${accessLabel}`,
      });
    },
    onSuccess: (_data, accessLabel) => {
      toast({
        title: "Problema reportado!",
        description: `Nossa equipe foi notificada sobre o problema no ${accessLabel} e irá atualizar os acessos em breve.`,
      });
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência.",
    });
  };

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    // YouTube
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // Se já é um embed válido ou outro tipo, retorna o original
    if (url.includes('/embed/') || url.includes('player.')) {
      return url;
    }

    return null;
  };

  const comingSoonTools = {
    "ia": [
      { id: "agente-ia-coming", name: "Agente de IA", isComingSoon: true },
      { id: "hack-ads-coming", name: "Hack Ads", isComingSoon: true }
    ],
  };

  const categories = {
    "ia": { name: "Inteligência Artificial", tools: [] as AITool[] },
    "design": { name: "Design", tools: [] as AITool[] },
    "mineracao": { name: "Ferramentas de Mineração", tools: [] as AITool[] },
    "seo": { name: "SEO", tools: [] as AITool[] },
    "cortesia": { name: "Cortesia", tools: [] as AITool[] },
    "infoprodutos": { name: "Infoprodutos", tools: [] as AITool[] },
    "brinde": { name: "Brinde", tools: [] as AITool[] },
    "manutencao": { name: "Manutenção", tools: [] as AITool[] },
    "assistentes": { name: "IA Conversacional", tools: [] as AITool[] },
    "imagem-video": { name: "Criação de Imagens e Vídeos", tools: [] as AITool[] },
    "edicao": { name: "Edição", tools: [] as AITool[] },
    "apresentacao": { name: "Apresentações", tools: [] as AITool[] },
    "banco-imagens": { name: "Banco de Imagens", tools: [] as AITool[] },
    "texto": { name: "Texto", tools: [] as AITool[] },
    "video": { name: "Vídeo", tools: [] as AITool[] },
    "audio": { name: "Áudio", tools: [] as AITool[] },
    "codigo": { name: "Código", tools: [] as AITool[] },
    "analise": { name: "Análise", tools: [] as AITool[] },
    "outros": { name: "Outros", tools: [] as AITool[] },
  };

  if (aiTools) {
    aiTools.forEach(tool => {
      const category = tool.category || "outros";
      if (categories[category as keyof typeof categories]) {
        categories[category as keyof typeof categories].tools.push(tool);
      }
    });
  }

  const isLoading = isLoadingTools || isLoadingAccess;

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Ferramentas de IA" 
        description="Acesse ferramentas de inteligência artificial premium. Disponível para assinantes e compradores."
      />
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-white">
      <SEO 
        title={seoConfig.ferramentas.title}
        description={seoConfig.ferramentas.description}
        canonicalUrl={seoConfig.ferramentas.canonical}
      />
      <div className="max-w-7xl mx-auto p-4 md:p-8" data-testid="ai-tools-page">
      {/* Header com Tour Button */}
      <div className="mb-8">
        <div className="flex justify-end mb-3 md:hidden">
          <TourButton
            onClick={tour.start}
            label="Conhecer Ferramentas"
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Ferramentas IA Disponíveis</h1>
            <p className="text-muted-foreground">Acesse mais de 30 ferramentas premium com os logins disponibilizados</p>
          </div>
          <div className="hidden md:block">
            <TourButton
              onClick={tour.start}
              label="Conhecer Ferramentas"
            />
          </div>
        </div>
      </div>

      {/* Instruções de Uso */}
      <Card className="mb-8" data-testid="ai-tools-instructions-card">
        <CardHeader>
          <CardTitle>Como Acessar as Ferramentas</CardTitle>
          <CardDescription>
            Siga as instruções abaixo para começar a utilizar as ferramentas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="adspower" className="w-full" data-testid="ai-tools-tabs">
            <TabsList className="grid w-full grid-cols-2 mb-6" data-testid="ai-tools-tabs-list">
              <TabsTrigger value="adspower" data-testid="tab-adspower">AdsPower</TabsTrigger>
              <TabsTrigger value="dicloak" data-testid="tab-dicloak">Dicloak</TabsTrigger>
            </TabsList>
            
            <TabsContent value="adspower" data-testid="content-adspower">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Vídeo AdsPower */}
                <div className="relative w-full aspect-video bg-muted rounded-lg border overflow-hidden">
                  <video 
                    src="/adspower-tutorial.mp4"
                    controls
                    controlsList="nodownload"
                    className="w-full h-full object-cover"
                    data-testid="video-adspower"
                    poster="/adspower-thumbnail.jpg"
                  >
                    Seu navegador não suporta vídeos.
                  </video>
                </div>

                {/* Instruções AdsPower */}
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Assista ao vídeo com atenção para garantir que siga todos os passos corretamente e evite problemas durante o acesso.
                  </p>

                  <p>
                    Baixe e instale o AdsPower clicando{" "}
                    <a 
                      href="https://www.adspower.com/pt/download" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      aqui
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {" "}— a instalação leva apenas alguns minutos.
                  </p>

                  <p>
                    Após a instalação, faça login usando um dos acessos fornecidos abaixo para começar a utilizar as ferramentas.
                  </p>

                  <p>
                    Se algum acesso não funcionar ou se houver alguma ferramenta que não esteja funcionando dentro do acesso, deslogue da conta do AdsPower e faça login na outra conta, conforme demonstrado no vídeo tutorial.
                  </p>

                  <p className="font-medium text-foreground">
                    Se tiver alguma dúvida ou problema durante o processo, entre em contato conosco para assistência imediata!
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="dicloak" data-testid="content-dicloak">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Vídeo Dicloak */}
                <div className="relative w-full aspect-video bg-muted rounded-lg border overflow-hidden">
                  <video 
                    src="/dicloak-tutorial.mp4"
                    controls
                    controlsList="nodownload"
                    className="w-full h-full object-cover"
                    data-testid="video-dicloak"
                    poster="/dicloak-thumbnail.jpg"
                  >
                    Seu navegador não suporta vídeos.
                  </video>
                </div>

                {/* Instruções Dicloak */}
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Assista ao vídeo com atenção para garantir que siga todos os passos corretamente e evite problemas durante o acesso.
                  </p>

                  <p>
                    Baixe e instale o Dicloak clicando{" "}
                    <a 
                      href="https://www.dicloak.com/download" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      aqui
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {" "}— a instalação leva apenas alguns minutos.
                  </p>

                  <p>
                    Após a instalação, faça login usando um dos acessos fornecidos abaixo para começar a utilizar as ferramentas.
                  </p>

                  <p>
                    Se algum acesso não funcionar ou se houver alguma ferramenta que não esteja funcionando dentro do acesso, deslogue da conta do Dicloak e faça login na outra conta, conforme demonstrado no vídeo tutorial.
                  </p>

                  <p className="font-medium text-foreground">
                    Se tiver alguma dúvida ou problema durante o processo, entre em contato conosco para assistência imediata!
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Acessos Globais */}
      <Card className="mb-8" data-testid="ai-tools-global-access">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle>Acessos Globais via AdsPower</CardTitle>
          </div>
          <CardDescription>
            Utilize estes acessos para todas as ferramentas disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4" data-testid="ai-tools-global-credentials">
            {isLoadingAccess ? (
              <div className="col-span-2 text-center py-4 text-muted-foreground">Carregando acessos...</div>
            ) : globalAccesses && globalAccesses.length > 0 ? (
              globalAccesses.map((cred, index) => (
                <Card 
                  key={cred.id} 
                  className="bg-muted/30"
                  data-testid={`global-access-${cred.id}`}
                >
                  <CardHeader className="pb-3">
                    <Badge variant="outline" className="w-fit">
                      <Lock className="w-3 h-3 mr-1" />
                      {cred.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Login</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-background rounded-md p-2.5 border">
                          <p className="text-sm font-mono break-all">{cred.login}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(cred.login, `global-login-${cred.id}`)}
                          data-testid={`button-copy-login-${cred.id}`}
                        >
                          {copiedId === `global-login-${cred.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-background rounded-md p-2.5 border">
                          <p className="text-sm font-mono">{cred.password}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(cred.password, `global-password-${cred.id}`)}
                          data-testid={`button-copy-password-${cred.id}`}
                        >
                          {copiedId === `global-password-${cred.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className={`w-full ${index === 0 ? 'tour-report-button' : ''}`}
                      onClick={() => reportLoginIssueMutation.mutate(cred.label)}
                      disabled={reportLoginIssueMutation.isPending}
                      data-testid={`button-report-${cred.id}`}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Reportar Problema
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-2 text-center py-4 text-muted-foreground">Nenhum acesso disponível no momento</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Catálogo de Ferramentas */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((section) => (
            <div key={section}>
              <div className="h-5 bg-muted rounded w-40 mb-3"></div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="w-10 h-10 bg-muted rounded mb-2 mx-auto"></div>
                    <div className="h-3 bg-muted rounded w-3/4 mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categories).map(([key, category]) => {
            if (category.tools.length === 0) return null;
            const categoryComingSoon = comingSoonTools[key as keyof typeof comingSoonTools] || [];

            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-foreground">{category.name}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {category.tools.length + categoryComingSoon.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {category.tools.map((tool: AITool, index: number) => {
                    const isFirstCard = key === Object.keys(categories)[0] && index === 0;
                    return (
                    <div 
                      key={tool.id}
                      className={`relative border rounded-lg p-3 bg-[#ffffff] ${isFirstCard ? 'ai-tool-card-first' : ''}`}
                      data-testid={`tool-card-${tool.id}`}
                    >
                      {tool.isUnderMaintenance && (
                        <>
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-background shadow-lg" title="Em manutenção"></div>
                          <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-[9px] font-bold py-0.5 px-1 rounded-t-lg text-center shadow-md">
                            EM MANUTENÇÃO
                          </div>
                        </>
                      )}
                      <div className={`flex flex-col items-center text-center gap-2 ${tool.isUnderMaintenance ? 'mt-3' : ''}`}>
                        <div className="w-20 h-20 flex items-center justify-center bg-white rounded-lg p-2">
                          {tool.logoUrl && tool.logoUrl.trim() !== '' ? (
                            <LazyImage
                              src={`/api/image-proxy?url=${encodeURIComponent(tool.logoUrl.trim())}`}
                              alt={tool.name.replace(/^(?:🇧🇷|🇺🇸)\s*(?:🇧🇷|🇺🇸)?\s*/, '').trim()}
                              className="w-full h-full object-contain rounded"
                              width="80"
                              height="80"
                              priority={index < 12}
                              fallbackText={tool.name.replace(/^(?:🇧🇷|🇺🇸)\s*(?:🇧🇷|🇺🇸)?\s*/, '').trim().charAt(0)}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                              <span className="text-xl font-bold text-primary">
                                {tool.name.replace(/^(?:🇧🇷|🇺🇸)\s*(?:🇧🇷|🇺🇸)?\s*/, '').trim().charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-xs font-semibold text-foreground line-clamp-1">
                          {tool.name.replace(/^(?:🇧🇷|🇺🇸)\s*(?:🇧🇷|🇺🇸)?\s*/, '').trim()}
                        </h3>
                        {tool.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 min-h-[2rem]">
                            {tool.description}
                          </p>
                        )}
                        <Button 
                          size="sm" 
                          className="w-full text-xs bg-green-600 hover:bg-green-700 text-white h-7"
                          onClick={() => !tool.isUnderMaintenance && setSelectedTool(tool)}
                          disabled={tool.isUnderMaintenance}
                          data-testid={`button-access-${tool.id}`}
                        >
                          Acesso
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  {categoryComingSoon.map((item: any) => (
                    <div 
                      key={item.id}
                      className="relative border rounded-lg p-3 bg-slate-100 dark:bg-slate-800 opacity-60"
                      data-testid={`tool-card-${item.id}`}
                    >
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-blue-500 text-white text-[9px] font-bold rounded-full">Em Breve</Badge>
                      </div>
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-20 h-20 flex items-center justify-center bg-slate-300 dark:bg-slate-600 rounded-lg p-2">
                          <span className="text-3xl">🔜</span>
                        </div>
                        <h3 className="text-xs font-semibold text-foreground line-clamp-1">
                          {item.name}
                        </h3>
                        <div className="text-[10px] text-muted-foreground min-h-[2rem] flex items-center">
                          <p>Novidade em breve</p>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full text-xs bg-gray-400 text-white h-7 cursor-not-allowed"
                          disabled
                          data-testid={`button-coming-soon-${item.id}`}
                        >
                          Em Breve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes da Ferramenta */}
      <Dialog open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="ai-tool-credentials-modal">
          <DialogHeader>
            <div className="flex items-center gap-4">
              {selectedTool?.logoUrl && selectedTool.logoUrl.trim() !== '' ? (
                <div className="relative w-16 h-16 border rounded-lg bg-muted p-2">
                  <LazyImage
                    src={`/api/image-proxy?url=${encodeURIComponent(selectedTool.logoUrl.trim())}`}
                    alt={selectedTool.name}
                    className="w-full h-full object-contain"
                    width="64"
                    height="64"
                    priority={true}
                    fallbackText={selectedTool?.name.charAt(0)}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center border">
                  <span className="text-2xl font-bold text-primary">
                    {selectedTool?.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <DialogTitle className="text-xl">{selectedTool?.name}</DialogTitle>
                {selectedTool?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedTool.description}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Instruções */}
            {selectedTool?.instructions && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Instruções de Uso
                </h3>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {selectedTool.instructions}
                </div>
              </div>
            )}

            {/* Vídeo Tutorial */}
            {selectedTool?.videoUrl && (() => {
              const embedUrl = getEmbedUrl(selectedTool.videoUrl);
              return embedUrl ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-primary" />
                    Vídeo Tutorial
                  </h3>
                  <div className="aspect-video rounded-lg overflow-hidden border">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      title="Vídeo Tutorial"
                      data-testid="tool-video-iframe"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-primary" />
                    Vídeo Tutorial
                  </h3>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(selectedTool.videoUrl, '_blank')}
                    data-testid="button-open-video"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Assistir Vídeo
                  </Button>
                </div>
              );
            })()}

            {/* Credenciais Específicas */}
            {selectedTool?.accessCredentials && selectedTool.accessCredentials.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  Credenciais de Acesso
                </h3>
                <div className="space-y-3">
                  {selectedTool.accessCredentials.map((cred, idx) => (
                    <Card key={idx} className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <Badge variant="outline" className="w-fit">
                          <Lock className="w-3 h-3 mr-1" />
                          {cred.label}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Login</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-background rounded-md p-2.5 border">
                              <p className="text-sm font-mono break-all">{cred.login}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(cred.login, `tool-login-${idx}`)}
                              data-testid={`button-copy-tool-login-${idx}`}
                            >
                              {copiedId === `tool-login-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-background rounded-md p-2.5 border">
                              <p className="text-sm font-mono">{cred.password}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(cred.password, `tool-password-${idx}`)}
                              data-testid={`button-copy-tool-password-${idx}`}
                            >
                              {copiedId === `tool-password-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Botão para Acessar Ferramenta */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => window.open(selectedTool?.toolUrl, '_blank')}
              data-testid="button-access-tool"
              disabled={selectedTool?.isUnderMaintenance}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Acessar {selectedTool?.name}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tour Overlay */}
      <TourOverlay
        isActive={tour.isActive}
        step={tour.getCurrentStep()}
        currentStep={tour.currentStep}
        totalSteps={aiToolsTour.steps.length}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
        elementRef={tour.getCurrentElement()}
      />
      </div>
    </div>
  );
}