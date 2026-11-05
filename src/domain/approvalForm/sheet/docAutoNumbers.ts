/**
 * 상신 때 번호를 받을 자동번호 칸 — 이 문서 기준(서식 틀이 아니라 문서가 펼친 모양).
 * - 반복 구간에 기안자가 줄을 더했으면 그 아래 칸은 줄 수만큼 아래로 밀린 자리(문서 칸 값 키)에 번호를 넣는다
 * - 행 보이기 조건으로 숨은 행의 칸은 번호를 받지 않는다(기존 양식 '숨은 항목엔 안 매김'과 같음 — 순번이 헛돌지 않게)
 * 순번 채널(channelKey)은 서식 틀 기준 그대로라 문서마다 바뀌지 않는다.
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { sheetAutoNumberCells, type SheetAutoNumberCell } from '@/domain/approvalForm/sheetAutoNumber';
import { SHEET_VALUES_KEY, applyValues, conditionHiddenRows, readSheetValues } from './approvalSheet';
import { SHEET_ROWS_KEY, expandRepeats, extraRowCount, readRowExtras, repeatSections } from './repeatRows';

export function docAutoNumberCells(template: Sheet | null | undefined, fieldValues: Record<string, unknown>): SheetAutoNumberCell[] {
  if (!template) return [];
  const cells = sheetAutoNumberCells(template);
  if (!cells.length) return [];
  const extras = readRowExtras(fieldValues[SHEET_ROWS_KEY]);
  const sections = repeatSections(template);
  /** 서식 틀 행 → 문서 행: 위쪽 반복 구간에 더한 줄 수만큼 */
  const docRow = (r: number) => r + sections.filter((x) => x.last < r).reduce((n, x) => n + extraRowCount(extras, x.id), 0);
  const doc = applyValues(expandRepeats(template, extras), readSheetValues(fieldValues[SHEET_VALUES_KEY]), { recalc: false });
  const hidden = conditionHiddenRows(doc);
  return cells
    .map((x) => {
      const r = docRow(x.r);
      return { ...x, r, key: cellKey(r, template.cols[x.c]) };
    })
    .filter((x) => !hidden.has(x.r));
}
