import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy } from 'lucide-react';

export function WeeklyGoals() {
  const { data: challenges } = useQuery({
    queryKey: ['/api/gamification/weekly-challenges'],
  });

  if (!challenges?.challenges || challenges.challenges.length === 0) {
    return null;
  }

  return (
    <Card data-testid="card-weekly-goals">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-5 h-5 text-primary" />
          Metas Semanais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.challenges.map((item: any) => {
          const currentProgress = item.currentProgress || 0;
          const targetValue = item.requirementCount;
          const progressPercentage = targetValue > 0 ? (currentProgress / targetValue) * 100 : 0;

          return (
            <div key={item.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <div className="text-green-600 dark:text-green-500 font-bold whitespace-nowrap" style={{ fontSize: '14px' }}>
                  +{item.xpReward} XP
                </div>
              </div>

              <div className="space-y-1">
                <div className="bg-[#00000024] rounded-full">
                  <Progress
                    value={progressPercentage}
                    className="h-1.5"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {currentProgress} / {targetValue}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
