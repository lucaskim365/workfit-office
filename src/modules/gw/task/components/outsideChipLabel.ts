import { scheduleChip } from '@/domain/commute/statusDisplay';

/*
  업무계획 외근·출장 칩 글 — 제목(목적 칸)만 보인다. 행선지는 일정을 열어 세부 정보에서 본다.
  제목이 없으면(예전 일정) 세부 구분. 여러 줄 목적은 첫 줄만.
*/

const firstLine = (text?: string | null) =>
  (text ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? '';

export function outsideChipLabel(s: {
  category: 'OUTSIDE' | 'TRIP';
  subType?: string | null;
  purpose?: string | null;
  /** 동행자 칸이면 등록자 이름 */
  companionOwnerName?: string | null;
}): string {
  const chip = scheduleChip({ category: s.category, subType: s.subType });
  const title = firstLine(s.purpose) || chip.label;
  if (s.companionOwnerName != null) return `[동행] ${title} · ${s.companionOwnerName}`;
  return `[${chip.short}] ${title}`;
}
