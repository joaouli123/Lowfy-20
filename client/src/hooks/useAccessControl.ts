import { useAuth } from "./useAuth";

export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'canceled' | 'expired' | 'inactive' | 'refunded';

export interface AccessControlResult {
  hasAccess: boolean;
  isSubscriptionActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  daysExpired: number;
  isLoading: boolean;
  canAccessFreemium: boolean;
}

const FREEMIUM_ROUTES = [
  '/timeline',
  '/forum',
  '/marketplace',
  '/marketplace/vitrine',
  '/marketplace/produto',
  '/marketplace/cart',
  '/marketplace/compras',
  '/marketplace/order',
  '/marketplace/meus-produtos',
  '/marketplace/financeiro',
  '/assinatura',
  '/indicacoes',
  '/profile',
  '/services',
  '/support',
  '/',
];

const PROTECTED_ROUTES = [
  '/ai-tools',
  '/courses',
  '/plrs',
  '/clonador',
  '/presell-dashboard',
  '/presell-builder',
  '/quiz-interativo',
  '/plugins',
  '/templates',
  '/modelos-n8n',
  '/meta-ads-andromeda',
  '/dashboard',
  '/notifications',
  '/users',
  '/admin',
];

export function isFreemiumRoute(path: string): boolean {
  return FREEMIUM_ROUTES.some(route => {
    // Special case for root path - only match exactly
    if (route === '/') {
      return path === '/';
    }
    return path === route || path.startsWith(`${route}/`);
  });
}

export function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.some(route => 
    path === route || path.startsWith(`${route}/`)
  );
}

export function useAccessControl(): AccessControlResult {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return {
      hasAccess: false,
      isSubscriptionActive: false,
      subscriptionStatus: 'none',
      daysExpired: 0,
      isLoading,
      canAccessFreemium: false,
    };
  }

  // Admin bypass - but respect testingAsNonAdmin flag for subscription testing
  if (user.isAdmin && !user.testingAsNonAdmin) {
    return {
      hasAccess: true,
      isSubscriptionActive: true,
      subscriptionStatus: 'active',
      daysExpired: 0,
      isLoading: false,
      canAccessFreemium: true,
    };
  }

  const subscriptionStatus = (user.subscriptionStatus as SubscriptionStatus) || 'none';
  const accountStatus = user.accountStatus;
  const expiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const now = new Date();

  let isActive = false;
  let daysExpired = 0;

  // Check if account is blocked - no access at all
  if (accountStatus === 'blocked') {
    return {
      hasAccess: false,
      isSubscriptionActive: false,
      subscriptionStatus: 'expired',
      daysExpired: 0,
      isLoading: false,
      canAccessFreemium: false, // Blocked users have no freemium access
    };
  }

  // Check if account is inactive - freemium access only
  if (accountStatus === 'inactive') {
    return {
      hasAccess: false,
      isSubscriptionActive: false,
      subscriptionStatus: 'inactive',
      daysExpired: 0,
      isLoading: false,
      canAccessFreemium: true, // Allow freemium access for inactive
    };
  }

  // Handle different subscription statuses
  
  // REEMBOLSO: Perde acesso IMEDIATAMENTE - sem verificar data de expiração
  if (subscriptionStatus === 'refunded') {
    return {
      hasAccess: false,
      isSubscriptionActive: false,
      subscriptionStatus: 'refunded',
      daysExpired: 0,
      isLoading: false,
      canAccessFreemium: true, // Pode acessar timeline, marketplace etc
    };
  }
  
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trial') {
    if (expiresAt && now > expiresAt) {
      // Subscription has expired
      isActive = false;
      daysExpired = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // Subscription is still valid
      isActive = true;
    }
  } else if (subscriptionStatus === 'expired') {
    // Already marked as expired - calculate days if we have expiry date
    isActive = false;
    if (expiresAt) {
      daysExpired = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));
    }
  } else if (subscriptionStatus === 'canceled') {
    // CANCELADO: Mantém acesso ATÉ a data de expiração do período pago
    if (expiresAt && now <= expiresAt) {
      isActive = true; // Ainda tem acesso até o final do período
    } else {
      isActive = false; // Período já expirou
      if (expiresAt) {
        daysExpired = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  }
  // 'none' and 'inactive' statuses have isActive = false by default

  return {
    hasAccess: isActive,
    isSubscriptionActive: isActive,
    subscriptionStatus,
    daysExpired: Math.max(0, daysExpired), // Ensure non-negative
    isLoading: false,
    canAccessFreemium: true, // All authenticated users can access freemium routes
  };
}

export function useRouteAccess(currentPath: string): {
  canAccess: boolean;
  requiresSubscription: boolean;
  isLoading: boolean;
} {
  const { hasAccess, isLoading, canAccessFreemium } = useAccessControl();

  if (isLoading) {
    return { canAccess: false, requiresSubscription: false, isLoading: true };
  }

  if (isFreemiumRoute(currentPath)) {
    return { canAccess: canAccessFreemium, requiresSubscription: false, isLoading: false };
  }

  if (isProtectedRoute(currentPath)) {
    return { canAccess: hasAccess, requiresSubscription: true, isLoading: false };
  }

  return { canAccess: hasAccess, requiresSubscription: true, isLoading: false };
}
