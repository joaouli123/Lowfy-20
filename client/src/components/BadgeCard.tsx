import { Badge as BadgeType } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Award, Star, Trophy, Zap, Medal, Crown, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeCardProps {
  badge: BadgeType;
  earned?: boolean;
  size?: "sm" | "md" | "lg";
}

const iconMap: Record<string, any> = {
  award: Award,
  star: Star,
  trophy: Trophy,
  zap: Zap,
  medal: Medal,
  crown: Crown,
  target: Target,
  sparkles: Sparkles,
};

export default function BadgeCard({ badge, earned = false, size = "md" }: BadgeCardProps) {
  const IconComponent = iconMap[badge.icon || "award"] || Award;
  
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-20 h-20",
    lg: "w-24 h-24",
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2",
        !earned && "opacity-40 grayscale"
      )}
      data-testid={`badge-${badge.id}`}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-300 scale-hover",
          sizeClasses[size],
          earned
            ? "bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-lg shadow-amber-500/50 group-hover:shadow-xl group-hover:shadow-amber-500/70 group-hover:scale-110"
            : "bg-gradient-to-br from-gray-300 to-gray-400"
        )}
      >
        <IconComponent
          className={cn(
            iconSizes[size],
            earned ? "text-white" : "text-gray-600"
          )}
        />
      </div>
      <div className="text-center">
        <p className={cn(
          "font-semibold text-sm",
          earned ? "text-foreground" : "text-muted-foreground"
        )}>
          {badge.name}
        </p>
        {badge.description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-[120px]">
            {badge.description}
          </p>
        )}
        {badge.requirement && (
          <p className="text-xs text-primary font-medium mt-1">
            {badge.requirement} pontos
          </p>
        )}
      </div>
    </div>
  );
}
