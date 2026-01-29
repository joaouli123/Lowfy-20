import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import type { PLRWithRelations } from "@shared/schema";

interface PLRCardProps {
  plr: PLRWithRelations;
}

export default function PLRCard({ plr }: PLRCardProps) {
  const getGradient = (categoryName?: string) => {
    const gradients = {
      'Marketing': 'from-primary/20 to-accent/20',
      'Negócios': 'from-accent/20 to-primary/20',
      'Saúde': 'from-secondary/20 to-accent/20',
      'Finanças': 'from-primary/20 to-secondary/20',
    };
    return gradients[categoryName as keyof typeof gradients] || 'from-primary/20 to-accent/20';
  };

  const getIcon = (categoryName?: string) => {
    // You can customize icons based on category
    return FileText;
  };

  const Icon = getIcon(plr.category?.name);

  const handleAccess = () => {
    if (plr.driveLink) {
      window.open(plr.driveLink, '_blank');
    }
  };

  return (
    <Card
      className="card-hover overflow-hidden"
      data-testid={`plr-card-${plr.id}`}
    >
      <div className={`h-48 bg-gradient-to-br ${getGradient(plr.category?.name)} flex items-center justify-center`}>
        <Icon className="w-16 h-16 text-primary/40" />
      </div>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 truncate" data-testid={`plr-title-${plr.id}`}>
              {plr.title}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid={`plr-category-${plr.id}`}>
              {plr.category?.name || "Sem categoria"}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="ml-2 flex-shrink-0 bg-muted text-muted-foreground"
            data-testid={`plr-language-${plr.id}`}
          >
            {plr.language?.code || "N/A"}
          </Badge>
        </div>

        {plr.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2" data-testid={`plr-description-${plr.id}`}>
            {plr.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span data-testid={`plr-file-count-${plr.id}`}>
              {plr.fileCount || 0} arquivos
            </span>
          </div>
          <Button
            onClick={handleAccess}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
            data-testid={`button-access-plr-${plr.id}`}
          >
            Acessar
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {plr.quizLink && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(plr.quizLink!, '_blank')}
              className="w-full text-xs"
              data-testid={`button-quiz-${plr.id}`}
            >
              Fazer Quiz
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}