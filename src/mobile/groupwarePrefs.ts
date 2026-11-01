/**
 * PWA 그룹웨어 메뉴 — 보기 방식(리스트/격자)과 배치 순서.
 * 휴대폰 결재함 탭 설정처럼 이 기기(localStorage)에 사람별로 저장한다.
 */
export type GroupwareViewMode = 'list' | 'grid';

const viewKey = (userId: string) => `workfit-mobile-groupware-view-${userId}`;
const orderKey = (userId: string) => `workfit-mobile-groupware-order-${userId}`;

/** 저장한 순서를 지금 메뉴에 맞춘다 — 없어진 메뉴는 빼고, 새로 생긴 메뉴는 기본 순서대로 뒤에 붙인다 */
export function mergeOrder(saved: string[] | null, ids: readonly string[]): string[] {
  const known = new Set(ids);
  const kept = [...new Set(saved ?? [])].filter((id) => known.has(id));
  const placed = new Set(kept);
  return [...kept, ...ids.filter((id) => !placed.has(id))];
}

/** fromId 를 toId 자리로 옮긴다(둘 중 하나라도 없으면 그대로) */
export function moveItem(order: string[], fromId: string, toId: string): string[] {
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export function loadGroupwareView(userId: string): GroupwareViewMode {
  try {
    return localStorage.getItem(viewKey(userId)) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export function saveGroupwareView(userId: string, mode: GroupwareViewMode): void {
  try {
    localStorage.setItem(viewKey(userId), mode);
  } catch {
    // 저장이 막힌 브라우저 — 이번 화면에서만 적용된다
  }
}

export function loadGroupwareOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(orderKey(userId));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;
  } catch {
    return null;
  }
}

export function saveGroupwareOrder(userId: string, order: string[]): void {
  try {
    localStorage.setItem(orderKey(userId), JSON.stringify(order));
  } catch {
    // 저장이 막힌 브라우저 — 이번 화면에서만 적용된다
  }
}
