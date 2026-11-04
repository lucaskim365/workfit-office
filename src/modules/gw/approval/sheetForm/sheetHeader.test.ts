import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue, type Sheet } from '@/lib/sheet';
import { TITLE_ROW, titleRowShown, withBodyHeader } from '@/domain/approvalForm/headerItems';
import { APPROVAL_NS, approvalCellProps, draftInfoValue, setApprovalProp } from './approvalSheet';
import { DOC_INFO_ROWS, insertDocInfoBlock, isExternalHiddenRow, setExternalHiddenRows, sheetHeaderItems, withoutExternalRows } from './sheetHeader';

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
  assert.equal(approvalCellProps(s, 3, 1).bind, 'doc.title');
  assert.ok(s.merges.some((m) => m.startRow === 3 && m.startCol === 1 && m.colSpan === 5), '제목 값 칸은 끝까지 합침');
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
  assert.deepEqual(new Set(sheetHeaderItems(s)), new Set(['docNo', 'drafterDept', 'drafter', 'draftDate', 'preservation', 'visibility', TITLE_ROW]));
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
  assert.equal(draftInfoValue('project.계약일자', info), undefined);
  assert.equal(draftInfoValue(undefined, info), undefined);
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
