import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSheet, mergeRange, setCellValue } from './index';
import { SheetView } from './SheetView';

test('숨긴 행이 걸친 세로 병합 — 첫 보이는 행에서 보이는 줄 수만큼, 옆 칸은 밀리지 않음', () => {
  // A1:A3 세로 병합('분류'), B1~B3 각 줄 값. 1행을 숨긴다
  let s = createSheet(3, 2);
  s = setCellValue(s, 0, 0, '분류');
  ['식대', '교통비', '운반비'].forEach((v, r) => (s = setCellValue(s, r, 1, v)));
  s = mergeRange(s, { r1: 0, r2: 2, c1: 0, c2: 0 });
  const html = renderToStaticMarkup(<SheetView sheet={s} hiddenRows={(r) => r === 0} />);
  const rows = html.split('<tr').slice(1);
  assert.equal(rows.length, 2);
  assert.match(rows[0], /rowSpan="2"[^>]*>분류<|rowspan="2"[^>]*>분류</i);
  assert.match(rows[0], /교통비/);
  assert.equal((rows[1].match(/<td/g) ?? []).length, 1); // 병합에 덮인 A 칸은 안 그림 → 운반비 하나
  assert.match(rows[1], /운반비/);
});
