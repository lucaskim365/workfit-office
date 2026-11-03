/**
 * 알림 설정 — 사용자별로 users.notificationPrefs 에 JSON 문자열로 저장한다.
 * 푸시는 서버 함수(push-notifications/src/prefs.js)가, 화면 토스트는 이 파일이 같은 규칙으로 거른다.
 * 알림을 꺼도 알림 목록(종 아이콘)에는 남는다.
 */
export interface NotificationPrefs {
  /** 모든 알림 방해금지 */
  mute: boolean;
  /** 푸시 받기(PC·휴대폰) */
  push: boolean;
  /** 메신저 알림 */
  chat: boolean;
  /** 전자결재 알림 */
  approval: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { mute: false, push: true, chat: true, approval: true };

/** 설정 화면 항목 — 웹·앱이 같은 문구를 쓴다 */
export const NOTIFICATION_PREF_ROWS: Array<{ key: keyof NotificationPrefs; label: string; desc: string }> = [
  { key: 'mute', label: '모든 알림 방해금지', desc: '모든 알림을 받지 않습니다. 알림 목록에는 그대로 남습니다.' },
  { key: 'push', label: '푸시 알림 받기', desc: 'PC·휴대폰으로 오는 푸시 알림을 받습니다.' },
  { key: 'chat', label: '메신저 알림 받기', desc: '새 메시지가 오면 알림을 받습니다.' },
  { key: 'approval', label: '전자결재 알림 받기', desc: '내 결재 차례나 최종 승인·반려 때 알림을 받습니다.' },
];

/** 저장된 문자열을 읽는다. 비었거나 깨졌으면 기본값 — 설정 전 사용자는 모두 받는다 */
export function parseNotificationPrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const saved = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      mute: saved.mute === true,
      push: saved.push !== false,
      chat: saved.chat !== false,
      approval: saved.approval !== false,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

/** 화면 토스트를 띄워도 되는가 — 알림 종류(메신저·결재·일정·시스템) 기준 */
export function allowsToast(prefs: NotificationPrefs, type: string): boolean {
  if (prefs.mute) return false;
  if (type === '메신저') return prefs.chat;
  if (type === '결재') return prefs.approval;
  return true;
}
