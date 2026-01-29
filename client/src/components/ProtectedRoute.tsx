import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useFeatureAccess, FeatureType } from "@/hooks/useFeatureAccess";
import { SubscriptionExpiredModal } from "./SubscriptionExpiredModal";
import { FeatureLockedOverlay } from "./FeatureLockedOverlay";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  currentPath?: string;
}

const ROUTE_TO_FEATURE_MAP: Record<string, FeatureType> = {
  "/plrs": "plrs",
  "/cursos": "cursos",
  "/plugins": "plugins",
  "/templates": "templates",
  "/ferramentas-ia": "ferramentas-ia",
  "/clonador": "clonador",
  "/presell-builder": "presell-builder",
  "/andromeda": "andromeda",
  "/quiz": "quiz",
  "/n8n": "n8n",
  "/timeline": "timeline",
  "/forum": "forum",
  "/marketplace": "marketplace",
  "/indicacao": "indicacao",
  "/perfil": "perfil",
  "/assinaturas": "assinatura",
  "/suporte": "suporte",
  "/white-label": "white-label",
};

const FREEMIUM_ROUTES = [
  "/timeline",
  "/forum",
  "/marketplace",
  "/indicacao",
  "/perfil",
  "/assinaturas",
  "/suporte",
  "/white-label",
  "/configuracoes",
  "/notificacoes",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function getFeatureForRoute(path: string): FeatureType | null {
  const normalizedPath = path.split("?")[0].split("#")[0];
  
  for (const [route, feature] of Object.entries(ROUTE_TO_FEATURE_MAP)) {
    if (normalizedPath === route || normalizedPath.startsWith(route + "/")) {
      return feature;
    }
  }
  return null;
}

function isFreemiumRoute(path: string): boolean {
  const normalizedPath = path.split("?")[0].split("#")[0];
  return FREEMIUM_ROUTES.some(route => 
    normalizedPath === route || normalizedPath.startsWith(route + "/")
  );
}

export function ProtectedRoute({ children, currentPath = "/" }: ProtectedRouteProps) {
  const [showModal, setShowModal] = useState(false);
  const [, setLocation] = useLocation();
  const { hasAccess: hasFeatureAccess, getUserPlan } = useFeatureAccess();
  const { user, isLoading } = useAuth();

  const feature = getFeatureForRoute(currentPath);
  const userPlan = getUserPlan();
  const canAccessFeature = feature ? hasFeatureAccess(feature) : true;

  useEffect(() => {
    if (isLoading) return;

    if (isFreemiumRoute(currentPath)) {
      setShowModal(false);
      return;
    }

    if (feature && !canAccessFeature) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [currentPath, canAccessFeature, isLoading, feature]);

  const handleCloseModal = () => {
    setShowModal(false);
    setLocation("/timeline");
  };

  if (isLoading) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (isFreemiumRoute(currentPath)) {
    return <>{children}</>;
  }

  if (feature && !canAccessFeature) {
    const isPremiumFeature = ["clonador", "presell-builder", "andromeda", "quiz", "n8n"].includes(feature);
    const isSubscriptionExpired = user?.subscriptionStatus === "canceled" || user?.subscriptionStatus === "expired";
    
    if (isSubscriptionExpired && userPlan === "free") {
      return (
        <>
          <SubscriptionExpiredModal 
            isOpen={showModal} 
            onClose={handleCloseModal}
            daysExpired={0}
          />
          <div className="w-full h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Acesso restrito</p>
            </div>
          </div>
        </>
      );
    }
    
    const featureNames: Record<string, string> = {
      clonador: "Clonador de Páginas",
      "presell-builder": "Pre-Sell Builder",
      andromeda: "Meta Ads Andromeda",
      quiz: "Quiz Interativo",
      n8n: "Automações N8N",
      plrs: "PLRs",
      cursos: "Cursos Online",
      plugins: "Plugins",
      templates: "Templates",
      "ferramentas-ia": "Ferramentas IA",
    };
    
    return (
      <FeatureLockedOverlay 
        featureName={featureNames[feature] || feature}
        description={isPremiumFeature 
          ? "Esta funcionalidade está disponível apenas para assinantes. Assine agora e desbloqueie todos os recursos premium!"
          : "Atualize seu plano para ter acesso a esta funcionalidade."}
      />
    );
  }

  return <>{children}</>;
}

export function withSubscriptionProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  routePath: string
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute currentPath={routePath}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}
