import { useEffect } from 'react';
import { closeReadChatNotifications } from '@/shared/lib/messaging';
import { useUnreadCounts } from './useChatRooms';

/**
 * 이 휴대폰에 남은 대화방 푸시 알림 중 이미 읽은 방(안 읽은 메시지 0)의 알림을 닫는다.
 * - 화면에 떠 있는 동안: 안 읽은 수가 바뀔 때마다(다른 기기에서 읽은 것도 실시간으로 들어온다)
 * - 화면으로 돌아올 때: 안 읽은 수를 새로 받은 뒤 — 숨어 있던 동안 온 알림을 옛 값으로 닫지 않게
 * 아이폰은 회수 신호를 받지 않으므로(domain/user/pushTokens withRecallToken) 이걸로만 정리된다.
 */
export function useCloseReadChatNotifications(userId?: string) {
  const { data: unread, dataUpdatedAt, refetch } = useUnreadCounts(userId);

  useEffect(() => {
    if (unread && !document.hidden) void closeReadChatNotifications(unread, dataUpdatedAt);
  }, [unread, dataUpdatedAt]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.hidden) return;
      void refetch().then(({ data, dataUpdatedAt: fetchedAt }) => {
        if (data) void closeReadChatNotifications(data, fetchedAt);
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refetch]);
}
