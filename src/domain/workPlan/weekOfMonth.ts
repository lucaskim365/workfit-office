import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';

/**
 * 'YYYY-MM-DD' → 그 달 몇 주차 — 업무계획 월간표와 같은 기준(월요일 시작, 1일이 든 주가 1주차)
 */
export function weekOfMonth(date: string): { month: number; week: number } | null {
  if (!isValidCalendarDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const firstOffset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 월=0 … 일=6
  return { month: m, week: Math.floor((d - 1 + firstOffset) / 7) + 1 };
}
