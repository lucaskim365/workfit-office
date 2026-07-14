import { useEffect, useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationRepo } from '@/data/notification/notification.repo';
import type { LiveNotification } from '@/domain/liveNotification/schema';

const NOTI_KEY = 'liveNotifications';

// Simple toast trigger subsystem
type ToastCallback = (data: { type: string; who: string; text: string; icon: string; color: string }) => void;
const toastListeners = new Set<ToastCallback>();

export function registerToastListener(cb: ToastCallback) {
  toastListeners.add(cb);
  return () => {
    toastListeners.delete(cb);
  };
}

export function triggerToast(type: string, who: string, text: string, icon: string, color: string) {
  toastListeners.forEach((cb) => cb({ type, who, text, icon, color }));
}

export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  const [data, setData] = useState<LiveNotification[]>([]);
  const lastCount = useRef(-1);

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }
    const unsub = notificationRepo.subscribe(userId, (list) => {
      setData(list);
      qc.setQueryData([NOTI_KEY, userId], list);

      // Trigger toast for new unread notifications
      const unread = list.filter((n) => !n.read);
      if (lastCount.current !== -1 && unread.length > lastCount.current) {
        // Find the newest unread notification
        const newest = unread[0];
        if (newest) {
          const typeIcon = newest.type === '결재' ? '🖋️' : newest.type === '메신저' ? '👤' : '📢';
          const typeColor = newest.type === '결재' ? '#6c5ce7' : newest.type === '메신저' ? '#eecfa2' : '#16b8cf';
          triggerToast(newest.type, newest.senderName, newest.text, typeIcon, typeColor);
        }
      }
      lastCount.current = unread.length;
    });
    return unsub;
  }, [userId, qc]);

  return data;
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: (id: string) => notificationRepo.markAsRead(id),
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: (userId: string) => notificationRepo.markAllAsRead(userId),
  });
}
