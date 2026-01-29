import { useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { queryClient } from '@/lib/queryClient';

export function useNotificationSocket() {
  const { on, off, isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const handleNewNotification = (notification: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    };

    on('new_notification', handleNewNotification);

    return () => {
      off('new_notification', handleNewNotification);
    };
  }, [isConnected, on, off]);
}
