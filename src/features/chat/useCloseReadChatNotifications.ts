import { useEffect } from 'react';
import { closeReadChatNotifications } from '@/shared/lib/messaging';
import { useUnreadCounts } from './useChatRooms';

/** 안 읽은 수를 받은 뒤에 뜬 알림이 있을 때 다시 받기까지 기다리는 시간 */
const RECHECK_MS = 1_000;

/**
 * 이 휴대폰에 남은 대화방 푸시 알림 중 이미 읽은 방(안 읽은 메시지 0)의 알림을 닫는다.
 * - 화면에 떠 있는 동안: 안 읽은 수가 바뀔 때마다(다른 기기에서 읽은 것도 실시간으로 들어온다)
 * - 화면으로 돌아올 때: 안 읽은 수를 새로 받은 뒤 — 숨어 있던 동안 온 알림을 옛 값으로 닫지 않게
 * - 안 읽은 수를 받은 뒤에 뜬 알림이 있으면 잠시 뒤 다시 받아 확인한다 — 다른 기기에 방을 열어 두면 그 기기의
 *   읽음 처리가 이 알림보다 먼저 끝나서, 안 읽은 수가 더는 바뀌지 않아 알림이 남는다.
 * 아이폰은 회수 신호를 받지 않으므로(domain/user/pushTokens withRecallToken) 이걸로만 정리된다.
 */
export function useCloseReadChatNotifications(userId?: string) {
  const { data: unread, dataUpdatedAt, refetch } = useUnreadCounts(userId);

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
