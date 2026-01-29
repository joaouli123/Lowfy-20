import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Se carregou e não é admin, redireciona silenciosamente para timeline
    if (!isLoading && (!user || !user.isAdmin)) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  // Enquanto carregando, não renderiza nada
  if (isLoading) {
    return null;
  }

  // Se não é admin, não renderiza nada (vai ser redirecionado pelo useEffect)
  if (!user || !user.isAdmin) {
    return null;
  }

  // Se é admin, renderiza o componente
  return <>{children}</>;
}
