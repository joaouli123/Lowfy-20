
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';

export function DailyActivities() {
  const { user } = useAuth();
  const { on, off, isConnected } = useSocket();
  
  const { data } = useQuery({
    queryKey: ['/api/gamification/daily-activities'],
  });

  // WebSocket listener for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.id) {
      return;
    }

    const handleGamificationUpdate = (data: { userId: string; action: string; points: number }) => {
      if (data.userId === user.id) {
        // Invalidate queries to refetch updated progress
        queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      }
    };

    on('gamification_update', handleGamificationUpdate);

    return () => {
      off('gamification_update', handleGamificationUpdate);
    };
  }, [user?.id, isConnected, on, off]);

  const activities = Array.isArray(data?.activities) ? data.activities : [];

  // Filtrar apenas atividades em progresso ou pendentes
  const visibleActivities = activities.filter(
    (activity: any) => !activity.isClaimed
  );

  if (visibleActivities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Atividades Pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleActivities.map((activity: any) => {
          const progress = activity.requirementCount > 0 
            ? (activity.currentProgress / activity.requirementCount) * 100 
            : 0;
          
          return (
            <div 
              key={activity.id} 
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {activity.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">{activity.title}</span>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +{activity.xpReward} XP
                </span>
              </div>
              {!activity.isCompleted && (
                <Progress 
                  value={progress} 
                  className="h-2"
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
