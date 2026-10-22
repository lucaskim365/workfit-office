/**
 * 셀 서식 → 화면 표시 (편집기·보기 화면 공용)
 * - 색은 '#rrggbb'(또는 '#rgb')만 적용 — 엑셀에서 가져온 색을 그대로 씀
 */
import type { CSSProperties } from 'react';
import { parseNumber } from './formula';
import type { BorderW, CellStyle, Sheet } from './model';

/** 색 고르기 화면의 미리 정한 색 — 문서는 흰 바탕 고정이라 고정 색 */
export const SHEET_COLORS: Array<{ label: string; text: string; bg: string }> = [
  { label: '회색', text: '#555555', bg: '#f3f4f6' },
  { label: '빨강', text: '#c62828', bg: '#fde8e8' },
  { label: '주황', text: '#d9480f', bg: '#ffedd5' },
  { label: '노랑', text: '#a16207', bg: '#fef9c3' },
  { label: '초록', text: '#2b8a3e', bg: '#e3f6e8' },
  { label: '청록', text: '#0f766e', bg: '#dff5f2' },
  { label: '파랑', text: '#1d4ed8', bg: '#e0ecff' },
  { label: '보라', text: '#6d28d9', bg: '#efe7ff' },
  { label: '검정', text: '#111111', bg: '#e5e7eb' },
];

const isHex = (v?: string): v is string => !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

function borderCss(w?: BorderW): string | undefined {
  if (w === 'thin') return '1px solid #333';
  if (w === 'thick') return '2px solid #111';
  if (w === 'none') return '1px hidden transparent';
  return undefined;
}

/** 셀 서식 → 인라인 스타일 (테두리 지정이 없으면 화면의 기본 격자선이 보임) */
export function cellCss(style?: CellStyle): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = 'italic';
  if (style.underline) css.textDecoration = 'underline';
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`;
  if (isHex(style.bg)) {
    css.backgroundColor = style.bg;
    css.color = '#1a1a1a';
  }
  if (isHex(style.color)) css.color = style.color;
  if (style.align) css.textAlign = style.align;
  if (style.valign) css.verticalAlign = style.valign;
  const b = style.border;
  if (b) {
    if (borderCss(b.t)) css.borderTop = borderCss(b.t);
    if (borderCss(b.r)) css.borderRight = borderCss(b.r);
    if (borderCss(b.b)) css.borderBottom = borderCss(b.b);
    if (borderCss(b.l)) css.borderLeft = borderCss(b.l);
  }
  return css;
}

/** 칸에 보여 줄 글자 — 숫자 표시 서식(금액 콤마·백분율) */
export function displayValue(s: Sheet, r: number, col: string): string {
  const raw = String(s.rows[r]?.[col] ?? '');
  const fmt = s.styles[`${r}:${col}`]?.numFmt;
  const n = parseNumber(raw);
  if (n !== null && fmt === 'currency') return n.toLocaleString('ko-KR');
  if (n !== null && fmt === 'percent') return `${raw}%`;
  return raw;
}

/** 정렬 지정이 없을 때 — 엑셀처럼 숫자는 오른쪽 */
export function defaultAlign(s: Sheet, r: number, col: string): 'left' | 'right' {
  return parseNumber(String(s.rows[r]?.[col] ?? '')) !== null ? 'right' : 'left';
}
