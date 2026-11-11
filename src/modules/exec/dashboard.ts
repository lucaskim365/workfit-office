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

/** 모눈 가로 칸 수 */
export const GRID_COLS = 12;
/** 위젯 기본 폭 — 12칸 중 몇 칸 */
export type WidgetSize = 4 | 6 | 8 | 12;
/** size — 가로 칸 수, rows — 세로 칸 수(없으면 위젯 기본), x·y — 왼쪽 위 칸(없으면 빈자리에 놓는다) */
export interface WidgetSlot<Id extends string = string> { id: Id; size: number; rows?: number; x?: number; y?: number }

/** 모눈 한 칸 높이와 칸 사이 간격(px) — 위젯 높이는 늘 이 칸에 맞춘다 */
export const CELL_H = 48;
export const CELL_GAP = 16;
export const PITCH = CELL_H + CELL_GAP;
export const MAX_ROWS = 40;

/** 칸 수 → 높이(px) */
export const rowsHeight = (rows: number) => rows * PITCH - CELL_GAP;
/** 이 높이(px)가 다 들어가는 가장 적은 칸 수 */
export const rowsFor = (px: number) => Math.max(1, Math.ceil((px + CELL_GAP) / PITCH));
/** 끌어 바꾼 높이(px) → 가장 가까운 칸 수, 최소 칸 수(minRows) 이상 */
export function snapRows(px: number, minRows = 1): number {
  return Math.min(MAX_ROWS, Math.max(minRows, 1, Math.round((px + CELL_GAP) / PITCH)));
}

const isCount = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 저장된 배치 정리 — 모르는 위젯·중복은 버리고, 잘못된 폭은 6칸으로. 비어 있으면 기본 배치 */
export function normalizeLayout<Id extends string>(saved: unknown, known: readonly Id[], fallback: WidgetSlot<Id>[]): WidgetSlot<Id>[] {
  if (!Array.isArray(saved)) return fallback;
  const seen = new Set<string>();
  const out: WidgetSlot<Id>[] = [];
  for (const raw of saved) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = r.id;
    if (typeof id !== 'string' || !known.includes(id as Id) || seen.has(id)) continue;
    seen.add(id);
    const slot: WidgetSlot<Id> = { id: id as Id, size: isCount(r.size, 1, GRID_COLS) ? r.size : 6 };
    if (isCount(r.rows, 1, MAX_ROWS)) slot.rows = r.rows;
    if (isCount(r.x, 0, GRID_COLS - 1) && isCount(r.y, 0, 999)) { slot.x = r.x; slot.y = r.y; }
    out.push(slot);
  }
  return out.length ? out : fallback;
}

/** 모눈 위의 네모 — 왼쪽 위 칸(x, y)과 가로·세로 칸 수 */
export interface Box { x: number; y: number; w: number; h: number }
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 위에서부터, 왼쪽부터 훑어 w×h 가 들어가는 첫 빈자리 */
export function firstFit(boxes: Box[], w: number, h: number): { x: number; y: number } {
  const ww = Math.min(Math.max(1, w), GRID_COLS);
  for (let y = 0; ; y++) {
    for (let x = 0; x + ww <= GRID_COLS; x++) if (!boxes.some((b) => overlaps(b, { x, y, w: ww, h }))) return { x, y };
  }
}

export interface Placement { id: string; w: number; h: number; x?: number; y?: number }

/**
 * 자리 잡기 — 방금 옮기거나 키운 위젯(pinned)을 먼저 그 자리에 두고, 자리가 정해진 나머지는 위에서부터 놓되
 * 겹치면 겹친 위젯 바로 아래로 밀어 낸다. 자리가 없는 위젯은 첫 빈자리에.
 * 마지막에 왼쪽 위로 당겨 붙인다(compact) — 빈칸은 옆 위젯과 높이가 달라 생기는 곳에만 남는다.
 */
export function arrange(items: Placement[], pinned?: string | null): Map<string, Box> {
  const out = new Map<string, Box>();
  const placed: Box[] = [];
  const clamp = (it: Placement): Box => {
    const w = Math.min(Math.max(1, it.w), GRID_COLS);
    return { x: Math.min(Math.max(0, it.x ?? 0), GRID_COLS - w), y: Math.max(0, it.y ?? 0), w, h: Math.max(1, it.h) };
  };
  const put = (id: string, b: Box) => { out.set(id, b); placed.push(b); };
  const has = (it: Placement) => it.x !== undefined && it.y !== undefined;
  const pin = pinned ? items.find((it) => it.id === pinned && has(it)) : undefined;
  if (pin) put(pin.id, clamp(pin));
  const rest = items.filter((it) => it !== pin && has(it)).sort((a, b) => a.y! - b.y! || a.x! - b.x!);
  for (const it of rest) {
    const b = clamp(it);
    for (let hit = placed.find((p) => overlaps(p, b)); hit; hit = placed.find((p) => overlaps(p, b))) b.y = hit.y + hit.h;
    put(it.id, b);
  }
  for (const it of items) {
    if (out.has(it.id)) continue;
    const w = Math.min(Math.max(1, it.w), GRID_COLS);
    put(it.id, { ...firstFit(placed, w, it.h), w, h: Math.max(1, it.h) });
  }
  return compact(out);
}

/**
 * 왼쪽 위 정렬 — 위에서부터(같은 줄이면 왼쪽부터) 하나씩, 먼저 놓인 위젯에 닿을 때까지 위로, 다시 왼쪽으로 민다.
 * 위로 더 못 가는 까닭은 위 위젯뿐이라, 남는 빈칸은 높이가 다른 위젯 옆자리뿐이다.
 */
export function compact(boxes: Map<string, Box>): Map<string, Box> {
  const order = [...boxes.entries()].sort(([, a], [, b]) => a.y - b.y || a.x - b.x);
  const placed: Box[] = [];
  const out = new Map<string, Box>();
  const free = (b: Box) => !placed.some((p) => overlaps(p, b));
  for (const [id, box] of order) {
    const b = { ...box };
    // 왼쪽으로 민 앞 위젯과 겹치면 먼저 그 아래로
    for (let hit = placed.find((p) => overlaps(p, b)); hit; hit = placed.find((p) => overlaps(p, b))) b.y = hit.y + hit.h;
    for (let moved = true; moved; ) {
      moved = false;
      while (b.y > 0 && free({ ...b, y: b.y - 1 })) { b.y--; moved = true; }
      while (b.x > 0 && free({ ...b, x: b.x - 1 })) { b.x--; moved = true; }
    }
    placed.push(b);
    out.set(id, b);
  }
  return out;
}

/** 그 날이 속한 주(월~일) 날짜 7개 */
export function weekDates(date: string): string[] {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // 월요일까지 며칠 전
  return Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + (i - back) * 86_400_000).toISOString().slice(0, 10));
}

/** 지난 시간 — 방금, n분 전, n시간 전, n일 전 */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / (60 * 24))}일 전`;
}

/** 분 → 'n시간 m분' (0분은 생략) */
export function hoursText(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/**
 * 위젯 안의 링크(웹 주소)를 모바일 화면 주소로 — 모바일 경영 현황 탭에서 쓴다.
 * 결재 문서는 문서 화면으로, 게시글은 게시판의 그 글로, 모바일에 없는 화면은 그룹웨어 첫 화면으로.
 */
export function mobilePath(path: string): string {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  switch (pathname) {
    case '/gw/approval': {
      const doc = params.get('doc');
      return doc ? `/m/approval/${encodeURIComponent(doc)}` : '/m/approval';
    }
    case '/gw/board':
      return query ? `/m/board?${query}` : '/m/board';
    case '/gw/commute':
    case '/gw/leave':
      return '/m/commute';
    case '/gw/calendar':
      return '/m/calendar';
    case '/gw/work-plan':
      return '/m/task';
    case '/gw/resource':
      return '/m/resource';
    case '/gw/orgchart':
      return '/m/orgchart';
    default:
      return '/m';
  }
}
