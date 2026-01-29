import { useState, useCallback, useEffect } from 'react';

export interface TourStep {
  id: string;
  element: string; // data-testid do elemento ou seletor CSS (começa com .)
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void; // callback quando chegar neste step
  desktopOnly?: boolean; // se true, só mostra em desktop (tela >= 1024px)
}

export interface TourConfig {
  id: string;
  name: string;
  steps: TourStep[];
}

const STORAGE_KEY = 'lowfy-tours-completed';

export function useTour(config: TourConfig) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [currentElement, setCurrentElement] = useState<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filtrar steps baseado no dispositivo
  const filteredSteps = config.steps.filter(step => {
    if (step.desktopOnly && isMobile) return false;
    return true;
  });

  // Verificar se tour já foi completado
  const isCompleted = useCallback(() => {
    const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return completed[config.id] === true;
  }, [config.id]);

  // Marcar tour como completado
  const markCompleted = useCallback(() => {
    const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    completed[config.id] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [config.id]);

  // Iniciar tour
  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setSkipped(false);
  }, []);

  // Próximo step
  const next = useCallback(() => {
    const nextStepIndex = currentStep + 1;
    if (nextStepIndex < filteredSteps.length) {
      setCurrentStep(nextStepIndex);
      filteredSteps[nextStepIndex]?.action?.();
    } else {
      // Completar tour - chegou ao final
      markCompleted();
      setIsActive(false);
    }
  }, [currentStep, filteredSteps, markCompleted]);

  // Passo anterior
  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Pular tour
  const skip = useCallback(() => {
    setIsActive(false);
    setSkipped(true);
  }, []);

  // Resetar tour
  const reset = useCallback(() => {
    const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete completed[config.id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    setCurrentStep(0);
    setSkipped(false);
  }, [config.id]);

  // Obter step atual
  const getCurrentStep = () => filteredSteps[currentStep];

  // Função helper para buscar elemento
  const findElement = useCallback((selector: string): HTMLElement | null => {
    if (selector.startsWith('.')) {
      return document.querySelector(selector) as HTMLElement;
    }
    return document.querySelector(`[data-testid="${selector}"]`) as HTMLElement;
  }, []);

  // Effect para encontrar e centralizar o elemento com retry
  useEffect(() => {
    if (!isActive) {
      setCurrentElement(null);
      return;
    }

    const step = filteredSteps[currentStep];
    if (!step) {
      setCurrentElement(null);
      return;
    }

    // Retry loop para encontrar elemento (até 500ms)
    let attempts = 0;
    const maxAttempts = 10;
    const retryInterval = 50;

    const tryFindElement = () => {
      const element = findElement(step.element);
      if (element) {
        setCurrentElement(element);
        
        // Centralizar elemento na viewport
        const rect = element.getBoundingClientRect();
        const vh = window.innerHeight;
        const elementCenterY = rect.top + rect.height / 2;
        const viewportCenterY = vh / 2;
        const scrollOffset = elementCenterY - viewportCenterY;
        
        // Só fazer scroll se necessário
        if (Math.abs(scrollOffset) > 50) {
          const targetScroll = Math.max(0, window.scrollY + scrollOffset);
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
          });
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryFindElement, retryInterval);
      } else {
        setCurrentElement(null);
      }
    };

    // Pequeno delay para dar tempo do DOM renderizar
    setTimeout(tryFindElement, 100);
  }, [isActive, currentStep, filteredSteps, findElement]);

  // Obter elemento do step atual (para compatibilidade)
  const getCurrentElement = () => currentElement;

  return {
    currentStep,
    isActive,
    isCompleted: isCompleted(),
    steps: filteredSteps,
    totalSteps: filteredSteps.length,
    start,
    next,
    prev,
    skip,
    reset,
    getCurrentStep,
    getCurrentElement,
    currentElement,
    progress: Math.round(((currentStep + 1) / filteredSteps.length) * 100),
    isMobile,
  };
}
