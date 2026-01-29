import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Star, Award, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';


const challengeIcons: Record<string, any> = {
  '🎯': Target,
  '⭐': Star,
  '🏆': Trophy,
  '🏅': Award,
  '⚡': Zap,
};

export function ActiveChallenges() {
  const { data: challenges = [] } = useQuery({
    queryKey: ['/api/challenges/active'],
  });

  if (challenges.length === 0) return null;

  return (
    <Card data-testid="card-active-challenges">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Desafios Ativos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.slice(0, 2).map((challenge: any) => {
          const IconComponent = challengeIcons[challenge.icon] || Target;

          return (
            <div key={challenge.id} className="space-y-2" data-testid={`challenge-${challenge.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-6 h-6 text-primary" />
                  <div>
                    <h4 className="text-sm font-medium" data-testid={`text-challenge-title-${challenge.id}`}>
                      {challenge.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">{challenge.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">{challenge.reward} XP</Badge>
              </div>
              <Progress
                value={(challenge.currentProgress / challenge.targetProgress) * 100}
                className="h-2"
                data-testid={`progress-challenge-${challenge.id}`}
              />
              <p className="text-xs text-muted-foreground">
                {challenge.currentProgress} / {challenge.targetProgress}
              </p>
            </div>
          );
        })}

        <Link href="/challenges">
          <Button
            variant="outline"
            className="w-full text-primary border-primary hover:bg-primary/10"
            data-testid="button-view-all-challenges"
          >
            <Gift className="w-4 h-4 mr-2" />
            Ver todos os desafios
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}