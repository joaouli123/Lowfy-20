import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Calendar, Zap } from 'lucide-react';
import { useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function DailyMissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { on, off, isConnected } = useSocket();
  
  const { data } = useQuery({
    queryKey: ['/api/gamification/daily-activities'],
  });

  const claimMutation = useMutation({
    mutationFn: async (progressId: string) => {
      return await apiRequest('POST', `/api/gamification/daily-activities/${progressId}/claim`, {});
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 XP Conquistado!",
        description: `Você ganhou +${data.xpAwarded} XP`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
    },
  });

  useEffect(() => {
    if (!isConnected || !user?.id) {
      return;
    }

    const handleGamificationUpdate = (data: { userId: string; action: string; points: number }) => {
      if (data.userId === user.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      }
    };

    on('gamification_update', handleGamificationUpdate);

    return () => {
      off('gamification_update', handleGamificationUpdate);
    };
  }, [user?.id, isConnected, on, off]);

  const activities = Array.isArray(data?.activities) ? data.activities : [];

  if (activities.length === 0) {
    return null;
  }

  const completedCount = activities.filter((a: any) => a.isClaimed).length;
  const totalXPAvailable = activities.reduce((sum: number, a: any) => sum + a.xpReward, 0);
  const earnedXP = activities.filter((a: any) => a.isClaimed).reduce((sum: number, a: any) => sum + a.xpReward, 0);

  return (
    <Card data-testid="card-daily-missions">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-primary" />
          Metas Diárias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity: any) => {
          const progress = activity.requirementCount > 0 
            ? (activity.currentProgress / activity.requirementCount) * 100 
            : 0;

          const isCompleted = activity.isCompleted;
          const isClaimed = activity.isClaimed;

          return (
            <div 
              key={activity.id} 
              className={`space-y-2 ${isClaimed ? 'opacity-60' : ''}`}
              data-testid={`mission-${activity.activityType}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm leading-tight">
                    {activity.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activity.description}
                  </p>
                </div>
                <div className="text-green-600 dark:text-green-500 font-bold whitespace-nowrap" style={{ fontSize: '14px' }}>
                  +{activity.xpReward} XP
                </div>
              </div>

              <div className="space-y-1">
                <div className="bg-[#00000024] dark:bg-[#ffffff14] rounded-full">
                  <Progress
                    value={progress}
                    className="h-1.5"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {activity.currentProgress} / {activity.requirementCount}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}