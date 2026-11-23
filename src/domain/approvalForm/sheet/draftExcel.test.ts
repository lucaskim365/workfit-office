import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, exportXlsx, importXlsx, insertRow, recalculate, setCellMeta, setCellValue, setRowMeta, xlsxDefinedNames, type Sheet, type XlsxNames } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, extractValues, type SheetValues } from './approvalSheet';
import { draftXlsxExport, fillFromXlsx, hasXlsxFillCells } from './draftExcel';
import { expandRepeats, type RowExtras } from './repeatRows';
import { unzip, zip } from '@/lib/sheet/zip';

const KEY = 'expense@v3';

/**
 * 경비 신청서 모양 — 0 제목, 1 정산기간(날짜 범위), 2 표 머리, 3~5 내용 줄(반복 구간: 번호·내역·금액·구분·담당자), 6 합계
 */
function template(): Sheet {
  let s = createSheet(7, 5);
  const put = (r: number, c: number, v: string) => (s = setCellValue(s, r, c, v));
  const input = (r: number, c: number, v: object) => (s = setCellMeta(s, APPROVAL_NS.input, r, c, v));
  put(0, 0, '개인 경비 사용 신청서');
  put(1, 0, '정산기간');
  input(1, 1, { type: 'dateRange' });
  ['NO', '내역', '금액', '구분', '담당자'].forEach((t, c) => put(2, c, t));
  for (let r = 3; r <= 5; r++) {
    put(r, 0, String(r - 2));
    input(r, 0, { type: 'text' });
    input(r, 1, { type: 'text' });
    input(r, 2, { type: 'currency' });
    input(r, 3, { type: 'select', options: ['식대', '교통'] });
    input(r, 4, { type: 'user' });
    s = setRowMeta(s, APPROVAL_NS.repeat, r, { id: 'items', label: '상세내역' });
  }
  put(6, 0, '합계');
  put(6, 2, '=SUM(C4:C6)');
  return recalculate(s);
}

/** 화면 → 엑셀 파일 → 다시 읽기 */
async function roundTrip(tpl: Sheet, extras: RowExtras, values: SheetValues) {
  const sheet = applyValues(expandRepeats(tpl, extras), values, { recalc: true });
  const out = draftXlsxExport({ sheet, template: tpl, extras, formKey: KEY });
  const bytes = await exportXlsx(out.sheet, out.options);
  const xlsx = (await importXlsx(bytes, { ignorePrintArea: true })).sheet;
  return { xlsx, names: await xlsxDefinedNames(bytes) };
}

/** 엑셀에서 at 줄 위에 빈 줄을 넣은 것처럼 — 아래 줄을 가리키던 이름이 한 줄씩 내려간다 */
function excelInsertRow(xlsx: Sheet, names: XlsxNames, at: number): { xlsx: Sheet; names: XlsxNames } {
  return { xlsx: insertRow(xlsx, at), names: { ...names, rows: Object.fromEntries(Object.entries(names.rows).map(([k, r]) => [k, r >= at ? r + 1 : r])) } };
}

const setX = (xlsx: Sheet, r: number, c: number, v: string) => setCellValue(xlsx, r, c, v, { allowFormula: false });

test('받은 그대로 올리면 바뀌는 것이 없다', async () => {
  const tpl = template();
  const values = extractValues(applyValues(tpl, { [cellKey(3, tpl.cols[1])]: '점심', [cellKey(3, tpl.cols[2])]: '12000' }, { recalc: true }));
  const { xlsx, names } = await roundTrip(tpl, {}, values);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: {}, xlsx, names });
  assert.ok(res.ok);
  assert.equal(res.changed, 0);
  assert.equal(res.rowDelta, 0);
  assert.deepEqual(res.notes, []);
  assert.deepEqual(res.extras, {});
});

test('숫자처럼 보이는 글도 받은 그대로 — 점으로 끝나는 연도, 콤마 든 글, 소수 자리 금액, 화면이 그리는 제목', async () => {
  let tpl = template();
  // 내역 칸(글)에 '2026.'·'1,000', 금액 칸에 '12000.50'
  tpl = setCellValue(tpl, 3, 1, '2026.', { allowFormula: false });
  tpl = setCellValue(tpl, 4, 1, '1,000', { allowFormula: false });
  const values = extractValues(applyValues(tpl, { [cellKey(3, tpl.cols[2])]: '12000.50' }, { recalc: true }));
  const sheet = applyValues(tpl, values, { recalc: true });
  // 0행 제목 칸은 화면이 그리는 칸(문서 제목 '12341')
  const out = draftXlsxExport({ sheet, template: tpl, extras: {}, formKey: KEY, cellText: (r, c) => (r === 0 && c === 0 ? '12341' : undefined) });
  const bytes = await exportXlsx(out.sheet, out.options);
  const xml = new TextDecoder().decode((await unzip(bytes)).get('xl/worksheets/sheet1.xml')!);
  assert.match(xml, /<c r="A1"[^>]*t="inlineStr"><is><t[^>]*>12341</, '제목은 글자로(숫자면 엑셀이 오른쪽에 붙인다)');
  assert.match(xml, /<c r="B4"[^>]*t="inlineStr"><is><t[^>]*>2026\.</);
  assert.match(xml, /<c r="A4"[^>]*><v>1<\/v>/, "번호 '1'은 숫자 그대로");
  const xlsx = (await importXlsx(bytes, { ignorePrintArea: true })).sheet;
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: {}, xlsx, names: await xlsxDefinedNames(bytes) });
  assert.ok(res.ok);
  assert.equal(res.changed, 0);
  const after = applyValues(tpl, res.values, { recalc: true });
  assert.deepEqual([after.rows[3][tpl.cols[1]], after.rows[4][tpl.cols[1]], after.rows[3][tpl.cols[2]]], ['2026.', '1,000', '12000.50']);
});

test('엑셀에서 쓴 값이 칸 종류에 맞게 들어온다 — 금액의 콤마·날짜 모양·합계 다시 계산', async () => {
  const tpl = template();
  let { xlsx, names } = await roundTrip(tpl, {}, {});
  xlsx = setX(xlsx, 1, 1, '2026.11.1 ~ 2026/11/30');
  xlsx = setX(xlsx, 3, 1, '점심');
  xlsx = setX(xlsx, 3, 2, '12,000');
  xlsx = setX(xlsx, 3, 3, '식대');
  xlsx = setX(xlsx, 4, 2, '3000');
  // 머리·라벨·수식 칸은 엑셀에서 고쳐도 무시
  xlsx = setX(xlsx, 2, 1, '내 역(수정)');
  xlsx = setX(xlsx, 6, 2, '999');
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx, names });
  assert.ok(res.ok);
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.equal(s.rows[1][s.cols[1]], '2026-11-01 ~ 2026-11-30');
  assert.equal(s.rows[3][s.cols[1]], '점심');
  assert.equal(s.rows[3][s.cols[2]], '12000');
  assert.equal(s.rows[3][s.cols[3]], '식대');
  assert.equal(s.rows[2][s.cols[1]], '내역', '라벨은 서식 것 그대로');
  assert.equal(s.rows[6][s.cols[2]], '15000', '합계는 서식 수식으로 다시 계산');
  assert.equal(res.changed, 5);
  assert.deepEqual(res.notes, []);
});

test('엑셀에서 표에 줄을 넣으면 문서의 줄 수가 늘고, 합계 줄은 그 아래로', async () => {
  const tpl = template();
  let cur = await roundTrip(tpl, {}, {});
  // 합계 줄(6) 위에 두 줄, 표 가운데(4) 위에 한 줄
  cur = excelInsertRow(cur.xlsx, cur.names, 6);
  cur = excelInsertRow(cur.xlsx, cur.names, 6);
  cur = excelInsertRow(cur.xlsx, cur.names, 4);
  let x = cur.xlsx;
  x = setX(x, 3, 2, '100');
  x = setX(x, 4, 2, '200'); // 가운데 넣은 줄
  x = setX(x, 8, 2, '300'); // 끝에 넣은 줄
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: x, names: cur.names });
  assert.ok(res.ok);
  assert.deepEqual(res.extras, { items: 3 });
  assert.equal(res.rowDelta, 3);
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.equal(s.rows.length, 10);
  assert.deepEqual([3, 4, 8].map((r) => s.rows[r][s.cols[2]]), ['100', '200', '300']);
  // 번호 열(서식에 1, 2, 3)은 넣은 줄까지 다시 매긴다
  assert.deepEqual([3, 4, 5, 6, 7, 8].map((r) => s.rows[r][s.cols[0]]), ['1', '2', '3', '4', '5', '6']);
  assert.equal(s.rows[9][s.cols[0]], '합계');
  assert.equal(s.rows[9][s.cols[2]], '600');
  assert.deepEqual(res.notes, []);
});

test('엑셀에서 표의 줄을 지우면 문서의 줄 수가 준다', async () => {
  const tpl = template();
  const { xlsx, names } = await roundTrip(tpl, { items: 2 }, {});
  // 받을 때 5줄(3~7) — 6·7번 줄을 지움: 이름이 사라지고 합계 줄(8)이 6으로 올라온다
  const rows = Object.fromEntries(Object.entries(names.rows).flatMap(([k, r]) => (r === 6 || r === 7 ? [] : [[k, r > 7 ? r - 2 : r]])));
  const cut = { ...xlsx, rows: xlsx.rows.filter((_, i) => i !== 6 && i !== 7) };
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: { items: 2 }, values: {}, refs: {}, xlsx: cut, names: { ...names, rows } });
  assert.ok(res.ok);
  assert.deepEqual(res.extras, {});
  assert.equal(res.rowDelta, -2);
});

test('받지 못한 것은 알린다 — 숫자가 아닌 금액, 목록에 없는 선택 값, 사람 칸, 표 밖에 넣은 줄', async () => {
  const tpl = template();
  let cur = await roundTrip(tpl, {}, {});
  cur = excelInsertRow(cur.xlsx, cur.names, 1); // 제목 아래(표 밖)에 줄
  let x = cur.xlsx;
  x = setX(x, 1, 0, '메모');
  x = setX(x, 4, 2, '만이천원');
  x = setX(x, 4, 3, '숙박');
  x = setX(x, 4, 4, '홍길동');
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: x, names: cur.names });
  assert.ok(res.ok);
  assert.equal(res.changed, 0);
  assert.equal(res.notes.length, 4);
  assert.ok(res.notes.some((n) => n.includes('금액')));
  assert.ok(res.notes.some((n) => n.includes('숙박')));
  assert.ok(res.notes.some((n) => n.includes('사람·부서')));
  assert.ok(res.notes.some((n) => n.includes('표 밖')));
});

test('다른 서식·다른 버전·표시 없는 파일은 받지 않는다', async () => {
  const tpl = template();
  const { xlsx, names } = await roundTrip(tpl, {}, {});
  const base = { template: tpl, extras: {}, values: {}, refs: {}, xlsx };
  assert.equal(fillFromXlsx({ ...base, formKey: 'expense@v4', names }).ok, false);
  assert.equal(fillFromXlsx({ ...base, formKey: KEY, names: { rows: {}, cols: {}, texts: {} } }).ok, false);
  // 틀 모양이 바뀐 뒤(서식을 고쳤거나 표 모양을 고친 문서)
  const changed = setCellMeta(tpl, APPROVAL_NS.input, 1, 2, { type: 'text' });
  assert.equal(fillFromXlsx({ ...base, template: changed, formKey: KEY, names }).ok, false);
});

test('화면에서 줄을 바꾼 뒤 올려도 받을 때의 줄 기준으로 맞춘다 — 사람 칸 값은 줄을 따라간다', async () => {
  const tpl = template();
  const { xlsx, names } = await roundTrip(tpl, {}, {}); // 받을 때 3줄
  // 그 뒤 화면에서 2줄을 더 붙이고 4번째 줄에 담당자를 골랐다
  const key = cellKey(6, tpl.cols[4]);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: { items: 2 }, values: { [key]: '홍길동 (영업)' }, refs: { [key]: 'U001' }, xlsx, names });
  assert.ok(res.ok);
  // 엑셀은 3줄 — 문서도 3줄로, 없어진 줄의 값·ID 는 버린다
  assert.deepEqual(res.extras, {});
  assert.deepEqual(res.refs, {});
  assert.equal(res.rowDelta, -2);
});

test('엑셀로 주고받을 칸이 있는 서식인지', () => {
  assert.equal(hasXlsxFillCells(template()), true);
  // 시스템이 채우는 칸(이름으로 뺀 칸)뿐이면 주고받을 것이 없다
  let only = createSheet(2, 2);
  only = setCellMeta(only, APPROVAL_NS.input, 0, 0, { type: 'text' });
  only = setCellMeta(only, APPROVAL_NS.name, 0, 0, 'clockIn');
  assert.equal(hasXlsxFillCells(only, ['clockIn']), false);
  assert.equal(hasXlsxFillCells(only), true);
});

const PEOPLE = {
  users: [
    { id: 'U001', name: '홍길동', dept: '영업팀' },
    { id: 'U002', name: '김철수', dept: '개발팀' },
    { id: 'U003', name: '김철수', dept: '총무팀' },
  ],
  depts: ['영업팀', '개발팀', '총무팀'],
};

test('엑셀에서 비워 둔 칸은 화면 값을 그대로 둔다 — 화면에서 고른 기간·사람이 지워지지 않게', async () => {
  const tpl = template();
  const { xlsx, names } = await roundTrip(tpl, {}, {}); // 빈 양식을 받았다
  // 그 뒤 화면에서 정산기간과 담당자를 골랐다
  const period = cellKey(1, tpl.cols[1]);
  const who = cellKey(3, tpl.cols[4]);
  const values = { [period]: '2026-11-01 ~ 2026-11-30', [who]: '홍길동 (영업팀)' };
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: { [who]: 'U001' }, xlsx: setX(xlsx, 3, 1, '점심'), names, people: PEOPLE });
  assert.ok(res.ok);
  assert.equal(res.changed, 1);
  assert.equal(res.values[period], '2026-11-01 ~ 2026-11-30');
  assert.equal(res.values[who], '홍길동 (영업팀)');
  assert.deepEqual(res.refs, { [who]: 'U001' });
});

test('사람 칸 — 엑셀에 쓴 이름으로 조직도에서 찾는다. 없는 이름·같은 이름 여럿은 받지 않고 알린다', async () => {
  const tpl = template();
  let { xlsx, names } = await roundTrip(tpl, {}, {});
  xlsx = setX(xlsx, 3, 4, '홍길동');
  xlsx = setX(xlsx, 4, 4, '김철수 (개발팀)');
  xlsx = setX(xlsx, 5, 4, '김철수');
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx, names, people: PEOPLE });
  assert.ok(res.ok);
  const col = tpl.cols[4];
  assert.equal(res.values[cellKey(3, col)], '홍길동 (영업팀)');
  assert.equal(res.values[cellKey(4, col)], '김철수 (개발팀)');
  assert.equal(res.values[cellKey(5, col)], undefined);
  assert.deepEqual(res.refs, { [cellKey(3, col)]: 'U001', [cellKey(4, col)]: 'U002' });
  assert.equal(res.changed, 2);
  assert.ok(res.notes.some((n) => n.includes('같은 이름이 여럿') && n.includes('김철수')));
  // 없는 이름
  const none = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: setX(xlsx, 5, 4, '이영희'), names, people: PEOPLE });
  assert.ok(none.ok && none.notes.some((n) => n.includes('찾지 못한') && n.includes('이영희')));
});

test('표 가운데에 줄을 넣어도 화면에서 고른 사람은 제 줄을 따라 내려간다', async () => {
  const tpl = template();
  // 2번 줄(4행)에 담당자를 고른 채로 받았다
  const who = cellKey(4, tpl.cols[4]);
  const values = { [who]: '홍길동 (영업팀)', [cellKey(4, tpl.cols[1])]: '택시' };
  const got = await roundTrip(tpl, {}, values);
  // 엑셀에서 2번 줄 위에 줄을 넣고 새 줄에 내역을 썼다
  const cur = excelInsertRow(got.xlsx, got.names, 4);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: { [who]: 'U001' }, xlsx: setX(cur.xlsx, 4, 1, '점심'), names: cur.names, people: PEOPLE });
  assert.ok(res.ok);
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.deepEqual([s.rows[4][s.cols[1]], s.rows[4][s.cols[4]]], ['점심', ''], '새 줄엔 사람이 없다');
  assert.deepEqual([s.rows[5][s.cols[1]], s.rows[5][s.cols[4]]], ['택시', '홍길동 (영업팀)']);
  assert.deepEqual(res.refs, { [cellKey(5, tpl.cols[4])]: 'U001' });
});

// ── 검토에서 나온 경우들 ──

/** 표(반복 구간)가 시트 맨 끝인 서식 — 0 제목, 1~3 내용 줄(번호·내역) */
function tailTemplate(): Sheet {
  let s = createSheet(4, 2);
  s = setCellValue(s, 0, 0, '목록');
  for (let r = 1; r <= 3; r++) {
    s = setCellValue(s, r, 0, String(r));
    s = setCellMeta(s, APPROVAL_NS.input, r, 0, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'text' });
    s = setRowMeta(s, APPROVAL_NS.repeat, r, { id: 'tail', label: '목록' });
  }
  return recalculate(s);
}

test('표가 시트 맨 끝일 때 — 표에 이어 쓴 줄만 받고, 한참 아래에 쓴 메모는 표의 줄로 받지 않는다', async () => {
  const tpl = tailTemplate();
  const got = await roundTrip(tpl, {}, {});
  let x = got.xlsx;
  for (let i = 0; i < 5; i++) x = insertRow(x, x.rows.length);
  x = setX(x, 4, 1, '이어 쓴 줄');
  x = setX(x, 8, 1, '아래 메모');
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: x, names: got.names });
  assert.ok(res.ok);
  assert.deepEqual(res.extras, { tail: 1 });
  assert.equal(Object.values(res.values).includes('아래 메모'), false);
  assert.ok(res.notes.some((n) => n.includes('표 밖')));
});

test('반복 구간 둘이 붙어 있을 때 — 그 사이에 넣은 줄은 위 구간에만 들어간다', async () => {
  let tpl = createSheet(4, 1);
  for (let r = 0; r < 4; r++) {
    tpl = setCellMeta(tpl, APPROVAL_NS.input, r, 0, { type: 'text' });
    tpl = setRowMeta(tpl, APPROVAL_NS.repeat, r, r < 2 ? { id: 'a', label: 'A' } : { id: 'b', label: 'B' });
  }
  const values = Object.fromEntries(['a1', 'a2', 'b1', 'b2'].map((v, r) => [cellKey(r, tpl.cols[0]), v]));
  const got = await roundTrip(tpl, {}, values);
  const cur = excelInsertRow(got.xlsx, got.names, 2);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: {}, xlsx: setX(cur.xlsx, 2, 0, 'NEW'), names: cur.names });
  assert.ok(res.ok);
  assert.deepEqual(res.extras, { a: 1 });
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.deepEqual(s.rows.map((r) => r[s.cols[0]]), ['a1', 'a2', 'NEW', 'b1', 'b2']);
});

test('긴 숫자 글(카드번호 등)은 엑셀에 글자로 — 엑셀은 숫자를 15자리까지만 지킨다', async () => {
  const tpl = template();
  const values = { [cellKey(3, tpl.cols[1])]: '1234567890123456' };
  const out = draftXlsxExport({ sheet: applyValues(tpl, values, { recalc: true }), template: tpl, extras: {}, formKey: KEY });
  const xml = new TextDecoder().decode((await unzip(await exportXlsx(out.sheet, out.options))).get('xl/worksheets/sheet1.xml')!);
  assert.match(xml, /<c r="B4"[^>]*t="inlineStr"><is><t[^>]*>1234567890123456</);
});

test('번호 열 — 기안자가 바꿔 둔 번호는 그대로, 엑셀에서 줄을 넣은 표만 다시 매긴다', async () => {
  const tpl = template();
  // 화면에서 번호를 10·20·30 으로 바꿔 두었다 → 다른 칸만 고쳐 올려도 번호는 그대로
  const custom = Object.fromEntries([10, 20, 30].map((n, i) => [cellKey(3 + i, tpl.cols[0]), String(n)]));
  const a = await roundTrip(tpl, {}, custom);
  const kept = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: custom, refs: {}, xlsx: setX(a.xlsx, 3, 1, '점심'), names: a.names });
  assert.ok(kept.ok);
  assert.deepEqual([3, 4, 5].map((r) => kept.values[cellKey(r, tpl.cols[0])]), ['10', '20', '30']);
  // 줄을 넣어도 바꿔 둔 번호는 다시 매기지 않는다(새 줄 번호는 빈 칸)
  const ins = excelInsertRow(a.xlsx, a.names, 4);
  const added = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: custom, refs: {}, xlsx: ins.xlsx, names: ins.names });
  assert.ok(added.ok);
  assert.deepEqual([3, 4, 5, 6].map((r) => added.values[cellKey(r, tpl.cols[0])]), ['10', '', '20', '30']);
  // 한 줄을 지우고 한 줄을 넣어 줄 수가 같아도, 차례였던 번호는 다시 1, 2, 3
  const b = await roundTrip(tpl, {}, {});
  const rows = Object.fromEntries(Object.entries(b.names.rows).filter(([k]) => k !== '_wf_r4'));
  const swapped = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: setX(b.xlsx, 4, 0, ''), names: { ...b.names, rows } });
  assert.ok(swapped.ok);
  const s = applyValues(expandRepeats(tpl, swapped.extras), swapped.values, { recalc: true });
  assert.deepEqual([3, 4, 5].map((r) => s.rows[r][s.cols[0]]), ['1', '2', '3']);
});

test('받은 그대로면 칸 종류로 못 읽는 글도 건드리지 않는다 — 날짜 칸에 미리 쓴 연도, 시작일만 고른 기간', async () => {
  let tpl = template();
  tpl = setCellMeta(tpl, APPROVAL_NS.input, 3, 1, { type: 'date' });
  tpl = setCellValue(tpl, 3, 1, '2026.', { allowFormula: false });
  const values = extractValues(applyValues(tpl, { [cellKey(1, tpl.cols[1])]: '2026-11-20 ~ ' }, { recalc: true }));
  const { xlsx, names } = await roundTrip(tpl, {}, values);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values, refs: {}, xlsx, names });
  assert.ok(res.ok);
  assert.equal(res.changed, 0);
  assert.deepEqual(res.notes, []);
  assert.equal(res.values[cellKey(1, tpl.cols[1])], '2026-11-20 ~ ', '화면 글자 그대로');
});

test('받은 뒤 화면에서 넣은 줄은 엑셀에 없어 빠진다고 알린다', async () => {
  const tpl = template();
  const { xlsx, names } = await roundTrip(tpl, {}, {});
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: { items: 2 }, values: {}, refs: {}, xlsx, names });
  assert.ok(res.ok && res.notes.some((n) => n.includes('화면에서 넣은 줄 2줄')));
});

test("엑셀에서 앞에 다른 시트를 넣어도 양식이 든 시트를 가리킨다 — 시트 이름의 작은따옴표 포함", async () => {
  const tpl = template();
  const out = draftXlsxExport({ sheet: tpl, template: tpl, extras: {}, formKey: KEY, sheetName: "김's 경비" });
  const bytes = await exportXlsx(out.sheet, out.options);
  assert.equal((await xlsxDefinedNames(bytes)).sheetIndex, 0);
  const files = await unzip(bytes);
  const book = new TextDecoder().decode(files.get('xl/workbook.xml')!).replace('<sheets>', '<sheets><sheet name="메모" sheetId="9" r:id="rId9"/>');
  const moved = await zip([...files].map(([k, v]): [string, string | Uint8Array] => [k, k === 'xl/workbook.xml' ? book : v]));
  const names = await xlsxDefinedNames(moved);
  assert.equal(names.sheetIndex, 1);
  assert.equal(names.rows._wf_r3, 3);
});

test('엑셀에서 번호 칸에 직접 쓴 번호(2-1)는 줄을 넣어도 다시 매기지 않는다', async () => {
  const tpl = template();
  const got = await roundTrip(tpl, {}, {});
  const cur = excelInsertRow(got.xlsx, got.names, 5);
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: setX(cur.xlsx, 5, 0, '2-1'), names: cur.names });
  assert.ok(res.ok);
  const s = applyValues(expandRepeats(tpl, res.extras), res.values, { recalc: true });
  assert.deepEqual([3, 4, 5, 6].map((r) => s.rows[r][s.cols[0]]), ['1', '2', '2-1', '3']);
});

test('양식이 든 시트가 지워진 파일 — 줄 표시를 버려 다른 시트의 글자를 읽지 않는다', async () => {
  const tpl = template();
  const out = draftXlsxExport({ sheet: tpl, template: tpl, extras: {}, formKey: KEY, sheetName: '경비' });
  const files = await unzip(await exportXlsx(out.sheet, out.options));
  const book = new TextDecoder().decode(files.get('xl/workbook.xml')!).split("'경비'!").join('#REF!');
  const broken = await zip([...files].map(([k, v]): [string, string | Uint8Array] => [k, k === 'xl/workbook.xml' ? book : v]));
  const names = await xlsxDefinedNames(broken);
  assert.deepEqual([names.rows, names.cols, names.sheetIndex], [{}, {}, undefined]);
  // 값은 하나도 받지 않고, 줄을 찾지 못했다고 알린다
  const xlsx = (await importXlsx(broken, { ignorePrintArea: true })).sheet;
  const res = fillFromXlsx({ template: tpl, formKey: KEY, extras: {}, values: {}, refs: {}, xlsx: setX(xlsx, 3, 1, '딴 글자'), names });
  assert.ok(res.ok);
  assert.equal(res.changed, 0);
  assert.ok(res.notes.length > 0);
});
