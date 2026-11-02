/**
 * 사용자 알림 설정(users.notificationPrefs, JSON 문자열)에 따라 푸시를 보낼지 정한다.
 * 화면 쪽 규칙은 src/domain/notificationPrefs/schema.ts — 바꾸면 함께 맞춘다.
 * 값이 없거나 깨졌으면 보낸다: 설정 전 사용자와, 칸이 아직 없는 DB도 지금처럼 받아야 한다.
 */
export function allowsPush(raw, type) {
  if (!raw) return true;
  let prefs;
  try {
    prefs = JSON.parse(raw);
  } catch {
    return true;
  }
  if (prefs?.mute === true || prefs?.push === false) return false;
  if (type === '메신저') return prefs?.chat !== false;
  if (type === '결재') return prefs?.approval !== false;
  return true;
}
