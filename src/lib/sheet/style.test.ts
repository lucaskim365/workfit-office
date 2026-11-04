import assert from 'node:assert/strict';
import test from 'node:test';
import { cellBorder, cellCss, displayValue, defaultAlign, shrinkFontSize, SHEET_COLORS } from './style';
import { createSheet, cellKey } from './model';

test('엑셀 색 그대로', () => {
  assert.deepEqual(cellCss({ color: '#FF0000', bg: '#00ff00' }), { color: '#FF0000', backgroundColor: '#00ff00' });
  assert.deepEqual(cellCss({ bg: '#eee' }), { backgroundColor: '#eee', color: '#1a1a1a' });
  assert.deepEqual(cellCss({ color: 'red;x', bg: '#12' }), {});
});

test('글꼴·정렬', () => {
  assert.deepEqual(cellCss({ fontSize: 14, italic: true, underline: true, valign: 'middle', bold: true }), {
    fontSize: '14pt',
    fontStyle: 'italic',
    textDecoration: 'underline',
    verticalAlign: 'middle',
    fontWeight: 700,
  });
});

test('테두리', () => {
  assert.deepEqual(cellCss({ border: { t: 'thin', b: 'thick', l: 'none' } }), {
    borderTop: '1px solid #333',
    borderBottom: '2px solid #111',
  }); // 없음은 그린 선이 없을 뿐 — 편집기 격자선은 보임(엑셀과 같음)
});

test('숫자 표시와 기본 정렬', () => {
  const s = createSheet(1, 4);
  const [a, b, c, d] = s.cols;
  s.rows[0] = { [a]: '1234567', [b]: '0.15', [c]: '가', [d]: '1,200' };
  s.styles[cellKey(0, a)] = { numFmt: 'currency' };
  s.styles[cellKey(0, b)] = { numFmt: 'percent' };
  assert.equal(displayValue(s, 0, a), '1,234,567');
  assert.equal(displayValue(s, 0, b), '15%');
  assert.equal(displayValue(s, 0, c), '가');
  assert.equal(defaultAlign(s, 0, d), 'right');
  assert.equal(defaultAlign(s, 0, c), 'left');
});

test('색 목록은 hex', () => {
  assert.equal(SHEET_COLORS.length, 9);
  assert.ok(SHEET_COLORS.every((p) => /^#[0-9a-f]{6}$/i.test(p.text) && /^#[0-9a-f]{6}$/i.test(p.bg)));
});

test('숫자 표시 — 백분율은 값×100(엑셀과 같음), 소수 자릿수 반올림', () => {
  const s = createSheet(1, 5);
  const [a, b, c, d, e] = s.cols;
  s.rows[0] = { [a]: '0.6133338785', [b]: '0.6133338785', [c]: '1234.5', [d]: '3.14159', [e]: '0' };
  s.styles[cellKey(0, a)] = { numFmt: 'percent', decimals: 1 };
  s.styles[cellKey(0, b)] = { numFmt: 'percent' };
  s.styles[cellKey(0, c)] = { numFmt: 'currency', decimals: 0 };
  s.styles[cellKey(0, d)] = { decimals: 2 };
  s.styles[cellKey(0, e)] = { numFmt: 'percent', decimals: 1 };
  assert.equal(displayValue(s, 0, a), '61.3%');
  assert.equal(displayValue(s, 0, b), '61.33%'); // 자릿수 없음 → 최대 2자리
  assert.equal(displayValue(s, 0, c), '1,235');
  assert.equal(displayValue(s, 0, d), '3.14');
  assert.equal(displayValue(s, 0, e), '0.0%');
  s.rows[0][a] = '61.3%'; // 기호를 붙여 쓴 값도 같게
  assert.equal(displayValue(s, 0, a), '61.3%');
});

test('그릴 테두리 — 이웃 칸 선과 병합 가장자리 칸 선을 모은다', () => {
  const s = createSheet(3, 4);
  const [a, , c] = s.cols;
  // A1:C1 병합 — 엑셀은 오른쪽 선을 가려진 C1 에, 아래 선을 각 칸에 저장
  s.merges = [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 3 }];
  s.styles[cellKey(0, a)] = { border: { t: 'thin', l: 'thick' } };
  s.styles[cellKey(0, c)] = { border: { r: 'thin', b: 'thick' } };
  // B2 왼쪽 선은 A2 의 오른쪽 선으로만 지정
  s.styles[cellKey(1, a)] = { border: { r: 'thin' } };
  assert.deepEqual(cellBorder(s, 0, 0, 1, 3), { t: 'thin', b: 'thick', l: 'thick', r: 'thin' });
  assert.deepEqual(cellBorder(s, 1, 1), { l: 'thin' });
  assert.deepEqual(cellBorder(s, 1, 2), { t: 'thick' }); // 위 C1(가려진 칸)의 아래 선
  assert.equal(cellBorder(s, 2, 3), undefined);
});

test('그릴 테두리 — 직접 지운 쪽(없음)은 이웃 선보다 우선, 병합 대표 칸 자신의 선도 그림', () => {
  const s = createSheet(2, 3);
  const [a, b] = s.cols;
  s.styles[cellKey(0, a)] = { border: { r: 'thin' } };
  s.styles[cellKey(0, b)] = { border: { l: 'none' } };
  assert.deepEqual(cellBorder(s, 0, 1), { l: 'none' });
  s.merges = [{ startRow: 1, startCol: 0, rowSpan: 1, colSpan: 3 }];
  s.styles[cellKey(1, a)] = { border: { r: 'thick', b: 'thin' } }; // 대표 칸에만 저장된 선(옛 데이터)
  assert.deepEqual(cellBorder(s, 1, 0, 1, 3), { b: 'thin', r: 'thick' });
});

test('셀에 맞춤 — 줄바꿈이 든 글·셀에 맞춤 아닌 칸·짧은 글은 줄이지 않음 (글 폭 재기는 브라우저에서만)', () => {
  assert.equal(shrinkFontSize('한 줄\n두 줄', { shrink: true }, 10), undefined);
  assert.equal(shrinkFontSize('아주 긴 글자입니다', {}, 10), undefined);
  assert.equal(shrinkFontSize('', { shrink: true }, 10), undefined);
});

test('그릴 테두리 — 병합 블록 위·옆 칸은 대표 칸에만 저장된 블록 가장자리 선을 알아본다', () => {
  const s = createSheet(2, 3);
  const [, b] = s.cols;
  // B2:C2 병합, 위쪽 선은 대표 칸 B2 에만(엑셀이 흔히 저장하는 방식)
  s.merges = [{ startRow: 1, startCol: 1, rowSpan: 1, colSpan: 2 }];
  s.styles[cellKey(1, b)] = { border: { t: 'thin' } };
  assert.deepEqual(cellBorder(s, 0, 2), { b: 'thin' }); // C1 아래 = 가려진 C2 의 위(대표 칸 선)
});
