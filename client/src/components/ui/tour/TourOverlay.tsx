import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface TourOverlayProps {
  isActive: boolean;
  step: {
    title: string;
    description: string;
  } | null;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  elementRef?: HTMLElement | null;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

type Placement = 'top' | 'bottom' | 'left' | 'right';

export function TourOverlay({
  isActive,
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  elementRef,
  position = 'bottom',
}: TourOverlayProps) {
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [highlightPos, setHighlightPos] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [actualPlacement, setActualPlacement] = useState<Placement>('bottom');
  const [clipPath, setClipPath] = useState<string>('');
  const [cardWidth, setCardWidth] = useState(340);

  useEffect(() => {
    if (!isActive || !elementRef) return;

    // Primeiro, garantir que o elemento está visível na viewport
    elementRef.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const updatePositions = () => {
      // Verificar se o elemento ainda existe
      if (!elementRef) return;
      
      let rect: DOMRect;
      
      // Verificar se é um grupo de credenciais - calcular bounding box dos itens filhos
      const tourGroup = elementRef.dataset?.tourGroup;
      
      if (tourGroup === 'credentials') {
        // Encontrar apenas os itens filhos (não o wrapper)
        const childItems = elementRef.querySelectorAll('[data-tour-credentials-item="true"]');
        
        if (childItems.length > 0) {
          let minTop = Infinity, minLeft = Infinity, maxRight = 0, maxBottom = 0;
          
          childItems.forEach(el => {
            const elRect = el.getBoundingClientRect();
            minTop = Math.min(minTop, elRect.top);
            minLeft = Math.min(minLeft, elRect.left);
            maxRight = Math.max(maxRight, elRect.right);
            maxBottom = Math.max(maxBottom, elRect.bottom);
          });
          
          rect = new DOMRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
        } else {
          rect = elementRef.getBoundingClientRect();
        }
      } else {
        rect = elementRef.getBoundingClientRect();
      }
      
      // Verificar se o elemento tem dimensões válidas
      if (rect.width === 0 || rect.height === 0) return;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Posição do highlight com padding reduzido para grupos
      const padding = tourGroup === 'credentials' ? 4 : 6;
      
      const hlTop = rect.top - padding;
      const hlLeft = rect.left - padding;
      const hlWidth = rect.width + padding * 2;
      const hlHeight = rect.height + padding * 2;

      setHighlightPos({
        top: hlTop,
        left: hlLeft,
        width: hlWidth,
        height: hlHeight,
      });

      // Criar clip-path que "recorta" a área do elemento do overlay
      // Usando polygon com buraco (even-odd fill rule via path)
      const x1 = hlLeft;
      const y1 = hlTop;
      const x2 = hlLeft + hlWidth;
      const y2 = hlTop + hlHeight;
      
      // Path que cobre toda a tela, mas com um buraco retangular onde está o elemento
      setClipPath(`polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
      )`);

      // Dimensões do card - menor no mobile
      const isMobile = vw < 768;
      const computedCardWidth = isMobile ? Math.min(320, vw - 32) : 340;
      setCardWidth(computedCardWidth);
      const cardHeight = 200;
      const gap = isMobile ? 16 : 20;
      const screenPadding = isMobile ? 16 : 24;

      // Calcular posição do card
      let cardLeft: number;
      let cardTop: number;
      let placement: Placement = 'bottom';

      // Espaço disponível ao redor do elemento
      const spaceRight = vw - rect.right - gap;
      const spaceLeft = rect.left - gap;
      const spaceBottom = vh - rect.bottom - gap;
      const spaceTop = rect.top - gap;

      // NO MOBILE: forçar abaixo > acima > centralizado (nunca esquerda/direita)
      if (isMobile) {
        cardLeft = (vw - computedCardWidth) / 2; // Sempre centralizado horizontalmente
        
        if (spaceBottom >= cardHeight + screenPadding) {
          cardTop = rect.bottom + gap;
          placement = 'bottom';
        } else if (spaceTop >= cardHeight + screenPadding) {
          cardTop = rect.top - cardHeight - gap;
          placement = 'top';
        } else {
          // Fallback: centro da tela
          cardTop = (vh - cardHeight) / 2;
          placement = 'bottom';
        }
      } else {
        // DESKTOP: lógica original com direita/esquerda
        const elementCenterX = rect.left + rect.width / 2;
        const isOnRightSide = elementCenterX > vw / 2;

        if (isOnRightSide) {
          if (spaceLeft >= computedCardWidth + screenPadding) {
            cardLeft = rect.left - computedCardWidth - gap;
            cardTop = Math.max(screenPadding, rect.top + (rect.height / 2) - (cardHeight / 2));
            placement = 'left';
          } else if (spaceRight >= computedCardWidth + screenPadding) {
            cardLeft = rect.right + gap;
            cardTop = Math.max(screenPadding, rect.top + (rect.height / 2) - (cardHeight / 2));
            placement = 'right';
          } else if (spaceBottom >= cardHeight + screenPadding) {
            cardLeft = rect.left + (rect.width / 2) - (computedCardWidth / 2);
            cardTop = rect.bottom + gap;
            placement = 'bottom';
          } else if (spaceTop >= cardHeight + screenPadding) {
            cardLeft = rect.left + (rect.width / 2) - (computedCardWidth / 2);
            cardTop = rect.top - cardHeight - gap;
            placement = 'top';
          } else {
            cardLeft = (vw - computedCardWidth) / 2;
            cardTop = vh - cardHeight - screenPadding - 20;
            placement = 'bottom';
          }
        } else {
          if (spaceRight >= computedCardWidth + screenPadding) {
            cardLeft = rect.right + gap;
            cardTop = Math.max(screenPadding, rect.top + (rect.height / 2) - (cardHeight / 2));
            placement = 'right';
          } else if (spaceLeft >= computedCardWidth + screenPadding) {
            cardLeft = rect.left - computedCardWidth - gap;
            cardTop = Math.max(screenPadding, rect.top + (rect.height / 2) - (cardHeight / 2));
            placement = 'left';
          } else if (spaceBottom >= cardHeight + screenPadding) {
            cardLeft = rect.left + (rect.width / 2) - (computedCardWidth / 2);
            cardTop = rect.bottom + gap;
            placement = 'bottom';
          } else if (spaceTop >= cardHeight + screenPadding) {
            cardLeft = rect.left + (rect.width / 2) - (computedCardWidth / 2);
            cardTop = rect.top - cardHeight - gap;
            placement = 'top';
          } else {
            cardLeft = (vw - computedCardWidth) / 2;
            cardTop = vh - cardHeight - screenPadding - 20;
            placement = 'bottom';
          }
        }
      }

      // CLAMPING: Garantir que o card NUNCA saia da tela
      cardLeft = Math.max(screenPadding, Math.min(cardLeft, vw - computedCardWidth - screenPadding));
      cardTop = Math.max(screenPadding, Math.min(cardTop, vh - cardHeight - screenPadding));

      setActualPlacement(placement);
      setTooltipPos({ top: cardTop, left: cardLeft });
    };

    // Delay inicial para esperar o scroll terminar
    const scrollTimeout = setTimeout(() => {
      updatePositions();
    }, 350);

    // Também atualizar imediatamente para evitar flash
    updatePositions();

    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true); // true para capturar eventos de scroll em containers
    
    // Observar scroll em containers pai
    const scrollableParents: Element[] = [];
    let parent = elementRef.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflow === 'auto' || style.overflow === 'scroll' || 
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        parent.addEventListener('scroll', updatePositions);
        scrollableParents.push(parent);
      }
      parent = parent.parentElement;
    }
    
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
      scrollableParents.forEach(el => el.removeEventListener('scroll', updatePositions));
    };
  }, [isActive, elementRef, position]);

  if (!isActive || !step || !elementRef) return null;

  return (
    <>
      {/* Overlay escuro COM BURACO usando clip-path */}
      <div 
        className="fixed inset-0 bg-black/60 pointer-events-auto z-[9990]" 
        onClick={onSkip}
        style={{
          clipPath: clipPath,
        }}
      />

      {/* Borda verde ao redor do elemento - SEM boxShadow */}
      {highlightPos.width > 0 && (
        <div
          className="fixed border-4 border-green-500 rounded-lg z-[9995] pointer-events-none"
          style={{
            top: highlightPos.top,
            left: highlightPos.left,
            width: highlightPos.width,
            height: highlightPos.height,
          }}
        />
      )}

      {/* Card do tour - ACIMA DE TUDO */}
      <div
        className="pointer-events-auto fixed bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-5 border border-accent/30 z-[10000]"
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: `${cardWidth}px`,
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        {/* Seta apontando para o elemento */}
        <div
          className="absolute w-4 h-4 bg-white dark:bg-slate-900"
          style={{
            ...(actualPlacement === 'top' && {
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              borderRight: '1px solid hsl(var(--accent) / 0.3)',
              borderBottom: '1px solid hsl(var(--accent) / 0.3)',
            }),
            ...(actualPlacement === 'bottom' && {
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              borderLeft: '1px solid hsl(var(--accent) / 0.3)',
              borderTop: '1px solid hsl(var(--accent) / 0.3)',
            }),
            ...(actualPlacement === 'left' && {
              right: '-8px',
              top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              borderTop: '1px solid hsl(var(--accent) / 0.3)',
              borderRight: '1px solid hsl(var(--accent) / 0.3)',
            }),
            ...(actualPlacement === 'right' && {
              left: '-8px',
              top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              borderBottom: '1px solid hsl(var(--accent) / 0.3)',
              borderLeft: '1px solid hsl(var(--accent) / 0.3)',
            }),
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">{step.title}</h3>
          </div>
          <button
            onClick={onSkip}
            className="ml-2 p-1 hover:bg-muted rounded transition-colors pointer-events-auto"
            aria-label="Pular tour"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Descrição */}
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{step.description}</p>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1 mb-4">
          <div
            className="bg-accent h-1 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Footer com controles */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            {currentStep + 1} de {totalSteps}
          </span>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button variant="default" size="sm" onClick={onNext} className="gap-1">
              {currentStep === totalSteps - 1 ? 'Fechar' : 'Próximo'}
              {currentStep !== totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
