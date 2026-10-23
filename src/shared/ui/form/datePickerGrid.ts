/** 날짜 선택 달력 — 한 달 칸 계산·날짜 색 구분 (화면과 무관한 순수 함수) */

export interface DayCell {
  date: string; // YYYY-MM-DD
  day: number;
  weekday: number; // 0=일 … 6=토
  inMonth: boolean;
}

export type DayTone = 'holiday' | 'sun' | 'sat' | 'normal';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** month 는 1~12. 일요일부터 6주(42칸) — 앞뒤 달 날짜로 채움 */
export function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: toDateStr(d), day: d.getDate(), weekday: d.getDay(), inMonth: d.getMonth() === month - 1 };
  });
}

/** 공휴일·일요일 = 빨강, 토요일 = 파랑 (공휴일이 우선) */
export function dayTone(date: string, weekday: number, holidays: ReadonlyMap<string, string>): DayTone {
  if (holidays.has(date)) return 'holiday';
  if (weekday === 0) return 'sun';
  if (weekday === 6) return 'sat';
  return 'normal';
}

export function isDateSelectable(date: string, min?: string, max?: string): boolean {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
