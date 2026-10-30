import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 완료함 아래 서식별 바로가기 — 문서의 docType(서식 code)으로 묶는다.
 * 무엇을 보일지는 사용자가 톱니바퀴로 고르고, 이 브라우저(localStorage)에 사람별로 저장한다.
 * 고른 적이 없으면 완료함에 문서가 많은 서식부터 DEFAULT_COUNT 개.
 */
export const DEFAULT_COUNT = 3;

/** 서식별 문서 수 — 많은 순(같으면 code 순) */
export function formCounts(docs: ApprovalDoc[]): { code: string; count: number }[] {
  const m = new Map<string, number>();
  for (const d of docs) if (d.docType) m.set(d.docType, (m.get(d.docType) ?? 0) + 1);
  return [...m.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/** 보일 서식 — 저장한 값이 있으면 그대로, 없으면 문서가 많은 서식 DEFAULT_COUNT 개 */
export function pinnedForms(saved: string[] | null, docs: ApprovalDoc[]): string[] {
  if (saved) return saved;
  return formCounts(docs).slice(0, DEFAULT_COUNT).map((f) => f.code);
}

const storageKey = (userId: string) => `workfit-approval-completed-forms-${userId}`;

export function loadPinnedForms(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;
  } catch {
    return null;
  }
}

export function savePinnedForms(userId: string, codes: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(codes));
  } catch {
    // 저장이 막힌 브라우저(시크릿 등) — 이번 화면에서만 적용된다
  }
}
