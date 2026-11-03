import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, cellKey, type Sheet } from '@/lib/sheet';
import { APPROVAL_NS, applyValues, canMergeApprovalRange, extractValues, isDraftEditable, isStructureLocked, namedValues, pasteDraftTsv, setApprovalCellValue } from './approvalSheet';
import { setCellMeta, setCellValue } from '@/lib/sheet';

function base(): Sheet {
  return createSheet(4, 3);
}

test('연동 칸 든 행·열 삭제 금지', () => {
  const s0 = base();
  const [a, b, c] = s0.cols;
  const s: Sheet = {
    ...s0,
    cellMeta: {
      name: { [cellKey(1, a)]: 'amount' },
      bind: { [cellKey(0, b)]: 'company.name' },
      seal: { [cellKey(2, c)]: true },
    },
    rowMeta: { secret: { '3': true } },
    colMeta: { secret: { [c]: true } },
  };
  assert.equal(isStructureLocked(s, 'row', 1), true); // 칸 이름
  assert.equal(isStructureLocked(s, 'col', 0), true);
  assert.equal(isStructureLocked(s, 'row', 0), true); // 데이터 불러오기(0:b)
  assert.equal(isStructureLocked(s, 'col', 1), true);
  assert.equal(isStructureLocked(s, 'row', 2), true); // 직인
  assert.equal(isStructureLocked(s, 'row', 3), true); // 비공개 행
  assert.equal(isStructureLocked(s, 'col', 2), true); // 비공개 열·직인

  const plain: Sheet = { ...s0, cellMeta: { lock: { [cellKey(1, a)]: true }, input: { [cellKey(2, b)]: { type: 'date' } } } };
  assert.equal(isStructureLocked(plain, 'row', 1), false); // 잠금·입력 칸만 있으면 지울 수 있음
  assert.equal(isStructureLocked(plain, 'col', 1), false);

  const secretCell: Sheet = { ...s0, cellMeta: { secret: { [cellKey(0, a)]: true } } };
  assert.equal(isStructureLocked(secretCell, 'row', 0), true); // 비공개 칸
  assert.equal(isStructureLocked(secretCell, 'row', 1), false);
});

test('이름 칸에는 수식이 들어가지 않는다', () => {
  const s0 = base();
  const [a, b] = s0.cols;
  const s: Sheet = { ...s0, cellMeta: { name: { [cellKey(0, a)]: 'amount' } } };
  const named = setApprovalCellValue(s, 0, 0, '=1+1');
  assert.equal(named.rows[0][a], '=1+1');
  assert.equal(named.formulas[cellKey(0, a)], undefined);
  const free = setApprovalCellValue(s, 0, 1, '=1+1');
  assert.equal(free.formulas[cellKey(0, b)], '=1+1');
});

test('이름공간 값은 바뀌지 않는다', () => {
  assert.deepEqual(APPROVAL_NS, { input: 'input', name: 'name', bind: 'bind', lock: 'lock', secret: 'secret', seal: 'seal' });
});

/** 2×3: A1 라벨(잠금 없음, 입력 아님) · B1 입력+이름 amount · C1 입력+잠금 · A2 입력 · B2 수식 =B1*2 */
function form(): Sheet {
  let s = createSheet(2, 3);
  s = setCellValue(s, 0, 0, '금액');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'currency' });
  s = setCellMeta(s, APPROVAL_NS.name, 0, 1, 'amount');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 2, { type: 'text' });
  s = setCellMeta(s, APPROVAL_NS.lock, 0, 2, true);
  s = setCellMeta(s, APPROVAL_NS.input, 1, 0, { type: 'text' });
  s = setCellValue(s, 1, 1, '=B1*2');
  return s;
}

test('기안자는 잠기지 않은 입력 칸만 고친다', () => {
  const s = form();
  assert.equal(isDraftEditable(s, 0, 0), false); // 라벨
  assert.equal(isDraftEditable(s, 0, 1), true);
  assert.equal(isDraftEditable(s, 0, 2), false); // 잠금
  assert.equal(isDraftEditable(s, 1, 1), false); // 수식 칸
});

test('기안자 붙여넣기 — 입력 칸만, 이름 칸의 = 은 값으로, 시트를 늘리지 않음', () => {
  const s = pasteDraftTsv(form(), 0, 0, '바꿈\t=1+1\t잠김\n둘째\t수식\t넘침\n셋째');
  const [a, b, c] = s.cols;
  assert.equal(s.rows[0][a], '금액');
  assert.equal(s.rows[0][b], '=1+1');
  assert.equal(s.formulas[cellKey(0, b)], undefined);
  assert.equal(s.rows[0][c], '');
  assert.equal(s.rows[1][a], '둘째');
  assert.equal(s.formulas[cellKey(1, b)], '=B1*2');
  assert.equal(s.rows.length, 2);
  assert.equal(s.cols.length, 3);
});

test('연동 칸을 덮는 병합은 막고, 대표 칸이면 허용', () => {
  const s = form();
  assert.equal(canMergeApprovalRange(s, { r1: 0, c1: 0, r2: 0, c2: 1 }), false);
  assert.equal(canMergeApprovalRange(s, { r1: 0, c1: 1, r2: 0, c2: 1 }), true);
  assert.equal(canMergeApprovalRange(createSheet(2, 2), { r1: 0, c1: 0, r2: 1, c2: 1 }), true);
});

test('값만 뽑아 틀에 다시 얹으면 같은 문서, 상신 문서는 저장된 결과를 그대로', () => {
  // 같은 서식 틀(열 키가 같아야 한다) — form()은 부를 때마다 새 열 키를 만든다
  const tpl = form();
  const s = setApprovalCellValue(tpl, 0, 1, '1000');
  const values = extractValues(s);
  const [a, b] = s.cols;
  assert.deepEqual(values, { [cellKey(0, b)]: '1000', [cellKey(1, b)]: '2000' });
  assert.equal(values[cellKey(0, a)], undefined); // 라벨은 틀에 있으므로 저장하지 않음
  const view = applyValues(tpl, values, { recalc: false });
  assert.equal(view.rows[1][b], '2000');
  // 틀의 수식이 바뀌어도 상신 문서는 저장 당시 결과
  const changed = setCellValue(tpl, 1, 1, '=B1*3');
  assert.equal(applyValues(changed, values, { recalc: false }).rows[1][b], '2000');
  assert.equal(applyValues(changed, values, { recalc: true }).rows[1][b], '3000');
  // 틀에 없는 칸 키는 버림
  assert.equal(applyValues(tpl, { 'x:none': '1' }, { recalc: false }).rows.length, 2);
});

test('이름 붙은 칸 값은 이름으로 복사', () => {
  const s = setApprovalCellValue(form(), 0, 1, '5,000');
  assert.deepEqual(namedValues(s), { amount: '5,000' });
});
