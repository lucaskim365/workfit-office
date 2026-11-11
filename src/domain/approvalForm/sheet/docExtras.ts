/**
 * 첨부·관련 문서 자리(bind 'doc.extras') — 시트 안 한 줄 칸에 첨부파일·수신처·관련 문서를 그린다(기존 문서처럼 본문과 맺음말 사이).
 * 규칙: 서식에 하나, 한 줄(고른 칸을 합침), 반복 구간 밖(줄이 늘면 블록도 늘어나므로).
 * 그리는 쪽(기안·문서 보기·엑셀)은 같은 규칙으로 줄을 숨긴다 — 보일 것이 없으면 자리 줄째, 옛 데이터에 자리가 여럿이면 첫 자리만.
 */
import { mergeRange, type CellRange, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, setApprovalProp, slotRows } from './approvalSheet';
import { repeatSectionAt } from './repeatRows';

export const EXTRAS_BIND = 'doc.extras';

/** 자리 칸 — 위에서 아래, 왼쪽에서 오른쪽 순서 */
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

/** 시트에 자리가 있나 — 없으면 그리는 쪽이 시트 아래에 붙인다 */
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

/** 자리를 넣는다 — 고른 한 줄을 합쳐 그 첫 칸에. 못 넣으면 이유 */
export function placeExtras(s: Sheet, g: CellRange): Sheet | { notice: string } {
  const r = Math.min(g.r1, g.r2);
  const c1 = Math.min(g.c1, g.c2);
  const c2 = Math.max(g.c1, g.c2);
  if (r !== Math.max(g.r1, g.r2)) return { notice: '첨부·관련 문서 자리는 한 줄만 고르세요.' };
  if (hasExtrasPlace(s)) return { notice: '첨부·관련 문서 자리는 서식에 하나만 둘 수 있습니다 — 있던 자리를 지운 뒤 넣으세요.' };
  if (repeatSectionAt(s, r)) return { notice: '반복 구간 안에는 첨부·관련 문서 자리를 둘 수 없습니다(줄이 늘면 함께 늘어남).' };
  for (let c = c1; c <= c2; c++) if (s.formulas[`${r}:${s.cols[c]}`] !== undefined) return { notice: '수식 칸에는 넣을 수 없습니다.' };
  const at = { r1: r, r2: r, c1, c2: c1 };
  const merged = c2 > c1 ? mergeRange(s, { r1: r, r2: r, c1, c2 }) : s;
  return setApprovalProp(setApprovalProp(merged, at, APPROVAL_NS.input, undefined), at, APPROVAL_NS.bind, EXTRAS_BIND);
}
