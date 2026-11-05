import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, insertRow, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues } from './approvalSheet';
import {
  addRepeatRow,
  clearRepeatSection,
  healRepeatSections,
  insertRepeatRowAfter,
  removeRepeatRowAt,
  expandRepeats,
  readRowExtras,
  removeRepeatRow,
  repeatIssues,
  repeatSections,
  setRepeatSection,
} from './repeatRows';

/**
 * 품목 표 — 0행 머리, 1~2행 품목(반복), 3행 합계
 *   A: 구분(1~2행 세로 병합 '품목')  B: 수량  C: 단가  D: =B*C   합계 D4 =SUM(D2:D3)
 *   B2:C2… 는 입력 칸
 */
function itemForm(): Sheet {
  let s = createSheet(4, 4);
  s = setCellValue(s, 0, 1, '수량');
  s = setCellValue(s, 1, 0, '품목');
  for (const r of [1, 2]) {
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'number' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 2, { type: 'number' });
    s = setCellValue(s, r, 3, `=B${r + 1}*C${r + 1}`);
  }
  s = setCellValue(s, 3, 3, '=SUM(D2:D3)');
  s = { ...s, merges: [{ startRow: 1, startCol: 0, rowSpan: 2, colSpan: 1 }] };
  s = { ...s, styles: { ...s.styles, [cellKey(2, s.cols[1])]: { border: { b: 'thin' } } } };
  return setRepeatSection(s, 1, 2, '품목');
}

const val = (s: Sheet, r: number, c: number) => s.rows[r][s.cols[c]];

test('반복 구간 지정·목록·해제', () => {
  const s = itemForm();
  const [sec] = repeatSections(s);
  assert.deepEqual({ label: sec.label, first: sec.first, last: sec.last }, { label: '품목', first: 1, last: 2 });
  assert.deepEqual(repeatSections(clearRepeatSection(s, sec.id)), []);
});

test('행 펼치기 — 마지막 행을 본뜨고, 합계 범위·세로 병합이 늘어난다', () => {
  const tpl = itemForm();
  const id = repeatSections(tpl)[0].id;
  const s = expandRepeats(tpl, { [id]: 2 });
  assert.equal(s.rows.length, 6);
  const [a, b, , d] = s.cols;
  assert.equal(s.formulas[cellKey(3, d)], '=B4*C4'); // 본뜬 행 수식은 한 행 아래로
  assert.equal(s.formulas[cellKey(4, d)], '=B5*C5');
  assert.equal(s.formulas[cellKey(5, d)], '=SUM(D2:D5)'); // 합계 범위가 늘어남
  assert.deepEqual(s.cellMeta[APPROVAL_NS.input][cellKey(4, b)], { type: 'number' });
  assert.deepEqual(s.styles[cellKey(4, b)], { border: { b: 'thin' } });
  assert.deepEqual(s.merges, [{ startRow: 1, startCol: 0, rowSpan: 4, colSpan: 1 }]);
  assert.equal(repeatSections(s)[0].last, 4);
  assert.equal(val(s, 1, 0), '품목');
  void a;
  // 틀은 그대로
  assert.equal(tpl.rows.length, 4);
});

test('행 추가·삭제 — 값은 아래로 밀리고, 지운 행 값은 버리고, 그린 줄 수 밑으로는 못 줄임', () => {
  const tpl = itemForm();
  const id = repeatSections(tpl)[0].id;
  const [, b, c, d] = tpl.cols;
  let extras = {};
  let values = { [cellKey(1, b)]: '2', [cellKey(1, c)]: '100', [cellKey(3, d)]: '200' };
  ({ extras, values } = addRepeatRow(tpl, extras, values, id));
  assert.deepEqual(extras, { [id]: 1 });
  assert.equal(values[cellKey(4, d)], '200'); // 합계 행 값이 한 줄 내려감
  values = { ...values, [cellKey(3, b)]: '3', [cellKey(3, c)]: '10' }; // 새 행에 입력
  const filled = applyValues(expandRepeats(tpl, extras), values, { recalc: true }); // 작성 화면과 같은 길
  assert.equal(val(filled, 4, 3), '230'); // 2×100 + 3×10

  ({ extras, values } = removeRepeatRow(tpl, extras, values, id));
  assert.deepEqual(extras, {});
  assert.equal(values[cellKey(3, b)], undefined); // 지운 행 값은 버림
  assert.equal(values[cellKey(1, b)], '2');
  // 관리자가 그린 줄도 지울 수 있다(기존 표 [행 삭제]와 같음) — 2줄 구간이면 1줄까지
  const again = removeRepeatRow(tpl, extras, values, id);
  assert.deepEqual(again.extras, { [id]: -1 });
  assert.equal(repeatSections(expandRepeats(tpl, again.extras))[0].last, 1, "그린 줄 하나 지움");
  assert.deepEqual(removeRepeatRow(tpl, again.extras, again.values, id).extras, { [id]: -1 }, "1줄은 남김");
});

test('구간 둘 — 아래 구간부터 펼쳐 위 구간 행 번호가 흔들리지 않음', () => {
  let s = createSheet(6, 2);
  s = setRepeatSection(s, 1, 1, '위');
  s = setRepeatSection(s, 3, 4, '아래');
  const [up, down] = repeatSections(s);
  const e = expandRepeats(s, { [up.id]: 1, [down.id]: 2 });
  assert.equal(e.rows.length, 9);
  const [u, w] = repeatSections(e);
  assert.deepEqual([u.first, u.last, w.first, w.last], [1, 2, 4, 7]);
});

test('검사 — 끊긴 구간, 구간 안 칸 이름', () => {
  let s = itemForm();
  const id = repeatSections(s)[0].id;
  // 2행 표시를 지워 1행·(빈)·… 처럼 끊긴 것을 흉내 — 같은 id 가 떨어져 두 번
  s = { ...s, rowMeta: { ...s.rowMeta, repeat: { '1': { id, label: '품목' }, '3': { id, label: '품목' } } } };
  assert.ok(repeatIssues(s).some((m) => m.includes('끊겼습니다')));
  let t = itemForm();
  t = setCellMeta(t, APPROVAL_NS.name, 1, 3, 'amount');
  assert.ok(repeatIssues(t).some((m) => m.includes('금액 키')));
  assert.deepEqual(repeatIssues(itemForm()), []);
});

test('붙인 줄 수 읽기', () => {
  assert.deepEqual(readRowExtras('{"a":2,"b":0,"c":"x"}'), { a: 2 });
  assert.deepEqual(readRowExtras('깨짐'), {});
  assert.deepEqual(readRowExtras(undefined), {});
});

test('구간 한가운데에 넣은 행은 그 구간으로 채운다', () => {
  let s = createSheet(5, 2);
  s = setRepeatSection(s, 1, 3, '품목');
  s = insertRow(s, 2); // 관리자가 2행 위에 행 삽입 → 1,3,4 행에 표시, 2행 빈칸
  assert.equal(repeatSections(s).length, 2);
  const healed = healRepeatSections(s);
  const secs = repeatSections(healed);
  assert.equal(secs.length, 1);
  assert.deepEqual([secs[0].first, secs[0].last], [1, 4]);
  assert.equal(healRepeatSections(healed), healed); // 바뀔 것 없으면 그대로
});

/** 번호 표 — 0행 머리, 1~3행 품목(반복): A 번호(입력, 1·2·3), B 수량(입력), C =B*10, 4행 합계 C5 =SUM(C2:C4) */
function numberedForm(): Sheet {
  let s = createSheet(5, 3);
  for (const r of [1, 2, 3]) {
    s = setCellMeta(s, APPROVAL_NS.input, r, 0, { type: 'text' });
    s = setCellValue(s, r, 0, String(r), { allowFormula: false });
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'number' });
    s = setCellValue(s, r, 2, `=B${r + 1}*10`);
  }
  s = setCellValue(s, 4, 2, '=SUM(C2:C4)');
  return setRepeatSection(s, 1, 3, '품목');
}

test('줄마다 [+]·[−] — 중간에 넣고 지우면 아래 값이 밀리고, 합계 범위가 따라가고, 차례 번호는 다시 매김', () => {
  const tpl = numberedForm();
  const id = repeatSections(tpl)[0].id;
  const [a, b] = tpl.cols;
  const values = { [cellKey(1, a)]: '1', [cellKey(2, a)]: '2', [cellKey(3, a)]: '3', [cellKey(1, b)]: '1', [cellKey(2, b)]: '2', [cellKey(3, b)]: '3' };
  // 1번 줄 아래에 넣기 → 수량 1, (빈), 2, 3 / 번호 1·2·3·4
  const ins = insertRepeatRowAfter(tpl, {}, values, id, 1);
  assert.deepEqual(ins.extras, { [id]: 1 });
  const s1 = applyValues(expandRepeats(tpl, ins.extras), ins.values, { recalc: true });
  assert.deepEqual([1, 2, 3, 4].map((r) => val(s1, r, 1)), ['1', '', '2', '3']);
  assert.deepEqual([1, 2, 3, 4].map((r) => val(s1, r, 0)), ['1', '2', '3', '4']);
  assert.equal(val(s1, 5, 2), '60'); // 합계 =SUM(C2:C5) — 10+0+20+30
  // 2번째 줄(수량 2였던 원래 줄이 아니라 넣은 빈 줄 다음) 지우기 → 1, (빈), 3 / 번호 1·2·3
  const del = removeRepeatRowAt(tpl, ins.extras, ins.values, id, 3);
  const s2 = applyValues(expandRepeats(tpl, del.extras), del.values, { recalc: true });
  assert.deepEqual([1, 2, 3].map((r) => val(s2, r, 1)), ['1', '', '3']);
  assert.deepEqual([1, 2, 3].map((r) => val(s2, r, 0)), ['1', '2', '3']);
  assert.equal(val(s2, 4, 2), '40');
  // 그린 줄 첫 줄도 지울 수 있다 → 수량 (빈), 3 — 1줄은 남김
  const first = removeRepeatRowAt(tpl, del.extras, del.values, id, 1);
  const one = removeRepeatRowAt(tpl, first.extras, first.values, id, 1);
  assert.deepEqual(removeRepeatRowAt(tpl, one.extras, one.values, id, 1).extras, one.extras, '마지막 1줄은 못 지움');
  // 구간 밖 행은 무시
  assert.deepEqual(insertRepeatRowAfter(tpl, {}, values, id, 4).extras, {});
});

test('번호 다시 매기기 — 기안자가 번호를 바꿔 차례가 깨졌으면 손대지 않음', () => {
  const tpl = numberedForm();
  const id = repeatSections(tpl)[0].id;
  const a = tpl.cols[0];
  const custom = { [cellKey(1, a)]: '1', [cellKey(2, a)]: '1-1', [cellKey(3, a)]: '2' };
  const ins = insertRepeatRowAfter(tpl, {}, custom, id, 1);
  const s = applyValues(expandRepeats(tpl, ins.extras), ins.values, { recalc: false });
  assert.deepEqual([1, 2, 3, 4].map((r) => val(s, r, 0)), ['1', '', '1-1', '2']);
});

test('줄 본뜨기 — 구간 밖(소계)을 가리키는 주소는 그대로, 소계 줄을 구간에 넣으면 저장 전 검사', () => {
  // 0 머리, 1~2 분류(B = C/C4 비중), 3 소계 C4 =SUM(C2:C3)
  let s = createSheet(4, 3);
  for (const r of [1, 2]) {
    s = setCellMeta(s, APPROVAL_NS.input, r, 2, { type: 'number' });
    s = setCellValue(s, r, 1, `=C${r + 1}/C4`);
  }
  s = setCellValue(s, 3, 2, '=SUM(C2:C3)');
  const tpl = setRepeatSection(s, 1, 2, '분류');
  const id = repeatSections(tpl)[0].id;
  const out = expandRepeats(tpl, { [id]: 1 });
  assert.equal(out.formulas[cellKey(3, out.cols[1])], '=C4/C5', '새 줄 비중은 밀려 내려간 소계(C5)를 가리킴');
  assert.equal(out.formulas[cellKey(4, out.cols[2])], '=SUM(C2:C4)');
  assert.deepEqual(repeatIssues(tpl), []);
  // 소계 줄까지 구간으로 잡으면 막는다
  assert.ok(repeatIssues(setRepeatSection(s, 1, 3, '분류')).some((m) => m.includes('합계 줄')));
});
