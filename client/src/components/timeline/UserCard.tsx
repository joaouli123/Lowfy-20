import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { MapPin, Trophy, Star, Award, Target, MessageCircle, Heart, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { useGamification } from '@/hooks/useGamification';

export function UserCard() {
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
  });
  const { on, off, isConnected } = useSocket();

  const { data: userPoints, refetch: refetchPoints } = useQuery({
    queryKey: ['/api/users', user?.id, 'points'],
    enabled: !!user?.id,
  });

  const { data: userBadges } = useQuery({
    queryKey: ['/api/users', user?.id, 'badges'],
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/users', user?.id, 'stats'],
    enabled: !!user?.id,
  });

  const [animatingProgress, setAnimatingProgress] = useState(false);
  const previousPointsRef = useRef<number>(0);
  const { toast } = useToast();

  const {
    currentXP,
    level: currentLevel,
    levelName,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
  } = useGamification(user?.id);

  // Função para traduzir ações em descrições amigáveis
  const getActionDescription = (action: string) => {
    const descriptions: Record<string, string> = {
      'create_post': 'Post criado',
      'like_given': 'Curtida',
      'comment_created': 'Comentário',
      'reply_created': 'Resposta',
      'best_answer': 'Melhor resposta',
      'topic_created': 'Tópico criado',
      'share_post': 'Compartilhamento',
    };
    return descriptions[action] || 'Atividade';
  };

  // WebSocket para pontos em tempo real
  useEffect(() => {
    if (!user?.id || !isConnected) {
      return;
    }

    const handlePointsAwarded = (data: { userId: string; points: number; totalPoints: number; action?: string }) => {
      if (data.userId === user.id) {
        // Mostrar toast de pontos ganhos (discreta e verde)
        toast({
          title: `+${data.points} XP`,
          description: data.action ? getActionDescription(data.action) : 'Continue assim!',
          duration: 2000,
          className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
        });

        // Animar barra de progresso
        setAnimatingProgress(true);

        // Refetch pontos para atualizar
        refetchPoints();

        // Resetar animação após 3 segundos
        setTimeout(() => {
          setAnimatingProgress(false);
        }, 3000);
      }
    };

    on('points_awarded', handlePointsAwarded);

    return () => {
      off('points_awarded', handlePointsAwarded);
    };
  }, [user?.id, refetchPoints, toast, isConnected, on, off]);

  // Detectar mudança de pontos manualmente (fallback)
  useEffect(() => {
    const currentPoints = userPoints?.points || 0;
    const previousPoints = previousPointsRef.current;

    if (currentPoints > previousPoints && previousPoints > 0) {
      const gained = currentPoints - previousPoints;

      toast({
        title: `+${gained} XP`,
        description: 'Continue assim!',
        duration: 2000,
        className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
      });

      setAnimatingProgress(true);

      setTimeout(() => {
        setAnimatingProgress(false);
      }, 3000);
    }

    previousPointsRef.current = currentPoints;
  }, [userPoints?.points, toast]);

  if (!user) return null;

  return (
    <Card className="border-none overflow-visible" data-testid="card-user-profile">
      <div className="relative pb-12">
        <div className="h-16 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-t-xl" />
        <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-white shadow-xl" data-testid="img-user-avatar">
              <AvatarImage src={user.profileImageUrl || ''} alt={user.name} />
              <AvatarFallback className="bg-white dark:bg-card text-primary text-2xl">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 shadow-lg z-20">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
      <CardContent className="relative pt-2 pb-6 px-6 bg-card">
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-bold text-center" data-testid="text-user-name">{user.name}</h2>
          <p className="text-muted-foreground text-sm text-center" data-testid="text-user-profession">
            {user.areaAtuacao || 'Profissional'}
          </p>

          {user.location && (
            <div className="flex items-center gap-1 mt-2 text-muted-foreground" data-testid="text-user-location">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{user.location}</span>
            </div>
          )}

          {/* Barra de Progresso de Pontos */}
          <div className="w-full mt-4 px-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {xpInCurrentLevel} / {xpNeededForNextLevel} XP
                </span>
              </div>
              <span className="text-xs font-medium text-foreground">
                Nv {currentLevel}
              </span>
            </div>

            <div className="relative">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 h-full transition-all rounded-full ${
                    animatingProgress ? 'duration-700 ease-out' : 'duration-300'
                  }`}
                  style={{ width: `${Math.max(progressPercentage, 2)}%` }}
                  data-testid="progress-user-xp"
                />
              </div>
            </div>

            <div className="flex justify-center mt-1.5">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5"
              >
                {levelName}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-xl font-bold text-primary" data-testid="text-posts-count">{stats?.postsCount || 0}</p>
              <p className="text-xs text-muted-foreground" data-testid="label-posts">Posts</p>
            </div>

            <div className="text-center">
              <p className="text-xl font-bold text-primary" data-testid="text-level">{currentLevel}</p>
              <p className="text-xs text-muted-foreground" data-testid="label-level">Nível</p>
            </div>

            <div className="text-center">
              <p className="text-xl font-bold text-primary" data-testid="text-followers-count">{stats?.followersCount || 0}</p>
              <p className="text-xs text-muted-foreground" data-testid="label-followers">Seguidores</p>
            </div>
          </div>

          {userBadges && userBadges.length > 0 && (
            <div className="pt-4 border-t mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 text-center">Conquistas</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {userBadges.slice(0, 6).map((badge: any) => (
                  <div
                    key={badge.id}
                    className="group relative"
                    data-testid={`badge-${badge.name.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badge.color || 'bg-gradient-to-br from-yellow-400 to-yellow-600'} shadow-md hover:shadow-lg transition-all cursor-pointer`}>
                      {badge.icon === 'MessageCircle' ? <MessageCircle className="w-5 h-5 text-white" /> :
                       badge.icon === 'Heart' ? <Heart className="w-5 h-5 text-white" /> :
                       badge.icon === 'Trophy' ? <Trophy className="w-5 h-5 text-white" /> :
                       badge.icon === 'Star' ? <Star className="w-5 h-5 text-white" /> :
                       badge.icon === 'Award' ? <Award className="w-5 h-5 text-white" /> :
                       badge.icon === 'Target' ? <Target className="w-5 h-5 text-white" /> :
                       <Sparkles className="w-5 h-5 text-white" />}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                      <div className="font-semibold">{badge.name}</div>
                      <div className="text-gray-300 text-[10px] mt-0.5">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}