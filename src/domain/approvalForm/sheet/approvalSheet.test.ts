import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, cellKey, recalculate, type Sheet } from '@/lib/sheet/core';
import { CHECK_MARK, formulaErrorCells, hasAmountKeyCell, routeConditionSources, conditionHiddenRows, conditionMatches, conditionSources, requiredMissing, rowConditionOf, setRowCondition, draftInfoValue, linkFieldValues, linkIssues, linkSystemValues, nameLabel, SHEET_VALUES_KEY, SHEET_VERSION_KEY, draftInputOf, invalidNumberCells, isSecretCell, readSheetValues, sheetDocFields, APPROVAL_NS, approvalCellProps, setApprovalProp, setCellName, validateApprovalSheet, applyValues, canMergeApprovalRange, extractValues, isDraftEditable, isStructureLocked, namedValues, pasteDraftTsv, setApprovalCellValue } from './approvalSheet';
import { setCellMeta, setCellValue, setRowMeta } from '@/lib/sheet/core';

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
  assert.deepEqual(APPROVAL_NS, { input: 'input', name: 'name', bind: 'bind', lock: 'lock', secret: 'secret', seal: 'seal', repeat: 'repeat', extHide: 'extHide', guide: 'guide', autoNo: 'autoNo', sealMark: 'sealMark', logoMark: 'logoMark', required: 'required', showIf: 'showIf' });
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
  const [a, b, c] = s.cols;
  // 입력 칸·수식 칸은 빈 값도 담는다(빈 입력 칸 둘)
  assert.deepEqual(values, { [cellKey(0, b)]: '1000', [cellKey(1, b)]: '2000', [cellKey(0, c)]: '', [cellKey(1, a)]: '' });
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

test('비운 칸은 빈 값으로 저장한다 — 틀의 기본값·옛 수식 결과가 되살아나지 않게', () => {
  let tpl = createSheet(2, 2);
  // 기본값이 적힌 입력 칸(수량 5), 값을 넣으면 빈 칸이 되는 안내 수식
  tpl = setCellMeta(setCellValue(tpl, 0, 0, '5'), APPROVAL_NS.input, 0, 0, { type: 'number' });
  tpl = recalculate(setCellValue(tpl, 1, 0, '=IF(A1>0,"","수량을 입력하세요")'));
  const [a] = tpl.cols;
  // 기안자가 수량을 지움 → 다시 얹어도 빈 칸(틀의 5 가 비치지 않음)
  const cleared = extractValues(recalculate(setCellValue(tpl, 0, 0, '', { allowFormula: false })));
  assert.equal(cleared[cellKey(0, a)], '');
  assert.equal(applyValues(tpl, cleared, { recalc: true }).rows[0][a], '');
  // 틀의 수식 결과가 글자였다가 빈 칸이 됨 → 문서 보기(다시 계산 안 함)에도 빈 칸
  const emptyTpl = recalculate(setCellValue(tpl, 0, 0, '', { allowFormula: false }));
  assert.equal(emptyTpl.rows[1][a], '수량을 입력하세요');
  const filled = extractValues(recalculate(setCellValue(emptyTpl, 0, 0, '3', { allowFormula: false })));
  assert.equal(applyValues(emptyTpl, filled, { recalc: false }).rows[1][a], '');
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
  // 직접 쓴 칸 이름도 맨 위 칸으로 — 결재선 규칙 조건(기존 서식 키)이 읽는다
  const withName = setCellName(setCellValue(s, 1, 0, '식대'), 1, 0, 'expenseItem');
  assert.equal(sheetDocFields(withName, '발주@v3').expenseItem, '식대');
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

test('연동 칸 — 기간 칸은 period·period__end 로 나누고, 사람 칸은 사용자 ID, __link 함께', () => {
  let s = createSheet(3, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['연차', '반차'] });
  s = setCellName(s, 0, 1, 'leaveType');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'dateRange' });
  s = setCellName(s, 1, 1, 'period');
  s = setCellMeta(s, APPROVAL_NS.input, 2, 1, { type: 'user' });
  s = setCellName(s, 2, 1, 'substituteId');
  const [, b] = s.cols;
  s = setCellValue(s, 0, 1, '연차');
  s = setCellValue(s, 1, 1, '2026-11-10 ~ 2026-11-12');
  s = setCellValue(s, 2, 1, '신지웅 (부설기술연구소)');
  assert.deepEqual(linkFieldValues(s, '휴가', { [cellKey(2, b)]: 'U029' }), {
    __link: '휴가',
    leaveType: '연차',
    period: '2026-11-10',
    period__end: '2026-11-12',
    period__days: '', // 휴가 일수 칸이 없으면 빈 값 — 기안 화면이 미리 넣어 둔 1일이 남지 않게
    substituteId: 'U029',
  });
  // 끝 날짜를 안 고른 기간('시작 ~ ')은 끝 날짜를 빈 값으로 — 앞서 고른 끝 날짜가 문서에 남지 않게
  const half = setCellValue(s, 1, 1, '2026-11-20 ~ ');
  assert.equal(linkFieldValues(half, '휴가').period, '2026-11-20');
  assert.equal(linkFieldValues(half, '휴가').period__end, '');
  assert.deepEqual(linkFieldValues(s, null), {}); // 대체 서식이 없으면 아무것도 안 넣음
});

test('대체 서식 검사 — 휴일근무 근무 일자는 날짜 칸(글자·기간 칸이면 상신이 막히므로 저장 때 알린다)', () => {
  let s = createSheet(1, 1);
  s = setCellName(s, 0, 0, 'workDate');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'text' });
  assert.deepEqual(linkIssues(s, '휴일근무'), ["'근무 일자' 칸은 날짜 칸이어야 합니다."]);
  assert.equal(linkIssues(setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'dateRange' }), '휴일근무').length, 1);
  assert.deepEqual(linkIssues(setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'date' }), '휴일근무'), []);
});

test('대체 서식 검사 — 꼭 있어야 할 연동 칸', () => {
  let s = createSheet(2, 2);
  assert.equal(linkIssues(s, '휴가').length, 2); // 휴가 종류·휴가 기간
  s = setCellName(s, 0, 0, 'leaveType');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'select', options: ['연차'] });
  s = setCellName(s, 1, 0, 'period');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 0, { type: 'dateRange' });
  assert.deepEqual(linkIssues(s, '휴가'), []);
  assert.deepEqual(linkIssues(s, null), []);
  assert.equal(nameLabel('period'), '휴가 기간');
  assert.equal(nameLabel('amount'), '금액 키');
  assert.equal(nameLabel('품명'), '품명');
});

test('발주 연동 — 꼭 있어야 할 칸, 지급 조건은 반복 구간의 열', () => {
  // 0행: 도입기업·발주처·공급가액 / 2~3행: 지급 조건(구분·비율)
  let s = createSheet(4, 3);
  assert.equal(linkIssues(s, '발주').length, 3); // 도입기업·발주처·매입 공급가액
  s = setCellName(s, 0, 0, 'poClient');
  s = setCellName(s, 0, 1, 'poVendor');
  s = setCellName(s, 0, 2, 'poSupply');
  assert.deepEqual(linkIssues(s, '발주'), []); // 지급 조건 칸은 없어도 된다(대장이 한 번에 지급으로 봄)

  // 지급 구분을 반복 구간 밖에 두면 막는다
  s = setCellName(s, 2, 0, 'poTerm');
  assert.ok(linkIssues(s, '발주').some((m) => m.includes('지급 구분') && m.includes('반복 구간 안')));
  s = setRowMeta(s, APPROVAL_NS.repeat, 2, { id: 'pay', label: '지급 조건' });
  assert.deepEqual(linkIssues(s, '발주'), []);

  // 다른 구간에 흩어지면 같은 줄끼리 묶을 수 없다
  s = setCellName(s, 3, 1, 'poTermRate');
  s = setRowMeta(s, APPROVAL_NS.repeat, 3, { id: 'other', label: '다른 표' });
  assert.ok(linkIssues(s, '발주').some((m) => m.includes('같은 반복 구간')));
  assert.equal(nameLabel('poTerm'), '지급 구분');
});

test('발주 연동 — 문서 맨 위 칸에는 한 값짜리만(지급 조건 열은 __named 에만)', () => {
  let s = createSheet(3, 3);
  s = setCellName(s, 0, 0, 'poClient');
  s = setCellName(s, 0, 1, 'poVendor');
  s = setCellName(s, 0, 2, 'poSupply');
  s = setCellName(s, 2, 0, 'poTerm');
  s = setRowMeta(s, APPROVAL_NS.repeat, 2, { id: 'pay', label: '지급 조건' });
  s = setCellValue(s, 0, 0, '새솔테크');
  s = setCellValue(s, 0, 1, '(주)미르시스템');
  s = setCellValue(s, 0, 2, '40000000');
  s = setCellValue(s, 2, 0, '선금');
  assert.deepEqual(linkFieldValues(s, '발주'), { __link: '발주', poClient: '새솔테크', poVendor: '(주)미르시스템', poSupply: '40000000' });
});

test('휴가원 대체 — 휴가 종류 칸은 선택 칸, 항목은 휴가 정책 이름만', () => {
  let s = createSheet(2, 2);
  s = setCellName(s, 0, 1, 'leaveType');
  s = setCellName(s, 1, 1, 'period');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'date' });
  assert.ok(linkIssues(s, '휴가').some((m) => m.includes('선택 칸')));
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['연차', '반차(오전)'] });
  assert.ok(linkIssues(s, '휴가').some((m) => m.includes('반차(오전)')));
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['연차', '오전반차', '반반차'] });
  assert.deepEqual(linkIssues(s, '휴가'), []);
});

test('연동 검사 — 기간 이름은 날짜 칸·기간 칸(수식 칸은 그대로), 목록이 아닌 이름은 반복 구간 밖', () => {
  let s = createSheet(3, 2);
  s = setCellName(s, 0, 0, 'period');
  s = setCellName(s, 0, 1, 'destination');
  const dateMsg = (x: Sheet) => linkIssues(x, '외근').filter((m) => m.includes('날짜 칸이나 기간 칸'));
  // 입력 칸이 아니거나 글자 칸이면 막는다
  assert.equal(dateMsg(s).length, 1);
  assert.ok(dateMsg(s)[0].includes('외근 일자'));
  assert.equal(dateMsg(setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'text' })).length, 1);
  // 날짜 칸·기간 칸·수식 칸은 된다
  assert.deepEqual(linkIssues(setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'date' }), '외근'), []);
  assert.deepEqual(linkIssues(setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'dateRange' }), '외근'), []);
  assert.deepEqual(linkIssues(setCellValue(s, 0, 0, '=B3'), '외근'), []);

  // 목록이 아닌 연동 이름이 반복 구간 안에 있으면 막는다(연동 이름이 아닌 칸은 상관없음)
  s = setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'date' });
  s = setCellName(s, 1, 0, 'purpose');
  s = setCellName(s, 1, 1, '품명');
  assert.deepEqual(linkIssues(s, '외근'), []);
  s = setRowMeta(s, APPROVAL_NS.repeat, 1, { id: 'rows', label: '표' });
  const out = linkIssues(s, '외근');
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('목적') && out[0].includes('반복 구간 밖에 두세요'));

  // 발주는 예외 — 매입 결제 대장이 이름 값을 줄마다 읽는다(발주 내역을 품목 구간 안에 둔 서식이 실제로 있다)
  let po = createSheet(3, 3);
  po = setCellName(po, 0, 0, 'poClient');
  po = setCellName(po, 0, 1, 'poVendor');
  po = setCellName(po, 0, 2, 'poSupply');
  po = setCellName(po, 1, 0, 'poSummary');
  po = setRowMeta(po, APPROVAL_NS.repeat, 1, { id: 'items', label: '품목' });
  assert.deepEqual(linkIssues(po, '발주'), []);
});

test('시스템 계산 칸 — 휴가 일수(주말 제외, 반차 0.5)', () => {
  assert.deepEqual(linkSystemValues('휴가', { leaveType: '연차', period: '2026-11-13', period__end: '2026-11-17' }, []), { period__days: '3' });
  assert.deepEqual(linkSystemValues('휴가', { leaveType: '오전반차', period: '2026-11-13', period__end: '2026-11-17' }, []), { period__days: '0.5' });
  assert.deepEqual(linkSystemValues('외근', { period: '2026-11-13' }, []), {});
});

test('자동 채우기 — 기안 정보 칸 값', () => {
  const info = { drafter: '신지웅 연구원', dept: '부설기술연구소', date: '2026-11-04', docNo: 'AP-261104-001' };
  assert.equal(draftInfoValue('draft.drafter', info), '신지웅 연구원');
  assert.equal(draftInfoValue('draft.docNo', info), 'AP-261104-001');
  assert.equal(draftInfoValue('project.name', info), undefined);
  assert.equal(draftInfoValue(undefined, info), undefined);
  assert.equal(draftInfoValue('draft.date', undefined), undefined);
});

test('행 보이기 조건 — 조건 칸 값에 맞지 않는 행 숨김, 필수 검사·연동 값에서 빠짐', () => {
  // 0행: 지출 항목(선택, 이름 expenseItem) / 1행: 식대 분류(필수, 이름 sort_meal) / 2행: 교통비 분류
  let s = createSheet(4, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['식대', '교통비'] });
  s = setCellName(s, 0, 1, 'expenseItem');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'select', options: ['간식대', '야근식대'] });
  s = setCellMeta(s, APPROVAL_NS.required, 1, 1, true);
  s = setCellName(s, 1, 1, 'sort_meal');
  s = setCellValue(s, 1, 0, '분류');
  s = setRowCondition(s, 1, 1, { name: 'expenseItem', values: ['식대'] });
  s = setRowCondition(s, 2, 2, { name: 'expenseItem', values: ['교통비', '기타'] });
  assert.deepEqual(rowConditionOf(s, 2), { name: 'expenseItem', values: ['교통비', '기타'] });
  assert.deepEqual(conditionSources(s).map((x) => x.name), ['expenseItem', 'sort_meal']);

  // 아무것도 안 골랐으면 둘 다 숨김 — 숨은 필수 칸은 검사하지 않음
  assert.deepEqual([...conditionHiddenRows(s)].sort(), [1, 2]);
  assert.deepEqual(requiredMissing(s), []);

  // 식대 → 1행 보임(필수 검사 대상), 2행 숨김
  let meal = setCellValue(s, 0, 1, '식대');
  assert.deepEqual([...conditionHiddenRows(meal)], [2]);
  assert.deepEqual(requiredMissing(meal), ['분류']);
  meal = setCellValue(meal, 1, 1, '야근식대');
  assert.equal(sheetDocFields(meal, 'f@v1').sort_meal, '야근식대');

  // 식대 분류를 고른 뒤 교통비로 바꾸면 숨은 식대 분류 값은 연동 값에서 빈 값(결재선 조건에 안 걸리게)
  const bus = setCellValue(meal, 0, 1, '교통비');
  assert.deepEqual([...conditionHiddenRows(bus)], [1]);
  assert.equal(sheetDocFields(bus, 'f@v1').sort_meal, '');

  // 조건 칸 이름을 지우면 숨기지 않는다 / 조건 빼기
  assert.equal(conditionHiddenRows(setCellName(s, 0, 1, undefined)).size, 0);
  assert.equal(rowConditionOf(setRowCondition(s, 1, 2, undefined), 1), undefined);
});

test('행 보이기 조건 — 여러 선택·체크 칸, 숨은 조건 칸을 보는 행도 숨김', () => {
  assert.equal(conditionMatches('식대, 교통비', ['교통비']), true);
  assert.equal(conditionMatches('식대', ['교통비']), false);
  assert.equal(conditionMatches(CHECK_MARK, [CHECK_MARK]), true);
  let s = createSheet(3, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'checkbox' });
  s = setCellName(s, 0, 1, 'car');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'select', options: ['자차', '렌트'] });
  s = setCellName(s, 1, 1, 'carType');
  s = setCellValue(s, 1, 1, '렌트');
  s = setRowCondition(s, 1, 1, { name: 'car', values: [CHECK_MARK] });
  s = setRowCondition(s, 2, 2, { name: 'carType', values: ['렌트'] });
  // 체크 안 함 → 1행 숨김 → 1행 값(렌트)은 없는 셈 → 2행도 숨김
  assert.deepEqual([...conditionHiddenRows(s)].sort(), [1, 2]);
  assert.equal(conditionHiddenRows(setCellValue(s, 0, 1, CHECK_MARK)).size, 0);
});

test('병합 — 왼쪽 위 칸 기준, 가려지는 칸의 부품(입력 칸 등)은 빠진다(풀었다 다시 합쳐도 막히지 않게)', async () => {
  const { mergeApprovalRange, mergeCoversLinks, mergeDropsContent } = await import('./approvalSheet');
  let s = createSheet(1, 3);
  s = setApprovalProp(s, { r1: 0, c1: 0, r2: 0, c2: 2 }, APPROVAL_NS.input, { type: 'text' });
  s = setCellValue(s, 0, 0, '기타');
  const range = { r1: 0, c1: 0, r2: 0, c2: 2 };
  assert.equal(mergeCoversLinks(s, range), false);
  assert.equal(mergeDropsContent(s, range), false);
  const m = mergeApprovalRange(s, range);
  assert.equal(m.merges.length, 1);
  assert.equal(String(m.rows[0][m.cols[0]]), '기타');
  assert.deepEqual(Object.keys(m.cellMeta[APPROVAL_NS.input] ?? {}), [`0:${m.cols[0]}`]);
  // 가려지는 칸에 칸 이름이 있으면 알린다
  const named = setCellName(s, 0, 2, 'amount');
  assert.equal(mergeCoversLinks(named, range), true);
});

test('금액·숫자 입력 칸 — 정렬을 안 정했으면 오른쪽 정렬, 이미 정한 정렬은 그대로', () => {
  let s = createSheet(1, 3);
  s = setApprovalProp(s, { r1: 0, c1: 0, r2: 0, c2: 1 }, APPROVAL_NS.input, { type: 'currency' });
  assert.equal(s.styles[cellKey(0, s.cols[0])]?.align, 'right');
  assert.equal(s.styles[cellKey(0, s.cols[1])]?.align, 'right');
  // 글 입력은 그대로(정렬 없음)
  s = setApprovalProp(s, { r1: 0, c1: 2, r2: 0, c2: 2 }, APPROVAL_NS.input, { type: 'text' });
  assert.equal(s.styles[cellKey(0, s.cols[2])]?.align, undefined);
});

test('휴일근무 연동 — 편집기가 잠금을 고정하는 칸 이름(locked)과 기안 화면이 막는 칸(HOLIDAY_WORK_LOCKED_KEYS)이 같다', async () => {
  const { linkTypeDef } = await import('./approvalSheet');
  const { HOLIDAY_WORK_LOCKED_KEYS } = await import('@/domain/commute/overtimeDraft');
  const locked = (linkTypeDef('휴일근무')?.names ?? []).filter((n) => n.locked).map((n) => n.key);
  assert.deepEqual([...locked].sort(), [...HOLIDAY_WORK_LOCKED_KEYS].sort());
  // 다른 연동은 늘 잠그는 칸이 없다(휴가 일수는 입력 칸으로 두지 않는 계산 칸 — 따로)
  for (const code of ['휴가', '외근', '국내출장', '해외출장', '발주']) {
    assert.deepEqual((linkTypeDef(code)?.names ?? []).filter((n) => n.locked), [], code);
  }
});

test('입력 예시 — 글·숫자 칸만, 공백만이면 없음, 최대 길이', async () => {
  const { placeholderOf, PLACEHOLDER_MAX } = await import('./approvalSheet');
  assert.equal(placeholderOf({ type: 'text', placeholder: ' 예: 14:00 ' }), '예: 14:00');
  assert.equal(placeholderOf({ type: 'number', placeholder: '시간' }), '시간');
  assert.equal(placeholderOf({ type: 'text', placeholder: '   ' }), undefined);
  assert.equal(placeholderOf({ type: 'date', placeholder: '날짜' }), undefined);
  assert.equal(placeholderOf({ type: 'select', options: ['a'], placeholder: '고르기' }), undefined);
  assert.equal(placeholderOf({ type: 'text', placeholder: 'x'.repeat(100) })?.length, PLACEHOLDER_MAX);
  assert.equal(placeholderOf(undefined), undefined);
});

test('자동번호 칸 — 받은 번호는 값으로 남고(고쳐서 다시 올려도 같은 번호), 틀에 적은 글자는 번호로 치지 않는다', () => {
  let tpl = createSheet(2, 2);
  tpl = setCellValue(tpl, 0, 0, '발주번호');
  tpl = setCellValue(tpl, 0, 1, '(자동)'); // 관리자가 틀에 적어 둔 글자
  tpl = setCellMeta(tpl, 'autoNo', 0, 1, { prefix: 'PO' });
  const key = cellKey(0, tpl.cols[1]);
  // 새 기안 — 번호가 아직 없다
  const fresh = applyValues(tpl, {}, { recalc: true });
  assert.equal(extractValues(fresh)[key], undefined, '틀 글자는 값이 아니다');
  // 상신해서 번호를 받은 뒤 반려 → 편집 화면에서 다시 값을 뽑아도 번호가 남는다
  const issued = applyValues(tpl, { [key]: 'PO-2026-0001' }, { recalc: true });
  assert.equal(extractValues(issued)[key], 'PO-2026-0001');
});

test('연동 칸 — 동행자는 사람 칸이면 사용자 ID(여러 명은 쉼표), 글자 칸이면 쓴 글자', () => {
  let s = createSheet(2, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'date' });
  s = setCellName(s, 0, 1, 'period');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'users' });
  s = setCellName(s, 1, 1, 'companions');
  s = setCellValue(s, 0, 1, '2026-11-20');
  s = setCellValue(s, 1, 1, '김하나 (영업), 이두리 (영업)');
  const key = cellKey(1, s.cols[1]);
  const linked = linkFieldValues(s, '국내출장', { [key]: 'U001,U002' });
  assert.equal(linked.companions, 'U001,U002');
  assert.equal(linked.period__end, '', '날짜 칸 하나면 끝 날짜는 빈 값');
  assert.equal(linkFieldValues(s, '국내출장').companions, '김하나 (영업), 이두리 (영업)', 'ID 가 없으면(글자 칸) 글자 그대로');
});

test('결재선 규칙이 읽는 칸 — 금액 키 칸이 있는지, 선택 값 조건 후보(이름 붙은 선택 칸)', () => {
  let s = createSheet(5, 2);
  s = setCellValue(s, 0, 0, '지출 항목');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['식대', '교통비', ' ', '식대'] });
  s = setCellName(s, 0, 1, 'expenseItem');
  // 이름 없는 선택 칸·여러 개 선택 칸·글자 칸은 후보가 아니다
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'select', options: ['가', '나'] });
  s = setCellMeta(s, APPROVAL_NS.input, 2, 1, { type: 'multiSelect', options: ['A', 'B'] });
  s = setCellName(s, 2, 1, 'tags');
  s = setCellMeta(s, APPROVAL_NS.input, 3, 1, { type: 'text' });
  s = setCellName(s, 3, 1, 'memo');
  assert.deepEqual(routeConditionSources(s), [{ key: 'expenseItem', label: '지출 항목', options: ['식대', '교통비'] }]);
  // 후보 칸 값은 문서 맨 위 칸(칸 이름 = 키)으로 나간다 — 규칙 엔진이 읽는 자리
  assert.equal(sheetDocFields(setCellValue(s, 0, 1, '교통비'), 'f@v1').expenseItem, '교통비');

  assert.equal(hasAmountKeyCell(s), false);
  let withAmount = setCellMeta(s, APPROVAL_NS.input, 4, 1, { type: 'currency' });
  withAmount = setCellName(withAmount, 4, 1, 'amount');
  assert.equal(hasAmountKeyCell(withAmount), true);

  // 반복 구간 안 이름은 맨 위 칸으로 나가지 않는다 — 금액 키도 선택 칸도 없는 것으로 본다
  let inRepeat = setRowMeta(withAmount, APPROVAL_NS.repeat, 4, { id: 'items', label: '품목' });
  inRepeat = setRowMeta(inRepeat, APPROVAL_NS.repeat, 0, { id: 'items', label: '품목' });
  assert.equal(hasAmountKeyCell(inRepeat), false);
  assert.deepEqual(routeConditionSources(inRepeat), []);
  assert.ok(!('amount' in sheetDocFields(inRepeat, 'f@v1')));
});

test('계산이 안 되는 수식 칸 — 숫자 자리에 글자가 들면 이름을, 빈 칸·숫자는 괜찮음', () => {
  let s = createSheet(2, 3);
  const [a, b, c] = s.cols;
  s = setCellValue(s, 0, 0, '수량');
  s = setCellValue(s, 0, 2, '공급가액');
  s = { ...s, formulas: { [cellKey(1, c)]: '=A2*B2' } };
  s = setCellMeta(setCellMeta(s, APPROVAL_NS.input, 1, 0, { type: 'text' }), APPROVAL_NS.input, 1, 1, { type: 'number' });
  assert.deepEqual(formulaErrorCells(recalculate(s)), []); // 빈 칸
  assert.deepEqual(formulaErrorCells(recalculate(setCellValue(setCellValue(s, 1, 0, '2'), 1, 1, '1500'))), []);
  assert.deepEqual(formulaErrorCells(recalculate(setCellValue(setCellValue(s, 1, 0, '세 개'), 1, 1, '1500'))), ['공급가액']); // 옆 입력 칸 값이 아니라 표 머리
  void a; void b;
});

test('외근·출장 연동 — 업무 대행자(사용자 ID)·긴급 연락처도 옛 서식처럼 문서 값에', () => {
  for (const link of ['외근', '국내출장', '해외출장']) {
    let s = createSheet(3, 2);
    s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'date' });
    s = setCellName(s, 0, 1, 'period');
    s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'user' });
    s = setCellName(s, 1, 1, 'substituteId');
    s = setCellMeta(s, APPROVAL_NS.input, 2, 1, { type: 'text' });
    s = setCellName(s, 2, 1, 'emergencyContact');
    const [, b] = s.cols;
    s = setCellValue(setCellValue(setCellValue(s, 0, 1, '2026-12-14'), 1, 1, 'testB (테스트)'), 2, 1, '010-1234-5678');
    const v = linkFieldValues(s, link, { [cellKey(1, b)]: 'U026' });
    assert.equal(v.substituteId, 'U026', link);
    assert.equal(v.emergencyContact, '010-1234-5678', link);
  }
});
