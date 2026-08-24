import { useState, memo, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Eye, Search, Download, BookOpen, ExternalLink, Lock, HelpCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";
import { useTour } from "@/hooks/useTour";
import { plrsTour } from "@/config/tours";
import { TourOverlay } from "@/components/ui/tour/TourOverlay";
import { TourButton } from "@/components/ui/tour/TourButton";
import { SEO, seoConfig } from "@/components/SEO";
import type { PLRWithRelations, Category, PLRTag } from "@shared/schema";
import * as flags from 'country-flag-icons/react/3x2';

export default function PLRs() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("plrs");
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPLR, setSelectedPLR] = useState<PLRWithRelations | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const { user } = useAuth();
  
  // Tour system
  const tour = useTour(plrsTour);
  const firstPLRRef = useRef<PLRWithRelations | null>(null);
  
  // Verificar se é usuário trial (sem acesso pago)
  // Usuários com accessPlan 'basic' ou 'full' NÃO são trial
  // Usuários com subscriptionStatus 'active' também NÃO são trial
  const isTrial = user && !user.accessPlan && !user.isAdmin && 
    (user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'none' || !user.subscriptionStatus);
  
  // Abrir sheet automaticamente quando tour chegar no passo de downloads
  useEffect(() => {
    const currentStep = tour.getCurrentStep();
    if (tour.isActive && currentStep?.id === 'downloads-section' && !selectedPLR && firstPLRRef.current) {
      setSelectedPLR(firstPLRRef.current);
    }
  }, [tour.isActive, tour.currentStep, selectedPLR]);

  const { data: categories = [] } = useQuery<Category[]>({ 
    queryKey: ['/api/categories'],
    staleTime: Infinity, // Categorias são dados estáticos - cache permanente até invalidação manual
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const { data: tags = [] } = useQuery<PLRTag[]>({ 
    queryKey: ['/api/plr-tags'],
    staleTime: Infinity, // Tags são dados estáticos - cache permanente até invalidação manual
    gcTime: 24 * 60 * 60 * 1000, // 24 horas
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const categoryFilter = selectedCategory === "all" ? undefined : selectedCategory;

  const { data: plrs, isLoading } = useQuery<{ data: PLRWithRelations[], total: number }>({
    queryKey: ['/api/plrs', categoryFilter, searchTerm, currentPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const params = new URLSearchParams();
      if (categoryFilter) params.append('categoryId', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('limit', String(ITEMS_PER_PAGE));
      params.append('offset', String(offset));
      const response = await fetch(`/api/plrs?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch PLRs');
      const { data, total } = await response.json();
      return { data, total };
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Manter em cache por 10 minutos
  });

  // Paginação server-side
  const totalItems = plrs?.total || 0;
  const plrData = plrs?.data || [];
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  // Reset page quando mudar filtros
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const likeMutation = useMutation({
    mutationFn: async (plrId: string) => {
      const response = await fetch(`/api/plrs/${plrId}/like`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to like PLR');
      return response.json();
    },
    onMutate: async (plrId) => {
      // Query key específica para esta página
      const currentQueryKey = ['/api/plrs', categoryFilter, searchTerm, currentPage];
      
      // Cancelar apenas a query específica atual
      await queryClient.cancelQueries({ queryKey: currentQueryKey });

      // Snapshot do estado anterior
      const previousPlrs = queryClient.getQueryData<{ data: PLRWithRelations[], total: number }>(currentQueryKey);

      // Atualização otimista apenas na query atual
      queryClient.setQueryData<{ data: PLRWithRelations[], total: number }>(
        currentQueryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map(plr => {
              if (plr.id === plrId) {
                return {
                  ...plr,
                  hasLiked: !plr.hasLiked,
                  likeCount: (plr.likeCount || 0) + (plr.hasLiked ? -1 : 1)
                };
              }
              return plr;
            })
          };
        }
      );

      return { previousPlrs, currentQueryKey };
    },
    onError: (_err, _plrId, context) => {
      // Reverter apenas a query específica em caso de erro
      if (context?.previousPlrs && context?.currentQueryKey) {
        queryClient.setQueryData(context.currentQueryKey, context.previousPlrs);
      }
    },
    onSuccess: (updatedPLR, _plrId, context) => {
      // Atualizar a query específica com os dados reais do servidor
      if (context?.currentQueryKey) {
        queryClient.setQueryData<{ data: PLRWithRelations[], total: number }>(
          context.currentQueryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(plr => plr.id === updatedPLR.id ? updatedPLR : plr)
            };
          }
        );
      }
      
      // Invalidar outras queries de PLRs para manter consistência (sem refetch imediato)
      queryClient.invalidateQueries({ 
        queryKey: ['/api/plrs'],
        exact: false,
        refetchType: 'none'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/my-plrs'],
        refetchType: 'none'
      });
    },
  });

  const getLanguageFlagCode = (languageCode: string) => {
    const baseCode = languageCode.split('-')[0].toLowerCase();
    const languageToCountry: Record<string, string> = {
      'pt': 'BR',
      'en': 'GB',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'ja': 'JP',
      'ko': 'KR',
      'zh': 'CN',
      'ru': 'RU',
      'ar': 'SA',
      'hi': 'IN',
    };
    return languageToCountry[baseCode] || 'UN';
  };

  // Usuários FREE podem ver 3 PLRs grátis - não bloqueia a página inteira
  // A lógica de bloqueio individual está no PLRCard (isBlocked={isTrial && index >= 3})

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-[50px] pb-8">
      <SEO 
        title={seoConfig.plrs.title}
        description={seoConfig.plrs.description}
        canonicalUrl={seoConfig.plrs.canonical}
      />
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">PLRs Lowfy</h1>
          <p className="text-muted-foreground">Baixe produtos com direitos de revenda</p>
        </div>
        <TourButton
          onClick={tour.start}
          label="Conhecer PLRs"
        />
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="w-full sm:flex-1 sm:min-w-[200px]" data-testid="plr-search-section">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar PLRs..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-white w-full"
                data-testid="input-search-plr"
              />
            </div>
          </div>

          <div data-testid="plr-category-filter">
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full sm:w-[200px] bg-white" data-testid="select-category">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {!isLoading && totalItems > 0 && (
          <div className="mb-4 text-sm text-muted-foreground">
            Exibindo {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} PLRs
          </div>
        )}
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-80 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <PLRGrid 
              plrs={plrData} 
              onSelectPLR={(plr) => {
                setSelectedPLR(plr);
                // Guardar referência do primeiro PLR para o tour
                if (!firstPLRRef.current && plrData.length > 0) {
                  firstPLRRef.current = plrData[0];
                }
              }}
              onLike={(plrId) => likeMutation.mutate(plrId)} 
              getLanguageFlagCode={getLanguageFlagCode}
              isTrial={!!isTrial}
              isFirstCardForTour={tour.isActive}
              onFirstCardMount={(plr) => { firstPLRRef.current = plr; }}
            />
            
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-9"
                      data-testid={`button-page-${page}`}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Próximo
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <PLRSheet 
        plr={selectedPLR} 
        open={!!selectedPLR} 
        onClose={() => setSelectedPLR(null)}
        getLanguageFlagCode={getLanguageFlagCode}
        isTourActive={tour.isActive}
      />
      
      {/* Tour Overlay */}
      <TourOverlay
        isActive={tour.isActive}
        step={tour.getCurrentStep()}
        currentStep={tour.currentStep}
        totalSteps={plrsTour.steps.length}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
        elementRef={tour.getCurrentElement()}
        position={tour.getCurrentStep()?.position}
      />
    </div>
  );
}

// Função pura para extrair flags de idiomas - movida para fora do componente
const getLanguageFlags = (downloads: any[]) => {
  if (!downloads || downloads.length === 0) return [];

  const uniqueLanguages = new Map();
  downloads.forEach(download => {
    if (download.language) {
      uniqueLanguages.set(download.language.code, {
        code: download.language.code,
        name: download.language.name
      });
    }
  });

  return Array.from(uniqueLanguages.values());
};

// Constante global para labels de tipos - evita recriação a cada render
const TYPE_LABELS: Record<string, string> = {
  'vsl': 'VSL',
  'quiz': 'Quiz',
  'landingpage': 'Página',
  'criativos': 'Criativos',
  'capa': 'Capa',
  'ebook': 'E-book'
};

// Componente PLRCard memoizado - renderiza apenas quando seus dados mudam
const PLRCard = memo(function PLRCard({ 
  plr, 
  onSelectPLR, 
  onLike,
  getLanguageFlagCode,
  animatingHeart,
  onHeartAnimationStart,
  isBlocked = false,
  isFirstCard = false,
}: { 
  plr: PLRWithRelations,
  onSelectPLR: (plr: PLRWithRelations) => void,
  onLike: (plrId: string) => void,
  getLanguageFlagCode: (code: string) => string,
  animatingHeart: string | null,
  onHeartAnimationStart: (plrId: string) => void,
  isBlocked?: boolean,
  isFirstCard?: boolean,
}) {
  // Memoiza o cálculo de idiomas disponíveis
  const availableLanguages = useMemo(() => getLanguageFlags(plr.downloads || []), [plr.downloads]);

  // Memoiza o handler de like para este card específico
  const handleLikeClick = useCallback(() => {
    if (!isBlocked) {
      onHeartAnimationStart(plr.id);
      onLike(plr.id);
    }
  }, [plr.id, onLike, onHeartAnimationStart, isBlocked]);

  return (
    <Card 
      className="card-modern overflow-hidden group w-full relative" 
      data-testid={isFirstCard ? 'plr-first-card' : `card-plr-${plr.id}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
        {plr.coverImageUrl ? (
          <OptimizedImage
            src={plr.coverImageUrl}
            alt={plr.title}
            className="w-full h-full transition-transform duration-500 group-hover:scale-105"
            quality={95}
            objectFit="contain"
            onError={(e: any) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.fallback-icon');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div className={`fallback-icon w-full h-full items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 ${plr.coverImageUrl ? 'hidden' : 'flex'}`}>
          <BookOpen className="w-24 h-24 text-primary/50" />
        </div>

        {!plr.isFree && plr.price && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow-lg border-0 px-3 py-1">
              R$ {(plr.price / 100).toFixed(2)}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div 
          className={`flex gap-1.5 flex-wrap ${isFirstCard ? 'tour-language-flags' : ''}`}
          data-testid={isFirstCard ? 'plr-language-flags' : undefined}
        >
          {availableLanguages.map((lang, index) => {
            const countryCode = getLanguageFlagCode(lang.code);
            const FlagComponent = flags[countryCode as keyof typeof flags];

            return (
              <div 
                key={lang.code}
                className={`w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 flex items-center justify-center ${index === 0 && isFirstCard ? 'tour-first-language-flag' : ''}`}
                title={lang.name}
                data-testid={`flag-${lang.code}-${plr.id}`}
              >
                {FlagComponent ? (
                  <FlagComponent className="w-8 h-8 object-cover scale-150" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px]">
                    {lang.code.toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {plr.category && (
          <Badge className="bg-gradient-to-r from-primary to-emerald-500 text-white hover:shadow-lg transition-shadow border-0" data-testid={`badge-category-${plr.id}`}>
            {plr.category.name}
          </Badge>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold text-lg line-clamp-2 flex-1" data-testid={`text-title-${plr.id}`}>
              {plr.title}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1.5 shrink-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                handleLikeClick();
              }}
              data-testid={`button-like-${plr.id}`}
            >
              <Heart 
                className={`h-5 w-5 transition-all ${
                  plr.hasLiked 
                    ? 'fill-red-500 text-red-500' 
                    : 'text-gray-400 hover:text-red-500'
                } ${animatingHeart === plr.id ? 'heart-pulse' : ''}`} 
              />
              <span className="text-sm font-medium text-foreground" data-testid={`text-likes-${plr.id}`}>
                {plr.likeCount || 0}
              </span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">{plr.description}</p>

          {plr.downloads && plr.downloads.length > 0 && (
            <div 
              className={`flex gap-1.5 flex-wrap mt-2 ${isFirstCard ? 'tour-content-types' : ''}`}
              data-testid={isFirstCard ? 'plr-content-types' : undefined}
            >
              {Array.from(new Set(plr.downloads.map(d => d.type))).map((type, index) => (
                <Badge 
                  key={type}
                  variant="outline" 
                  className={`text-xs border-gray-300 text-gray-700 ${index === 0 && isFirstCard ? 'tour-first-content-type' : ''}`}
                >
                  {TYPE_LABELS[type] || type}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {plr.creator && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {plr.creator.profileImageUrl ? (
              <img 
                src={plr.creator.profileImageUrl} 
                alt={plr.creator.name} 
                className="w-8 h-8 rounded-full object-cover"
                loading="lazy"
                decoding="async"
                data-testid={`avatar-creator-${plr.id}`}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold">{plr.creator.name[0]}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium" data-testid={`text-creator-name-${plr.id}`}>
                {plr.creator.name}
              </span>
              {plr.creator.profession && (
                <span className="text-xs text-muted-foreground" data-testid={`text-creator-profession-${plr.id}`}>
                  {plr.creator.profession}
                </span>
              )}
            </div>
          </div>
        )}

        <Button 
          className={`w-full bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all ${isFirstCard ? 'tour-view-details-button' : ''}`}
          onClick={() => !isBlocked && onSelectPLR(plr)}
          disabled={isBlocked}
          data-testid={isFirstCard ? 'plr-view-details-button' : `button-view-details-${plr.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          Ver Detalhes
        </Button>
      </div>

      {/* Overlay de bloqueio para contas trial */}
      {isBlocked && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-10 p-6">
          <div className="bg-white rounded-full p-4 shadow-xl">
            <Lock className="w-12 h-12 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h4 className="text-xl font-bold text-white">
              Conteúdo Bloqueado
            </h4>
            <p className="text-sm text-gray-200">
              Assine para ter acesso ilimitado a todos os PLRs
            </p>
          </div>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-700 text-white font-bold shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = '/planos';
            }}
            data-testid={`button-upgrade-${plr.id}`}
          >
            Assinar Agora
          </Button>
        </div>
      )}
    </Card>
  );
});

const PLRGrid = memo(function PLRGrid({ 
  plrs, 
  onSelectPLR, 
  onLike,
  getLanguageFlagCode,
  isTrial = false,
  isFirstCardForTour = false,
  onFirstCardMount,
}: { 
  plrs: PLRWithRelations[], 
  onSelectPLR: (plr: PLRWithRelations) => void,
  onLike: (plrId: string) => void,
  getLanguageFlagCode: (code: string) => string,
  isTrial?: boolean,
  isFirstCardForTour?: boolean,
  onFirstCardMount?: (plr: PLRWithRelations) => void,
}) {
  const [animatingHeart, setAnimatingHeart] = useState<string | null>(null);

  // Memoiza o callback de animação do coração
  const handleHeartAnimationStart = useCallback((plrId: string) => {
    setAnimatingHeart(plrId);
    setTimeout(() => setAnimatingHeart(null), 600);
  }, []);
  
  // Notificar sobre o primeiro PLR montado para o tour
  useEffect(() => {
    if (plrs.length > 0 && onFirstCardMount) {
      onFirstCardMount(plrs[0]);
    }
  }, [plrs, onFirstCardMount]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plrs.map((plr, index) => (
        <PLRCard
          key={plr.id}
          plr={plr}
          onSelectPLR={onSelectPLR}
          onLike={onLike}
          getLanguageFlagCode={getLanguageFlagCode}
          animatingHeart={animatingHeart}
          onHeartAnimationStart={handleHeartAnimationStart}
          isBlocked={isTrial && index >= 3}
          isFirstCard={index === 0}
        />
      ))}
    </div>
  );
});

const PLRSheet = memo(function PLRSheet({ 
  plr, 
  open, 
  onClose,
  getLanguageFlagCode,
  isTourActive = false
}: { 
  plr: PLRWithRelations | null, 
  open: boolean, 
  onClose: () => void,
  getLanguageFlagCode: (code: string) => string,
  isTourActive?: boolean
}) {
  if (!plr) return null;

  const groupedDownloads = useMemo(() => {
    return plr.downloads?.reduce((acc, download) => {
      if (!acc[download.type]) {
        acc[download.type] = [];
      }
      acc[download.type].push(download);
      return acc;
    }, {} as Record<string, any[]>) || {};
  }, [plr.downloads]);

  const downloadTypes = useMemo(() => Object.keys(groupedDownloads), [groupedDownloads]);

  const handleDownload = useCallback((download: any, type: string) => {
    if (type === 'quiz') {
      const link = document.createElement('a');
      link.href = download.fileUrl;
      link.download = download.fileUrl.split('/').pop() || 'quiz.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(download.fileUrl, '_blank');
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        className="w-full max-w-full sm:max-w-md overflow-y-auto p-0" 
        data-testid="sheet-plr-details"
        side="right"
      >
        {open && (
          <>
            <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
              <SheetTitle className="text-xl font-bold pr-8">{plr.title}</SheetTitle>
              
              {/* Categoria e Curtidas */}
              <div className="flex items-center gap-3 mt-2">
                {plr.category && (
                  <Badge className="bg-gradient-to-r from-primary to-emerald-500 text-white border-0">
                    {plr.category.name}
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                  <span className="text-sm font-medium">{plr.likeCount || 0} curtidas</span>
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-4">
              {/* Capa */}
              <div className="w-full aspect-[3/2] overflow-hidden rounded-lg relative">
                {plr.coverImageUrl ? (
                  <OptimizedImage
                    src={plr.coverImageUrl}
                    alt={plr.title}
                    className="w-full h-full"
                    quality={85}
                    objectFit="cover"
                    loading="lazy"
                    onError={(e: any) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      const fallback = e.target.parentElement.querySelector('.fallback-icon-sheet');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`fallback-icon-sheet w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center ${plr.coverImageUrl ? 'hidden absolute inset-0' : 'flex'}`}>
                  <BookOpen className="w-20 h-20 text-primary/40" />
                </div>
              </div>

              {/* Sobre este PLR - Descrição */}
              <div className="bg-emerald-50 p-4 rounded-lg">
                <h3 className="font-semibold text-base text-emerald-700 mb-2">Sobre este PLR</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{plr.description}</p>
              </div>

              {/* Downloads Disponíveis - Organizados por tipo em Accordion */}
              <div className="space-y-2" data-testid="plr-downloads-section">
                <h3 className="font-semibold text-base">Downloads Disponíveis</h3>
                
                {downloadTypes.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {downloadTypes.map((type) => {
                      const downloads = groupedDownloads[type];
                      return (
                        <AccordionItem key={type} value={type} className="border rounded-lg mb-2">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-medium">
                                {TYPE_LABELS[type] || type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ({downloads.length} idioma{downloads.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2">
                              {downloads.map((download) => {
                                const countryCode = getLanguageFlagCode(download.language?.code || '');
                                const FlagComponent = flags[countryCode as keyof typeof flags];
                                
                                return (
                                  <div 
                                    key={download.id} 
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                                    data-testid={`download-item-${download.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {FlagComponent && (
                                        <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0">
                                          <FlagComponent className="w-8 h-8 object-cover scale-150" />
                                        </div>
                                      )}
                                      <span className="text-sm font-medium">{download.language?.name || 'Sem idioma'}</span>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      className="bg-primary hover:bg-primary/90 text-white h-8"
                                      data-testid={`button-download-${download.id}`}
                                      onClick={() => handleDownload(download, type)}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Baixar
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum download disponível</p>
                )}
              </div>

              {/* Links Extras */}
              {plr.extraLinks && plr.extraLinks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">Links Extras</h3>
                  <div className="space-y-2">
                    {plr.extraLinks.map((link, index) => {
                      const truncatedUrl = link.url.length > 15 ? link.url.substring(0, 15) + '...' : link.url;
                      
                      return (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium truncate">{link.title}</span>
                              <span className="text-xs text-muted-foreground">{truncatedUrl}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Criador */}
              {plr.creator && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-3">
                    {plr.creator.profileImageUrl ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden">
                        <OptimizedImage
                          src={plr.creator.profileImageUrl}
                          alt={plr.creator.name}
                          className="w-full h-full"
                          width={48}
                          height={48}
                          objectFit="cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold">{plr.creator.name[0]}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{plr.creator.name}</p>
                      {plr.creator.profession && (
                        <p className="text-sm text-muted-foreground">{plr.creator.profession}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Comprar */}
              {!plr.isFree && plr.price && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-2xl font-bold">R$ {(plr.price / 100).toFixed(2)}</span>
                    <Button size="lg" className="flex-1">Comprar Agora</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
});