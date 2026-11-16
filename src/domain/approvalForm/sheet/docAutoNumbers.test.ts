import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, type Sheet } from '@/lib/sheet/core';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import { APPROVAL_NS, SHEET_VALUES_KEY, setCellName, setRowCondition } from './approvalSheet';
import { SHEET_ROWS_KEY, repeatSections, setRepeatSection } from './repeatRows';
import { docAutoNumberCells, keepOwnAutoNumbers } from './docAutoNumbers';

/** 0행 구분(선택) / 1행 수입 번호(구분=수입일 때만) / 2행 품목(반복 구간) / 3행 관리번호 */
function form(): Sheet {
  let s = createSheet(4, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['국내', '수입'] });
  s = setCellName(s, 0, 1, 'kind');
  s = setCellMeta(s, APPROVAL_NS.autoNo, 1, 1, { ...DEFAULT_AUTO_NUMBER, prefix: 'IMP' });
  s = setRowCondition(s, 1, 1, { name: 'kind', values: ['수입'] });
  s = setRepeatSection(s, 2, 2, '품목');
  s = setCellMeta(s, APPROVAL_NS.autoNo, 3, 1, { ...DEFAULT_AUTO_NUMBER, prefix: 'NO' });
  return s;
}
const vals = (s: Sheet, kind: string, extra = 0) => ({
  [SHEET_VALUES_KEY]: JSON.stringify({ [cellKey(0, s.cols[1])]: kind }),
  [SHEET_ROWS_KEY]: JSON.stringify(extra ? { [repeatSections(s)[0].id]: extra } : {}),
});

test('상신 번호 칸 — 조건으로 숨은 행은 번호를 받지 않음', () => {
  const s = form();
  assert.deepEqual(docAutoNumberCells(s, vals(s, '국내')).map((x) => x.config.prefix), ['NO']);
  assert.deepEqual(docAutoNumberCells(s, vals(s, '수입')).map((x) => x.config.prefix), ['IMP', 'NO']);
  // 순번 채널은 서식 틀 순서 그대로(숨은 칸이 빠져도 NO 는 sheet#2)
  assert.equal(docAutoNumberCells(s, vals(s, '국내'))[0].channelKey, 'sheet#2');
});

test('상신 번호 칸 — 반복 구간에 더한 줄만큼 아래 칸 자리가 밀린다', () => {
  const s = form();
  const cells = docAutoNumberCells(s, vals(s, '국내', 2));
  assert.equal(cells[0].key, cellKey(5, s.cols[1]));
  assert.deepEqual(docAutoNumberCells(null, {}), []);
});

test('이 문서가 받은 번호만 남긴다 — 다른 문서의 번호가 섞여 들어오면 지우고, 자기 번호는 그대로', () => {
  let s = createSheet(2, 2);
  s = setCellMeta(s, APPROVAL_NS.autoNo, 0, 1, DEFAULT_AUTO_NUMBER);
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'text' });
  const noKey = cellKey(0, s.cols[1]);
  const memoKey = cellKey(1, s.cols[1]);
  const withNo = (no: string) => ({ [SHEET_VALUES_KEY]: JSON.stringify({ [noKey]: no, [memoKey]: '메모' }) });
  // 새 기안에 보관본을 불러온 경우 — 번호는 지우고 쓴 값은 남긴다
  const fresh = keepOwnAutoNumbers(s, withNo('PO-0001'), null, null);
  assert.deepEqual(JSON.parse(fresh[SHEET_VALUES_KEY]), { [memoKey]: '메모' });
  // 반려·회수한 문서를 고쳐 다시 올리는 경우 — 자기 번호 그대로(같은 값을 돌려준다)
  const mine = withNo('PO-0001');
  assert.equal(keepOwnAutoNumbers(s, mine, withNo('PO-0001'), s), mine);
  // 번호를 받은 문서(반려·회수)를 고치다 다른 문서의 보관본을 불러온 경우 — 남의 번호 대신 자기 번호로 되살린다
  assert.deepEqual(JSON.parse(keepOwnAutoNumbers(s, withNo('PO-0009'), withNo('PO-0001'), s)[SHEET_VALUES_KEY]), { [noKey]: 'PO-0001', [memoKey]: '메모' });
  // 번호 없는 보관본(새 기안 때 저장한 것)을 불러온 경우에도 자기 번호를 되살린다
  const noNumber = { [SHEET_VALUES_KEY]: JSON.stringify({ [memoKey]: '보관본 메모' }) };
  assert.deepEqual(JSON.parse(keepOwnAutoNumbers(s, noNumber, withNo('PO-0001'), s)[SHEET_VALUES_KEY]), { [memoKey]: '보관본 메모', [noKey]: 'PO-0001' });
  // 아직 번호를 안 받은 임시저장 문서에 번호 든 보관본을 불러온 경우 — 지운다
  assert.deepEqual(JSON.parse(keepOwnAutoNumbers(s, withNo('PO-0009'), noNumber, s)[SHEET_VALUES_KEY]), { [memoKey]: '메모' });
});

test('이 문서가 받은 번호 — 표 모양을 고쳐 번호 칸 자리가 달라져도 자기 번호는 남고, 보이는 문서번호는 이 문서 것으로 되돌린다', () => {
  let s = createSheet(3, 2);
  s = setCellMeta(s, APPROVAL_NS.autoNo, 2, 1, DEFAULT_AUTO_NUMBER); // 지금 틀: 번호 칸이 3행(위에 행을 넣은 뒤)
  const now = cellKey(2, s.cols[1]);
  const before = cellKey(1, s.cols[1]); // 저장된 문서에서는 2행에 있었다
  const own = { [SHEET_VALUES_KEY]: JSON.stringify({ [before]: 'PO-0001' }), __docNo: 'PO-0001' };
  const cur = { [SHEET_VALUES_KEY]: JSON.stringify({ [now]: 'PO-0001' }), __docNo: 'PO-0001' };
  assert.equal(keepOwnAutoNumbers(s, cur, own, null), cur, '저장된 문서의 틀을 모르면 값으로 견준다 — 자리가 달라도 같은 번호면 그대로');
  const foreign = keepOwnAutoNumbers(s, { [SHEET_VALUES_KEY]: JSON.stringify({ [now]: 'PO-0009' }), __docNo: 'PO-0009' }, own, null) as Record<string, unknown>;
  assert.deepEqual(JSON.parse(String(foreign[SHEET_VALUES_KEY])), {});
  assert.equal(foreign.__docNo, 'PO-0001', '보이는 문서번호는 이 문서 것으로');
});

test('이 문서가 받은 번호 — 조건으로 숨은 번호 칸이 있어도 같은 번호 칸끼리 짝짓는다(순번 채널)', () => {
  const s = form();
  const impKey = cellKey(1, s.cols[1]);
  const noKey = cellKey(3, s.cols[1]);
  const doc = (kind: string, nos: Record<string, string>) => ({ [SHEET_VALUES_KEY]: JSON.stringify({ [cellKey(0, s.cols[1])]: kind, ...nos }), [SHEET_ROWS_KEY]: '{}' });
  // 수입으로 IMP·NO 를 받은 문서를 국내로 바꿔 다시 올린다 — NO 칸은 자기 번호(NO-0001), IMP 번호가 들어가지 않는다
  const own = doc('수입', { [impKey]: 'IMP-0001', [noKey]: 'NO-0001' });
  const back = keepOwnAutoNumbers(s, doc('국내', { [noKey]: 'IMP-0001' }), own, s);
  assert.equal(JSON.parse(String(back[SHEET_VALUES_KEY]))[noKey], 'NO-0001');
  // 국내로 NO 만 받은 문서를 수입으로 바꾸면 — NO 칸은 그대로, IMP 칸은 비어 상신 때 새로 받는다
  const own2 = doc('국내', { [noKey]: 'NO-0001' });
  const out2 = JSON.parse(String(keepOwnAutoNumbers(s, doc('수입', { [impKey]: 'NO-0001', [noKey]: 'NO-0001' }), own2, s)[SHEET_VALUES_KEY]));
  assert.equal(out2[noKey], 'NO-0001');
  assert.equal(out2[impKey], undefined);
});
