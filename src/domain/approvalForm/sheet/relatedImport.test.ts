import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, setCellName } from './approvalSheet';
import { expandRepeats, repeatSections, setRepeatSection } from './repeatRows';
import { collectNamed, importNamed, namedFromLegacy, readNamed } from './relatedImport';

/**
 * 0행: 거래처(B1 입력, 이름 '거래처')
 * 1~2행: 품목 반복 구간 — A 품명(입력, 이름 '품명'), B 수량(입력, 이름 '수량'), C =A*B 아님 → C 금액 =B*10
 * 3행: 합계 C4 =SUM(C2:C3) (이름 '합계')
 */
function poForm(): Sheet {
  let s = createSheet(4, 3);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'text' });
  s = setCellName(s, 0, 1, '거래처');
  for (const r of [1, 2]) {
    s = setCellMeta(s, APPROVAL_NS.input, r, 0, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'number' });
    s = setCellValue(s, r, 2, `=B${r + 1}*10`);
  }
  s = setCellName(s, 1, 0, '품명');
  s = setCellName(s, 1, 1, '수량');
  s = setCellValue(s, 3, 2, '=SUM(C2:C3)');
  s = setCellName(s, 3, 2, '합계');
  return setRepeatSection(s, 1, 2, '품목');
}

test('이름 값 모으기 — 한 칸은 값, 반복 구간 열은 목록(끝 빈 줄 제외)', () => {
  const tpl = poForm();
  const [a, b] = tpl.cols;
  const s = applyValues(tpl, { [cellKey(0, b)]: '에이스', [cellKey(1, a)]: '태블릿', [cellKey(1, b)]: '3' }, { recalc: true });
  assert.deepEqual(collectNamed(s), { 거래처: '에이스', 품명: ['태블릿'], 수량: ['3'], 합계: '30' });
});

test('가져오기 — 같은 이름 칸을 채우고, 목록이 길면 반복 구간 행을 늘린다. 수식 칸은 채우지 않는다', () => {
  const tpl = poForm();
  const id = repeatSections(tpl)[0].id;
  const [a, b] = tpl.cols;
  const src = { 거래처: '에이스메디칼', 품명: ['태블릿', '설비 I/F', 'N/W 공사'], 수량: ['14', '1', '1'], 합계: '999', 없는이름: 'x' };
  const res = importNamed(tpl, {}, {}, { [cellKey(0, b)]: 'U001' }, src);
  assert.deepEqual(res.extras, { [id]: 1 }); // 2줄 → 3줄
  assert.deepEqual(res.filled.sort(), ['거래처', '수량', '품명'].sort()); // 합계는 수식 칸이라 제외
  assert.equal(res.values[cellKey(0, b)], '에이스메디칼');
  assert.equal(res.values[cellKey(3, a)], 'N/W 공사');
  assert.equal(res.refs[cellKey(0, b)], undefined); // 가져온 칸의 사람 ID 는 지움
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.equal(s.rows[4][s.cols[2]], '160'); // (14+1+1)×10 — 합계 범위도 늘어남
});

test('가져오기 — 목록이 짧으면 남는 줄은 비우고, 한 칸에 목록이 오면 이어 붙임', () => {
  const tpl = poForm();
  const [a, b] = tpl.cols;
  const before = { [cellKey(1, a)]: '옛 품목1', [cellKey(2, a)]: '옛 품목2' };
  const res = importNamed(tpl, {}, before, {}, { 품명: ['새 품목'], 거래처: ['가', '나'] });
  assert.equal(res.values[cellKey(1, a)], '새 품목');
  assert.equal(res.values[cellKey(2, a)], undefined);
  assert.equal(res.values[cellKey(0, b)], '가, 나');
});

test('옛 서식 문서 — 라벨을 이름으로, 한 칸짜리 필드만', () => {
  const fields = [
    { key: 'vendor', label: '거래처', type: '텍스트' },
    { key: 'period', label: '계약기간', type: '기간' },
    { key: 'items', label: '품목', type: '표' },
    { key: 'amt', label: '금액', type: '금액' },
  ];
  assert.deepEqual(namedFromLegacy(fields, { vendor: '에이스', period: '2026-11-01', period__end: '2026-11-30', items: '{}', amt: 1500 }), {
    거래처: '에이스',
    계약기간: '2026-11-01 ~ 2026-11-30',
    금액: '1500',
  });
});

test('저장된 이름 값 읽기', () => {
  assert.deepEqual(readNamed('{"a":"1","b":["x",2]}'), { a: '1', b: ['x', '2'] });
  assert.deepEqual(readNamed('깨짐'), {});
});
