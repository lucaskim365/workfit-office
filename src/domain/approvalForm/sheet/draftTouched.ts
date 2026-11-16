/**
 * 시트 서식 기안에 기안자가 쓴 것이 있나 — 기안 화면의 '작성 중' 판정(빈 문서 자동 보관·닫을 때 확인 창)이 쓴다.
 *
 * 시트는 열리자마자 서식 버전·수식 결과·미리 적힌 글자를 문서 값(__values 등)에 내보내므로 '값이 있나'로는 알 수 없다.
 * 틀이 처음 내보내는 값과 견주어, 기안자가 쓰는 칸(입력 칸)의 값이 달라졌을 때만 쓴 것으로 본다.
 * 줄을 더하거나 지웠을 때(__rows), 표 모양을 고쳤을 때(__sheet)도 쓴 것이다.
 * 시스템이 채우는 칸(휴가 일수·수식 결과 등)은 입력 칸이 아니라 견주지 않는다
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, SHEET_VALUES_KEY, applyValues, clearConditionHidden, clearStaleDependent, readSheetValues } from './approvalSheet';
import { SHEET_OWN_KEY, readOwnSheet } from './ownSheet';
import { SHEET_ROWS_KEY, readRowExtras } from './repeatRows';

export function sheetDraftTouched(template: Sheet, fieldValues: Record<string, unknown>): boolean {
  // 시트가 아직 값을 내보내기 전(막 연 때) — 견줄 값이 없다
  if (typeof fieldValues[SHEET_VALUES_KEY] !== 'string') return false;
  if (readOwnSheet(fieldValues[SHEET_OWN_KEY])) return true;
  if (Object.keys(readRowExtras(fieldValues[SHEET_ROWS_KEY])).length > 0) return true;
  const values = readSheetValues(fieldValues[SHEET_VALUES_KEY]);
  // 틀이 처음 내보내는 모양 — 작성 화면과 같은 길(다시 계산 → 종속 선택의 안 맞는 값·조건으로 숨은 행의 값 비우기)
  const first = clearConditionHidden(clearStaleDependent(applyValues(template, {}, { recalc: true }))).sheet;
  return Object.keys(template.cellMeta[APPROVAL_NS.input] ?? {}).some((key) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    if (r >= first.rows.length || !first.cols.includes(col)) return false;
    return (values[cellKey(r, col)] ?? '') !== String(first.rows[r]?.[col] ?? '');
  });
}
