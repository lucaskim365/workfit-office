import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, cellKey, type Sheet } from '@/lib/sheet';
import { SHEET_VALUES_KEY, SHEET_VERSION_KEY, draftInputOf, invalidNumberCells, isSecretCell, readSheetValues, sheetDocFields, APPROVAL_NS, approvalCellProps, setApprovalProp, setCellName, validateApprovalSheet, applyValues, canMergeApprovalRange, extractValues, isDraftEditable, isStructureLocked, namedValues, pasteDraftTsv, setApprovalCellValue } from './approvalSheet';
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

test('칸 속성 — 범위에 넣고 빼기, 병합에 가려진 칸은 건너뜀', () => {
  let s = createSheet(3, 3);
  s = { ...s, merges: [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }] };
  const all = { r1: 0, c1: 0, r2: 1, c2: 1 };
  s = setApprovalProp(s, all, APPROVAL_NS.input, { type: 'text' });
  const [a, b] = s.cols;
  assert.ok(s.cellMeta.input[cellKey(0, a)]);
  assert.equal(s.cellMeta.input[cellKey(0, b)], undefined); // 가려진 칸
  assert.ok(s.cellMeta.input[cellKey(1, a)]);
  assert.ok(s.cellMeta.input[cellKey(1, b)]);
  assert.deepEqual(approvalCellProps(s, 1, 1).input, { type: 'text' });
  s = setApprovalProp(s, all, APPROVAL_NS.input, undefined);
  assert.equal(s.cellMeta.input, undefined);
  s = setApprovalProp(s, { r1: 2, c1: 2, r2: 2, c2: 2 }, APPROVAL_NS.lock, true);
  assert.equal(approvalCellProps(s, 2, 2).lock, true);
  s = setApprovalProp(s, { r1: 2, c1: 2, r2: 2, c2: 2 }, APPROVAL_NS.lock, false);
  assert.equal(approvalCellProps(s, 2, 2).lock, false);
});

test('칸 이름은 서식에 하나 — 다른 칸에 붙이면 옛 칸에서 떨어진다', () => {
  let s = createSheet(2, 2);
  s = setCellName(s, 0, 0, 'amount');
  s = setCellName(s, 1, 1, 'amount');
  assert.equal(approvalCellProps(s, 0, 0).name, undefined);
  assert.equal(approvalCellProps(s, 1, 1).name, 'amount');
  s = setCellName(s, 1, 1, 'body'); // 한 칸엔 이름 하나
  assert.deepEqual(Object.values(s.cellMeta.name), ['body']);
  s = setCellName(s, 1, 1, undefined);
  assert.equal(s.cellMeta.name, undefined);
});

test('저장 전 검사 — 입력 칸 없음, 빈 선택 칸, 수식 입력 칸, 숫자 아닌 금액키', () => {
  assert.equal(validateApprovalSheet(createSheet(2, 2)).length, 1);
  let s = createSheet(2, 3);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'select', options: [' '] });
  s = setCellValue(s, 0, 1, '=1+1');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'number' });
  s = setCellMeta(s, APPROVAL_NS.input, 1, 0, { type: 'text' });
  s = setCellName(s, 1, 0, 'amount');
  const errs = validateApprovalSheet(s);
  assert.equal(errs.length, 3);
  assert.match(errs[0], /^A1: 선택 칸/);
  assert.match(errs[1], /^B1: 수식 칸/);
  assert.match(errs[2], /^A2: '금액 키'/);

  let ok = createSheet(2, 2);
  ok = setCellMeta(ok, APPROVAL_NS.input, 0, 0, { type: 'currency' });
  ok = setCellName(ok, 0, 0, 'amount');
  ok = setCellValue(ok, 1, 1, '=A1*2');
  ok = setCellName(ok, 1, 1, 'body'); // 수식 칸에 이름 — 문제 없음
  assert.deepEqual(validateApprovalSheet(ok), []);
});

test('문서 저장 — 칸 값·서식 버전·이름 붙은 칸 값을 fieldValues 로, 다시 읽기', () => {
  const tpl = form();
  const s = setCellValue(tpl, 0, 1, '1500');
  const fields = sheetDocFields(s, '발주@v3');
  assert.equal(fields[SHEET_VERSION_KEY], '발주@v3');
  assert.equal(fields.amount, '1500'); // 칸 이름 amount
  const vals = readSheetValues(fields[SHEET_VALUES_KEY]);
  const [, b] = s.cols;
  assert.equal(vals[cellKey(0, b)], '1500');
  assert.equal(vals[cellKey(1, b)], '3000'); // 수식 결과도 남김
  assert.deepEqual(readSheetValues('깨진 {'), {});
  assert.deepEqual(readSheetValues(undefined), {});
  assert.deepEqual(readSheetValues('{"a":1,"b":"x"}'), { b: 'x' }); // 글자만
});

test('기안 입력 종류 — 고칠 수 있는 칸만, 숫자 칸 검사', () => {
  const tpl = form();
  assert.deepEqual(draftInputOf(tpl, 0, 1), { type: 'currency' });
  assert.equal(draftInputOf(tpl, 0, 2), undefined); // 잠금
  assert.equal(draftInputOf(tpl, 0, 0), undefined); // 라벨
  assert.deepEqual(invalidNumberCells(setCellValue(tpl, 0, 1, '천원')), ['B1']);
  assert.deepEqual(invalidNumberCells(setCellValue(tpl, 0, 1, '1,500')), []);
  assert.deepEqual(invalidNumberCells(tpl), []); // 빈 칸은 괜찮음
});

test('비공개 칸 — 칸·행·열', () => {
  let s = createSheet(3, 3);
  s = setCellMeta(s, APPROVAL_NS.secret, 0, 0, true);
  s = { ...s, rowMeta: { secret: { '1': true } }, colMeta: { secret: { [s.cols[2]]: true } } };
  assert.equal(isSecretCell(s, 0, 0), true);
  assert.equal(isSecretCell(s, 1, 1), true);
  assert.equal(isSecretCell(s, 2, 2), true);
  assert.equal(isSecretCell(s, 2, 1), false);
});
