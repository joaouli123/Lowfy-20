import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import ServiceCard from "@/components/ServiceCard";
import { Briefcase } from "lucide-react";
import type { Service } from "@shared/schema";

export default function Services() {
  const { data: services, isLoading, error } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card className="p-6 text-center">
          <p className="text-destructive">Erro ao carregar serviços. Tente novamente.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8" data-testid="services-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">White Label</h1>
        <p className="text-muted-foreground">Não perca tempo criando ou desenvolvendo do zero um sistema, compre pontos e use sua marca muito mais barato e venda como Seu</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-muted rounded-xl"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full mb-4"></div>
              <div className="space-y-2 mb-6">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
              <div className="h-8 bg-muted rounded w-full"></div>
            </Card>
          ))}
        </div>
      ) : services?.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state-services">
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">White Label em breve</h3>
          <p className="text-muted-foreground">
            Estamos preparando soluções de White Label exclusivas para você. Aguarde!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="services-grid">
          {services?.map((service: Service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
