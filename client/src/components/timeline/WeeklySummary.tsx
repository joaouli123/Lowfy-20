import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Target } from 'lucide-react';

export function WeeklySummary() {
  const { data: summary } = useQuery({
    queryKey: ['/api/timeline/weekly-summary'],
  });

  if (!summary) return null;

  return (
    <>
      <Card data-testid="card-weekly-summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            Sua Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Posts publicados</span>
            <span className="text-lg font-bold text-primary" data-testid="text-posts-count">
              {summary.postsPublished || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Engajamento médio</span>
            <span className="text-lg font-bold text-primary" data-testid="text-engagement">
              {summary.averageEngagement || 0}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Novas conexões</span>
            <span className="text-lg font-bold text-primary" data-testid="text-connections">
              {summary.newConnections || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">XP ganho</span>
            <span className="text-lg font-bold text-primary" data-testid="text-xp-gained">
              +{summary.xpGained || 0}
            </span>
          </div>

          {summary.topPercentage && (
            <div className="mt-4 pt-4 border-t text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-pink-500" />
              <p className="text-xs text-muted-foreground">
                Você está no top {summary.topPercentage}% mais ativo da semana!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
