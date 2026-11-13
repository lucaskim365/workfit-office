/**
 * 매입 결제 목록의 열 필터 — 엑셀 열 필터처럼 열마다 건다.
 * 값 필터(고른 값 중 하나와 같은 줄만)와 날짜 필터(기간, 또는 비어 있음·입력됨) 두 가지.
 */
import { EXPENSE_LABEL, EXPENSE_STATUSES, PAY_TERMS, type ExpenseStatus, type PurchasePayment } from './purchaseMock';

export type SetFilterKey = 'client' | 'bizType' | 'vendor' | 'term' | 'salesVat' | 'expense';
export type DateFilterKey = 'planTax' | 'planPay' | 'build' | 'tax' | 'pay';
export type FilterKey = SetFilterKey | DateFilterKey;

/** any: 따지지 않음, empty: 아직 안 넣은 줄만, filled: 넣은 줄만 */
export type DateState = 'any' | 'empty' | 'filled';
export interface DateFilter {
  from: string;
  to: string;
  state: DateState;
}
export const NO_DATE_FILTER: DateFilter = { from: '', to: '', state: 'any' };

export interface ColumnFilters {
  /** 값 필터 — 빈 배열이면 걸지 않음 */
  sets: Record<SetFilterKey, string[]>;
  dates: Record<DateFilterKey, DateFilter>;
}
export const NO_FILTERS: ColumnFilters = {
  sets: { client: [], bizType: [], vendor: [], term: [], salesVat: [], expense: [] },
  dates: { planTax: NO_DATE_FILTER, planPay: NO_DATE_FILTER, build: NO_DATE_FILTER, tax: NO_DATE_FILTER, pay: NO_DATE_FILTER },
};

interface SetFilterDef {
  label: string;
  valueOf: (r: PurchasePayment) => string;
  /** 화면에 보일 이름(값과 다를 때) */
  labelOf?: (value: string) => string;
  /** 고르기 순서 — 없으면 가나다순 */
  order?: readonly string[];
}
export const SET_FILTERS: Record<SetFilterKey, SetFilterDef> = {
  client: { label: '도입기업', valueOf: (r) => r.client },
  bizType: { label: '사업구분', valueOf: (r) => r.bizType },
  vendor: { label: '발주처', valueOf: (r) => r.vendor },
  term: { label: '지급 조건', valueOf: (r) => r.term, order: PAY_TERMS },
  salesVat: { label: '매출 부가세 수금', valueOf: (r) => (r.salesVatCollected ? 'O' : 'X'), order: ['O', 'X'] },
  expense: { label: '지출결의서', valueOf: (r) => r.expense, labelOf: (v) => EXPENSE_LABEL[v as ExpenseStatus] ?? v, order: EXPENSE_STATUSES },
};

interface DateFilterDef {
  label: string;
  /** 줄의 날짜 — 하루면 [날짜, 날짜], 기간이면 [시작, 종료]. 아직 안 넣었으면 빈 글자 */
  rangeOf: (r: PurchasePayment) => [string, string];
  /** 비어 있을 수 있는 날짜인가(발주서에서 오는 예정일은 늘 있다) */
  canBeEmpty: boolean;
}
export const DATE_FILTERS: Record<DateFilterKey, DateFilterDef> = {
  planTax: { label: '(예정) 계산서 발행일', rangeOf: (r) => [r.planTaxDate, r.planTaxDate], canBeEmpty: false },
  planPay: { label: '(예정) 결제일', rangeOf: (r) => [r.planPayDate, r.planPayDate], canBeEmpty: false },
  build: { label: '구축일', rangeOf: (r) => [r.buildFrom, r.buildTo], canBeEmpty: true },
  tax: { label: '(확정) 계산서 발행일', rangeOf: (r) => [r.taxDate, r.taxDate], canBeEmpty: true },
  pay: { label: '(확정) 결제일', rangeOf: (r) => [r.payDate, r.payDate], canBeEmpty: true },
};

const isSetKey = (key: FilterKey): key is SetFilterKey => key in SET_FILTERS;

/** 값 필터에서 고를 수 있는 값 — 목록에 실제로 있는 값만 */
export function setFilterOptions(rows: PurchasePayment[], key: SetFilterKey): { value: string; label: string }[] {
  const def = SET_FILTERS[key];
  const values = [...new Set(rows.map(def.valueOf))];
  const rank = (v: string) => def.order?.indexOf(v) ?? -1;
  values.sort((a, b) => (def.order ? rank(a) - rank(b) : a.localeCompare(b, 'ko')));
  return values.map((value) => ({ value, label: def.labelOf?.(value) ?? value }));
}

export const isDateFilterOn = (f: DateFilter) => f.state !== 'any' || !!f.from || !!f.to;

/** 그 열에 필터가 걸려 있는가 */
export function isFilterOn(filters: ColumnFilters, key: FilterKey): boolean {
  return isSetKey(key) ? filters.sets[key].length > 0 : isDateFilterOn(filters.dates[key]);
}

function matchDate(f: DateFilter, [start, end]: [string, string]): boolean {
  const empty = !start || !end;
  if (f.state === 'empty') return empty;
  if (f.state === 'filled' && empty) return false;
  if (!f.from && !f.to) return true;
  // 기간을 정했으면 날짜가 있는 줄만 — 줄의 기간이 고른 기간과 하루라도 겹치면 맞음
  return !empty && (!f.from || end >= f.from) && (!f.to || start <= f.to);
}

/** 줄이 모든 열 필터에 맞는가 */
export function matchFilters(r: PurchasePayment, filters: ColumnFilters): boolean {
  for (const key of Object.keys(SET_FILTERS) as SetFilterKey[]) {
    const picked = filters.sets[key];
    if (picked.length && !picked.includes(SET_FILTERS[key].valueOf(r))) return false;
  }
  for (const key of Object.keys(DATE_FILTERS) as DateFilterKey[]) {
    if (!matchDate(filters.dates[key], DATE_FILTERS[key].rangeOf(r))) return false;
  }
  return true;
}

function dateFilterText(f: DateFilter): string {
  if (f.state === 'empty') return '비어 있음';
  if (f.from || f.to) return `${f.from || '처음'} ~ ${f.to || '끝'}`;
  return '입력됨';
}

/** 걸려 있는 필터 — 표 위 꼬리표('발주처: 푸른자동화')로 보인다 */
export function activeFilters(filters: ColumnFilters): { key: FilterKey; text: string }[] {
  const out: { key: FilterKey; text: string }[] = [];
  for (const key of Object.keys(SET_FILTERS) as SetFilterKey[]) {
    const picked = filters.sets[key];
    if (!picked.length) continue;
    const def = SET_FILTERS[key];
    const names = picked.map((v) => def.labelOf?.(v) ?? v);
    out.push({ key, text: `${def.label}: ${names.length > 2 ? `${names[0]} 외 ${names.length - 1}` : names.join(', ')}` });
  }
  for (const key of Object.keys(DATE_FILTERS) as DateFilterKey[]) {
    const f = filters.dates[key];
    if (isDateFilterOn(f)) out.push({ key, text: `${DATE_FILTERS[key].label}: ${dateFilterText(f)}` });
  }
  return out;
}

export function withSetFilter(filters: ColumnFilters, key: SetFilterKey, values: string[]): ColumnFilters {
  return { ...filters, sets: { ...filters.sets, [key]: values } };
}

export function withDateFilter(filters: ColumnFilters, key: DateFilterKey, value: DateFilter): ColumnFilters {
  return { ...filters, dates: { ...filters.dates, [key]: value } };
}

/** 한 열의 필터를 푼다 */
export function clearFilter(filters: ColumnFilters, key: FilterKey): ColumnFilters {
  return isSetKey(key) ? withSetFilter(filters, key, []) : withDateFilter(filters, key, NO_DATE_FILTER);
}
