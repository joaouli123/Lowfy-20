import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { UserPoints } from '@shared/schema';

// Sistema de níveis - DEVE SER IDÊNTICO AO BACKEND (server/gamification.ts)
export const USER_LEVELS = [
  { level: 1, name: "Novato", minPoints: 0, maxPoints: 99, icon: "Sprout" },
  { level: 2, name: "Aprendiz", minPoints: 100, maxPoints: 299, icon: "BookOpen" },
  { level: 3, name: "Contribuidor", minPoints: 300, maxPoints: 599, icon: "Users" },
  { level: 4, name: "Mentor", minPoints: 600, maxPoints: 999, icon: "GraduationCap" },
  { level: 5, name: "Mestre", minPoints: 1000, maxPoints: Infinity, icon: "Crown" },
];

export function useGamification(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  const { data: userPoints } = useQuery<UserPoints>({
    queryKey: [`/api/users/${targetUserId}/points`],
    enabled: !!targetUserId,
  });

  const currentXP = userPoints?.points || 0;
  
  // Encontrar nível atual baseado nos pontos
  const currentLevelData = USER_LEVELS.find(
    level => currentXP >= level.minPoints && currentXP <= level.maxPoints
  ) || USER_LEVELS[0];

  // Próximo nível
  const nextLevelData = USER_LEVELS.find(
    level => level.level === currentLevelData.level + 1
  );

  // XP dentro do nível atual
  const xpInCurrentLevel = currentXP - currentLevelData.minPoints;
  
  // XP necessário para o próximo nível
  const xpNeededForNextLevel = nextLevelData 
    ? nextLevelData.minPoints - currentLevelData.minPoints
    : currentLevelData.maxPoints === Infinity 
      ? 1000 
      : currentLevelData.maxPoints - currentLevelData.minPoints + 1;

  // Progresso percentual
  const progressPercentage = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  return {
    // Dados básicos
    currentXP,
    level: currentLevelData.level,
    levelName: currentLevelData.name,
    
    // Dados do nível atual
    currentLevelData,
    nextLevelData,
    
    // Progresso
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
    
    // Status
    isMaxLevel: !nextLevelData,
  };
}
