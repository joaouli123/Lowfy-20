import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Calendar, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Notifications() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');

  const { data: allNotifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const getNotificationLink = (notification: Notification): string => {
    // Se for follow, vai para o perfil do usuário que seguiu
    if (notification.type === 'follow' && notification.relatedUserId) {
      return `/profile/${notification.relatedUserId}`;
    }
    
    // Se for notificação de tópico do fórum (reply, best_answer, etc)
    if (notification.relatedTopicId) {
      const link = `/forum/${notification.relatedTopicId}`;
      return link;
    }
    
    // Se for notificação de post (comment, reaction, share, mention)
    if (notification.relatedPostId) {
      // Vai direto para a timeline com o post específico visível
      const link = `/timeline?post=${notification.relatedPostId}`;
      return link;
    }
    
    // Se for badge ou conquista, vai para o perfil do próprio usuário
    if (notification.type === 'badge' || notification.type === 'achievement') {
      return `/profile/${notification.userId}`;
    }
    
    // Default: timeline
    return '/timeline';
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Marcar como lida primeiro
      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync(notification.id);
      }
      
      // Navegar para o link correto
      const link = getNotificationLink(notification);
      setLocation(link);
      
      // Se for post específico, fazer scroll após carregar
      if (notification.relatedPostId && link.includes('?post=')) {
        setTimeout(() => {
          const postElement = document.querySelector(`[data-post-id="${notification.relatedPostId}"]`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Destacar temporariamente
            postElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              postElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 500);
      }
    } catch (error) {
    }
  };

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/notifications/read-all`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Todas marcadas como lidas",
        description: "Suas notificações foram marcadas como lidas",
      });
    },
  });

  const notifications = useMemo(() => {
    if (!allNotifications) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return allNotifications.filter((notification) => {
      if (!notification.createdAt) return true;
      const notifDate = new Date(notification.createdAt);

      switch (filter) {
        case 'today':
          return notifDate >= today;
        case 'week':
          return notifDate >= weekAgo;
        case 'custom':
          if (!customDate) return true;
          const selectedDate = new Date(customDate);
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          return notifDate >= selectedDate && notifDate < nextDay;
        default:
          return true;
      }
    });
  }, [allNotifications, filter, customDate]);

  const formatTimeAgo = (date: string | Date | null) => {
    if (!date) return "Data desconhecida";
    const now = Date.now();
    const notifDate = new Date(date).getTime();
    const diffInMs = now - notifDate;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return "agora";
    if (diffInMinutes < 60) return `há ${diffInMinutes}min`;
    if (diffInHours < 24) return `há ${diffInHours}h`;
    if (diffInDays === 1) return "há 1 dia";
    return `há ${diffInDays} dias`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return "❤️";
      case "reply":
        return "💬";
      case "badge":
        return "🏆";
      case "follow":
        return "👤";
      default:
        return "🔔";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando notificações...</p>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Bell className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">Notificações</h1>
            </div>
            <p className="text-muted-foreground">Fique por dentro de tudo que acontece</p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              variant="outline"
              className="gap-2"
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-48" data-testid="select-notifications-filter">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="custom">Data específica</SelectItem>
            </SelectContent>
          </Select>

          {filter === 'custom' && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-48"
              data-testid="input-custom-date"
            />
          )}

          {allNotifications && (
            <Badge variant="secondary" className="text-sm">
              {notifications.length} de {allNotifications.length} notificações
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {!notifications || notifications.length === 0 ? (
          <Card className="p-8 text-center" data-testid="empty-notifications">
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma notificação</h3>
            <p className="text-muted-foreground">Você está em dia com tudo!</p>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all bg-white dark:bg-card cursor-pointer hover:shadow-md ${
                !notification.isRead
                  ? "border-primary/30 card-glow"
                  : "opacity-75"
              }`}
              data-testid={`notification-${notification.id}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground mb-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      {!notification.isRead && (
                        <Badge variant="secondary" className="text-xs">
                          Nova
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsReadMutation.mutate(notification.id);
                      }}
                      disabled={markAsReadMutation.isPending}
                      data-testid={`mark-read-${notification.id}`}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
