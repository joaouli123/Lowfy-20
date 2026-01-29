import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock, CreditCard, AlertTriangle, X } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useEffect, useState } from "react";

interface SubscriptionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  daysExpired?: number;
}

export function SubscriptionExpiredModal({ 
  isOpen, 
  onClose,
  daysExpired = 0 
}: SubscriptionExpiredModalProps) {
  const [, setLocation] = useLocation();
  const { isSidebarCollapsed } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleRenew = () => {
    onClose();
    setLocation("/assinatura/checkout?plan=mensal");
  };

  const handleGoBack = () => {
    onClose();
    setLocation("/timeline");
  };

  if (!isOpen) return null;

  const sidebarWidth = isMobile ? 0 : (isSidebarCollapsed ? 80 : 288);

  return (
    <div 
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ 
        left: `${sidebarWidth}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
      data-testid="modal-subscription-expired-overlay"
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden"
        data-testid="modal-subscription-expired"
      >
        {/* Close button */}
        <button
          onClick={handleGoBack}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors z-50"
          data-testid="button-close-modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 sm:p-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-3 text-gray-900 dark:text-white">
            Sua assinatura expirou
          </h2>

          {/* Expiration badge */}
          {daysExpired > 0 && (
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Expirada há {daysExpired} dia{daysExpired !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          <p className="text-center text-gray-600 dark:text-gray-300 mb-8 text-sm">
            Renove agora por apenas <span className="font-bold text-gray-900 dark:text-white">R$ 99,90/mês</span> e continue acessando todas as ferramentas premium
          </p>

          {/* Benefits list */}
          <div className="space-y-3 mb-8">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Com a assinatura ativa você tem:
            </h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                <span>+39 Ferramentas de IA Premium</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                <span>Criador e Clonador de Páginas</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                <span>+350 Cursos Exclusivos</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                <span>PLRs Globais em 7 idiomas</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                <span>E muito mais...</span>
              </li>
            </ul>
          </div>

          {/* Warning */}
          {daysExpired >= 10 && (
            <div className="mb-8 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <p className="text-sm text-red-800 dark:text-red-300 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span><strong>Atenção:</strong> Suas páginas serão excluídas em breve. Renove agora!</span>
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleRenew}
              className="w-full h-12 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white font-semibold rounded-lg transition-colors"
              data-testid="button-renew-subscription"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Renovar Agora
            </Button>
            <button
              onClick={handleGoBack}
              className="w-full h-12 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
              data-testid="button-go-back-timeline"
            >
              Voltar para Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
