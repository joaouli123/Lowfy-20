import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Menu, Trophy, Bell } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { NotificationsModal } from "@/components/NotificationsModal";
import { Progress } from "@/components/ui/progress";
import { useEffect } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useGamification } from "@/hooks/useGamification";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";

export default function TopBar() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const queryClient = useQueryClient();
  const { on, off, isConnected } = useSocket();
  
  useNotificationSocket();
  
  const {
    currentXP,
    level,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
  } = useGamification();

  const { data: cartItems } = useQuery({
    queryKey: ["/api/marketplace/cart"],
    enabled: !!user,
  });

  const cartItemCount = Array.isArray(cartItems) ? cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0) : 0;

  useEffect(() => {
    if (!isConnected || !user?.id) {
      return;
    }

    const handlePointsUpdated = (data: { userId: string; points: number; totalPoints: number; action: string }) => {
      if (data.userId === user.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/points`] });
      }
    };

    on('points_updated', handlePointsUpdated);

    return () => {
      off('points_updated', handlePointsUpdated);
    };
  }, [user?.id, queryClient, isConnected, on, off]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-16 border-b bg-card sticky top-0 z-40" data-testid="topbar">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar discussões, usuários..."
              className="pl-10 bg-muted/50"
              data-testid="input-topbar-search"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Modal */}
          <NotificationsModal />

          {/* Cart */}
          <Link href="/marketplace/cart">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              data-testid="button-topbar-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]" 
                  data-testid="cart-item-count"
                >
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Badge>
              )}
            </Button>
          </Link>

          {/* Progress Bar - Hidden on mobile */}
          <Link href="/profile">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {xpInCurrentLevel} / {xpNeededForNextLevel} XP
                  </span>
                  <span className="text-xs font-medium">
                    Nv {level}
                  </span>
                </div>
                <Progress 
                  value={progressPercentage} 
                  className="h-1.5 bg-[#0000001a]"
                  data-testid="topbar-progress-xp"
                />
              </div>
            </div>
          </Link>

          {/* User Profile */}
          <Link href="/profile">
            <div className="flex items-center hover:bg-muted/50 p-2 rounded-lg transition-colors cursor-pointer" data-testid="topbar-user-profile">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-primary" data-testid="topbar-user-initials">
                    {getInitials(user?.name)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
