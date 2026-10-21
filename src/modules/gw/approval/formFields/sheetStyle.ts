/**
 * 표 셀 서식 → 화면 표시 (편집기·보기 화면 공용)
 */
import type { CSSProperties } from 'react';
import type { BorderW, CellStyle, SheetPayload } from './sheetModel';

/** 글자색·배경색 팔레트 — 문서는 흰 바탕 고정이라 고정 색 사용 */
export const SHEET_PALETTE: Array<{ token: string; label: string; text: string; bg: string }> = [
  { token: 'gray', label: '회색', text: '#555555', bg: '#f3f4f6' },
  { token: 'red', label: '빨강', text: '#c62828', bg: '#fde8e8' },
  { token: 'orange', label: '주황', text: '#d9480f', bg: '#ffedd5' },
  { token: 'yellow', label: '노랑', text: '#a16207', bg: '#fef9c3' },
  { token: 'green', label: '초록', text: '#2b8a3e', bg: '#e3f6e8' },
  { token: 'teal', label: '청록', text: '#0f766e', bg: '#dff5f2' },
  { token: 'blue', label: '파랑', text: '#1d4ed8', bg: '#e0ecff' },
  { token: 'purple', label: '보라', text: '#6d28d9', bg: '#efe7ff' },
  { token: 'black', label: '검정', text: '#111111', bg: '#e5e7eb' },
];

const paletteOf = (token?: string) => SHEET_PALETTE.find((p) => p.token === token);

function borderCss(w?: BorderW): string | undefined {
  if (w === 'thin') return '1px solid #333';
  if (w === 'thick') return '2px solid #111';
  if (w === 'none') return '1px hidden transparent';
  return undefined;
}

/** 셀 서식 → 인라인 스타일 (테두리 지정이 없으면 표의 기본 얇은 격자선이 보임) */
export function cellCss(style?: CellStyle): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.bold) css.fontWeight = 700;
  const bg = paletteOf(style.bg);
  if (bg) {
    css.backgroundColor = bg.bg;
    css.color = '#1a1a1a';
  }
  const fg = paletteOf(style.color);
  if (fg) css.color = fg.text;
  if (style.align) css.textAlign = style.align;
  const b = style.border;
  if (b) {
    if (borderCss(b.t)) css.borderTop = borderCss(b.t);
    if (borderCss(b.r)) css.borderRight = borderCss(b.r);
    if (borderCss(b.b)) css.borderBottom = borderCss(b.b);
    if (borderCss(b.l)) css.borderLeft = borderCss(b.l);
  }
  return css;
}

const toNumber = (v: string): number | null => {
  const s = v.replace(/,/g, '').trim();
  if (s === '' || isNaN(Number(s))) return null;
  return Number(s);
};

// 예전 보기 화면 규칙: 열 키 이름으로 숫자 열 판단
const LEGACY_NUM_COL = /수량|단가|가격|금액|수|율|비중/;

/** 칸에 보여 줄 글자 — 숫자 표시 서식, 예전 표의 숫자 열 콤마 규칙 */
export function displayCellValue(sheet: SheetPayload, r: number, col: string): string {
  const raw = String(sheet.rows[r]?.[col] ?? '');
  const style = sheet.cellStyles[`${r}:${col}`];
  const n = toNumber(raw);
  if (n !== null && style?.numFmt === 'currency') return n.toLocaleString('ko-KR');
  if (n !== null && style?.numFmt === 'percent') return `${raw}%`;
  const isLegacyBody = sheet.legacyHeaderRow && r > 0;
  if (isLegacyBody && n !== null && !raw.endsWith('%') && LEGACY_NUM_COL.test(col)) return n.toLocaleString('ko-KR');
  if (raw === '' && isLegacyBody) return '—';
  return raw;
}

/** 정렬 지정이 없을 때 기본 정렬 — 새 표는 엑셀처럼 숫자 오른쪽, 예전 표는 예전 열 이름 규칙 */
export function defaultAlign(sheet: SheetPayload, r: number, col: string): 'left' | 'right' {
  const raw = String(sheet.rows[r]?.[col] ?? '');
  if (sheet.legacyHeaderRow) {
    if (r === 0) return 'left';
    return LEGACY_NUM_COL.test(col) || raw.endsWith('%') ? 'right' : 'left';
  }
  return toNumber(raw.replace(/%$/, '')) !== null ? 'right' : 'left';
}

/** 예전 표에서 변환된 제목 행 칸인지 — 예전처럼 비공개 가림 대상이 아님 */
export function isLegacyHeaderCell(sheet: SheetPayload, r: number): boolean {
  return !!sheet.legacyHeaderRow && r === 0;
}

/** 비공개 칸 여부 */
export function isSecretCell(sheet: SheetPayload, r: number, col: string): boolean {
  if (isLegacyHeaderCell(sheet, r)) return false;
  return sheet.secretCols.includes(col) || sheet.secretRows.includes(r) || sheet.secretCells.includes(`${r}:${col}`);
}
