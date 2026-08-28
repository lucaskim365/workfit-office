import { useEffect, useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationRepo } from '@/data/notification/notification.repo';
import type { LiveNotification } from '@/domain/liveNotification/schema';
import { NOTIFICATION_TYPE_META } from '@/domain/liveNotification/schema';

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

/**
 * 사용자당 실시간 구독을 **하나만** 유지하고 여러 화면이 나눠 쓴다.
 *
 * `useNotifications` 는 App 루트·상단바·그룹웨어 도크 등 여러 곳에서 동시에 마운트된다.
 * 예전에는 그 수만큼 각자 `subscribe` 해서, 알림 1건마다 **화면당 4번씩** 목록 전체를
 * 다시 읽었다. 전 사원 발송과 겹치면 그대로 브라우저가 멎는다.
 *
 * 구독자가 0이 되면 실제 구독도 끊는다 — 로그아웃 후에도 소켓이 남으면 안 된다.
 */
interface SharedFeed {
  list: LiveNotification[];
  listeners: Set<(list: LiveNotification[]) => void>;
  unsubscribe: () => void;
}

const feeds = new Map<string, SharedFeed>();

function subscribeShared(userId: string, listener: (list: LiveNotification[]) => void): () => void {
  let feed = feeds.get(userId);
  if (!feed) {
    const created: SharedFeed = { list: [], listeners: new Set(), unsubscribe: () => {} };
    created.unsubscribe = notificationRepo.subscribe(userId, (list) => {
      created.list = list;
      created.listeners.forEach((cb) => cb(list));
    });
    feeds.set(userId, created);
    feed = created;
  }
  feed.listeners.add(listener);
  // 늦게 붙은 구독자에게도 지금까지 받은 목록을 바로 넘긴다.
  if (feed.list.length > 0) listener(feed.list);

  return () => {
    const current = feeds.get(userId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsubscribe();
      feeds.delete(userId);
    }
  };
}

export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  const [data, setData] = useState<LiveNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }
    return subscribeShared(userId, (list) => {
      setData(list);
      qc.setQueryData([NOTI_KEY, userId], list);
    });
  }, [userId, qc]);

  return data;
}

export function useToastNotificationsTrigger(userId: string | undefined) {
  const lastCount = useRef(-1);

  useEffect(() => {
    if (!userId) return;
    return subscribeShared(userId, (list) => {
      const unread = list.filter((n) => !n.read);
      if (lastCount.current !== -1 && unread.length > lastCount.current) {
        const newest = unread[0];
        if (newest) {
          const meta = NOTIFICATION_TYPE_META[newest.type] || { icon: '📢', color: '#16b8cf' };
          triggerToast(newest.type, newest.senderName, newest.text, meta.icon, meta.color);
        }
      }
      lastCount.current = unread.length;
    });
  }, [userId]);
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
