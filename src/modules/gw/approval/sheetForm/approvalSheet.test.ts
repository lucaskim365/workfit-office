import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, cellKey, type Sheet } from '@/lib/sheet';
import { APPROVAL_NS, isStructureLocked, setApprovalCellValue } from './approvalSheet';

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
