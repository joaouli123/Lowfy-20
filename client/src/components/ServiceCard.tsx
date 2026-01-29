import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Shield, Briefcase } from "lucide-react";
import type { Service } from "@shared/schema";

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const getIcon = (serviceName: string) => {
    if (serviceName.toLowerCase().includes('consultoria')) return Users;
    if (serviceName.toLowerCase().includes('mentoria')) return Shield;
    if (serviceName.toLowerCase().includes('coaching')) return Briefcase;
    return Briefcase;
  };

  const Icon = getIcon(service.name);
  const price = service.priceCents ? (service.priceCents / 100).toFixed(2) : '0.00';
  const benefits = service.benefits || [];

  const handlePurchase = () => {
  };

  return (
    <Card
      className={`flex flex-col ${
        service.isPopular
          ? "border-2 border-primary relative"
          : ""
      }`}
      data-testid={`service-card-${service.id}`}
    >
      {service.isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
          Mais Popular
        </div>
      )}
      
      {service.imageUrl && (
        <div className="w-full h-80 bg-muted overflow-hidden rounded-t-lg">
          <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
        </div>
      )}
      
      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground" data-testid={`service-price-${service.id}`}>
            R$ {price}
          </span>
        </div>
        
        <h3 className="font-semibold text-foreground text-lg mb-2" data-testid={`service-name-${service.id}`}>
          {service.name}
        </h3>
        
        {service.description && (
          <p className="text-sm text-muted-foreground mb-4 flex-1" data-testid={`service-description-${service.id}`}>
            {service.description}
          </p>
        )}
        
        {benefits.length > 0 && (
          <ul className="space-y-2 mb-6" data-testid={`service-benefits-${service.id}`}>
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary mr-2 flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}
        
        <Button
          onClick={handlePurchase}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid={`button-purchase-service-${service.id}`}
        >
          Contratar Serviço
        </Button>
        
      </CardContent>
    </Card>
  );
}
