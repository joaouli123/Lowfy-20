import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button, Input, Badge, Avatar, Progress, Tooltip } from "@heroui/react";
import { Search, ShoppingCart, Menu, Trophy } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { NotificationsModal } from "@/components/NotificationsModal";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useGamification } from "@/hooks/useGamification";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";

export default function TopBar() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const queryClient = useQueryClient();
  const { on, off, isConnected } = useSocket();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(true);

  useNotificationSocket();

  const {
    level,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
  } = useGamification();

  const { data: cartItems } = useQuery({
    queryKey: ["/api/marketplace/cart"],
    enabled: !!user,
  });

  const cartItemCount = Array.isArray(cartItems)
    ? cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0)
    : 0;

  useEffect(() => {
    if (!isConnected || !user?.id) {
      return;
    }

    const handlePointsUpdated = (data: { userId: string; points: number; totalPoints: number; action: string }) => {
      if (data.userId === user.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/points`] });
      }
    };

    on("points_updated", handlePointsUpdated);

    return () => {
      off("points_updated", handlePointsUpdated);
    };
  }, [user?.id, queryClient, isConnected, on, off]);

  // Detecta a plataforma só para exibir o rótulo certo do atalho (⌘K vs Ctrl K).
  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(window.navigator.platform || window.navigator.userAgent));
  }, []);

  // Atalho de teclado Cmd/Ctrl+K — foca a busca global do TopBar. Ela é intencionalmente
  // separada da busca do Sidebar: esta é o atalho rápido "vá para" (foco + digitação),
  // a do Sidebar filtra a lista de navegação em tempo real.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-16 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40" data-testid="topbar">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-6">
        <Button
          isIconOnly
          variant="light"
          radius="full"
          onPress={toggleSidebar}
          className="lg:hidden text-default-500"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex-1 max-w-xs hidden sm:block">
          <Input
            ref={searchInputRef}
            placeholder="Buscar na plataforma"
            size="sm"
            variant="underlined"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            endContent={
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-default-200 bg-default-100 px-1.5 py-0.5 text-[10px] font-medium text-default-400 select-none">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            }
            classNames={{
              inputWrapper: "shadow-none",
              input: "text-sm",
            }}
            data-testid="input-topbar-search"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <NotificationsModal />

          <Link href="/marketplace/cart">
            <Badge
              content={cartItemCount > 99 ? "99+" : cartItemCount}
              color="primary"
              size="sm"
              shape="circle"
              isInvisible={cartItemCount === 0}
              data-testid="cart-item-count"
            >
              <Button
                isIconOnly
                variant="light"
                radius="full"
                className="text-default-500"
                data-testid="button-topbar-cart"
              >
                <ShoppingCart className="h-5 w-5" />
              </Button>
            </Badge>
          </Link>

          <Tooltip content={`Nível ${level} · ${xpInCurrentLevel}/${xpNeededForNextLevel} XP`}>
            <Link href="/profile">
              <div className="hidden lg:flex flex-col gap-1 min-w-[120px] px-1 cursor-pointer group">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-default-500 group-hover:text-foreground transition-colors">
                    <Trophy className="h-3 w-3 text-primary" />
                    Nível {level}
                  </span>
                  <span className="text-[11px] text-default-400">
                    {xpInCurrentLevel}/{xpNeededForNextLevel} XP
                  </span>
                </div>
                <Progress
                  value={progressPercentage}
                  size="sm"
                  color="primary"
                  aria-label="Progresso de XP"
                  classNames={{ indicator: "bg-primary", track: "bg-default-100" }}
                  data-testid="topbar-progress-xp"
                />
              </div>
            </Link>
          </Tooltip>

          <Link href="/profile">
            <Avatar
              src={user?.profileImageUrl || undefined}
              name={getInitials(user?.name)}
              size="sm"
              radius="full"
              className="cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all"
              classNames={{ base: "bg-primary/10", name: "text-primary font-bold" }}
              data-testid="topbar-user-profile"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
