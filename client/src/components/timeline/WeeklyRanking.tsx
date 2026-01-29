import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Award } from 'lucide-react';

export function WeeklyRanking() {
  const { data: ranking = [] } = useQuery({
    queryKey: ['/api/users/ranking'],
    queryFn: async () => {
      const res = await fetch('/api/users/ranking?limit=5');
      if (!res.ok) throw new Error('Failed to fetch ranking');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
    refetchOnWindowFocus: false,
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-amber-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-700" />;
    return null;
  };

  return (
    <Card data-testid="card-weekly-ranking">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Top Usuários
        </CardTitle>
        <p className="text-xs text-muted-foreground">Ranking desta semana</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {ranking.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-ranking">
            Nenhum usuário no ranking ainda
          </p>
        ) : (
          ranking.map((user: any, index: number) => (
            <div
              key={`${user.id}-${index}`}
              className={`flex items-center gap-2 p-2 rounded-lg ${index < 3 ? 'bg-accent/50' : 'hover:bg-accent/30'} transition-colors`}
              data-testid={`rank-user-${index + 1}`}
            >
              <div className="w-6 text-center font-bold" data-testid={`text-rank-position-${index + 1}`}>
                {getRankIcon(index) || <span className="text-xs text-muted-foreground">{index + 1}</span>}
              </div>
              <Avatar className="w-9 h-9 ring-1 ring-primary" data-testid={`img-user-avatar-${user.id}`}>
                <AvatarImage src={user.profileImageUrl || ''} alt={user.name} />
                <AvatarFallback className="bg-white dark:bg-card text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium truncate" data-testid={`text-user-name-${user.id}`}>
                  {user.name}
                </h4>
                <p className="text-xs text-muted-foreground truncate" data-testid={`text-user-profession-${user.id}`}>
                  Nível {user.points?.level || 1}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}