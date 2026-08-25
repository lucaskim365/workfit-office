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
    case '금액':
      return v ? `₩${Number(v).toLocaleString()}` : '—';
    case '기간': {
      const start = (v as string) ?? '';
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      const days = (values[field.key + DAYS_SUFFIX] as number) ?? (start && end ? daysBetween(start, end) : 0);
      return start && end ? `${start} ~ ${end} (${days}일)` : '—';
    }
    case '체크':
      return v === true ? '예' : '아니오';
    case '사용자':
      return org?.users.find((u) => u.id === v)?.name ?? (v ? String(v) : '—');
    default:
      return v === '' || v == null ? '—' : String(v);
  }
}

export function missingRequired(fields: FormField[], values: Record<string, FieldValue>): string[] {
  return fields
    .filter((f) => f.required && f.type !== '안내문')
    .filter((f) => {
      if (f.visibleIf) {
        const parts = f.visibleIf.split(':');
        if (parts.length === 2) {
          const [condKey, condVal] = parts;
          if (String(values[condKey] ?? '') !== condVal) {
            return false;
          }
        }
      }
      const v = values[f.key];
      if (f.type === '기간') return !(v && values[f.key + END_SUFFIX]);
      if (f.type === '체크') return v !== true;
      return v === '' || v == null;
    })
    .map((f) => f.label);
}
