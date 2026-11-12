/**
 * 첨부·관련 문서(첨부파일·수신처·관련 문서) 자리 — 서식 편집자가 두지 않는다. 그릴 때 저절로 맺음말 바로 위에(기존 문서와 같은 순서).
 * - 맺음말: 기안일 칸 줄 바로 아래가 기안자 서명 칸 줄인 곳. 그 위의 맺음말 문구 줄·빈 줄까지 맺음말로 본다
 * - 맺음말이 없으면(공문처럼 맺음말을 끈 서식, 거래처용 모양) 시트 아래에
 * - 서식 시트에는 아무것도 저장하지 않는다. 문서 보기는 그릴 시트에 자리 줄(bind 'doc.extras')을 끼워 넣고(withExtrasRow),
 *   기안 화면은 값이 줄 번호에 묶여 있어 줄을 끼우지 않고 그 자리 앞에 띠를 그린다(extrasAnchorRow)
 * - 예전에 자리 부품으로 저장한 줄(bind 'doc.extras')이 있으면 그 줄을 자리로 쓴다(개발 중 자동 초안)
 */
import { insertRow, mergeRange, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, setApprovalProp, slotRows } from './approvalSheet';
import { repeatSectionAt } from './repeatRows';

export const EXTRAS_BIND = 'doc.extras';

/** 저장된 자리 칸 — 위에서 아래, 왼쪽에서 오른쪽 순서 */
function extrasCells(s: Sheet): Array<{ r: number; c: number }> {
  return Object.entries(s.cellMeta[APPROVAL_NS.bind] ?? {})
    .filter(([, v]) => v === EXTRAS_BIND)
    .map(([k]) => ({ r: Number(k.slice(0, k.indexOf(':'))), c: s.cols.indexOf(k.slice(k.indexOf(':') + 1)) }))
    .filter((x) => x.c >= 0 && x.r >= 0 && x.r < s.rows.length)
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

/** 그릴 자리(첫 자리) — 없으면 null */
export function extrasCell(s: Sheet): { r: number; c: number } | null {
  return extrasCells(s)[0] ?? null;
}

/** 시트에 자리 줄이 있나 — 없으면 그리는 쪽이 시트 아래에 붙인다 */
export const hasExtrasPlace = (s: Sheet) => extrasCells(s).length > 0;

/** 숨길 자리 줄 — 보일 것이 없으면 모든 자리 줄, 있으면 첫 자리 줄 말고 나머지(옛 데이터의 겹친 자리) */
export function extrasHiddenRows(s: Sheet, shown: boolean): Set<number> {
  const rows = new Set(slotRows(s, 'extras'));
  const first = extrasCell(s);
  if (shown && first) rows.delete(first.r);
  return rows;
}

/** 이 칸이 그릴 자리인가 */
export function isExtrasDrawCell(s: Sheet, r: number, c: number): boolean {
  const first = extrasCell(s);
  return !!first && first.r === r && first.c === c;
}

const bindRows = (s: Sheet, bind: string) =>
  new Set(
    Object.entries(s.cellMeta[APPROVAL_NS.bind] ?? {})
      .filter(([, v]) => v === bind)
      .map(([k]) => Number(k.slice(0, k.indexOf(':')))),
  );

/** 줄에 부품(입력 칸·자동 채우기·직인·자동번호)이나 수식이 없나 */
function plainRow(s: Sheet, r: number): boolean {
  return s.cols.every((col, c) => {
    const p = approvalCellProps(s, r, c);
    return !p.input && !p.bind && !p.seal && !p.autoNo && s.formulas[`${r}:${col}`] === undefined;
  });
}
const rowText = (s: Sheet, r: number) => s.cols.map((col) => String(s.rows[r]?.[col] ?? '').trim()).join('');

/** 맺음말 첫 줄 — 기안일 줄 바로 아래가 기안자 서명 줄이면 맺음말, 그 위 문구 줄·빈 줄까지. 없으면 null */
export function closingStartRow(s: Sheet): number | null {
  const signs = bindRows(s, 'draft.sign');
  const date = [...bindRows(s, 'draft.date')].sort((a, b) => a - b).find((r) => signs.has(r + 1));
  if (date === undefined) return null;
  let start = date;
  if (start > 0 && plainRow(s, start - 1) && rowText(s, start - 1)) start--;
  if (start > 0 && plainRow(s, start - 1) && !rowText(s, start - 1)) start--;
  return repeatSectionAt(s, start) ? null : start;
}

/** 자리를 그릴 줄 — 저장된 자리 줄, 없으면 맺음말 첫 줄(그 앞에 그림). 없으면 null(시트 아래에) */
export function extrasAnchorRow(s: Sheet): number | null {
  return extrasCell(s)?.r ?? closingStartRow(s);
}

/** 그릴 시트에 자리 줄을 끼운다(맺음말 바로 위, 한 줄 합침) — 이미 있거나 맺음말이 없으면 그대로 */
export function withExtrasRow(s: Sheet): Sheet {
  if (hasExtrasPlace(s) || !s.cols.length) return s;
  const at = closingStartRow(s);
  if (at === null) return s;
  let out = insertRow(s, at);
  if (out.cols.length > 1) out = mergeRange(out, { r1: at, r2: at, c1: 0, c2: out.cols.length - 1 });
  return setApprovalProp(out, { r1: at, r2: at, c1: 0, c2: 0 }, APPROVAL_NS.bind, EXTRAS_BIND);
}
