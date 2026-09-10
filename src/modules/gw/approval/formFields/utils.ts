import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import type { User } from '@/domain/user/schema';
import type { Department } from '@/domain/department/schema';

export const END_SUFFIX = '__end';
export const DAYS_SUFFIX = '__days';

export interface OrgLite {
  users: User[];
  depts: Department[];
}

export interface CellMerge {
  startRow: number;
  startCol: number;
  rowSpan: number;
  colSpan: number;
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

/** 주말(토/일)을 제외한 평일(영업일) 일수 계산 */
export function businessDaysBetween(start: string, end: string): number {
  const s = new Date(start.slice(0, 10) + 'T00:00:00');
  const e = new Date(end.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function getCellMergeInfo(rIdx: number, cIdx: number, merges: CellMerge[]) {
  const mergeInfo = (merges || []).find((m) => {
    const rMatch = rIdx >= m.startRow && rIdx < m.startRow + m.rowSpan;
    const cMatch = cIdx >= m.startCol && cIdx < m.startCol + m.colSpan;
    return rMatch && cMatch;
  });

  if (!mergeInfo) {
    return { isMerged: false, isStart: false, rowSpan: 1, colSpan: 1 };
  }

  const isStart = mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx;
  return {
    isMerged: true,
    isStart,
    rowSpan: isStart ? mergeInfo.rowSpan : 0,
    colSpan: isStart ? mergeInfo.colSpan : 0,
    mergeInfo,
  };
}

export function fieldText(field: FormField, values: Record<string, FieldValue>, org?: OrgLite): string {
  const v = values[field.key];
  switch (field.type) {
    case '표':
      return '(표 형식 데이터)';
    case '금액': {
      if (v == null || v === '') return '—';
      const clean = String(v).replace(/[^0-9.-]/g, '');
      const num = Number(clean);
      return !isNaN(num) ? `₩${num.toLocaleString()}` : '—';
    }
    case '기간': {
      const start = (v as string) ?? '';
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      const days = (values[field.key + DAYS_SUFFIX] as number) ?? (start && end ? daysBetween(start, end) : 0);
      const startTime = values['startTime'] as string | undefined;
      const endTime = values['endTime'] as string | undefined;
      const isPartDay = days > 0 && days < 1;
      const timeInfo = isPartDay && startTime && endTime ? `, ${startTime}~${endTime}` : '';
      return start && end ? `${start} ~ ${end} (${days}일${timeInfo})` : '—';
    }
    case '체크':
      return v === true ? '예' : '아니오';
    case '사용자':
      return org?.users.find((u) => u.id === v)?.name ?? (v ? String(v) : '—');
    default:
      return v === '' || v == null ? '—' : String(v);
  }
}

