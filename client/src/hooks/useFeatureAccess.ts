import { useAuth } from "./useAuth";

export type FeatureType = 
  | "clonador" 
  | "presell-builder" 
  | "andromeda" 
  | "quiz" 
  | "n8n"
  | "marketplace"
  | "plrs"
  | "cursos"
  | "forum"
  | "timeline"
  | "indicacao"
  | "perfil"
  | "white-label"
  | "ferramentas-ia"
  | "plugins"
  | "templates"
  | "suporte"
  | "assinatura";

const FREE_PLAN_ALLOWED_FEATURES: FeatureType[] = [
  "timeline",
  "forum",
  "marketplace",
  "indicacao",
  "assinatura",
  "perfil",
  "white-label",
  "suporte"
];

const BASIC_PLAN_ALLOWED_FEATURES: FeatureType[] = [
  ...FREE_PLAN_ALLOWED_FEATURES,
  "plrs",
  "cursos",
  "plugins",
  "templates",
  "ferramentas-ia"
];

const PREMIUM_ONLY_FEATURES: FeatureType[] = [
  "clonador",
  "presell-builder", 
  "andromeda",
  "quiz",
  "n8n"
];

export function useFeatureAccess() {
  const { user } = useAuth();

  const getUserPlan = (): "free" | "basic" | "full" => {
    if (!user) return "free";
    
    // Admin sempre tem acesso total
    if (user.isAdmin) return "full";
    
    // PRIORIDADE 1: accessPlan define o nível de acesso
    // - "full" = assinante ou compra de plano completo
    // - "basic" = compra única de produto básico (NÃO pode ser elevado por subscriptionStatus)
    if (user.accessPlan === "full") return "full";
    if (user.accessPlan === "basic") return "basic";
    
    // PRIORIDADE 2: Para usuários sem accessPlan definido,
    // subscriptionStatus ativa indica assinatura válida (acesso full)
    if (user.subscriptionStatus === "active") return "full";
    
    return "free";
  };

  const hasAccess = (feature: FeatureType): boolean => {
    const plan = getUserPlan();
    
    if (plan === "full") return true;
    
    if (plan === "basic") {
      return BASIC_PLAN_ALLOWED_FEATURES.includes(feature);
    }
    
    return FREE_PLAN_ALLOWED_FEATURES.includes(feature);
  };

  const isFeatureBlocked = (feature: FeatureType): boolean => {
    return !hasAccess(feature);
  };

  const getBlockedFeatures = (): FeatureType[] => {
    const plan = getUserPlan();
    
    if (plan === "full") return [];
    
    if (plan === "basic") {
      return PREMIUM_ONLY_FEATURES;
    }
    
    return [
      ...PREMIUM_ONLY_FEATURES,
      "plrs",
      "cursos",
      "plugins",
      "templates",
      "ferramentas-ia"
    ];
  };

  const canUpgrade = (): boolean => {
    const plan = getUserPlan();
    return plan !== "full";
  };

  const getPlanLabel = (): string => {
    const plan = getUserPlan();
    switch (plan) {
      case "full": return "Assinante";
      case "basic": return "Básico";
      default: return "Gratuito";
    }
  };

  return {
    hasAccess,
    isFeatureBlocked,
    getBlockedFeatures,
    canUpgrade,
    getUserPlan,
    getPlanLabel,
    accessPlan: user?.accessPlan || null,
    subscriptionStatus: user?.subscriptionStatus || "none"
  };
}
