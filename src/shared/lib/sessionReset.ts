/**
 * 로그아웃 때 비울 것들 — 저장소 계층이 받아 둔 목록(결재 문서 등)을 등록해 두면
 * 로그아웃할 때 한꺼번에 비운다. 같은 창에서 다른 계정으로 들어와도 앞사람 목록이 잠깐이라도 보이지 않게.
 */
const resets = new Set<() => void>();

/** 로그아웃 때 부를 함수를 등록한다. 반환값으로 등록을 푼다 */
export function onSessionReset(fn: () => void): () => void {
  resets.add(fn);
  return () => resets.delete(fn);
}

/** 등록된 것을 모두 비운다(로그아웃 시) */
export function resetSessionCaches(): void {
  for (const fn of resets) {
    try {
      fn();
    } catch {
      /* 하나가 실패해도 나머지는 비운다 */
    }
  }
}
