import type { CommuteStatus } from '@/domain/commute/schema';

/** 대시보드 근태 4분류 — 시안(출근·출근 전/휴무·지각·휴가)과 같은 색 묶음 */
export type AttendanceBucket = 'work' | 'pending' | 'late' | 'leave';

export const ATTENDANCE_BUCKETS: AttendanceBucket[] = ['pending', 'leave', 'work', 'late'];

export const ATTENDANCE_LABELS: Record<AttendanceBucket, string> = {
  work: '출근',
  pending: '휴무/기타',
  late: '지각',
  leave: '휴가',
};

/** 근태 판정 → 4분류. 외근·출장·휴일근무는 일한 날이라 출근, 결근·미기록·휴무는 휴무/기타 */
export function bucketOf(status: CommuteStatus): AttendanceBucket {
  switch (status) {
    case 'normal':
    case 'holiday_work':
    case 'outside':
    case 'trip':
    case 'missing_out':
      return 'work';
    case 'late':
      return 'late';
    case 'leave':
      return 'leave';
    default:
      return 'pending';
  }
}

/** 한국 시간 오늘 'YYYY-MM-DD' */
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM' 의 날짜 목록 */
export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** 그 달 1일의 요일(0=일) */
export function firstWeekday(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 하루 타임라인 축 — 08:00 ~ 20:00 */
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 20 * 60;

/** 'HH:MM' → 분. 못 읽으면 null */
export function minutesOf(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * 타임라인 위 자리(축 대비 %) — 시작이 없으면 null(종일·시간 미정은 축 밖에 따로 둔다).
 * 끝이 없거나 시작보다 이르면 1시간으로 본다. 축 밖은 잘라 낸다.
 */
export function timelineSpan(start: string | null, end: string | null): { left: number; width: number } | null {
  const s = minutesOf(start);
  if (s === null) return null;
  let e = minutesOf(end);
  if (e === null || e <= s) e = s + 60;
  const span = DAY_END_MIN - DAY_START_MIN;
  const a = Math.min(Math.max(s, DAY_START_MIN), DAY_END_MIN);
  const b = Math.min(Math.max(e, DAY_START_MIN), DAY_END_MIN);
  if (b <= a) return null;
  return { left: ((a - DAY_START_MIN) / span) * 100, width: ((b - a) / span) * 100 };
}

/** 지금 시각의 축 위 자리(%) — 축 밖이면 null */
export function nowPercent(now = new Date()): number | null {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const min = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (min < DAY_START_MIN || min > DAY_END_MIN) return null;
  return ((min - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100;
}

/** 도넛 조각 — 합계 대비 시작·끝 각도(0~1). 값이 0인 조각은 뺀다 */
export function donutSlices<K extends string>(counts: Array<{ key: K; value: number }>): Array<{ key: K; value: number; from: number; to: number }> {
  const total = counts.reduce((s, c) => s + c.value, 0);
  if (total <= 0) return [];
  let acc = 0;
  return counts
    .filter((c) => c.value > 0)
    .map((c) => {
      const from = acc / total;
      acc += c.value;
      return { ...c, from, to: acc / total };
    });
}

/**
 * 겹치는 일정 줄 나누기 — 시작 순으로 놓으며, 앞 일정과 겹치면 다음 칸으로 내린다.
 * 반환: 각 항목의 칸 번호(0부터)와 전체 칸 수.
 */
export function packLanes<T extends { start: string | null; end: string | null }>(items: T[]): { lanes: Array<{ item: T; lane: number }>; count: number } {
  const spans = items
    .map((item) => ({ item, s: minutesOf(item.start), e: minutesOf(item.end) }))
    .filter((x): x is { item: T; s: number; e: number | null } => x.s !== null)
    .map((x) => ({ item: x.item, s: x.s, e: x.e === null || x.e <= x.s ? x.s + 60 : x.e }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const laneEnds: number[] = [];
  const lanes = spans.map(({ item, s, e }) => {
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
    return { item, lane };
  });
  return { lanes, count: laneEnds.length };
}

/* ───────── 위젯 배치 ───────── */

/** 위젯 폭 — 12칸 중 몇 칸 */
export const WIDGET_SIZES = [4, 6, 8, 12] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];
export interface WidgetSlot<Id extends string = string> { id: Id; size: WidgetSize }

/** 저장된 배치 정리 — 모르는 위젯·중복·잘못된 폭은 버린다. 비어 있으면 기본 배치 */
export function normalizeLayout<Id extends string>(saved: unknown, known: readonly Id[], fallback: WidgetSlot<Id>[]): WidgetSlot<Id>[] {
  if (!Array.isArray(saved)) return fallback;
  const seen = new Set<string>();
  const out: WidgetSlot<Id>[] = [];
  for (const raw of saved) {
    const id = (raw as { id?: unknown })?.id;
    const size = (raw as { size?: unknown })?.size;
    if (typeof id !== 'string' || !known.includes(id as Id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id: id as Id, size: (WIDGET_SIZES as readonly number[]).includes(size as number) ? (size as WidgetSize) : 6 });
  }
  return out.length ? out : fallback;
}

/** from 자리의 위젯을 to 자리로 옮긴다 */
export function moveSlot<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, x);
  return next;
}

/** 다음 폭 — 4 → 6 → 8 → 12 → 4 */
export function nextSize(size: WidgetSize): WidgetSize {
  return WIDGET_SIZES[(WIDGET_SIZES.indexOf(size) + 1) % WIDGET_SIZES.length];
}

/** 끌어 늘린 칸 수 → 가장 가까운 위젯 폭(4·6·8·12) */
export function snapSize(cols: number, allowed: readonly WidgetSize[] = WIDGET_SIZES): WidgetSize {
  const list = allowed.length ? allowed : WIDGET_SIZES;
  let best: WidgetSize = list[0];
  for (const s of list) if (Math.abs(s - cols) < Math.abs(best - cols)) best = s;
  return best;
}

/** 새 위젯을 at 자리에 끼운다(이미 있으면 그대로) */
export function insertSlot<Id extends string>(list: WidgetSlot<Id>[], slot: WidgetSlot<Id>, at: number): WidgetSlot<Id>[] {
  if (list.some((s) => s.id === slot.id)) return list;
  const next = [...list];
  next.splice(Math.max(0, Math.min(at, next.length)), 0, slot);
  return next;
}
