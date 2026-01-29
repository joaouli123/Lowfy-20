import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Check, Users } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function SuggestedConnections() {
  const { toast } = useToast();
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());

  const { data: suggestions = [] } = useQuery({
    queryKey: ['/api/users/suggested-connections'],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/users/${userId}/follow`);
    },
    onMutate: async (userId: string) => {
      // UI otimista - atualiza imediatamente
      setFollowedUsers(prev => new Set(prev).add(userId));
      
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['/api/users/suggested-connections'] });
      
      // Salvar snapshot anterior
      const previousSuggestions = queryClient.getQueryData(['/api/users/suggested-connections']);
      
      // Remover imediatamente da lista (otimista)
      queryClient.setQueryData(['/api/users/suggested-connections'], (old: any[]) => 
        old?.filter((u: any) => u.id !== userId) || []
      );
      
      return { previousSuggestions };
    },
    onSuccess: (data: any, userId) => {
      // Invalidar queries de followers/following para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "following"] });
      
      // Forçar refetch de sugestões para obter nova lista sem o usuário seguido
      queryClient.invalidateQueries({ 
        queryKey: ['/api/users/suggested-connections'],
        refetchType: 'active'
      });
      
      // Invalidar metas diárias e semanais
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });
      
      toast({
        title: "Seguindo!",
        description: data?.alreadyFollowing ? "Você já seguia este usuário" : "Você começou a seguir este usuário",
        duration: 2000,
      });
    },
    onError: (error: any, userId, context: any) => {
      // Reverte em caso de erro
      setFollowedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      
      // Restaurar lista anterior
      if (context?.previousSuggestions) {
        queryClient.setQueryData(['/api/users/suggested-connections'], context.previousSuggestions);
      }
      
      const errorMessage = error?.message || "Não foi possível seguir este usuário";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  if (suggestions.length === 0) return null;

  return (
    <Card data-testid="card-suggested-connections">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Sugestões para Você
        </CardTitle>
        <p className="text-xs text-muted-foreground">Expanda sua rede</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((user: any) => {
          const isFollowed = followedUsers.has(user.id);
          return (
            <div 
              key={user.id} 
              className={`flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-all ${isFollowed ? 'opacity-50' : ''}`}
              data-testid={`suggestion-${user.id}`}
            >
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
                  {user.areaAtuacao || 'Profissional'}
                </p>
                <p className="text-xs text-muted-foreground/70 truncate" data-testid={`text-user-level-${user.id}`}>
                  Nv {user.points?.level || 1}
                </p>
              </div>
              
              <Button 
                size="sm" 
                variant={isFollowed ? "default" : "outline"}
                className={`h-8 w-8 p-0 shrink-0 rounded-full transition-all ${
                  isFollowed 
                    ? 'bg-primary text-primary-foreground' 
                    : 'border-primary text-primary hover:bg-primary/10'
                }`}
                onClick={() => followMutation.mutate(user.id)}
                disabled={isFollowed}
                data-testid={`button-follow-${user.id}`}
              >
                {isFollowed ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}