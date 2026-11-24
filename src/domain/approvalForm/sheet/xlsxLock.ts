/**
 * 엑셀로 채운 표 잠그기 — 엑셀을 올려 채운 표(반복 구간)의 칸은 화면에서 고치지 못하게 한다.
 *
 * 손으로 쓰는 것은 그대로 되고, 엑셀을 올린 뒤에만 잠긴다(고치려면 엑셀을 고쳐 다시 올리거나 [엑셀 내용 지우기]).
 * 엑셀 값이 들어온 칸만 잠근다 — 엑셀에 없어 빈 칸으로 남은 칸(예: 내역)은 계속 쓸 수 있다.
 * 잠긴 표는 줄을 더하거나 지울 수 없다(줄 자리가 그대로라 잠근 칸을 '구간 안 몇째 줄'로 기억한다 — 다른 표의 줄 수가 바뀌어도 맞는다).
 * 실수로 고치는 것을 막는 장치다 — 올리기 전에 엑셀을 고치면 고친 값이 들어온다
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, type SheetValues } from './approvalSheet';
import { fillable } from './draftExcel';
import { expandRepeats, extraRowCount, repeatSections, type RowExtras } from './repeatRows';
import { xlsxChanges } from './xlsxPreview';

/** 구간 id → 잠근 칸('구간 안 줄 차례(0부터):열') */
export type XlsxLock = Record<string, string[]>;

/** 문서 fieldValues 에 잠근 칸을 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const SHEET_XLSX_LOCK_KEY = '__xlsxLock';

/** fieldValues.__xlsxLock(JSON 글자) → 잠근 칸. 없거나 깨졌으면 빈 값 */
export function readXlsxLock(raw: unknown): XlsxLock {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    const out: XlsxLock = {};
    Object.entries(p).forEach(([id, cells]) => {
      if (Array.isArray(cells)) out[id] = cells.filter((x): x is string => typeof x === 'string');
    });
    return out;
  } catch {
    return {};
  }
}

export interface XlsxLockInput {
  /** 새 줄 수로 펼친 틀 */
  shape: Sheet;
  /** 엑셀 값을 얹기 전(화면 값)과 얹은 뒤 */
  base: SheetValues;
  values: SheetValues;
  skipNames?: readonly string[];
  /** 올리기 전의 잠금 — 이번에 엑셀이 건드리지 않은 표는 그대로 둔다 */
  prev?: XlsxLock;
}

/** 엑셀을 올린 뒤의 잠금 — 엑셀이 값을 바꾼 표마다, 값이 든 칸(틀에 미리 쓴 글자만 있는 칸은 빈 칸)을 잠근다 */
export function xlsxLockAfterUpload({ shape, base, values, skipNames = [], prev = {} }: XlsxLockInput): XlsxLock {
  const changes = xlsxChanges({ shape, base, values, skipNames });
  const now = applyValues(shape, values, { recalc: false });
  const next: XlsxLock = { ...prev };
  repeatSections(shape).forEach((sec) => {
    if (!changes.some((ch) => ch.r >= sec.first && ch.r <= sec.last)) return;
    const cells: string[] = [];
    for (let r = sec.first; r <= sec.last; r++) {
      shape.cols.forEach((col, c) => {
        if (!fillable(shape, r, c, skipNames)) return;
        const text = String(now.rows[r]?.[col] ?? '').trim();
        if (text && text !== String(shape.rows[r]?.[col] ?? '').trim()) cells.push(`${r - sec.first}:${col}`);
      });
    }
    if (cells.length) next[sec.id] = cells;
    else delete next[sec.id];
  });
  return next;
}

/** 화면에서 고칠 수 없는 칸('행:열 순번') — 펼친 시트 기준 */
export function xlsxLockedCells(sheet: Sheet, lock: XlsxLock): Set<string> {
  const out = new Set<string>();
  repeatSections(sheet).forEach((sec) => {
    (lock[sec.id] ?? []).forEach((cell) => {
      const i = cell.indexOf(':');
      const r = sec.first + Number(cell.slice(0, i));
      const c = sheet.cols.indexOf(cell.slice(i + 1));
      if (r <= sec.last && c >= 0) out.add(`${r}:${c}`);
    });
  });
  return out;
}

/**
 * 값이 빈 칸은 잠금에서 뺀다 — 잠근 칸이 다른 이유(행 보이기 조건으로 숨음·종속 선택의 기준 칸이 바뀜)로 비면
 * '비어 있는데 쓸 수 없는 칸'이 되므로 다시 쓸 수 있게 한다. 문서에 남기기 직전의 시트로 부른다
 */
export function dropEmptyXlsxLock(sheet: Sheet, lock: XlsxLock): XlsxLock {
  const out: XlsxLock = {};
  repeatSections(sheet).forEach((sec) => {
    const cells = (lock[sec.id] ?? []).filter((cell) => {
      const i = cell.indexOf(':');
      const r = sec.first + Number(cell.slice(0, i));
      return r <= sec.last && String(sheet.rows[r]?.[cell.slice(i + 1)] ?? '').trim() !== '';
    });
    if (cells.length) out[sec.id] = cells;
  });
  return out;
}

/**
 * [엑셀 내용 지우기] — 표를 비우고 잠금을 푼다. 엑셀로 늘거나 줄어든 줄은 서식의 줄 수로 되돌리고,
 * 남은 줄의 입력 칸은 처음 모양(틀에 미리 쓴 글자)으로. 사람 칸 ID(refs)도 같이 지운다
 */
export function clearXlsxSection(
  template: Sheet,
  extras: RowExtras,
  values: SheetValues,
  refs: SheetValues,
  lock: XlsxLock,
  id: string
): { extras: RowExtras; values: SheetValues; refs: SheetValues; lock: XlsxLock } {
  const restLock = { ...lock };
  delete restLock[id];
  const shape = expandRepeats(template, extras);
  const sec = repeatSections(shape).find((x) => x.id === id);
  const drawn = repeatSections(template).find((x) => x.id === id);
  if (!sec || !drawn) return { extras, values, refs, lock: restLock };
  // 서식 줄 수보다 늘어난(음수면 줄어든) 줄 수 — 펼칠 때와 같은 규칙으로
  const cut = extraRowCount(extras, drawn);
  const keepLast = sec.last - Math.max(0, cut);
  const inputCols = (r: number) => new Set(shape.cols.filter((col) => shape.cellMeta[APPROVAL_NS.input]?.[cellKey(r, col)] !== undefined));
  const move = (map: SheetValues): SheetValues => {
    const out: SheetValues = {};
    Object.entries(map).forEach(([key, v]) => {
      const i = key.indexOf(':');
      const r = Number(key.slice(0, i));
      const col = key.slice(i + 1);
      // 되돌리는 줄은 버리고, 표 아래 줄은 그만큼 올린다(줄어든 표였으면 내린다)
      if (r > keepLast && r <= sec.last) return;
      if (r >= sec.first && r <= keepLast && inputCols(r).has(col)) return;
      out[cellKey(r > sec.last ? r - cut : r, col)] = v;
    });
    return out;
  };
  const nextExtras = { ...extras };
  delete nextExtras[id];
  return { extras: nextExtras, values: move(values), refs: move(refs), lock: restLock };
}
