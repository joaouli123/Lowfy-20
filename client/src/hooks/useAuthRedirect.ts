import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./useAuth";

/**
 * Hook que redireciona usuários não autenticados para login
 * quando tentam acessar páginas protegidas
 */
export function useAuthRedirect() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = [
    "/",
    "/login",
    "/reset-password",
    "/clonador/preview",
    "/presell/preview",
    "/termos",
    "/privacidade",
    "/licenca-plr",
    "/direitos-autorais",
    "/assinatura/checkout",
    "/assinatura/checkout/pix",
    "/assinatura/checkout/pix/:transactionId",
    "/assinatura/checkout/sucesso",
    "/ativar-conta",
  ];

  useEffect(() => {
    if (isLoading) return;

    // Verificar se é uma rota pública
    const isPublicRoute = publicRoutes.some((route) => {
      if (route.includes(":")) {
        // Para rotas com parâmetros, comparar apenas o prefixo
        return location.startsWith(route.split(":")[0]);
      }
      return location === route;
    });

    // Se não autenticado e tentando acessar rota protegida, redirecionar para login
    if (!isAuthenticated && !isPublicRoute) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`);
    }
  }, [location, isAuthenticated, isLoading, setLocation]);
}
