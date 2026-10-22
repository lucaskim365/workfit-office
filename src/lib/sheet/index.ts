/**
 * 엑셀 편집기 모듈 공개 API — 바깥에서는 이 파일로만 불러온다 (`@/lib/sheet`)
 */
export {
  evaluateFormula,
  shiftFormula,
  parseNumber,
  valueText,
  colLetter,
  colIndex,
  FormulaError,
  FORMULA_ERROR,
  type SheetValue,
  type CellGetter,
  type ShiftAction,
} from './formula';
export {
  createSheet,
  parseSheet,
  serializeSheet,
  recalculate,
  sheetSignature,
  cellKey,
  newColKey,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  type Sheet,
  type CellStyle,
  type BorderW,
  type Merge,
  type MetaMap,
} from './model';
export {
  insertRow,
  deleteRow,
  insertCol,
  deleteCol,
  mergeRange,
  unmergeAt,
  setCellValue,
  applyStyle,
  applyBorder,
  pasteTsv,
  setCellMeta,
  setRowMeta,
  setColMeta,
  type CellRange,
  type BorderPreset,
} from './ops';
export { cellCss, displayValue, defaultAlign, SHEET_COLORS } from './style';
