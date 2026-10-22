import assert from 'node:assert/strict';
import test from 'node:test';
import { cellCss, displayValue, defaultAlign, SHEET_COLORS } from './style';
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
    borderLeft: '1px hidden transparent',
  });
});

test('숫자 표시와 기본 정렬', () => {
  const s = createSheet(1, 4);
  const [a, b, c, d] = s.cols;
  s.rows[0] = { [a]: '1234567', [b]: '15', [c]: '가', [d]: '1,200' };
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
