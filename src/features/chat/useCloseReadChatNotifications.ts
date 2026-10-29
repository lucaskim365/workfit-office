import { useEffect } from 'react';
import { closeChatNotificationsUpTo, closeReadChatNotifications } from '@/shared/lib/messaging';
import { onLiveChatMessage } from './chatRealtime';
import { useUnreadCounts } from './useChatRooms';

/** 안 읽은 수를 받은 뒤에 뜬 알림이 있을 때 다시 받기까지 기다리는 시간 */
const RECHECK_MS = 1_000;

/**
 * 이 휴대폰에 남은 대화방 푸시 알림 중 이미 읽은 것을 닫는다.
 * - 실시간 읽음 표시: 다른 기기(또는 이 기기)에서 읽어 메시지의 readBy 에 내가 들어가면, 그 방의 그 메시지 시각까지의
 *   알림을 바로 닫는다. 안 읽은 수를 다시 세지 않으므로 다시 받는 요청이 엇갈려도(받는 중이던 옛 값) 놓치지 않는다.
 * - 안 읽은 수: 화면에 떠 있는 동안 바뀔 때마다, 화면으로 돌아올 때는 새로 받은 뒤 — 실시간이 끊겼던 동안의 읽음을 메운다.
 *   안 읽은 수를 받은 뒤에 뜬 알림이 있으면 잠시 뒤 다시 받아 확인한다.
 * 아이폰은 회수 신호를 받지 않으므로(domain/user/pushTokens withRecallToken) 이걸로만 정리된다.
 */
export function useCloseReadChatNotifications(userId?: string) {
  const { data: unread, dataUpdatedAt, refetch } = useUnreadCounts(userId);

  useEffect(() => {
    if (!userId) return;
    return onLiveChatMessage((message) => {
      if (message.senderId !== userId && message.readBy.includes(userId)) closeChatNotificationsUpTo(message.roomId, message.at);
    });
  }, [userId]);

  useEffect(() => {
    if (!unread || document.hidden) return;
    let recheck: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void closeReadChatNotifications(unread, dataUpdatedAt).then((deferred) => {
      if (deferred > 0 && !cancelled) recheck = setTimeout(() => void refetch(), RECHECK_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(recheck);
    };
  }, [unread, dataUpdatedAt, refetch]);

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
