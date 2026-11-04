import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue, type Sheet } from '@/lib/sheet';
import { HEADER_ITEMS, STAMP_TABLE, TITLE_ROW, stampTableInHeader, titleRowShown, withBodyHeader } from '@/domain/approvalForm/headerItems';
import { APPROVAL_NS, DEFAULT_CLOSING, approvalCellProps, draftInfoValue, korDateText, setApprovalProp, sheetHasSeal, slotOf } from './approvalSheet';
import { DOC_INFO_ROWS, insertDocHeader, insertDocInfoBlock, isFullHeaderSheet, isExternalHiddenRow, setExternalHiddenRows, sheetHeaderItems, withoutExternalRows } from './sheetHeader';

const text = (s: Sheet, r: number, c: number) => String(s.rows[r]?.[s.cols[c]] ?? '');

test('문서 정보 표 넣기 — 맨 위에 라벨·문서 정보 칸, 원래 내용은 아래로', () => {
  const base = setCellValue(createSheet(3, 6), 0, 0, '발 주 서');
  const s = insertDocInfoBlock(base);
  assert.equal(s.rows.length, 3 + DOC_INFO_ROWS + 1);
  assert.equal(text(s, DOC_INFO_ROWS + 1, 0), '발 주 서');
  // 6열: A 라벨 · B~C 값 · D 라벨 · E~F 값
  assert.equal(text(s, 0, 0), '문서번호');
  assert.equal(text(s, 0, 3), '기안부서');
  assert.equal(approvalCellProps(s, 0, 1).bind, 'draft.docNo');
  assert.equal(approvalCellProps(s, 0, 4).bind, 'draft.dept');
  assert.equal(approvalCellProps(s, 2, 1).bind, 'doc.preservation');
  assert.equal(text(s, 3, 0), '결재 완료일');
  assert.equal(approvalCellProps(s, 3, 1).bind, 'draft.completedDate');
  assert.equal(approvalCellProps(s, 4, 1).bind, 'doc.title');
  assert.ok(s.merges.some((m) => m.startRow === 4 && m.startCol === 1 && m.colSpan === 5), '제목 값 칸은 끝까지 합침');
  assert.ok(s.merges.some((m) => m.startRow === 0 && m.startCol === 1 && m.colSpan === 2));
  // 넣은 행은 대외 문서에서 숨김
  for (let r = 0; r <= DOC_INFO_ROWS; r++) assert.ok(isExternalHiddenRow(s, r), `${r}행`);
  assert.ok(!isExternalHiddenRow(s, DOC_INFO_ROWS + 1));
});

test('문서 정보 표 넣기 — 열이 넷보다 적으면 늘린다', () => {
  const s = insertDocInfoBlock(createSheet(2, 2));
  assert.equal(s.cols.length, 4);
  assert.equal(text(s, 1, 2), '기안일');
  assert.equal(approvalCellProps(s, 1, 3).bind, 'draft.date');
});

test('시트가 맡은 머리 항목 — 기안 정보·문서 항목 칸만', () => {
  assert.deepEqual(sheetHeaderItems(createSheet(2, 2)), []);
  assert.deepEqual(sheetHeaderItems(null), []);
  const s = insertDocInfoBlock(createSheet(2, 6));
  assert.deepEqual(new Set(sheetHeaderItems(s)), new Set(['docNo', 'drafterDept', 'drafter', 'draftDate', 'completedDate', 'preservation', 'visibility', TITLE_ROW]));
  const one = setApprovalProp(createSheet(2, 2), { r1: 0, r2: 0, c1: 1, c2: 1 }, APPROVAL_NS.bind, 'draft.drafter');
  assert.deepEqual(sheetHeaderItems(one), ['drafter']);
});

test('머리에서 빼기 — 화면용 서식에만, 제목 줄 포함', () => {
  const form = { hiddenHeaderItems: ['topBar'], fields: [] as Array<{ type: string; key: string }> };
  assert.equal(withBodyHeader(form, []), form);
  const shown = withBodyHeader(form, ['drafter', TITLE_ROW]);
  assert.deepEqual(shown.hiddenHeaderItems, ['topBar', 'drafter', TITLE_ROW]);
  assert.deepEqual(form.hiddenHeaderItems, ['topBar'], '원래 서식은 그대로');
  assert.equal(titleRowShown(form), true);
  assert.equal(titleRowShown(shown), false);
  assert.equal(titleRowShown({ fields: [{ type: '문서제목', key: 't' }] }), false);
});

test('문서 항목 칸 값 — 문서 보기는 문서의 제목·보존연한·공개범위', () => {
  const info = { drafter: '홍길동', dept: '기획팀', date: '2026-11-04', docNo: 'AP-1', title: '발주 건', preservation: '5년', visibility: '부서 공개' };
  assert.equal(draftInfoValue('doc.title', info), '발주 건');
  assert.equal(draftInfoValue('doc.preservation', info), '5년');
  assert.equal(draftInfoValue('doc.visibility', info), '부서 공개');
  assert.equal(draftInfoValue('draft.docNo', info), 'AP-1');
  assert.equal(draftInfoValue('draft.completedDate', info), undefined, '결재 전 문서는 완료일 없음');
  assert.equal(draftInfoValue('draft.completedDate', { ...info, completedDate: '2026년 11월 5일' }), '2026년 11월 5일');
  assert.equal(draftInfoValue('project.계약일자', info), undefined);
  assert.equal(draftInfoValue(undefined, info), undefined);
});

test('날짜 글자 — 문서 머리와 같은 모양', () => {
  assert.equal(korDateText('2026-11-04T09:00:00'), '2026년 11월 4일');
  assert.equal(korDateText(new Date(2026, 0, 9)), '2026년 1월 9일');
  assert.equal(korDateText(null), '');
  assert.equal(korDateText('아님'), '');
});

test('대외 문서 — 숨김 행을 통째로 빼고, 켜고 끌 수 있다', () => {
  let s = createSheet(5, 2);
  for (let r = 0; r < 5; r++) s = setCellValue(s, r, 0, `줄${r}`);
  s = setExternalHiddenRows(s, 1, 2, true);
  s = setExternalHiddenRows(s, 4, 4, true);
  const out = withoutExternalRows(s);
  assert.deepEqual(
    out.rows.map((_, r) => text(out, r, 0)),
    ['줄0', '줄3']
  );
  s = setExternalHiddenRows(s, 1, 2, false);
  assert.ok(!isExternalHiddenRow(s, 1));
  assert.equal(s.rowMeta[APPROVAL_NS.extHide]?.[String(4)], true);
  assert.equal(withoutExternalRows(createSheet(2, 2)).rows.length, 2);
});

test('문서 머리 전체 넣기 — 위: 로고·큰 제목/결재란·문서 정보, 아래: 맺음말·기안일·기안자 서명', () => {
  const base = setCellValue(createSheet(2, 6), 0, 0, '본문');
  const s = insertDocHeader(base, { title: '기 안 서' });
  const top = 3 + DOC_INFO_ROWS + 1;
  assert.equal(s.rows.length, top + 2 + 4);
  assert.equal(approvalCellProps(s, 0, 0).bind, 'doc.logo');
  assert.equal(text(s, 1, 0), '기 안 서');
  assert.equal(approvalCellProps(s, 1, 3).bind, 'doc.approvalLine', '결재란은 오른쪽 절반');
  assert.ok(s.merges.some((m) => m.startRow === 1 && m.startCol === 3 && m.colSpan === 3));
  assert.equal(s.rowHeights['1'], 96);
  assert.equal(approvalCellProps(s, 3, 1).bind, 'draft.docNo', '그 아래 문서 정보 표');
  assert.equal(text(s, top, 0), '본문');
  const end = top + 2;
  assert.equal(text(s, end + 1, 0), DEFAULT_CLOSING);
  assert.equal(approvalCellProps(s, end + 2, 0).bind, 'draft.date');
  assert.equal(approvalCellProps(s, end + 3, 0).bind, 'draft.sign');
  // 대외 문서: 로고·문서 정보·맺음말은 숨김, 큰 제목 줄은 남김
  assert.ok(isExternalHiddenRow(s, 0));
  assert.ok(!isExternalHiddenRow(s, 1));
  assert.ok(isExternalHiddenRow(s, 3));
  assert.ok(!isExternalHiddenRow(s, top));
  for (let r = end; r <= end + 3; r++) assert.ok(isExternalHiddenRow(s, r), `맺음말 ${r}행`);
  // 제목이 없으면(엑셀 제목이 본문에 있을 때) 큰 제목 줄도 대외 문서에서 숨김
  assert.ok(isExternalHiddenRow(insertDocHeader(base), 1));
  // 문서 이름 부품 — 큰 제목 칸에 서식 이름이 저절로, 대외 문서에도 남음
  const auto = insertDocHeader(base, { formTitle: true });
  assert.equal(approvalCellProps(auto, 1, 0).bind, 'doc.formTitle');
  assert.equal(text(auto, 1, 0), '');
  assert.ok(!isExternalHiddenRow(auto, 1));
  assert.equal(draftInfoValue('doc.formTitle', { drafter: '', dept: '', date: '', docNo: '', formTitle: '발 주 서' }), '발 주 서');
});

test('결재란이 시트에 있으면 문서 머리 전체를 뺀다', () => {
  const s = insertDocHeader(createSheet(2, 4), { title: '기안서' });
  assert.ok(isFullHeaderSheet(s));
  const items = sheetHeaderItems(s);
  for (const item of [...HEADER_ITEMS, TITLE_ROW, STAMP_TABLE]) assert.ok(items.includes(item), item);
  assert.equal(stampTableInHeader(withBodyHeader({ hiddenHeaderItems: [] }, items)), false);
  assert.equal(stampTableInHeader({ hiddenHeaderItems: [] }), true);
  // 문서 정보 표만 있으면 결재란·로고 등은 머리에 남는다
  assert.ok(!isFullHeaderSheet(insertDocInfoBlock(createSheet(2, 4))));
});

test('문서 머리 부품 칸 이름, 직인 서식 판단', () => {
  assert.equal(slotOf('doc.approvalLine'), 'approvalLine');
  assert.equal(slotOf('doc.logo'), 'logo');
  assert.equal(slotOf('draft.sign'), 'drafterSign');
  assert.equal(slotOf('draft.drafter'), undefined);
  assert.equal(slotOf(undefined), undefined);
  const s = createSheet(2, 2);
  assert.equal(sheetHasSeal(s), false);
  assert.equal(sheetHasSeal(setApprovalProp(s, { r1: 0, r2: 0, c1: 1, c2: 1 }, APPROVAL_NS.seal, true)), true);
  assert.equal(sheetHasSeal(null), false);
});
