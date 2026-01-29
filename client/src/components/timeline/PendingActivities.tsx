
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle2, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function PendingActivities() {
  const { toast } = useToast();

  const { data, refetch } = useQuery({
    queryKey: ['/api/gamification/daily-activities'],
  });

  // A API retorna { activities: [...] }
  const activities = Array.isArray(data?.activities) ? data.activities : [];

  const handleClaimReward = async (progressId: string, xpReward: number) => {
    try {
      const response = await fetch(`/api/gamification/daily-activities/${progressId}/claim`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao resgatar XP');
      }

      toast({
        title: `+${xpReward} XP`,
        className: 'bg-green-600 text-white border-0',
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro ao resgatar XP',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const pendingActivities = activities.filter(
    (activity: any) => activity.isCompleted && !activity.isClaimed
  );

  const completedActivities = activities.filter(
    (activity: any) => activity.isClaimed
  );

  const inProgressActivities = activities.filter(
    (activity: any) => !activity.isCompleted && activity.currentProgress > 0
  );

  if (pendingActivities.length === 0 && inProgressActivities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Atividades Diárias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Atividades Pendentes (Completas, não resgatadas) */}
        {pendingActivities.map((activity: any) => (
          <div
            key={activity.progressId}
            className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{activity.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      +{activity.xpReward} XP
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleClaimReward(activity.progressId, activity.xpReward)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Zap className="w-4 h-4 mr-1" />
                Resgatar
              </Button>
            </div>
          </div>
        ))}

        {/* Atividades Em Progresso */}
        {inProgressActivities.map((activity: any) => {
          const progress = (activity.currentProgress / activity.requirementCount) * 100;
          
          return (
            <div
              key={activity.progressId}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{activity.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {activity.currentProgress} / {activity.requirementCount}
                      </span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        +{activity.xpReward} XP
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Resumo de Atividades Completas */}
        {completedActivities.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              ✅ {completedActivities.length} atividade{completedActivities.length > 1 ? 's' : ''} concluída{completedActivities.length > 1 ? 's' : ''} hoje
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
