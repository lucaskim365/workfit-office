import { addDays } from './rules';
import type { PmAction, PmMeeting } from './schema';

/**
 * 회의록 · 액션 아이템 — 이슈 · 회의 · 보고 › 회의록 · 액션 아이템 (데모 docMeet 5658 · mtForm 3317 · actForm 3342).
 */
export const actOpen = (a: PmAction) => !a.done;

/** 회의 기록 (docMeet ms) — 사업으로 거르고 날짜 최근 순 + 달 머리 */
export function meetList(ms: readonly PmMeeting[], site: string): Array<{ m: PmMeeting; month: string | null }> {
  const L = ms.filter((m) => site === 'all' || m.projectId === site).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return L.map((m, i) => {
    const mo = (m.date || '').slice(0, 7);
    const newMo = i === 0 || (L[i - 1].date || '').slice(0, 7) !== mo;
    return { m, month: newMo ? (mo ? `${mo.slice(0, 4)}년 ${+mo.slice(5)}월` : '날짜 없음') : null };
  });
}

export type ActBucket = 'od' | 'week' | 'later' | 'done';
export const ACT_BUCKETS: ReadonlyArray<readonly [ActBucket, string]> = [['od', '기한 지남'], ['week', '이번 주'], ['later', '그 뒤 · 기한 없음'], ['done', '끝낸 일']];
/** 할 일 4칸 (docMeet B) — 사업 · 담당으로 거르고 안 끝난 것 · 기한 순. '이번 주' = 오늘 ~ 7일 뒤 */
export function actBuckets(as: readonly PmAction[], site: string, who: string, today: string): Record<ActBucket, PmAction[]> & { n: number } {
  const w7 = addDays(today, 7);
  const acts = as.filter((a) => (site === 'all' || a.projectId === site) && (who === 'all' || a.whoId === who))
    .sort((a, b) => Number(a.done) - Number(b.done) || ((a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : 0));
  return {
    n: acts.length,
    od: acts.filter((x) => actOpen(x) && !!x.due && x.due < today),
    week: acts.filter((x) => actOpen(x) && !!x.due && x.due <= w7 && x.due >= today),
    later: acts.filter((x) => actOpen(x) && !(x.due && x.due <= w7)),
    done: acts.filter((x) => !actOpen(x)),
  };
}

/** 회의록 입력 확인 (mtForm req) */
export function meetCheck(v: { title: string; date: string; attIds: readonly string[]; content: string }): [string, string] | null {
  if (!v.title.trim()) return ['회의명을 입력해 주세요', 'title'];
  if (!v.date) return ['일자를 입력해 주세요', 'date'];
  if (!v.attIds.length) return ['참석자(사내)를 한 명 이상 골라 주세요', 'attIds'];
  if (!v.content.trim()) return ['회의 내용을 입력해 주세요', 'content'];
  return null;
}
/** 액션 아이템 입력 확인 (actForm req) */
export function actCheck(v: { text: string; whoId: string; due: string }): [string, string] | null {
  if (!v.text.trim()) return ['할 일을 입력해 주세요', 'text'];
  if (!v.whoId) return ['담당자를 골라 주세요', 'whoId'];
  if (!v.due) return ['기한을 입력해 주세요', 'due'];
  return null;
}
