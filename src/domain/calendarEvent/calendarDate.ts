export interface CalendarMonthCell {
  date: string;
  inCurrentMonth: boolean;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function dateKeyFromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isValidCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  return dateKeyFromUtc(date) === value;
}

export function isValidCalendarMonth(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function calendarToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function moveCalendarMonth(month: string, amount: number): string {
  if (!isValidCalendarMonth(month)) throw new Error('올바른 달력 월을 입력하세요.');
  const [year, monthNumber] = month.split('-').map(Number);
  const moved = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildCalendarMonth(month: string): CalendarMonthCell[] {
  if (!isValidCalendarMonth(month)) throw new Error('올바른 달력 월을 입력하세요.');
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = dateKeyFromUtc(date);
    return {
      date: dateKey,
      inCurrentMonth: dateKey.startsWith(`${month}-`),
    };
  });
}
