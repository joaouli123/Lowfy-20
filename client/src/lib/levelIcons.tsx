import { 
  Sprout, 
  BookOpen, 
  Users, 
  GraduationCap, 
  Crown,
  LucideIcon
} from 'lucide-react';
import { USER_LEVELS } from '@/hooks/useGamification';

const LEVEL_ICON_MAP: Record<string, LucideIcon> = {
  'Sprout': Sprout,
  'BookOpen': BookOpen,
  'Users': Users,
  'GraduationCap': GraduationCap,
  'Crown': Crown,
};

export function getLevelIcon(level: number): LucideIcon | null {
  const levelData = USER_LEVELS.find(l => l.level === level);
  if (!levelData) return null;
  return LEVEL_ICON_MAP[levelData.icon] || null;
}

export function getLevelColor(level: number): string {
  const colors: Record<number, string> = {
    1: 'text-green-600 dark:text-green-400',
    2: 'text-blue-600 dark:text-blue-400',
    3: 'text-purple-600 dark:text-purple-400',
    4: 'text-orange-600 dark:text-orange-400',
    5: 'text-yellow-600 dark:text-yellow-400',
  };
  return colors[level] || 'text-gray-600 dark:text-gray-400';
}

export function getLevelName(level: number): string {
  const levelData = USER_LEVELS.find(l => l.level === level);
  return levelData?.name || 'Novato';
}
