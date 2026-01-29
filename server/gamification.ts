// Gamification Constants and Logic
import { getNowSaoPaulo, startOfDaySaoPaulo, endOfDaySaoPaulo, addDaysSaoPaulo, getWeekBoundariesSaoPaulo } from '@shared/dateUtils';

// User Levels
export const USER_LEVELS = [
  { level: 1, name: "Novato", minPoints: 0, maxPoints: 99, icon: "Sprout" },
  { level: 2, name: "Aprendiz", minPoints: 100, maxPoints: 299, icon: "BookOpen" },
  { level: 3, name: "Contribuidor", minPoints: 300, maxPoints: 599, icon: "Users" },
  { level: 4, name: "Mentor", minPoints: 600, maxPoints: 999, icon: "GraduationCap" },
  { level: 5, name: "Mestre", minPoints: 1000, maxPoints: Infinity, icon: "Crown" },
];

// Daily Activities Definitions
export interface DailyActivityDefinition {
  id: string;
  title: string;
  description: string;
  activityType: 'login' | 'create_post' | 'comment' | 'like' | 'reply_topic' | 'follow';
  requirementCount: number;
  xpReward: number;
  icon: string;
}

export const DAILY_ACTIVITIES: DailyActivityDefinition[] = [
  {
    id: "daily_login",
    title: "Login Diário",
    description: "Faça login hoje",
    activityType: "login",
    requirementCount: 1,
    xpReward: 3,
    icon: "LogIn",
  },
  {
    id: "daily_post",
    title: "Criar Postagem",
    description: "Crie 1 postagem na timeline",
    activityType: "create_post",
    requirementCount: 1,
    xpReward: 10,
    icon: "FileText",
  },
  {
    id: "daily_comments",
    title: "Comentar em Posts",
    description: "Comente em 3 posts diferentes",
    activityType: "comment",
    requirementCount: 3,
    xpReward: 15,
    icon: "MessageCircle",
  },
  {
    id: "daily_likes",
    title: "Curtir Conteúdo",
    description: "Dê 5 curtidas em posts",
    activityType: "like",
    requirementCount: 5,
    xpReward: 10,
    icon: "Heart",
  },
  {
    id: "daily_forum",
    title: "Participar do Fórum",
    description: "Responda 1 tópico no fórum",
    activityType: "reply_topic",
    requirementCount: 1,
    xpReward: 10,
    icon: "MessageSquare",
  },
  {
    id: "daily_network",
    title: "Expandir Rede",
    description: "Siga 2 novos membros",
    activityType: "follow",
    requirementCount: 2,
    xpReward: 4,
    icon: "UserPlus",
  },
];

// Weekly Challenges Definitions
export interface WeeklyChallengeDefinition {
  id: string;
  title: string;
  description: string;
  challengeType: 'posts_count' | 'likes_count' | 'topics_count' | 'connections_count' | 'complete_course' | 'daily_streak';
  requirementCount: number;
  xpReward: number;
  rewardType?: 'featured_member' | 'xp_multiplier' | 'profile_badge' | 'weekly_champion';
  rewardValue?: string;
  icon: string;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeDefinition[] = [
  {
    id: "weekly_posts",
    title: "Criador de Conteúdo",
    description: "Crie 5 postagens esta semana",
    challengeType: "posts_count",
    requirementCount: 5,
    xpReward: 50,
    icon: "FileEdit",
  },
  {
    id: "weekly_likes",
    title: "Influenciador",
    description: "Receba 20 curtidas esta semana",
    challengeType: "likes_count",
    requirementCount: 20,
    xpReward: 40,
    icon: "TrendingUp",
  },
  {
    id: "weekly_topics",
    title: "Iniciador de Discussões",
    description: "Crie 2 tópicos no fórum",
    challengeType: "topics_count",
    requirementCount: 2,
    xpReward: 30,
    icon: "MessageSquarePlus",
  },
  {
    id: "weekly_connections",
    title: "Networking Pro",
    description: "Conecte-se com 10 membros",
    challengeType: "connections_count",
    requirementCount: 10,
    xpReward: 20,
    icon: "Users",
  },
  {
    id: "weekly_streak",
    title: "Dedicação Total",
    description: "Complete todas as atividades diárias por 5 dias",
    challengeType: "daily_streak",
    requirementCount: 5,
    xpReward: 150,
    rewardType: "weekly_champion",
    rewardValue: JSON.stringify({
      badge: "Campeão da Semana",
      duration: 7,
      benefits: ["Perfil em destaque", "Badge exclusivo", "1.5x XP por 48h"]
    }),
    icon: "Trophy",
  },
];

// Reward Types
export interface RewardDefinition {
  type: 'featured_member' | 'xp_multiplier' | 'profile_border' | 'weekly_champion';
  name: string;
  description: string;
  icon: string;
  duration: number; // in days
}

export const REWARD_TYPES: RewardDefinition[] = [
  {
    type: "featured_member",
    name: "Membro em Destaque",
    description: "Seu perfil aparece na seção de destaque por 7 dias",
    icon: "Star",
    duration: 7,
  },
  {
    type: "xp_multiplier",
    name: "Multiplicador de XP",
    description: "Ganhe 1.5x XP em todas as ações por 48 horas",
    icon: "Zap",
    duration: 2,
  },
  {
    type: "profile_border",
    name: "Borda Especial",
    description: "Borda dourada no perfil por 7 dias",
    icon: "Crown",
    duration: 7,
  },
  {
    type: "weekly_champion",
    name: "Campeão da Semana",
    description: "Badge exclusivo + Perfil em destaque + 1.5x XP",
    icon: "Trophy",
    duration: 7,
  },
];

// Points for actions
export const POINTS = {
  // Timeline/Posts
  CREATE_POST: 10,
  COMMENT_POST: 5,
  LIKE_POST_GIVEN: 2,
  LIKE_POST_RECEIVED: 3,
  SHARE_POST: 4,
  FOLLOW_USER: 2,
  NEW_FOLLOWER: 5,
  
  // Forum
  CREATE_TOPIC: 15,
  REPLY_TOPIC: 10,
  BEST_ANSWER: 25,
  
  // General
  REPORT_ACCEPTED: 10,
  DAILY_LOGIN: 3,
  WEEKLY_CHALLENGE: 20,
};

// Badge Definitions
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string;
  type: 'posts_created' | 'comments_created' | 'likes_received' | 'best_answers' | 'replies_created' | 'total_login_days' | 'points' | 'level';
  requirement: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "communicativo",
    name: "Comunicativo",
    description: "50 comentários feitos",
    icon: "MessageSquare",
    color: "blue",
    type: "comments_created",
    requirement: 50,
  },
  {
    id: "popular",
    name: "Popular",
    description: "100 curtidas recebidas",
    icon: "Heart",
    color: "red",
    type: "likes_received",
    requirement: 100,
  },
  {
    id: "explorador",
    name: "Explorador",
    description: "30 postagens criadas",
    icon: "Compass",
    color: "green",
    type: "posts_created",
    requirement: 30,
  },
  {
    id: "mentor",
    name: "Mentor",
    description: "10 respostas marcadas como melhor",
    icon: "Award",
    color: "yellow",
    type: "best_answers",
    requirement: 10,
  },
  {
    id: "colaborador",
    name: "Colaborador",
    description: "20 respostas em tópicos",
    icon: "HandHeart",
    color: "purple",
    type: "replies_created",
    requirement: 20,
  },
  {
    id: "veterano",
    name: "Veterano",
    description: "100 dias logados",
    icon: "Shield",
    color: "gray",
    type: "total_login_days",
    requirement: 100,
  },
  {
    id: "nivel_mestre",
    name: "Alcançou Mestre",
    description: "Chegou ao nível Mestre",
    icon: "Crown",
    color: "gold",
    type: "level",
    requirement: 5,
  },
  {
    id: "mil_pontos",
    name: "Milionário de Pontos",
    description: "1000 pontos acumulados",
    icon: "TrendingUp",
    color: "emerald",
    type: "points",
    requirement: 1000,
  },
];

// Calculate user level based on points
export function calculateLevel(points: number): number {
  for (const levelData of USER_LEVELS) {
    if (points >= levelData.minPoints && points <= levelData.maxPoints) {
      return levelData.level;
    }
  }
  return 1; // Default to level 1
}

// Get level info
export function getLevelInfo(level: number) {
  return USER_LEVELS.find(l => l.level === level) || USER_LEVELS[0];
}

// Get next level info
export function getNextLevelInfo(currentLevel: number) {
  return USER_LEVELS.find(l => l.level === currentLevel + 1);
}

// Check which badges user should have
export function checkBadgesEarned(userStats: {
  posts_created?: number;
  comments_created?: number;
  likes_received?: number;
  best_answers?: number;
  replies_created?: number;
  total_login_days?: number;
  points?: number;
  level?: number;
}): string[] {
  const earnedBadgeIds: string[] = [];
  
  for (const badge of BADGE_DEFINITIONS) {
    const statValue = userStats[badge.type] || 0;
    if (statValue >= badge.requirement) {
      earnedBadgeIds.push(badge.id);
    }
  }
  
  return earnedBadgeIds;
}

// Get current week boundaries (Monday to Sunday)
export function getCurrentWeekBoundaries(): { start: Date; end: Date } {
  return getWeekBoundariesSaoPaulo();
}

// Get today boundaries
export function getTodayBoundaries(): { start: Date; end: Date } {
  return { start: startOfDaySaoPaulo(), end: endOfDaySaoPaulo() };
}

// Calculate XP with multiplier
export function calculateXpWithMultiplier(baseXp: number, multiplier: number = 1): number {
  return Math.floor(baseXp * multiplier);
}

// Check if user has active reward
export function hasActiveReward(rewards: any[], rewardType: string): boolean {
  return rewards.some(r => r.rewardType === rewardType && r.isActive);
}

// Get active XP multiplier
export function getActiveXpMultiplier(rewards: any[]): number {
  const multiplierReward = rewards.find(r => 
    r.rewardType === 'xp_multiplier' && r.isActive
  );
  
  if (multiplierReward) {
    try {
      const value = JSON.parse(multiplierReward.rewardValue || '{}');
      return value.multiplier || 1.5;
    } catch {
      return 1.5;
    }
  }
  
  return 1;
}

// Calculate time remaining for reset
export function getTimeUntilReset(type: 'daily' | 'weekly'): number {
  const now = getNowSaoPaulo();
  
  if (type === 'daily') {
    const tomorrow = startOfDaySaoPaulo(addDaysSaoPaulo(now, 1));
    return tomorrow.getTime() - now.getTime();
  } else {
    const { end } = getCurrentWeekBoundaries();
    return end.getTime() - now.getTime();
  }
}

// Format time remaining
export function formatTimeRemaining(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  return `${hours}h ${minutes}min`;
}
