import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Notification } from '@shared/schema';
import { formatTimeAgo as formatTime } from '@/lib/formatTime';
import { Link, useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface NotificationWithActor extends Notification {
  actor?: {
    id: string;
    name: string;
    profileImageUrl?: string | null;
    profession?: string | null;
  } | null;
}

interface NotificationsModalProps {
  trigger?: React.ReactNode;
}

export function NotificationsModal({ trigger }: NotificationsModalProps) {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<NotificationWithActor[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

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
      return apiRequest("POST", `/api/notifications/mark-all-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const getNotificationLink = (notification: NotificationWithActor): string => {
    if (notification.type === 'follow') {
      return '/timeline';
    }

    if (notification.relatedTopicId) {
      const link = `/forum/${notification.relatedTopicId}${notification.relatedReplyId ? `#reply-${notification.relatedReplyId}` : ''}`;
      return link;
    }

    if (notification.relatedPostId) {
      const link = `/timeline?post=${notification.relatedPostId}${notification.relatedCommentId ? `#comment-${notification.relatedCommentId}` : ''}`;
      return link;
    }

    if (notification.type === 'badge' || notification.type === 'achievement') {
      return `/profile`;
    }

    return '/timeline';
  };

  const handleNotificationClick = async (notification: NotificationWithActor) => {
    try {
      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync(notification.id);
      }

      setIsOpen(false);

      const link = getNotificationLink(notification);
      setLocation(link);

      if (notification.relatedCommentId) {
        setTimeout(() => {
          const commentElement = document.getElementById(`comment-${notification.relatedCommentId}`);
          if (commentElement) {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            commentElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              commentElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 500);
      } else if (notification.relatedPostId && link.includes('?post=')) {
        setTimeout(() => {
          const postElement = document.querySelector(`[data-post-id="${notification.relatedPostId}"]`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            postElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              postElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 500);
      } else if (notification.relatedReplyId) {
        setTimeout(() => {
          const replyElement = document.getElementById(`reply-${notification.relatedReplyId}`);
          if (replyElement) {
            replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            replyElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              replyElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 500);
      }
    } catch (error) {
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recentNotifications = notifications.slice(0, 6);

  useEffect(() => {
    if (isOpen && unreadCount > 0 && !markAllAsReadMutation.isPending) {
      markAllAsReadMutation.mutate();
    }
  }, [isOpen, unreadCount]);


  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
      case "reaction":
        return "❤️";
      case "comment":
      case "reply":
        return "💬";
      case "follow":
        return "👤";
      case "share":
        return "🔄";
      case "badge":
        return "🏆";
      default:
        return "🔔";
    }
  };

  const formatTimeAgo = (date: string | Date | null) => {
    if (!date) return "Data desconhecida";
    return formatTime(date);
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      data-testid="button-topbar-notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          data-testid="topbar-notification-count"
        >
          {unreadCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notificações</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} novas</Badge>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando notificações...
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-accent/50 transition-colors cursor-pointer ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex gap-3">
                    {notification.actor ? (
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={notification.actor.profileImageUrl || undefined} />
                        <AvatarFallback>{notification.actor.name?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-muted/30">
          <Link href="/notifications" onClick={() => setIsOpen(false)}>
            <Button
              variant="ghost"
              className="w-full text-primary hover:text-white"
              data-testid="button-view-all-notifications"
            >
              Ver todas as notificações
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
