import { z } from 'zod';

/**
 * 식권 대장 — 날짜별 한 건(mealTickets). 순수 함수만 둔다.
 *
 * 식권은 몇백 장씩 한 번에 받아 두고(입고), 그날 받은 사람 수만큼 줄어든다. 중식·석식은 같은 식권이라
 * 발행 = 중식 받은 사람 + 석식 받은 사람이고, 남은 식권도 하나로 센다.
 * 발행 수(= 받은 사람 수)와 남은 수는 저장하지 않고 매번 계산한다 — 저장하면 손으로 고칠 때 어긋난다.
 * 요일도 날짜에서 계산한다.
 */
export const mealTicketDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 그날 들어온 식권 수. 보통 0 */
  stockIn: z.number().int().nullish().transform((v) => v ?? 0),
  /** 그날 중식 식권을 받은 사람(users.id) */
  recipients: z.array(z.string()).nullish().transform((v) => v ?? []),
  /** 그날 석식 식권을 받은 사람(users.id) */
  dinnerRecipients: z.array(z.string()).nullish().transform((v) => v ?? []),
  memo: z.string().nullish(),
  updatedBy: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export type MealTicketDay = z.infer<typeof mealTicketDaySchema>;

export const mealTicketId = (date: string) => `MT-${date}`;

/** 끼니 — 중식(recipients)·석식(dinnerRecipients) */
export type Meal = 'lunch' | 'dinner';
export const MEAL_LABEL: Record<Meal, string> = { lunch: '중식', dinner: '석식' };

/** 그날 그 끼니에 받은 사람 */
export const recipientsOf = (d: MealTicketDay | undefined, meal: Meal): string[] =>
  (meal === 'lunch' ? d?.recipients : d?.dinnerRecipients) ?? [];

/** 그 끼니의 받은 사람 목록을 바꾼 날 */
export const withRecipients = (d: MealTicketDay, meal: Meal, ids: string[]): MealTicketDay =>
  meal === 'lunch' ? { ...d, recipients: ids } : { ...d, dinnerRecipients: ids };

/** 엑셀·PDF 칸 표시 — 중식 O, 석식 석, 둘 다 O석 */
export const mealMark = (d: MealTicketDay | undefined, userId: string): string =>
  `${recipientsOf(d, 'lunch').includes(userId) ? 'O' : ''}${recipientsOf(d, 'dinner').includes(userId) ? '석' : ''}`;

/** 그날 그 사람이 받은 식권 수(0~2) */
export const ticketsOf = (d: MealTicketDay | undefined, userId: string): number =>
  (recipientsOf(d, 'lunch').includes(userId) ? 1 : 0) + (recipientsOf(d, 'dinner').includes(userId) ? 1 : 0);

/** 받은 사람 목록에 여러 명을 넣거나 뺀다. 이미 있으면 다시 넣지 않고, 순서는 유지한다. */
export function applyRecipients(recipients: string[], userIds: string[], received: boolean): string[] {
  if (!received) {
    const ids = new Set(userIds);
    return recipients.filter((id) => !ids.has(id));
  }
  return [...recipients, ...userIds.filter((id, i) => !recipients.includes(id) && userIds.indexOf(id) === i)];
}

/**
 * 표에서 두 칸 사이 사각형 범위(사람 × 날짜) — Shift+클릭용.
 * 날짜별로 묶어 돌려준다(저장도 날짜당 한 번).
 */
export function rangeCells(
  people: string[],
  dates: string[],
  from: { userId: string; date: string },
  to: { userId: string; date: string },
): Map<string, string[]> {
  const [r1, r2] = [people.indexOf(from.userId), people.indexOf(to.userId)].sort((a, b) => a - b);
  const [c1, c2] = [dates.indexOf(from.date), dates.indexOf(to.date)].sort((a, b) => a - b);
  const out = new Map<string, string[]>();
  if (r1 < 0 || c1 < 0) return out;
  for (const date of dates.slice(c1, c2 + 1)) out.set(date, people.slice(r1, r2 + 1));
  return out;
}

export const emptyMealTicketDay = (date: string): MealTicketDay => ({ date, stockIn: 0, recipients: [], dinnerRecipients: [], memo: null, updatedBy: null, updatedAt: null });

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 0=일 … 6=토. 브라우저 시간대와 무관하게 날짜 문자열만 본다. */
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** '10/27(월)' */
export const dayLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}(${WEEKDAYS[weekdayOf(date)]})`;

/** 'YYYY-MM' 의 모든 날짜. */
export function monthDates(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

/** 'YYYY-MM' 에 n달을 더한다. */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface MealTicketDaySummary {
  date: string;
  stockIn: number;
  /** 발행 = 받은 사람 수(중식 + 석식) */
  issued: number;
  /** 그중 석식 */
  dinner: number;
  /** 그날 끝의 남은 식권 */
  remaining: number;
}

/**
 * 한 달 날짜별 입고·발행·남은 수. 남은 수는 첫 기록부터 이어서 센다(달이 바뀌어도 이월).
 * days 에는 그 달 이전 기록도 모두 넘겨야 한다.
 */
export function summarizeMonth(days: MealTicketDay[], dates: string[]): { opening: number; rows: MealTicketDaySummary[] } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = dates[0] ?? '';
  let balance = 0;
  for (const d of days) if (d.date < first) balance += d.stockIn - d.recipients.length - d.dinnerRecipients.length;
  const opening = balance;
  const rows = dates.map((date) => {
    const d = byDate.get(date);
    const stockIn = d?.stockIn ?? 0;
    const dinner = d?.dinnerRecipients.length ?? 0;
    const issued = (d?.recipients.length ?? 0) + dinner;
    balance += stockIn - issued;
    return { date, stockIn, issued, dinner, remaining: balance };
  });
  return { opening, rows };
}

/** 날짜 칸에 적을 남은 수 — 입고·발행이 있던 날만(화면·엑셀 공통). */
export const remainingCell = (r: MealTicketDaySummary): number | '' => (r.stockIn || r.issued ? r.remaining : '');

/** 합계 칸의 남은 수 — 오늘 기준(지난달은 말일, 다음 달은 이월분). */
export const remainingAsOf = (opening: number, rows: MealTicketDaySummary[], today: string): number =>
  rows.filter((r) => r.date <= today).at(-1)?.remaining ?? opening;

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * 한 달 대장을 CSV 로 — 엑셀에서 바로 열린다(UTF-8 BOM). 받은 칸은 중식 O, 석식 석, 둘 다 O석(mealMark).
 * people 순서대로 행을 만들고(합계 = 받은 식권 수), 아래에 입고·발행·그중 석식·남은 식권·메모 행을 붙인다.
 */
export function monthCsv(
  days: MealTicketDay[],
  dates: string[],
  people: { id: string; name: string; dept?: string }[],
  today: string,
): string {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const { opening, rows } = summarizeMonth(days, dates);
  const lines: (string | number)[][] = [];
  lines.push(['이름', '부서', ...dates.map(dayLabel), '합계']);
  for (const p of people) {
    const marks = dates.map((date) => mealMark(byDate.get(date), p.id));
    lines.push([p.name, p.dept ?? '', ...marks, dates.reduce((a, date) => a + ticketsOf(byDate.get(date), p.id), 0)]);
  }
  lines.push(['입고', `전월 이월 ${opening}`, ...rows.map((r) => r.stockIn || ''), rows.reduce((a, r) => a + r.stockIn, 0)]);
  lines.push(['발행', '', ...rows.map((r) => r.issued || ''), rows.reduce((a, r) => a + r.issued, 0)]);
  lines.push(['그중 석식', '', ...rows.map((r) => r.dinner || ''), rows.reduce((a, r) => a + r.dinner, 0)]);
  lines.push(['남은 식권', '', ...rows.map(remainingCell), remainingAsOf(opening, rows, today)]);
  if (dates.some((date) => byDate.get(date)?.memo)) {
    lines.push(['메모', '', ...dates.map((date) => byDate.get(date)?.memo ?? ''), '']);
  }
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
}
