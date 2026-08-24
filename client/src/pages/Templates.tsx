
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Folder, ExternalLink } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockedOverlay } from "@/components/FeatureLockedOverlay";

const TEMPLATE_COLLECTIONS = [
  {
    id: 'premium',
    name: '+100 templates kits elementor (premium)',
    description: 'Coleção premium de templates Elementor',
    url: 'https://drive.google.com/drive/folders/1a3bztWWiTVUmi0-I9RqeJXsqy-CIzR2k?usp=sharing'
  },
  {
    id: 'diversos',
    name: '+200 templates kits elementor (diversos)',
    description: 'Coleção diversificada de templates Elementor',
    url: 'https://drive.google.com/drive/folders/1a3bztWWiTVUmi0-I9RqeJXsqy-CIzR2k?usp=sharing'
  }
];

export default function Templates() {
  const { isFeatureBlocked } = useFeatureAccess();
  const featureBlocked = isFeatureBlocked("templates");
  
  const handleOpenCollection = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (featureBlocked) {
    return (
      <FeatureLockedOverlay 
        featureName="Templates" 
        description="Acesse mais de 300 templates profissionais. Disponível para assinantes e compradores."
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8" data-testid="templates-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Páginas e Templates</h1>
        <p className="text-muted-foreground">Acesse nossa biblioteca de páginas prontas e templates para seus projetos</p>
      </div>

      <div className="space-y-2">
        {TEMPLATE_COLLECTIONS.map((collection) => (
          <Card 
            key={collection.id}
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => handleOpenCollection(collection.url)}
            data-testid={`card-${collection.id}-templates`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Folder className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground" data-testid={`text-${collection.id}-templates`}>
                    {collection.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {collection.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCollection(collection.url);
                  }}
                  data-testid={`button-open-${collection.id}-templates`}
                >
                  Acessar
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
