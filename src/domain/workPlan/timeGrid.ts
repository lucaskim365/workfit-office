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

/** 시각 글 — 24:00(하루 끝)도 그대로 쓴다(저장은 toHHmm 이 23:59로 바꾼다) */
const clockLabel = (minutes: number) => (minutes >= DAY_END ? '24:00' : toHHmm(minutes));

/** 시작 시각 고르기 목록 — 30분 간격, 칸에 없는 지금 값(예: 09:15)은 끼워 넣는다 */
export function startTimeOptions(current: number | null): number[] {
  const list = Array.from({ length: DAY_END / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES);
  if (current !== null && current >= 0 && current < DAY_END && current % SLOT_MINUTES !== 0) {
    list.push(current);
    list.sort((a, b) => a - b);
  }
  return list;
}

/** 종료 시각 고르기 목록 — 시작 뒤 30분 경계부터 24:00까지, 글에 길이를 붙인다('11:00 (1시간)') */
export function endTimeOptions(start: number, current: number | null): Array<{ minute: number; label: string }> {
  const minutes: number[] = [];
  for (let m = (Math.floor(start / SLOT_MINUTES) + 1) * SLOT_MINUTES; m <= DAY_END; m += SLOT_MINUTES) minutes.push(m);
  if (current !== null && current > start && current <= DAY_END && !minutes.includes(current)) {
    minutes.push(current);
    minutes.sort((a, b) => a - b);
  }
  return minutes.map((minute) => ({ minute, label: `${clockLabel(minute)} (${durationLabel({ start, end: minute })})` }));
}

/** 지금 시각이 속한 1시간 칸(시간표의 '지금' 표시) */
export function hourBlockOf(now: Date): MinuteRange {
  const start = now.getHours() * 60;
  return { start, end: start + 60 };
}

const MERIDIEM = /^(오전|오후|am|pm)/;
const MERIDIEM_END = /(오전|오후|am|pm)$/;

/**
 * 시각 직접 입력 → 분(5분 단위 반올림). 못 읽으면 null.
 * '9:30'·'930'·'14'·'9시 반'·'오후 2시'·'2pm'·'정오'. 오전·오후 없이 1~7시는 오후로 본다(근무시간 기준) —
 * 앞에 0을 붙이면('02:00') 그대로.
 */
export function parseTimeInput(text: string): number | null {
  let s = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  if (s === '정오') return 12 * 60;
  if (s === '자정') return 0;

  let meridiem: 'am' | 'pm' | null = null;
  const lead = s.match(MERIDIEM) ?? s.match(MERIDIEM_END);
  if (lead) {
    meridiem = lead[1] === '오전' || lead[1] === 'am' ? 'am' : 'pm';
    s = s.replace(lead.index === 0 ? MERIDIEM : MERIDIEM_END, '');
  }

  let hourText: string;
  let minute = 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):(\d{1,2})$/))) {
    hourText = m[1];
    minute = Number(m[2]);
  } else if ((m = s.match(/^(\d{1,2})시(?:(\d{1,2})분?|(반))?$/))) {
    hourText = m[1];
    minute = m[3] ? 30 : m[2] ? Number(m[2]) : 0;
  } else if ((m = s.match(/^(\d{1,2})(\d{2})$/))) {
    hourText = m[1];
    minute = Number(m[2]);
  } else if ((m = s.match(/^\d{1,2}$/))) {
    hourText = m[0];
  } else {
    return null;
  }

  let hour = Number(hourText);
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (hour >= 1 && hour <= 7 && !hourText.startsWith('0')) {
    hour += 12;
  }
  const total = hour * 60 + minute;
  if (total > DAY_END) return null;
  return Math.min(Math.round(total / 5) * 5, DAY_END);
}
