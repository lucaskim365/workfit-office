// 업무계획 시간표 계산 — 30분 칸 클릭·끌기·옮기기·겹침 배치 (분 단위 정수, 0~1440)

export const SLOT_MINUTES = 30;
export const DAY_END = 1440;

export interface MinuteRange {
  start: number;
  end: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** 'HH:mm' → 분 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 분 → 'HH:mm' (24:00은 시간 규칙이 못 받으므로 23:59) */
export function toHHmm(minutes: number): string {
  const m = Math.min(Math.max(Math.round(minutes), 0), DAY_END - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 끌기: 두 점이 속한 30분 칸을 모두 덮는다(최소 30분) */
export function rangeFromDrag(anchor: number, current: number): MinuteRange {
  const lo = Math.min(anchor, current);
  const hi = Math.max(anchor, current);
  const end = clamp((Math.floor(hi / SLOT_MINUTES) + 1) * SLOT_MINUTES, SLOT_MINUTES, DAY_END);
  const start = clamp(Math.floor(lo / SLOT_MINUTES) * SLOT_MINUTES, 0, end - SLOT_MINUTES);
  return { start, end };
}

/** 옮기기: 30분 단위로 반올림, 길이 유지, 하루 안으로 */
export function moveRange(range: MinuteRange, delta: number): MinuteRange {
  const length = range.end - range.start;
  const shift = Math.round(delta / SLOT_MINUTES) * SLOT_MINUTES;
  const start = clamp(range.start + shift, 0, DAY_END - length);
  return { start, end: start + length };
}

/** 끝 늘리기: 30분 단위 올림, 최소 시작+30분, 최대 24시 */
export function resizeEnd(range: MinuteRange, end: number): MinuteRange {
  const snapped = Math.ceil(end / SLOT_MINUTES) * SLOT_MINUTES;
  return { start: range.start, end: clamp(snapped, range.start + SLOT_MINUTES, DAY_END) };
}

/** 길이 표시: '30분' | '1시간' | '1시간 30분' */
export function durationLabel(range: MinuteRange): string {
  const len = Math.max(range.end - range.start, 0);
  const h = Math.floor(len / 60);
  const m = len % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 겹치는 블록을 옆으로 나눈다. 이어서 겹치는 블록끼리 한 묶음이며 cols는 묶음 안 최대 동시 칸 수 */
export function layoutColumns<T extends { key: string } & MinuteRange>(
  blocks: T[],
): Array<T & { col: number; cols: number }> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Array<T & { col: number; cols: number }> = [];
  let group: Array<T & { col: number; cols: number }> = [];
  let colEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    for (const b of group) b.cols = cols;
    result.push(...group);
    group = [];
    colEnds = [];
  };

  for (const block of sorted) {
    if (group.length > 0 && block.start >= groupEnd) flush();
    let col = colEnds.findIndex((e) => e <= block.start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = block.end;
    groupEnd = group.length === 0 ? block.end : Math.max(groupEnd, block.end);
    group.push({ ...block, col, cols: 1 });
  }
  flush();
  return result;
}

/** 빠른 입력 기본값: 다음 30분 경계부터 30분 (23:30 이후면 23:30~24:00) */
export function quickDefaultRange(now: Date): MinuteRange {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = Math.min((Math.floor(minutes / SLOT_MINUTES) + 1) * SLOT_MINUTES, DAY_END - SLOT_MINUTES);
  return { start, end: start + SLOT_MINUTES };
}
