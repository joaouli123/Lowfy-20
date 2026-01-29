import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Eye, Trash2, Sparkles, RotateCw, Image, GalleryHorizontal, Video, Zap, HelpCircle, AlertTriangle, Shield, PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { MetaAdsCampaign } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import  CreateCampaignWizard from "@/components/CreateCampaignWizard";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

// Helper functions for format and emotion labels/icons
const getFormatIcon = (format?: string) => {
  switch (format) {
    case 'single_image':
      return <Image className="w-3 h-3" />;
    case 'carousel':
      return <GalleryHorizontal className="w-3 h-3" />;
    case 'video_script':
      return <Video className="w-3 h-3" />;
    default:
      return <Image className="w-3 h-3" />;
  }
};

const getFormatLabel = (format?: string) => {
  const formats: Record<string, string> = {
    'single_image': 'Imagem',
    'carousel': 'Carrossel',
    'video_script': 'Vídeo',
  };
  return formats[format || ''] || 'Criativo';
};

const getEmotionIcon = (emotion?: string) => {
  switch (emotion) {
    case 'urgency':
      return <Zap className="w-3 h-3" />;
    case 'curiosity':
      return <HelpCircle className="w-3 h-3" />;
    case 'fear_of_missing_out':
      return <AlertTriangle className="w-3 h-3" />;
    case 'trust':
      return <Shield className="w-3 h-3" />;
    case 'excitement':
      return <PartyPopper className="w-3 h-3" />;
    default:
      return null;
  }
};

const getEmotionLabel = (emotion?: string) => {
  const emotions: Record<string, string> = {
    'urgency': 'Urgência',
    'curiosity': 'Curiosidade',
    'fear_of_missing_out': 'FOMO',
    'trust': 'Confiança',
    'excitement': 'Empolgação',
  };
  return emotions[emotion || ''] || emotion || '';
};

const getObjectiveLabel = (objective?: string) => {
  const objectives: Record<string, string> = {
    'sales': 'Vendas',
    'leads': 'Leads',
    'traffic': 'Tráfego',
    'engagement': 'Engajamento',
    'conversions': 'Conversões',
    'awareness': 'Consciência de Marca',
    'brand': 'Marca',
  };
  return objectives[(objective || '').toLowerCase()] || objective || '';
};

const formatCurrency = (value?: number) => {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function MetaAdsAndromeda() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("andromeda");
  
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MetaAdsCampaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<MetaAdsCampaign[]>({
    queryKey: ['/api/meta-ads/campaigns'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/meta-ads/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      toast({
        title: "Campanha deletada!",
        description: "A campanha foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível deletar a campanha.",
        variant: "destructive",
      });
    },
  });

  const regenerateCreativesMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/meta-ads/campaigns/${id}/regenerate-creatives`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      toast({
        title: "Criativos regenerados!",
        description: "Novos criativos foram gerados com IA.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao regenerar",
        description: "Não foi possível regenerar os criativos.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600';
      case 'paused':
        return 'bg-yellow-600';
      case 'draft':
        return 'bg-gray-500';
      default:
        return 'bg-green-600';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'paused':
        return 'Pausada';
      case 'draft':
        return 'Rascunho';
      default:
        return 'Completa';
    }
  };

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Meta Ads Andromeda" 
        description="Crie campanhas inteligentes com criativos gerados por IA. Disponível apenas para assinantes."
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8" data-testid="meta-ads-andromeda-page">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
              Meta Ads Andromeda
            </h1>
            <p className="text-muted-foreground">
              Crie campanhas inteligentes com criativos gerados por IA baseados na nova atualização Andromeda
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            size="lg"
            className="gap-2"
            data-testid="button-create-campaign"
          >
            <Plus className="w-5 h-5" />
            {showCreateForm ? 'Cancelar' : 'Nova Campanha'}
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <CreateCampaignWizard onClose={() => setShowCreateForm(false)} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : campaigns.length === 0 && !showCreateForm ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada ainda</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando sua primeira campanha Meta Ads com estratégia Andromeda
            </p>
            <Button onClick={() => setShowCreateForm(true)} data-testid="button-create-first-campaign">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow" data-testid={`campaign-card-${campaign.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{campaign.productName}</CardTitle>
                      <Badge className={getStatusColor(campaign.status)}>
                        {getStatusLabel(campaign.status)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatCurrency(campaign.productPrice)} • {getObjectiveLabel(campaign.objective)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Dor que resolve:</p>
                    <p className="text-sm text-muted-foreground">{campaign.painPoint}</p>
                  </div>

                  {Array.isArray(campaign.creatives) && campaign.creatives.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Criativos ({campaign.creatives.length}):</p>
                      <div className="flex gap-2 flex-wrap">
                        {campaign.creatives.map((creative: any, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                            {getFormatIcon(creative.type || creative.format)}
                            {getFormatLabel(creative.type || creative.format)} • {getEmotionLabel(creative.emotion)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedCampaign(campaign)}
                      data-testid={`button-view-${campaign.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Criativos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateCreativesMutation.mutate(campaign.id)}
                      disabled={regenerateCreativesMutation.isPending}
                      data-testid={`button-regenerate-${campaign.id}`}
                    >
                      <RotateCw className={`w-4 h-4 ${regenerateCreativesMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(campaign.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${campaign.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {selectedCampaign && (
        <CampaignDetailsModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}

interface CarouselSlideData {
  image: string;
  description: string;
  cta: string;
  headline: string;
}

function CarouselSlidesView({ 
  slides, 
  creative
}: { 
  slides: any[];
  creative: any;
}) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const totalSlides = slides.length;

  const slideImages = [
    '/ai_automation_technology_workspace.webp',
    '/copywriter_creating_persuasive_content.webp',
    '/viral_marketing_campaign_success.webp',
    '/vsl_and_design_creation_workspace.webp',
    '/dropshipping_logistics_visualization.webp',
  ];

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const currentSlide = slides[carouselIndex];

  return (
    <div className="w-full flex flex-col">
      <div className="bg-white dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
            {carouselIndex + 1} / {totalSlides}
          </span>
          <span className="text-xs text-gray-500">Slide do Carrossel</span>
        </div>
        <p className="text-sm font-semibold mb-1">{currentSlide?.title}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">{currentSlide?.description || currentSlide?.text}</p>
      </div>

      <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-9 text-sm" data-testid="carousel-slides-cta">
          {creative.cta || creative.callToAction || "Saiba Mais"}
        </Button>
      </div>

      <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
        >
          {slides.map((slide: any, index: number) => (
            <div 
              key={index}
              className="min-w-full flex-shrink-0"
              data-testid={`carousel-slides-item-${index}`}
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={slideImages[index % slideImages.length]}
                  alt={slide.title || `Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-base font-bold">{slide.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={prevSlide}
          className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all z-10"
          data-testid="carousel-slides-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={nextSlide}
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all z-10"
          data-testid="carousel-slides-next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_: any, index: number) => (
            <button
              key={index}
              onClick={() => setCarouselIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === carouselIndex 
                  ? 'bg-white scale-110' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              data-testid={`carousel-slides-dot-${index}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StaticImageCarousel({ 
  productName, 
  creative, 
  campaignId 
}: { 
  productName: string; 
  creative: any;
  campaignId: string;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const carouselVariations: CarouselSlideData[] = [
    {
      image: '/ai_automation_technology_workspace.webp',
      headline: 'Transforme seu negócio',
      description: 'Descubra como automatizar suas vendas e escalar seus resultados com estratégias comprovadas.',
      cta: 'Começar Agora'
    },
    {
      image: '/copywriter_creating_persuasive_content.webp',
      headline: 'Resultados reais',
      description: 'Mais de 10.000 empreendedores já transformaram seus negócios com nossa metodologia.',
      cta: 'Ver Resultados'
    },
    {
      image: '/viral_marketing_campaign_success.webp',
      headline: 'Oferta exclusiva',
      description: 'Por tempo limitado: acesse todo o conteúdo com desconto especial de lançamento.',
      cta: 'Aproveitar Desconto'
    },
    {
      image: '/vsl_and_design_creation_workspace.webp',
      headline: 'Garantia total',
      description: 'Satisfação garantida ou seu dinheiro de volta. Sem perguntas, sem burocracia.',
      cta: 'Garantir Minha Vaga'
    },
    {
      image: '/dropshipping_logistics_visualization.webp',
      headline: 'Suporte completo',
      description: 'Acesso direto a nossa equipe de especialistas para tirar todas as suas dúvidas.',
      cta: 'Falar com Especialista'
    }
  ];

  const totalSlides = carouselVariations.length;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const currentVariation = carouselVariations[currentSlide];

  return (
    <div className="w-full" data-testid={`carousel-container-${campaignId}`}>
      <div className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {carouselVariations.map((variation, index) => (
            <div 
              key={index}
              className="min-w-full flex-shrink-0"
              data-testid={`carousel-slide-${index}`}
            >
              <div className="relative h-72 md:h-80 overflow-hidden">
                <img 
                  src={variation.image}
                  alt={variation.headline}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl md:text-2xl font-bold mb-2">{variation.headline}</h3>
                  <p className="text-sm md:text-base opacity-90">{variation.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={prevSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
          data-testid="carousel-prev-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
          data-testid="carousel-next-btn"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {carouselVariations.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-white scale-110' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              data-testid={`carousel-dot-${index}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 border-x border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
            {currentSlide + 1} / {totalSlides}
          </span>
          <span className="text-xs text-gray-500">Variação do Carrossel</span>
        </div>
        <p className="text-sm font-semibold mb-1">{productName}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{currentVariation.description}</p>
      </div>

      <div className="p-4 bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-11 text-base" data-testid="carousel-cta-btn">
          {currentVariation.cta}
        </Button>
      </div>
    </div>
  );
}

function ImageVariationCard({ variation, index, productName }: { variation: any; index: number; productName: string }) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedPrimaryText, setCopiedPrimaryText] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  const copyPrompt = () => {
    const promptWithResolution = `${variation.prompt}\n\nResolução: 1080x1080`;
    navigator.clipboard.writeText(promptWithResolution);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyPrimaryText = () => {
    navigator.clipboard.writeText(variation.primaryText);
    setCopiedPrimaryText(true);
    setTimeout(() => setCopiedPrimaryText(false), 2000);
  };

  const copyTitle = () => {
    navigator.clipboard.writeText(variation.headline);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const copyDescription = () => {
    navigator.clipboard.writeText(variation.description);
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition border border-gray-300 dark:border-gray-600 rounded-lg" data-testid={`image-variation-${index}`}>
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs text-gray-500 font-bold uppercase mb-2">Texto Principal</p>
        <div 
          className="group bg-gray-50 dark:bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          onClick={copyPrimaryText}
        >
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
            {variation.primaryText}
          </p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            {copiedPrimaryText ? '✓ Copiado!' : '👆 Clique para copiar'}
          </p>
        </div>
      </div>

      <div 
        className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 min-h-[160px] flex flex-col items-center justify-center relative cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all mx-3 mb-3 rounded-lg overflow-hidden group"
        onClick={copyPrompt}
      >
        <Badge className="absolute top-3 left-3 bg-white/90 text-green-700 text-xs font-semibold">
          Variacao {index + 1}
        </Badge>
        
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 text-white/40 text-2xl animate-pulse">›</div>
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-white/40 text-2xl animate-pulse">›</div>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-green-100 font-bold uppercase tracking-wider mb-3">
            PROMPT PARA CRIAR IMAGEM
          </p>
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 mx-2">
            <p className="text-sm text-white text-center leading-relaxed">
              {variation.prompt}
            </p>
            <p className="text-xs text-green-100/80 mt-2 pt-2 border-t border-white/20">
              Resolução: 1080x1080
            </p>
          </div>
          <p className="text-xs text-green-100 mt-3 flex items-center justify-center gap-1">
            {copiedPrompt ? '✓ Copiado!' : '👆 Clique para copiar o prompt'}
          </p>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-3">
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-1.5">Titulo</p>
          <div 
            className="flex items-start gap-2 group cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={copyTitle}
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{variation.headline}</p>
            <span className="text-xs text-gray-400">
              {copiedTitle ? '✓' : '📋'}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-1.5">Descricao</p>
          <div 
            className="flex items-start gap-2 group cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={copyDescription}
          >
            <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">{variation.description}</p>
            <span className="text-xs text-gray-400">
              {copiedDesc ? '✓' : '📋'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CarouselSlideCard({ slide, index, total }: { slide: any; index: number; total: number }) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  const slideTitle = slide.title || `Slide ${index + 1}`;
  const slideDescription = slide.description || slide.text || '';
  const slideImagePrompt = slide.imagePrompt || slide.prompt || `Crie uma imagem profissional para: ${slideTitle}. ${slideDescription}`;
  
  const copyPrompt = () => {
    navigator.clipboard.writeText(slideImagePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyTitle = () => {
    navigator.clipboard.writeText(slideTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const copyDescription = () => {
    navigator.clipboard.writeText(slideDescription);
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition border border-gray-300 dark:border-gray-600 rounded-lg" data-testid={`carousel-slide-${index}`}>
      <div className="bg-white dark:bg-gray-900 p-3">
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
          Slide {index + 1}/{total}
        </Badge>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">Prompt para IA de Imagem</p>
          <div 
            className="cursor-pointer bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
            onClick={copyPrompt}
          >
            <p className="text-xs text-green-100 font-bold uppercase tracking-wider mb-2 text-center">
              CLIQUE PARA COPIAR
            </p>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-white leading-relaxed whitespace-pre-wrap font-mono">
                {slideImagePrompt}
              </pre>
            </div>
            <p className="text-xs text-green-100/80 mt-2 text-center">
              {copiedPrompt ? '✓ Copiado!' : '👆 Clique para copiar'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">Titulo</p>
          <div 
            className="cursor-pointer bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={copyTitle}
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{slideTitle}</p>
            <p className="text-xs text-gray-400 mt-1">
              {copiedTitle ? '✓ Copiado!' : '👆 Clique para copiar'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">Texto/Copy do Slide</p>
          <div 
            className="cursor-pointer bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={copyDescription}
          >
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{slideDescription}</p>
            <p className="text-xs text-gray-400 mt-2">
              {copiedDesc ? '✓ Copiado!' : '👆 Clique para copiar'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function VideoScriptCard({ creative, productName }: { creative: any; productName: string }) {
  const [copiedPrimaryText, setCopiedPrimaryText] = useState(false);
  const [copiedVeoScene, setCopiedVeoScene] = useState<number | null>(null);
  const [copiedRoteiro, setCopiedRoteiro] = useState<number | null>(null);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  
  const video = creative.video;
  const legacyScript = creative.videoScript;
  const legacyVeoPrompts = creative.veoPrompts;
  const primaryText = creative.copy || creative.primaryText || `Descubra como ${productName} pode transformar seus resultados. Assista ate o final!`;
  const videoTitle = creative.headline || creative.title || 'Transforme seus resultados';
  const videoDescription = creative.description || 'Descubra o metodo comprovado que esta mudando a vida de milhares de pessoas.';
  
  const hasNewFormat = video && video.cenas;
  const hasLegacyFormat = legacyVeoPrompts && legacyVeoPrompts.scenes;

  const copyPrimaryText = () => {
    navigator.clipboard.writeText(primaryText);
    setCopiedPrimaryText(true);
    setTimeout(() => setCopiedPrimaryText(false), 2000);
  };

  const copyVeoPrompt = (promptVeo: string, index: number) => {
    navigator.clipboard.writeText(promptVeo);
    setCopiedVeoScene(index);
    setTimeout(() => setCopiedVeoScene(null), 2000);
  };

  const copyRoteiro = (roteiro: any, index: number) => {
    const text = `TEXTO NA TELA: ${roteiro.textoNaTela}\n\nNARRACAO: ${roteiro.narracao}`;
    navigator.clipboard.writeText(text);
    setCopiedRoteiro(index);
    setTimeout(() => setCopiedRoteiro(null), 2000);
  };

  const copyTitle = () => {
    navigator.clipboard.writeText(videoTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const copyDescription = () => {
    navigator.clipboard.writeText(videoDescription);
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  };

  const getBadgeColor = (index: number) => {
    const colors = [
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    ];
    return colors[index % colors.length];
  };

  return (
    <Card className="overflow-hidden border border-gray-300 dark:border-gray-600 rounded-lg" data-testid="video-script-card">
      <div className="p-3 space-y-4">
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">Texto Principal (Copy do Anuncio)</p>
          <div 
            className="cursor-pointer bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={copyPrimaryText}
          >
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {primaryText}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {copiedPrimaryText ? '✓ Copiado!' : '👆 Clique para copiar'}
            </p>
          </div>
        </div>

        {hasNewFormat && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-bold uppercase">VIDEO COMPLETO - {video.cenas.length} CENAS</p>
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {video.duracaoTotal}
              </Badge>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg mb-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                <strong>Formato:</strong> {video.formato} | <strong>Plataformas:</strong> {video.plataformas}
              </p>
              {video.padraoVisual && (
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">PADRAO VISUAL (manter em TODAS as cenas):</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <strong>Protagonista:</strong> {video.padraoVisual.protagonista} ({video.padraoVisual.idadeAparente})
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <strong>Ambiente:</strong> {video.padraoVisual.ambiente}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <strong>Cores:</strong> {video.padraoVisual.paletaDeCores}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">
                    {video.padraoVisual.avisoImportante}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {video.cenas.map((cena: any, index: number) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setExpandedScene(expandedScene === index ? null : index)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`${getBadgeColor(index)} text-xs`}>
                        Cena {cena.numero}
                      </Badge>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
                        {cena.duracao}
                      </Badge>
                      <span className="text-sm font-medium">{cena.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{cena.tempoNoVideo}</span>
                      <span className="text-gray-400">{expandedScene === index ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  
                  {expandedScene === index && (
                    <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                      <div 
                        className="cursor-pointer bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                        onClick={() => copyRoteiro(cena.roteiro, index)}
                      >
                        <p className="text-xs text-gray-500 font-bold uppercase mb-2">ROTEIRO DA CENA (clique para copiar)</p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Texto na Tela:</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{cena.roteiro.textoNaTela}</p>
                          </div>
                          <div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Narracao:</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200 italic">"{cena.roteiro.narracao}"</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          {copiedRoteiro === index ? '✓ Roteiro copiado!' : '👆 Clique para copiar roteiro'}
                        </p>
                      </div>
                      
                      <div 
                        className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-lg cursor-pointer hover:from-purple-700 hover:to-purple-900 transition-all"
                        onClick={() => copyVeoPrompt(cena.promptVeo, index)}
                      >
                        <p className="text-xs text-purple-100 font-bold uppercase tracking-wider mb-2 text-center">
                          PROMPT VEO - CENA {cena.numero} (CLIQUE PARA COPIAR)
                        </p>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 max-h-[250px] overflow-y-auto">
                          <pre className="text-xs text-white whitespace-pre-wrap leading-relaxed font-mono">
                            {cena.promptVeo}
                          </pre>
                        </div>
                        <p className="text-xs text-purple-100 mt-3 text-center">
                          {copiedVeoScene === index ? '✓ Prompt copiado!' : '👆 Clique para copiar o prompt Veo'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {video.dicasEdicao && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Dicas de Edicao</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Audio</p>
                    {video.dicasEdicao.audio?.map((dica: string, i: number) => (
                      <p key={i} className="text-xs text-gray-500 dark:text-gray-500">• {dica}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Textos</p>
                    {video.dicasEdicao.textos?.map((dica: string, i: number) => (
                      <p key={i} className="text-xs text-gray-500 dark:text-gray-500">• {dica}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Transicoes</p>
                    {video.dicasEdicao.transicoes?.map((dica: string, i: number) => (
                      <p key={i} className="text-xs text-gray-500 dark:text-gray-500">• {dica}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasNewFormat && hasLegacyFormat && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-bold uppercase">VIDEO COMPLETO - {legacyVeoPrompts.scenes.length} CENAS</p>
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {legacyVeoPrompts.totalDuration}
              </Badge>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg mb-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                <strong>Formato:</strong> {legacyVeoPrompts.videoFormat} | <strong>Plataformas:</strong> {legacyVeoPrompts.platform}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">
                Manter mesma pessoa, mesma roupa, mesmo ambiente em TODAS as cenas!
              </p>
            </div>
            
            <div className="space-y-3">
              {legacyVeoPrompts.scenes.map((scene: any, index: number) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setExpandedScene(expandedScene === index ? null : index)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`${getBadgeColor(index)} text-xs`}>
                        Cena {scene.sceneNumber}
                      </Badge>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
                        {scene.duration}
                      </Badge>
                      <span className="text-sm font-medium">{scene.sceneName}</span>
                    </div>
                    <span className="text-gray-400">{expandedScene === index ? '▲' : '▼'}</span>
                  </div>
                  
                  {expandedScene === index && (
                    <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Texto Overlay:</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{scene.textOverlay}</p>
                          </div>
                          <div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold">Narracao:</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200 italic">"{scene.narration}"</p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-lg cursor-pointer hover:from-purple-700 hover:to-purple-900 transition-all"
                        onClick={() => copyVeoPrompt(scene.veoPrompt, index)}
                      >
                        <p className="text-xs text-purple-100 font-bold uppercase tracking-wider mb-2 text-center">
                          PROMPT VEO - CENA {scene.sceneNumber} (CLIQUE PARA COPIAR)
                        </p>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 max-h-[250px] overflow-y-auto">
                          <pre className="text-xs text-white whitespace-pre-wrap leading-relaxed font-mono">
                            {scene.veoPrompt}
                          </pre>
                        </div>
                        <p className="text-xs text-purple-100 mt-3 text-center">
                          {copiedVeoScene === index ? '✓ Prompt copiado!' : '👆 Clique para copiar o prompt Veo'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {legacyVeoPrompts.editingNotes && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Notas de Edicao</p>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {legacyVeoPrompts.editingNotes}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase mb-1">Titulo</p>
            <div 
              className="cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={copyTitle}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">{videoTitle}</p>
              <p className="text-xs text-gray-400 mt-1">
                {copiedTitle ? '✓ Copiado!' : '👆 Copiar'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-bold uppercase mb-1">Descricao</p>
            <div 
              className="cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={copyDescription}
            >
              <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{videoDescription}</p>
              <p className="text-xs text-gray-400 mt-1">
                {copiedDesc ? '✓ Copiado!' : '👆 Copiar'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CampaignDetailsModal({ campaign, onClose }: { campaign: MetaAdsCampaign; onClose: () => void }) {
  const creatives = Array.isArray(campaign.creatives) ? campaign.creatives : [];
  
  const imageCreatives = creatives.filter((c: any) => (c.type || c.format) === 'single_image');
  const carouselCreatives = creatives.filter((c: any) => (c.type || c.format) === 'carousel');
  const videoCreatives = creatives.filter((c: any) => (c.type || c.format) === 'video_script');

  const imageVariations = [
    { 
      image: '/ai_automation_technology_workspace.webp', 
      primaryText: `Voce ja imaginou ${campaign.productDescription?.toLowerCase() || 'transformar sua vida'}? Com ${campaign.productName}, isso se torna realidade. Milhares de pessoas ja estao colhendo os resultados!`,
      headline: 'Transforme seu negocio', 
      description: 'Descubra como automatizar suas vendas e escalar seus resultados.', 
      cta: 'Comecar Agora', 
      prompt: `Ultra-professional marketing photograph for ${campaign.productName}: Modern minimalist workspace with sleek desk, laptop displaying success metrics dashboard, soft ambient lighting, warm color palette (navy blue and gold accents), confident diverse entrepreneur smiling at camera, high-end furniture, plants in background, bokeh office lights, depth of field photography, 8K quality, cinematic lighting, luxury aesthetic, professional headshot style, inspiring and aspirational mood, trending on advertisement platforms, high contrast, vibrant colors, shot with professional camera, perfect composition` 
    },
    { 
      image: '/copywriter_creating_persuasive_content.webp', 
      primaryText: `${campaign.painPoint || 'Cansado de lutar sozinho?'} ${campaign.productName} e a solucao que voce precisa. Resultados comprovados por mais de 10.000 pessoas!`,
      headline: 'Resultados reais', 
      description: 'Mais de 10.000 empreendedores transformaram seus negocios.', 
      cta: 'Ver Resultados', 
      prompt: `High-impact testimonial-style marketing image for ${campaign.productName}: Montage of 4-6 diverse, happy people of different ethnicities and ages showing genuine joy, success charts with upward arrows in background, celebration atmosphere, confetti or light rays, warm golden hour lighting, professional portrait photography, emotional connection, authentic smiles, real people aesthetic, lifestyle photography, high-resolution, vibrant energy, conversion-focused design, social proof visual, trending aesthetic, premium quality, sharp focus on faces, blurred success backgrounds, inspirational storytelling, 8K detail` 
    },
    { 
      image: '/viral_marketing_campaign_success.webp', 
      primaryText: `ATENCAO: Por tempo LIMITADO, ${campaign.productName} esta com desconto especial! Nao perca essa oportunidade unica de ${campaign.productDescription?.toLowerCase() || 'transformar seus resultados'}.`,
      headline: 'Oferta exclusiva', 
      description: 'Por tempo limitado: acesse com desconto especial.', 
      cta: 'Aproveitar', 
      prompt: `Attention-grabbing promotional image for ${campaign.productName}: Bold vibrant colors (bright orange, electric blue, neon pink), large percentage discount badge (40-70% OFF), countdown timer visual elements, urgency indicators, explosion of energy and motion, dynamic composition, trending on social media, eye-catching design, contrasting bright backgrounds, bold typography effect, premium product showcase, luxury branding, limited edition aesthetic, FOMO-inducing visuals, professional ad design, high saturation colors, metallic accents, premium feel, 8K quality, magazine-cover style, conversion optimized` 
    },
    { 
      image: '/vsl_and_design_creation_workspace.webp', 
      primaryText: `Sem riscos! Com ${campaign.productName}, voce tem garantia total de satisfacao. Se nao gostar, devolvemos 100% do seu dinheiro. Simples assim!`,
      headline: 'Garantia total', 
      description: 'Satisfacao garantida ou seu dinheiro de volta.', 
      cta: 'Garantir Vaga', 
      prompt: `Trust-building premium image for ${campaign.productName}: Serene, professional office setting with visible trust elements - security badges, check marks, shield icons subtly integrated into design, peaceful expression of professional, premium leather furniture, soft natural light through large windows, calm color palette (whites, soft blues, greens), professional certificate or medal display, reassuring atmosphere, premium aesthetic, luxury office environment, security and reliability visual metaphor, high-end photography, depth of field, professional lighting, trustworthy brand presentation, premium quality, 8K resolution, magazine-style photography` 
    },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            {campaign.productName}
          </DialogTitle>
          <DialogDescription>
            Criativos gerados com IA • Clique para copiar prompts
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="images" className="flex items-center gap-1.5">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Imagens</span>
              {imageCreatives.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{imageCreatives.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="carousel" className="flex items-center gap-1.5">
              <GalleryHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Carrossel</span>
              {carouselCreatives.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{carouselCreatives.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1.5">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Vídeo</span>
              {videoCreatives.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{videoCreatives.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="strategy" className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Estratégia</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="mt-0">
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Variacoes de Anuncio</p>
              <p className="text-xs text-blue-600 dark:text-blue-300">Texto principal, prompt para criar imagem, titulo e descricao - clique para copiar cada elemento</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imageVariations.map((variation, index) => (
                <ImageVariationCard key={index} variation={variation} index={index} productName={campaign.productName || ''} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="carousel" className="mt-0">
            {carouselCreatives.length > 0 ? (
              carouselCreatives.map((creative: any, creativeIndex: number) => {
                const slides = creative.slides || creative.carouselSlides || [];
                return (
                  <div key={creativeIndex} className="mb-6">
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Carrossel {creativeIndex + 1} • {slides.length} slides
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-300">
                        Cada slide com título, descrição e prompt para imagem
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {slides.map((slide: any, slideIndex: number) => (
                        <CarouselSlideCard 
                          key={slideIndex} 
                          slide={slide} 
                          index={slideIndex} 
                          total={slides.length} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <GalleryHorizontal className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum carrossel gerado</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            {videoCreatives.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Roteiros de Vídeo</p>
                  <p className="text-xs text-red-600 dark:text-red-300">Scripts prontos para gravar seus vídeos</p>
                </div>
                {videoCreatives.map((creative: any, index: number) => (
                  <VideoScriptCard 
                    key={index} 
                    creative={creative} 
                    productName={campaign.productName || ''} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum roteiro de vídeo gerado</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="strategy" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Estratégia Andromeda</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{campaign.strategyNotes || "Nenhuma nota disponível"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações da Campanha</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Produto</p>
                  <p>{campaign.productName}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Preço</p>
                  <p>R$ {campaign.productPrice?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Objetivo</p>
                  <p>{getObjectiveLabel(campaign.objective)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Link</p>
                  <a href={campaign.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate block">
                    {campaign.destinationUrl}
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
