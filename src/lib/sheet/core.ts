/**
 * 시트 계산 공개 API(화면 부품 없음) — 수식·모델·편집 동작·모양·엑셀 읽기.
 * 도메인·데이터 코드는 이것만 불러온다(React 화면 부품 SheetEditor·SheetView 를 끌어오지 않게). 화면 코드는 `@/lib/sheet`
 */
export {
  evaluateFormula,
  shiftFormula,
  translateFormula,
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
  unmergeRange,
  setCellValue,
  applyStyle,
  applyBorder,
  pasteTsv,
  setCellMeta,
  setRowMeta,
  setColMeta,
  type CellRange,
  type BorderPreset,
  type PasteOptions,
} from './ops';
export { cellCss, cellBorder, renderStyle, displayValue, defaultAlign, shrinkFontSize, SHEET_COLORS } from './style';
export { importXlsx, XlsxError, type XlsxImport, type XlsxOptions } from './xlsx';
