import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, recalculate, setCellMeta, setCellValue, setRowMeta, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues } from './approvalSheet';
import { fillFromListXlsx, listXlsxAliasesOf } from './listExcel';
import { expandRepeats } from './repeatRows';

const HEAD = ['NO', '날짜', '사용처', '금액', '참석자', '고객 및 협력사', '내역'];

/**
 * 법인카드 사용 내역서 모양 — 0 제목, 1 사용자(한 칸), 2 표 머리, 3~5 내용 줄(반복 구간: 번호·날짜('2026.' 미리 씀)·사용처·금액…), 6 합계
 */
function template(): Sheet {
  let s = createSheet(7, HEAD.length);
  const put = (r: number, c: number, v: string) => (s = setCellValue(s, r, c, v));
  const input = (r: number, c: number, v: object) => (s = setCellMeta(s, APPROVAL_NS.input, r, c, v));
  put(0, 0, '법인카드 사용 내역서');
  put(1, 0, '카드 사용자');
  input(1, 1, { type: 'text' });
  HEAD.forEach((t, c) => put(2, c, t));
  for (let r = 3; r <= 5; r++) {
    put(r, 0, String(r - 2));
    put(r, 1, '2026.');
    HEAD.forEach((_, c) => input(r, c, { type: c === 3 ? 'currency' : 'text' }));
    s = setRowMeta(s, APPROVAL_NS.repeat, r, { id: 'items', label: '사용 내역' });
  }
  put(6, 0, '합계');
  put(6, 3, '=SUM(D4:D6)');
  return recalculate(s);
}

/** 엑셀 시트 — 줄마다 글자들 */
function xlsxOf(rows: string[][]): Sheet {
  let s = createSheet(rows.length, Math.max(...rows.map((r) => r.length)));
  rows.forEach((row, r) => row.forEach((v, c) => (s = setCellValue(s, r, c, v, { allowFormula: false }))));
  return s;
}

/** 카드사 이용내역 모양 — 제목 줄, 열 제목, 최근 것부터 */
const CARD = [
  ['합계 : 매출금액 - 카드번호: 4289-****-****-0000에 대한 세부 정보'],
  ['NO', '이용일자', '매입일자', '구분', '가맹점명', '매출금액', '할인금액', '참석자', '내역'],
  ['770', '2026.11.17', '2026.11.18', '국내', '철도승차권', '41700', '0', '홍길동', '출장'],
  ['660', '2026.11.10', '2026.11.11', '국내', '택시', '10900', '0', '', ''],
  ['82', '2026.10.07', '2026.10.08', '국내', '부부식당', '10000', '0', '김영희', '중식대'],
  ['85', '2026.10.07', '2026.10.08', '국내', '철도승차권', '29200', '0', '', ''],
];

const aliases = listXlsxAliasesOf({ code: '법인카드', name: '법인카드 사용 내역서' });

const fill = (xlsx: Sheet, over: Partial<Parameters<typeof fillFromListXlsx>[0]> = {}) => {
  const tpl = over.template ?? template();
  const res = fillFromListXlsx({ extras: {}, values: {}, refs: {}, xlsx, aliases, ...over, template: tpl });
  assert.ok(res.ok, res.ok ? '' : res.error);
  const sheet = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  /** 표의 줄들(3행부터 rows 줄) */
  const table = Array.from({ length: res.rows }, (_, k) => sheet.cols.map((col) => String(sheet.rows[3 + k][col] ?? '')));
  return { res, sheet, table };
};

test('카드 이용내역 — 정해 둔 서식만 카드사 열 제목을 표 머리글에 맞춘다', () => {
  assert.deepEqual(aliases, { 날짜: ['이용일자'], 금액: ['매출금액'], 사용처: ['가맹점명'], 참석자: ['사용자'], '고객 및 협력사': ['거래처'], 기타: ['비고'] });
  assert.ok(listXlsxAliasesOf({ code: 'x', name: '개인 경비 사용 신청서' }));
  assert.ok(listXlsxAliasesOf({ code: 'x', name: '개인경비 사용신청서' }));
  assert.ok(listXlsxAliasesOf({ code: '개인경비_운영시험', name: '(운영본) 개인 경비 사용 신청서' }));
  assert.equal(listXlsxAliasesOf({ code: '품의', name: '품의서' }), undefined);
});

test('열 제목으로 맞추고, 날짜 빠른 순으로 놓고, 번호는 엑셀 것을 버리고 1부터', () => {
  const { res, table, sheet } = fill(xlsxOf(CARD));
  assert.equal(res.rows, 4);
  assert.equal(res.rowDelta, 1);
  assert.deepEqual(res.extras, { items: 1 });
  assert.equal(res.sortedBy, '날짜');
  assert.deepEqual(res.columns, [
    { label: '날짜', header: '이용일자' },
    { label: '사용처', header: '가맹점명' },
    { label: '금액', header: '매출금액' },
    { label: '참석자', header: '참석자' },
    { label: '내역', header: '내역' },
  ]);
  assert.deepEqual(table, [
    // 최근 것부터 적힌 엑셀 — 같은 날의 줄도 아래 줄(먼저 쓴 것)이 위로
    ['1', '2026.10.07', '철도승차권', '29200', '', '', ''],
    ['2', '2026.10.07', '부부식당', '10000', '김영희', '', '중식대'],
    ['3', '2026.11.10', '택시', '10900', '', '', ''],
    ['4', '2026.11.17', '철도승차권', '41700', '홍길동', '', '출장'],
  ]);
  // 합계 줄은 늘어난 줄까지 더한다
  assert.equal(sheet.rows[7][sheet.cols[3]], '91800');
  assert.deepEqual(res.notes, ["엑셀에 같은 제목의 열이 없어 비워 둔 열: 고객 및 협력사"]);
});

test('제목이 두 줄이면(위에 서식 머리글, 아래에 카드사 제목) 둘 다 본다', () => {
  const rows = [
    CARD[0],
    ['', '날짜', '', '', '사용처', '금액', '', '참석자', '고객 및 협력사', '내역'],
    ['NO', '이용일자', '매입일자', '구분', '가맹점명', '매출금액', '할인금액', '사용자', '거래처', '내역'],
    ['5', '2026.11.02', '2026.11.03', '국내', '식당', '8000', '0', '홍길동', '서천산업', '석식'],
    ['4', '2026.11.01', '2026.11.02', '국내', '택시', '5000', '0', '홍길동', '효광', ''],
  ];
  const { res, table } = fill(xlsxOf(rows));
  assert.deepEqual(table, [
    ['1', '2026.11.01', '택시', '5000', '홍길동', '효광', ''],
    ['2', '2026.11.02', '식당', '8000', '홍길동', '서천산업', '석식'],
  ]);
  assert.equal(res.rowDelta, -1);
  assert.deepEqual(res.extras, { items: -1 });
  assert.deepEqual(res.notes, []);
});

test('다른 이름을 정하지 않은 서식은 같은 글자·품은 글자로만 맞춘다', () => {
  const rows = [
    ['순번', '날짜', '사용처(가맹점)', '매출금액', '할인금액'],
    ['9', '2026-11-03', '식당', '8000', '0'],
  ];
  const { res, table } = fill(xlsxOf(rows), { aliases: undefined });
  // '금액'을 품은 열이 둘(매출금액·할인금액)이라 어느 열인지 몰라 받지 않는다
  assert.deepEqual(res.columns, [
    { label: '날짜', header: '날짜' },
    { label: '사용처', header: '사용처(가맹점)' },
  ]);
  assert.deepEqual(table, [['1', '2026-11-03', '식당', '', '', '', '']]);
  assert.deepEqual(res.extras, { items: -2 });
});

test('표 밖의 값은 그대로, 표에 쓴 값은 엑셀 내용으로 바뀐다. 빈 줄·합계 줄은 받지 않는다', () => {
  const tpl = template();
  const values = { [cellKey(1, tpl.cols[1])]: '강윤석', [cellKey(3, tpl.cols[2])]: '화면에서 쓴 곳', [cellKey(5, tpl.cols[6])]: '화면 메모' };
  const rows = [...CARD.slice(1, 3), [], ['합계', '', '', '', '', '41700']];
  const { res, sheet, table } = fill(xlsxOf(rows), { template: tpl, values });
  assert.equal(res.rows, 1);
  assert.equal(sheet.rows[1][sheet.cols[1]], '강윤석');
  assert.deepEqual(table, [['1', '2026.11.17', '철도승차권', '41700', '홍길동', '', '출장']]);
  // 합계 줄(틀의 6행)이 줄어든 표 바로 아래로
  assert.equal(sheet.rows[4][sheet.cols[0]], '합계');
  assert.equal(sheet.rows[4][sheet.cols[3]], '41700');
});

test('머리글 줄이 입력 칸인 서식(개인 경비 사용 신청서) — 기안자가 고쳐 쓴 머리글로 맞춘다', () => {
  let tpl = template();
  HEAD.forEach((_, c) => (tpl = setCellMeta(tpl, APPROVAL_NS.input, 2, c, { type: 'text' })));
  const plain = fill(xlsxOf(CARD), { template: tpl });
  assert.equal(plain.res.columns.length, 5);
  assert.equal(plain.res.rows, 4);
  // '내역'을 '적요'로 고쳐 썼으면 엑셀의 '적요' 열을 받는다
  const values = { [cellKey(2, tpl.cols[6])]: '적요' };
  const rows = [['이용일자', '가맹점명', '매출금액', '적요', '내역'], ['2026.11.01', '식당', '8000', '석식', '다른 글']];
  const renamed = fill(xlsxOf(rows), { template: tpl, values });
  assert.deepEqual(renamed.res.columns.map((x) => x.label), ['날짜', '사용처', '금액', '적요']);
  assert.equal(renamed.sheet.rows[2][tpl.cols[6]], '적요');
  assert.equal(renamed.sheet.rows[3][tpl.cols[6]], '석식');
});

test('날짜가 섞여 적힌 엑셀은 날짜가 같은 줄을 엑셀 차례 그대로 둔다', () => {
  const rows = [
    ['날짜', '사용처', '금액'],
    ['2026.11.02', '가', '1'],
    ['2026.11.01', '나', '2'],
    ['2026.11.02', '다', '3'],
    ['', '날짜 없음', '4'],
    ['2026.11.01', '라', '5'],
  ];
  const { table } = fill(xlsxOf(rows));
  assert.deepEqual(table.map((r) => r[2]), ['나', '라', '가', '다', '날짜 없음']);
  assert.deepEqual(table.map((r) => r[0]), ['1', '2', '3', '4', '5']);
});

test('열 제목을 찾지 못하면 받지 않고 알린다', () => {
  const tpl = template();
  const res = fillFromListXlsx({ template: tpl, extras: {}, values: {}, refs: {}, xlsx: xlsxOf([['가', '나'], ['1', '2']]), aliases });
  assert.ok(!res.ok);
  assert.match(res.error, /열 제목을 찾지 못했습니다/);
  const none = fillFromListXlsx({ template: tpl, extras: {}, values: {}, refs: {}, xlsx: xlsxOf([CARD[1]]), aliases });
  assert.ok(!none.ok);
  assert.match(none.error, /내용 줄이 없습니다/);
});

test('칸 종류에 맞지 않는 값은 받지 않고 알린다', () => {
  const rows = [CARD[1], ['1', '2026.11.17', '', '', '식당', '만원', '0', '', '']];
  const { res, table } = fill(xlsxOf(rows));
  assert.equal(table[0][3], '');
  assert.match(res.notes.join('\n'), /맞지 않는 값이라 받지 않았습니다: 금액 1번째 줄\(만원\)/);
});

test("합계 줄은 글자가 조금 달라도 받지 않는다 — '합계(2건)', '국내 소계'", () => {
  const rows = [CARD[1], CARD[2], ['국내 소계', '', '', '', '', '41700'], CARD[3], ['합계(2건)', '', '', '', '', '52600']];
  const { res, sheet } = fill(xlsxOf(rows));
  assert.equal(res.rows, 2);
  assert.equal(sheet.rows[5][sheet.cols[3]], '52600');
});

test('합계 낱말이 든 내용 줄은 받는다. 번호 열의 맺음 글(총 3건)은 받지 않는다', () => {
  const rows = [
    ['가맹점명', '이용일자', '매출금액'],
    ['야근 식대 합계', '2026.11.02', '100'],
    ['Total Wine 구입', '2026.11.01', '200'],
    ['합계', '', '300'],
  ];
  const first = fill(xlsxOf(rows));
  assert.deepEqual(first.table.map((r) => r[2]), ['Total Wine 구입', '야근 식대 합계']);
  const closing = fill(xlsxOf([CARD[1], CARD[2], CARD[3], ['총 2건', '', '', '', '', '52600']]));
  assert.equal(closing.res.rows, 2);
  assert.equal(closing.res.sortedBy, '날짜');
});

test('줄이 적어도 날짜가 아닌 값 한 줄 때문에 정렬이 꺼지지 않는다', () => {
  const rows = [['날짜', '사용처', '금액'], ['2026.11.02', '가', '1'], ['미정', '나', '2'], ['2026.11.01', '다', '3']];
  const { res, table } = fill(xlsxOf(rows));
  assert.equal(res.sortedBy, '날짜');
  assert.deepEqual(table.map((r) => r[2]), ['다', '가', '나']);
});

test('엑셀 맨 위의 긴 제목 줄은 열 제목이 아니다 — 엉뚱한 열(엑셀 NO)을 맞추지 않는다', () => {
  const rows = [['법인카드 이용 내역 (금액 단위: 원)'], ['NO', '이용일자', '가맹점명', '매출금액', '비고'], ['660', '2026.11.10', '택시', '10900', ''], ['770', '2026.11.17', '식당', '8000', '']];
  const { res, table } = fill(xlsxOf(rows));
  assert.deepEqual(res.columns.map((x) => `${x.label}←${x.header}`), ['날짜←이용일자', '사용처←가맹점명', '금액←매출금액']);
  assert.deepEqual(table.map((r) => r[6]), ['', '']);
});

test('머리글 낱말이 든 내용 줄을 제목으로 삼키지 않는다', () => {
  const rows = [CARD[1], ['1', '2026.11.01', '2026.11.02', '국내', '참석자 식대 식당', '8000', '0', '홍길동', '출장 내역 정산'], CARD[2]];
  const { res, table } = fill(xlsxOf(rows));
  assert.equal(res.rows, 2);
  assert.equal(table[0][2], '참석자 식대 식당');
  assert.equal(res.columns.find((x) => x.label === '사용처')?.header, '가맹점명');
});

test('엑셀에서 숨긴 줄(필터)은 받지 않고 알린다', () => {
  const xlsx = xlsxOf(CARD);
  const { res, table } = fill({ ...xlsx, rowHeights: { ...xlsx.rowHeights, '3': 0 } });
  assert.equal(res.rows, 3);
  assert.ok(!table.some((r) => r[2] === '택시'));
  assert.match(res.notes.join(' '), /숨긴 줄.* 1줄은 받지 않았습니다/);
});

test('통째로 빈 줄 아래는 받지 않고 알린다', () => {
  const rows = [CARD[1], CARD[2], [], ['메모', '2026.11.30', '', '', '정산 메모', '1']];
  const { res } = fill(xlsxOf(rows));
  assert.equal(res.rows, 1);
  assert.match(res.notes.join('\n'), /빈 줄 아래에 있는 1줄은 받지 않았습니다/);
});

test('표 아래 줄의 값·사람 칸 ID 는 제 줄을 따라가고, 표 안의 엑셀로 못 받는 칸 값은 남는다', () => {
  let tpl = template();
  tpl = setCellMeta(tpl, APPROVAL_NS.input, 6, 1, { type: 'user' });
  tpl = setCellMeta(tpl, APPROVAL_NS.name, 3, 5, 'client');
  const values = { [cellKey(6, tpl.cols[1])]: '홍길동 (영업팀)', [cellKey(3, tpl.cols[5])]: '고른 거래처', [cellKey(4, tpl.cols[4])]: '옛 참석자' };
  const refs = { [cellKey(6, tpl.cols[1])]: 'u1', [cellKey(4, tpl.cols[4])]: 'old' };
  const { res, sheet } = fill(xlsxOf(CARD), { template: tpl, values, refs, skipNames: ['client'] });
  assert.equal(res.rows, 4);
  // 합계 줄(틀 6행)은 7행으로 — 값과 ID 가 같이 간다
  assert.equal(sheet.rows[7][tpl.cols[1]], '홍길동 (영업팀)');
  assert.deepEqual(res.refs, { [cellKey(7, tpl.cols[1])]: 'u1' });
  assert.equal(sheet.rows[3][tpl.cols[5]], '고른 거래처');
});

test('받은 양식 모양인데 숨은 표시가 사라진 파일은 받지 않는다', () => {
  const tpl = template();
  const rows = tpl.rows.map((row) => tpl.cols.map((col) => String(row[col] ?? '')));
  rows[3][2] = '식당';
  const res = fillFromListXlsx({ template: tpl, extras: {}, values: {}, refs: {}, xlsx: xlsxOf(rows), aliases });
  assert.ok(!res.ok);
  assert.match(res.error, /숨은 표시가 사라져/);
});

test('날짜 칸 서식 — 시각이 붙은 날짜도 받고, 같은 날은 시각 순. 날짜가 아닌 줄은 맨 뒤로 보내고 알린다', () => {
  let tpl = template();
  for (let r = 3; r <= 5; r++) tpl = setCellMeta(tpl, APPROVAL_NS.input, r, 1, { type: 'date' });
  const rows = [
    ['날짜', '사용처', '금액'],
    ['2026.11.17 18:00', '저녁', '1'],
    ['취소', '취소 건', '2'],
    ['2026.11.17 09:00', '아침', '3'],
    ['20261110', '지난주', '4'],
    ['2026-11-18', '다음 날', '5'],
    ['2026/11/16', '전날', '6'],
  ];
  const { res, table } = fill(xlsxOf(rows), { template: tpl });
  assert.deepEqual(table.map((r) => `${r[1]} ${r[2]}`), ['2026-11-10 지난주', '2026-11-16 전날', '2026-11-17 아침', '2026-11-17 저녁', '2026-11-18 다음 날', ' 취소 건']);
  assert.match(res.notes.join('\n'), /날짜로 읽지 못한 1줄은 맨 뒤에/);
});

test("한 줄짜리 표에 미리 적은 '1'은 번호가 아니다", () => {
  let s = createSheet(3, 2);
  [['품명', '수량'], ['', '1']].forEach((row, r) => row.forEach((v, c) => (s = setCellValue(s, r, c, v))));
  for (let c = 0; c < 2; c++) s = setCellMeta(s, APPROVAL_NS.input, 1, c, { type: 'text' });
  s = recalculate(setRowMeta(s, APPROVAL_NS.repeat, 1, { id: 'i', label: '품목' }));
  const res = fillFromListXlsx({ template: s, extras: {}, values: {}, refs: {}, xlsx: xlsxOf([['품명', '수량'], ['볼트', '50'], ['너트', '70']]) });
  assert.ok(res.ok);
  assert.equal(res.numbered, false);
  assert.equal(res.values[cellKey(2, s.cols[1])], '70');
});

test('카드사 제목만 있는 엑셀 — 사용자는 참석자로, 거래처는 고객 및 협력사로', () => {
  const rows = [['NO', '이용일자', '가맹점명', '매출금액', '비고', '사용자', '거래처', '가맹점주소'], ['7', '2026.10.01', '택시', '9300', '출장', '김승기', '씨엠텍', '서울 중구']];
  const { res, table } = fill(xlsxOf(rows));
  assert.deepEqual(res.columns.map((x) => x.label + '←' + x.header), ['날짜←이용일자', '사용처←가맹점명', '금액←매출금액', '참석자←사용자', '고객 및 협력사←거래처']);
  assert.deepEqual(table, [['1', '2026.10.01', '택시', '9300', '김승기', '씨엠텍', '']]);
});
