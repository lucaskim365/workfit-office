/**
 * 엑셀 올리기 미리보기 — 올린 값을 얹으면 어느 칸이 어떻게 바뀌는지, 그리고 기안자가 뺀 칸을 되돌린 값.
 *
 * 올리기 계산(draftExcel.ts·listExcel.ts)은 그대로 두고 그 결과만 읽는다:
 *   base(엑셀 값을 얹기 전, 새 줄 번호로 옮긴 화면 값)와 values(얹은 뒤)를 칸마다 견준다.
 * 줄 수가 바뀌는 것(표의 줄 늘림·줄임)은 칸별로 고를 수 없다 — 뺀 칸은 '그 자리의 화면 값'으로 남는다.
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { applyValues, type SheetValues } from './approvalSheet';
import { fillable } from './draftExcel';

/** add: 빈 칸에 새로 들어감 / change: 있던 값이 바뀜 / clear: 있던 값이 지워짐 */
export type XlsxChangeKind = 'add' | 'change' | 'clear';

export interface XlsxCellChange {
  key: string;
  r: number;
  c: number;
  kind: XlsxChangeKind;
  /** 화면에 있던 글자·들어갈 글자 */
  before: string;
  after: string;
}

export interface XlsxChangesInput {
  /** 새 줄 수로 펼친 틀 */
  shape: Sheet;
  base: SheetValues;
  values: SheetValues;
  skipNames?: readonly string[];
}

/** 바뀌는 칸 — 위에서 아래, 왼쪽에서 오른쪽 차례 */
export function xlsxChanges({ shape, base, values, skipNames = [] }: XlsxChangesInput): XlsxCellChange[] {
  const was = applyValues(shape, base, { recalc: false });
  const now = applyValues(shape, values, { recalc: false });
  const out: XlsxCellChange[] = [];
  for (let r = 0; r < shape.rows.length; r++) {
    shape.cols.forEach((col, c) => {
      if (!fillable(shape, r, c, skipNames)) return;
      const before = String(was.rows[r]?.[col] ?? '').trim();
      const after = String(now.rows[r]?.[col] ?? '').trim();
      if (before === after) return;
      // 틀에 미리 써 둔 글자('2026.' 등)만 있던 칸에 값이 들어가면 '채움' — 그 글자가 지워지는 것은 '지워짐'(보이는 것이 없어지므로)
      const preset = String(shape.rows[r]?.[col] ?? '').trim();
      const untouched = before === '' || before === preset;
      out.push({ key: cellKey(r, col), r, c, kind: after === '' ? 'clear' : untouched ? 'add' : 'change', before, after });
    });
  }
  return out;
}

export interface XlsxPickInput {
  base: SheetValues;
  baseRefs: SheetValues;
  values: SheetValues;
  refs: SheetValues;
  /** 적용하지 않을 칸(값 키) */
  excluded: ReadonlySet<string>;
}

/** 뺀 칸을 화면 값(사람 칸은 ID 까지)으로 되돌린 값 */
export function pickXlsxValues({ base, baseRefs, values, refs, excluded }: XlsxPickInput): { values: SheetValues; refs: SheetValues } {
  if (excluded.size === 0) return { values, refs };
  const back = (from: SheetValues, to: SheetValues) => {
    const out = { ...to };
    excluded.forEach((key) => {
      if (from[key] === undefined) delete out[key];
      else out[key] = from[key];
    });
    return out;
  };
  return { values: back(base, values), refs: back(baseRefs, refs) };
}
