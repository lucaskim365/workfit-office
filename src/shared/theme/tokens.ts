/**
 * 디자인 토큰 (JS) — index.css의 @theme 와 동일 값.
 * SVG 차트처럼 색을 문자열로 직접 넘겨야 하는 곳에서만 사용.
 * 레이아웃/색상 UI는 Tailwind 클래스(text-teal 등)를 우선 사용한다.
 */
export const T = {
  bg: '#eef1f6',
  bgDeep: '#e6eaf2',
  panel: '#ffffff',
  panelAlt: '#f7f9fc',
  border: '#e3e8f0',
  borderHi: '#d4dbe7',
  ink: '#1c2536',
  ink2: '#56607a',
  ink3: '#8b95ab',
  navy: '#1f2f55',
  navyDeep: '#172241',
  blue: '#3a6ee0',
  blueSoft: '#e7eefc',
  teal: '#17a89a',
  tealSoft: '#dcf3f0',
  ok: '#16a34a',
  warn: '#e6960c',
  err: '#e0483b',
  info: '#3a6ee0',
  // chart palette
  c1: '#1f2f55',
  c2: '#17a89a',
  c3: '#3a6ee0',
  c4: '#8ab4f8',
  c5: '#b7c0d4',
} as const;
