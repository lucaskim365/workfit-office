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

/** 부동소수 오차를 걷어 낸 고정 자릿수 */
const fixed = (n: number, d: number) => Number(n.toFixed(10)).toFixed(d);

/**
 * 칸에 보여 줄 글자 — 숫자 표시 서식. 엑셀과 같게:
 * - 금액: 콤마, 소수 자릿수가 정해져 있으면 그 자리로 반올림
 * - 백분율: 값×100 에 % (0.6133 → '61.3%' — 자릿수 1일 때). 자릿수가 없으면 최대 2자리
 * - 서식 없이 자릿수만 있으면(엑셀 '0.00' 등) 그 자리로 반올림
 */
export function displayValue(s: Sheet, r: number, col: string): string {
  const raw = String(s.rows[r]?.[col] ?? '');
  const style = s.styles[`${r}:${col}`];
  const n = parseNumber(raw);
  if (n === null || !style) return raw;
  const d = style.decimals;
  if (style.numFmt === 'currency') {
    return d === undefined ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  if (style.numFmt === 'percent') {
    const p = n * 100;
    return `${d === undefined ? String(Number(fixed(p, 2))) : fixed(p, d)}%`;
  }
  if (d !== undefined) return fixed(n, d);
  return raw;
}

type Border = NonNullable<CellStyle['border']>;
type Side = keyof Border;

/**
 * 화면에 그릴 테두리 — 칸 자신의 선에 이웃 칸이 맞닿은 쪽에 그린 선을 더하고,
 * 병합 블록은 가장자리 칸들의 선까지 모은다.
 * - 엑셀은 병합 블록의 오른쪽·아래 선을 가려진 칸에 저장하므로, 대표 칸 서식만 보면 선이 빠진다
 * - 표 겹침(border-collapse)에서 같은 굵기 선이 만나면 왼쪽·위 칸 선이 이겨, 편집기 격자선이 진짜 선을 가린다
 * 둘 다 여기서 막는다. 저장 데이터는 바꾸지 않는다.
 */
export function cellBorder(s: Sheet, r: number, c: number, rowSpan = 1, colSpan = 1): CellStyle['border'] {
  const at = (rr: number, cc: number): Border | undefined => {
    const col = s.cols[cc];
    return col === undefined || rr < 0 ? undefined : s.styles[`${rr}:${col}`]?.border;
  };
  const strongest = (ws: Array<BorderW | undefined>): BorderW | undefined =>
    ws.includes('thick') ? 'thick' : ws.includes('thin') ? 'thin' : undefined;
  const r2 = r + rowSpan - 1;
  const c2 = c + colSpan - 1;
  const along = (from: number, to: number, pick: (i: number) => Array<BorderW | undefined>) => {
    const out: Array<BorderW | undefined> = [];
    for (let i = from; i <= to; i++) out.push(...pick(i));
    return strongest(out);
  };
  const own = at(r, c);
  const result: Border = {};
  const sides: Record<Side, BorderW | undefined> = {
    t: along(c, c2, (cc) => [at(r, cc)?.t, at(r - 1, cc)?.b]),
    b: along(c, c2, (cc) => [at(r2, cc)?.b, at(r2 + 1, cc)?.t, own?.b]),
    l: along(r, r2, (rr) => [at(rr, c)?.l, at(rr, c - 1)?.r]),
    r: along(r, r2, (rr) => [at(rr, c2)?.r, at(rr, c2 + 1)?.l, own?.r]),
  };
  (Object.keys(sides) as Side[]).forEach((k) => {
    // 칸에 직접 '없음'을 지정한 쪽은 지운 것 — 이웃 칸 선보다 우선
    const w = own?.[k] === 'none' ? 'none' : sides[k];
    if (w) result[k] = w;
  });
  return Object.keys(result).length ? result : undefined;
}

/** 화면용 칸 서식 — 저장된 서식에 cellBorder 로 모은 테두리를 얹는다 */
export function renderStyle(s: Sheet, r: number, c: number, rowSpan = 1, colSpan = 1): CellStyle | undefined {
  const col = s.cols[c];
  const style = col === undefined ? undefined : s.styles[`${r}:${col}`];
  const border = cellBorder(s, r, c, rowSpan, colSpan);
  if (!style && !border) return undefined;
  return { ...style, border };
}

/** 정렬 지정이 없을 때 — 엑셀처럼 숫자는 오른쪽 */
export function defaultAlign(s: Sheet, r: number, col: string): 'left' | 'right' {
  return parseNumber(String(s.rows[r]?.[col] ?? '')) !== null ? 'right' : 'left';
}
