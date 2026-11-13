import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sheet } from '@/lib/sheet';
import { approvalFormSchema, formFieldSchema, type ApprovalForm } from '@/domain/approvalForm/schema';
import { APPROVAL_NS, approvalCellProps, clearStaleDependent, conditionHiddenRows, draftOptions, requiredMissing, rowConditionOf, sheetDocFields, type CellInput } from '@/domain/approvalForm/sheet/approvalSheet';
import { colLetter, setCellValue } from '@/lib/sheet';
import { legacyFormToSheet, legacyRepeatRows, spreadColumns, translateLegacyFormula } from './fromLegacyForm';
import { repeatSections } from '@/domain/approvalForm/sheet/repeatRows';
import { isFullHeaderSheet } from '@/domain/approvalForm/sheet/sheetHeader';

const field = (f: Record<string, unknown>) => formFieldSchema.parse(f);

/** 칸 속성이 붙은 칸들 — [행, 열, 값] */
const metaCells = (s: Sheet, ns: string) =>
  Object.entries(s.cellMeta[ns] ?? {}).map(([k, v]) => {
    const i = k.indexOf(':');
    return { r: Number(k.slice(0, i)), c: s.cols.indexOf(k.slice(i + 1)), v };
  });
const text = (s: Sheet, r: number, c: number) => String(s.rows[r]?.[s.cols[c]] ?? '');
const findText = (s: Sheet, t: string) => {
  for (let r = 0; r < s.rows.length; r++) for (let c = 0; c < s.cols.length; c++) if (text(s, r, c) === t) return { r, c };
  return null;
};

function legacyForm(code: string, fields: Record<string, unknown>[], extra: Record<string, unknown> = {}): ApprovalForm {
  return approvalFormSchema.parse({ id: code, code, name: `${code} 서식`, fields: fields.map(field), ...extra });
}

test('기존 서식 → 시트 — 머리를 끈 서식(공문)은 로고·큰 제목·문서 정보·맺음말 없이, 제목은 본문 칸', () => {
  const form = legacyForm('공문', [{ key: 't', label: '제목', type: '문서제목' }, { key: 'b', label: '본문', type: '장문' }], {
    hiddenHeaderItems: ['topBar', 'docTitle', 'docNo', 'drafterDept', 'drafter', 'draftDate', 'completedDate', 'preservation', 'visibility', 'closing'],
  });
  const { sheet: s } = legacyFormToSheet(form);
  const binds = metaCells(s, APPROVAL_NS.bind).map((x) => x.v);
  assert.ok(binds.includes('doc.approvalLine'), '결재란은 남김');
  for (const b of ['doc.logo', 'doc.formTitle', 'draft.docNo', 'draft.sign']) assert.ok(!binds.includes(b), b);
  assert.equal(binds.filter((b) => b === 'doc.title').length, 1, '제목은 본문 칸 하나');
  assert.ok(findText(s, '본문'));
});

test('기존 서식 → 시트 — 라벨·값 칸, 입력 종류, 금액 키, 연동 칸 이름, 문서 머리', () => {
  const form = legacyForm('휴가', [
    { key: 'leaveType', label: '휴가 종류', type: '선택', options: ['연차', '오전반차'], width: 'half', required: true },
    { key: 'period', label: '휴가 기간', type: '기간', width: 'half' },
    { key: 'cost', label: '경비', type: '금액', isAmountKey: true },
    { key: 'body', label: '사유', type: '장문', isSecret: true },
    { key: 'docTitle', label: '제목', type: '문서제목' },
  ]);
  const { sheet: s, link, warnings } = legacyFormToSheet(form);
  assert.equal(link, '휴가', '연동 서식이면 대체 서식으로');
  assert.ok(isFullHeaderSheet(s), '문서 머리 전체가 들어 있음');
  // 반쪽 둘은 한 줄에
  const kind = findText(s, '휴가 종류')!;
  const period = findText(s, '휴가 기간')!;
  assert.equal(kind.r, period.r);
  assert.equal(approvalCellProps(s, kind.r, kind.c + 1).input?.type, 'select');
  assert.deepEqual(approvalCellProps(s, kind.r, kind.c + 1).input?.options, ['연차', '오전반차']);
  assert.equal(approvalCellProps(s, kind.r, kind.c + 1).name, 'leaveType');
  // 연동 서식이 아니어도 선택 항목은 기존 키를 칸 이름으로(결재선 규칙 조건용)
  const exp = legacyFormToSheet(legacyForm('지출결의', [{ key: 'expenseItem', label: '경비 항목', type: '선택', options: ['식대', '교통비'] }])).sheet;
  const ex = findText(exp, '경비 항목')!;
  assert.equal(approvalCellProps(exp, ex.r, ex.c + 1).name, 'expenseItem');
  assert.equal(approvalCellProps(s, period.r, period.c + 1).input?.type, 'dateRange');
  assert.equal(approvalCellProps(s, period.r, period.c + 1).name, 'period');
  // 금액 키 → amount, 장문 비공개
  const cost = findText(s, '경비')!;
  assert.equal(approvalCellProps(s, cost.r, 1).name, 'amount');
  assert.equal(approvalCellProps(s, cost.r, 1).input?.type, 'currency');
  const body = findText(s, '사유')!;
  assert.equal(approvalCellProps(s, body.r, 1).input?.type, 'multiline');
  assert.equal(approvalCellProps(s, body.r, 1).secret, true);
  // 문서제목 항목은 문서 정보 표의 제목 칸이 맡는다(따로 안 만듦)
  assert.equal(metaCells(s, APPROVAL_NS.bind).filter((x) => x.v === 'doc.title').length, 1);
  assert.equal(approvalCellProps(s, kind.r, kind.c + 1).required, true, '필수 그대로');
  assert.ok(!warnings.some((w) => w.includes('필수')));
});

test('기존 서식 → 시트 — 표·직인·자동번호·회사정보·안내문·섹션', () => {
  const table = JSON.stringify({
    version: 2,
    cols: ['a', 'b'],
    rows: [
      { a: '품명', b: '수량' },
      { a: '', b: '' },
    ],
    colWidths: {},
    tableWidth: '100%',
    merges: [],
    cellFormulas: { '1:b': { expression: '=A1' } },
    cellStyles: { '0:a': { bold: true, bg: 'gray' }, '0:b': { bold: true } },
    secretCols: [],
    secretCells: [],
    secretRows: [],
  });
  const form = legacyForm('발주', [
    { key: 'head', label: '', type: '회사정보' },
    { key: 'guide', label: '작성 요령', type: '안내문', placeholder: '품목을 빠짐없이 적으세요' },
    { key: 'no', label: '발주번호', type: '자동번호', autoNumber: { prefix: 'PO', datePart: 'YYYY', digits: 4, reset: 'YEAR' } },
    { key: 'items', label: '품목', type: '표', placeholder: table, section: '발주 내역' },
    { key: 'seal', label: '주식회사 워크핏 대표이사', type: '직인', markId: 'MK-abcd' },
  ]);
  const { sheet: s, link, warnings } = legacyFormToSheet(form);
  assert.equal(link, null);
  assert.equal(metaCells(s, APPROVAL_NS.bind).filter((x) => x.v === 'doc.letterhead').length, 1, '회사정보');
  const guide = findText(s, '품목을 빠짐없이 적으세요')!;
  assert.equal(approvalCellProps(s, guide.r, guide.c).guide, true, '안내문');
  const no = findText(s, '발주번호')!;
  assert.equal(approvalCellProps(s, no.r, 1).autoNo?.prefix, 'PO', '자동번호 모양 그대로');
  assert.equal(approvalCellProps(s, no.r, 1).autoNo?.channelKey, 'no', '기존 항목 순번 이어받기');
  assert.ok(findText(s, '발주 내역'), '섹션 제목 줄');
  // 표 — 머리 줄 굵게·회색, 빈 칸은 입력 칸(수식 칸 제외), 마지막 줄은 반복 구간
  const head = findText(s, '품명')!;
  assert.equal(s.styles[`${head.r}:${s.cols[0]}`]?.bg, '#f2f2f2');
  assert.equal(approvalCellProps(s, head.r + 1, 0).input?.type, 'text');
  const qty = findText(s, '수량')!.c; // 표 둘째 열이 놓인 시트 열(표 열이 시트보다 적어 나뉘어 놓임)
  assert.equal(approvalCellProps(s, head.r + 1, qty).input, undefined, '수식 칸은 입력 칸이 아님');
  assert.equal(repeatSections(s).length, 1);
  assert.equal(repeatSections(s)[0].first, head.r + 1);
  // 기존 수식(표 안 좌표 A1 = 머리 줄 첫 칸) → 시트 수식(행만 민다)
  assert.equal(s.formulas[`${head.r + 1}:${s.cols[qty]}`], `=A${head.r + 1}`);
  assert.ok(!warnings.some((w) => w.includes('수식')));
  // 직인 — 발신 명의 + 직인 칸(고른 직인)
  const seal = findText(s, '주식회사 워크핏 대표이사')!;
  const sealCell = metaCells(s, APPROVAL_NS.seal).find((x) => x.r === seal.r)!;
  assert.ok(sealCell);
  assert.equal(approvalCellProps(s, sealCell.r, sealCell.c).sealMark, 'MK-abcd');
});

test('기존 서식 → 시트 — 조건부 항목(visibleIf)은 행 보이기 조건으로', () => {
  const form = legacyForm('지출결의', [
    { key: 'expenseItem', label: '지출 항목', type: '선택', options: ['식대', '회의비', '운반비'], isTabSelector: true },
    { key: 'sort_meal', label: '분류', type: '선택', options: ['간식대', '야근식대'], visibleIf: 'expenseItem:식대', width: 'half' },
    { key: 'note_meal', label: '인원', type: '숫자', visibleIf: 'expenseItem:식대', width: 'half' },
    { key: 'guide', label: '회의비 안내', type: '안내문', placeholder: '회의비는 10만원 이내', visibleIf: 'expenseItem:회의비' },
    { key: 'sort_carr', label: '운반 분류', type: '선택', options: ['우편/택배', '퀵서비스'], visibleIf: 'expenseItem:운반비', width: 'half' },
    { key: 'amount', label: '청구 금액', type: '금액', isAmountKey: true },
  ]);
  const { sheet: s, warnings } = legacyFormToSheet(form);
  const kind = findText(s, '지출 항목')!;
  assert.equal(approvalCellProps(s, kind.r, kind.c + 1).name, 'expenseItem');
  const condOf = (t: string) => rowConditionOf(s, findText(s, t)!.r);
  // 같은 조건의 반쪽 둘은 한 줄에
  assert.equal(findText(s, '인원')!.r, metaCells(s, APPROVAL_NS.name).find((x) => x.v === 'sort_meal')!.r);
  assert.deepEqual(condOf('인원'), { name: 'expenseItem', values: ['식대'] });
  assert.deepEqual(condOf('회의비는 10만원 이내'), { name: 'expenseItem', values: ['회의비'] });
  // 조건이 다른 반쪽은 다른 줄
  const carr = metaCells(s, APPROVAL_NS.name).find((x) => x.v === 'sort_carr')!;
  assert.deepEqual(rowConditionOf(s, carr.r), { name: 'expenseItem', values: ['운반비'] });
  assert.equal(rowConditionOf(s, findText(s, '청구 금액')!.r), undefined);
  // 아무것도 안 골랐으면 조건 행은 모두 숨김
  assert.equal(conditionHiddenRows(s).size, 3);
  assert.ok(warnings.some((w) => w.includes('행 보이기 조건')));
});

test('기존 서식 → 시트 — 표: 수식 칸 말고 모두 입력 칸(미리 쓴 글자는 기본값), 섹션 항목 이름표는 고정', () => {
  const table = JSON.stringify({
    version: 2,
    cols: ['구분', '항목', '내용'],
    rows: [{ 구분: '구분', 항목: '항목', 내용: '내용' }, { 구분: '자재', 항목: '', 내용: '' }, { 구분: '', 항목: '', 내용: '' }],
    legacyHeaderRow: true,
    colWidths: {}, tableWidth: '100%', merges: [], cellFormulas: {}, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [],
  });
  const { sheet: s } = legacyFormToSheet(legacyForm('발주', [{ key: 'body', label: '내역', type: '표', placeholder: table }]));
  const head = findText(s, '항목')!;
  // 기존 표는 칸을 모두 고칠 수 있었다(운영 문서에서 기안자가 수주자·날짜·분류 이름 등을 실제로 고쳐 씀)
  assert.equal(approvalCellProps(s, head.r, 0).input?.type, 'text', '머리 줄도 고칠 수 있음');
  const pre = findText(s, '자재')!;
  assert.equal(approvalCellProps(s, pre.r, pre.c).input?.type, 'text', '미리 쓴 글자는 기본값이 든 입력 칸');
  assert.equal(approvalCellProps(s, pre.r, head.c).input?.type, 'text');
  // 표 밖 항목 이름표(라벨)는 기존 양식에서도 못 고쳤다 — 고정
  const label = findText(s, '내역');
  assert.ok(!label || approvalCellProps(s, label.r, label.c).input === undefined);
});

test('기존 서식 → 시트 — 값마다 바뀌던 같은 이름 선택 항목은 종속 선택 칸 하나로, 상위 칸 오른쪽에', () => {
  const form = legacyForm('지출결의', [
    { key: 'expenseItem', label: '지출 항목', type: '선택', options: ['식대', '회의비', '운반비', '직접입력'], width: 'half', required: true },
    { key: 'sort_meal', label: '분류', type: '선택', options: ['간식대', '야근식대'], visibleIf: 'expenseItem:식대', width: 'half' },
    { key: 'guide', label: '회의비 안내', type: '안내문', placeholder: '회의비는 10만원 이내', visibleIf: 'expenseItem:회의비' },
    { key: 'sort_carr', label: '분류', type: '선택', options: ['우편/택배', '퀵서비스'], visibleIf: 'expenseItem:운반비', width: 'half', required: true },
    { key: 'amount', label: '청구 금액', type: '금액', isAmountKey: true },
  ]);
  const { sheet: s, warnings } = legacyFormToSheet(form);
  const kind = findText(s, '지출 항목')!;
  const sort = findText(s, '분류')!;
  assert.equal(sort.r, kind.r, '분류는 지출 항목과 같은 줄 오른쪽');
  assert.equal(metaCells(s, APPROVAL_NS.input).filter((x) => (x.v as CellInput).depends).length, 1, '칸 하나');
  const input = approvalCellProps(s, sort.r, sort.c + 1).input!;
  assert.deepEqual(input.depends, {
    name: 'expenseItem',
    branches: [
      { when: '식대', options: ['간식대', '야근식대'], key: 'sort_meal' },
      { when: '운반비', options: ['우편/택배', '퀵서비스'], key: 'sort_carr' },
    ],
  });
  assert.equal(approvalCellProps(s, sort.r, sort.c + 1).required, true);
  assert.equal(rowConditionOf(s, kind.r), undefined, '지출 항목 줄은 늘 보임');
  assert.deepEqual(rowConditionOf(s, findText(s, '회의비는 10만원 이내')!.r), { name: 'expenseItem', values: ['회의비'] });
  assert.ok(warnings.some((w) => w.includes("'분류'")));

  // 기안 — 운반비 → 퀵서비스: 결재선 규칙 키 sort_carr 에 값, 다른 갈래 키는 빈 값
  const vc = kind.c + 1;
  const sc = sort.c + 1;
  assert.deepEqual(draftOptions(s, input), [], '지출 항목 고르기 전엔 쓸 수 없음');
  let d = setCellValue(s, kind.r, vc, '운반비');
  assert.deepEqual(draftOptions(d, input), ['우편/택배', '퀵서비스']);
  assert.deepEqual(requiredMissing(d), ['분류'], '갈래가 있으면 필수 검사');
  d = setCellValue(d, sort.r, sc, '퀵서비스');
  const fv = sheetDocFields(d, 'x@1');
  assert.equal(fv.sort_carr, '퀵서비스');
  assert.equal(fv.sort_meal, '');
  // 지출 항목을 식대로 바꾸면 운반비 분류 값은 비운다
  const meal = clearStaleDependent(setCellValue(d, kind.r, vc, '식대'));
  assert.equal(meal.rows[sort.r][s.cols[sc]], '');
  // 고를 분류가 없는 값(직접입력한 글자)이면 분류 칸은 필수 검사에서 빠짐
  assert.deepEqual(requiredMissing(setCellValue(s, kind.r, vc, '문구 구입')), []);
});

test('기존 표 수식 → 시트 수식 — 좌표·열 이름·SUM(ABOVE)·[줄:열]·백분율, 다른 표 참조는 못 옮김', () => {
  const cols = ['구분', '비중', '금액'];
  const rows = [{ 구분: '구분', 비중: '비중', 금액: '금액' }, { 구분: 'A', 비중: '', 금액: '' }, { 구분: '소계', 비중: '', 금액: '' }];
  const at = (r: number, col: string) => ({ r, col, top: 9, cols, rows });
  assert.equal(translateLegacyFormula('=D3*F3', at(2, '금액'), 'currency'), '=D12*F12');
  assert.equal(translateLegacyFormula('=SUM(G2:G9)', at(2, '금액')), '=SUM(G11:G18)');
  assert.equal(translateLegacyFormula('=SUM(ABOVE)', at(2, '금액')), '=SUM(C10:C11)');
  assert.equal(translateLegacyFormula('=( [금액] / [소계:금액] ) * 100', at(1, '비중'), 'percent1'), '=IFERROR(( C11 / C12 ),0)');
  assert.equal(translateLegacyFormula('=C2/C1', at(1, '비중'), 'percent1'), '=IFERROR((C11/C10)/100,0)');
  // 백분율 칸들의 합(소계 비중)은 나누지 않음
  assert.equal(translateLegacyFormula('=SUM(ABOVE)', at(2, '비중'), 'percent1'), '=SUM(B10:B11)');
  assert.equal(translateLegacyFormula('=[매출구분]![소계:금액] - 1', at(1, '금액')), null);
  assert.equal(translateLegacyFormula('=[없는열]', at(1, '금액')), null);
  assert.equal(translateLegacyFormula(undefined, at(1, '금액')), null);
});

test('기존 표에서 줄을 더하던 곳 — 같은 모양 품목 줄이 이어지는 마지막 줄, 라벨·값 표는 없음', () => {
  const f = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, { expression: '=1' }]));
  // 발주 세부내역: 0 머리, 1~8 품목(G 수식), 9~11 합계 줄(A 글자 + G 수식)
  const cols = ['A', 'B', 'G'];
  const items = Array.from({ length: 8 }, (_, i) => ({ A: String(i + 1), B: '', G: '' }));
  const totals = ['공급가액 합계', '부가세', '합계'].map((t) => ({ A: t, B: '', G: '' }));
  const po = { cols, rows: [{ A: 'NO', B: '항목', G: '공급가액' }, ...items, ...totals], cellFormulas: f([...Array.from({ length: 11 }, (_, i) => `${i + 1}:G`)]) };
  assert.deepEqual(legacyRepeatRows(po, 1), { first: 1, last: 8 }, '품목 1~8 줄 전체(합계 줄 빼고)');
  // 라벨·값 표(작성일 | 값 | 상호 | 값 …) — 미리 쓴 글자가 많아 반복 구간 없음
  const info = { cols: ['A', 'B', 'C', 'D'], rows: Array.from({ length: 6 }, () => ({ A: '작성일', B: '', C: '상호', D: '워크핏' })), cellFormulas: {} };
  assert.equal(legacyRepeatRows(info, 1), null);
  // 데이터 줄 하나뿐이고 비어 있으면 그 줄
  assert.deepEqual(legacyRepeatRows({ cols: ['A', 'B'], rows: [{ A: '머리', B: '' }, { A: '', B: '' }], cellFormulas: {} }, 1), { first: 1, last: 1 });
  // 데이터 줄 하나에 이름표가 있으면(직인란 등) 품목 줄 아님
  assert.equal(legacyRepeatRows({ cols: ['A', 'B'], rows: [{ A: '발주자', B: '' }, { A: '날짜', B: '년 월 일' }], cellFormulas: {} }, 1), null);
});

test('짝 없는 반쪽 항목은 값 칸을 줄 끝까지(오른쪽에 이름 없는 빈 칸을 남기지 않음)', () => {
  const form = legacyForm('지출결의', [
    { key: 'item', label: '지출 항목', type: '선택', options: ['식대'], width: 'half' },
    { key: 'guide', label: '안내', type: '안내문', placeholder: '안내' },
    { key: 'amount', label: '청구 금액', type: '금액', width: 'half' },
    { key: 'date', label: '사용 일자', type: '날짜' },
  ]);
  const { sheet: s } = legacyFormToSheet(form);
  for (const t of ['지출 항목', '청구 금액']) {
    const at = findText(s, t)!;
    const m = s.merges.find((x) => x.startRow === at.r && x.startCol === 1)!;
    assert.equal(m.startCol + m.colSpan - 1, s.cols.length - 1, `${t} 값 칸이 줄 끝까지`);
  }
});

test('기존 표에서 줄을 더하던 곳 — 빈 품목 두 줄, 줄마다 똑같이 미리 쓴 글자(2026.)도 품목 줄', () => {
  // 원자재: 머리 두 줄 뒤 빈 품목 두 줄
  const blank = { cols: ['A', 'B', 'C'], rows: [{ A: '품명', B: '규격', C: '금액' }, { A: '', B: '', C: '수량' }, { A: '', B: '', C: '' }, { A: '', B: '', C: '' }], cellFormulas: {} };
  assert.deepEqual(legacyRepeatRows(blank, 1), { first: 2, last: 3 });
  // 개인 경비: 번호 + 날짜 칸에 '2026.' 이 미리 써 있는 품목 줄들 + 합계 줄
  const rows = [{ A: 'NO', B: '날짜', C: '금액', D: '기타' }, ...Array.from({ length: 5 }, (_, i) => ({ A: String(i + 1), B: '2026.', C: '', D: '' })), { A: '합계', B: '', C: '', D: '' }];
  assert.deepEqual(legacyRepeatRows({ cols: ['A', 'B', 'C', 'D'], rows, cellFormulas: { '6:C': { expression: '=SUM(C2:C6)' } } }, 1), { first: 1, last: 5 });
  // 줄마다 이름표가 다른 표(선급금·중도금·잔금)는 품목 줄 아님
  const fixed = { cols: ['A', 'B', 'C'], rows: [{ A: '구분', B: '년-월', C: '금액' }, { A: '선급금', B: '', C: '' }, { A: '중도금', B: '', C: '' }, { A: '잔금', B: '', C: '' }], cellFormulas: {} };
  assert.equal(legacyRepeatRows(fixed, 1), null);
});

test('기존 표 수식 — 열 이름은 머리 줄 글자로도, 다른 표([표]![줄:열])는 그 표 자리를 알면 옮긴다', () => {
  const cols = ['a', 'b', 'c'];
  const rows = [{ a: '인정거리', b: '단가', c: '주유비' }, { a: '', b: '', c: '' }];
  assert.equal(translateLegacyFormula('=[인정거리] * [단가]', { r: 1, col: 'c', top: 4, cols, rows }), '=A6 * B6');
  const sales = { top: 20, cols: ['구분', '금액'], rows: [{ 구분: '구분', 금액: '금액' }, { 구분: 'SW', 금액: '' }, { 구분: '소계', 금액: '' }] };
  const at = { r: 1, col: 'c', top: 4, cols, rows, tables: new Map([['매출구분', sales]]) };
  assert.equal(translateLegacyFormula('=[매출구분]![소계:금액] - [단가]', at), '=B23 - B6');
  assert.equal(translateLegacyFormula('=[없는표]![소계:금액]', at), null);
});

test('다른 표를 가리키는 수식은 그 표가 아래에 놓여도 옮긴다', () => {
  const tbl = (cols: string[], rows: Record<string, string>[], cellFormulas: Record<string, unknown> = {}) =>
    JSON.stringify({ version: 2, cols, rows, legacyHeaderRow: true, colWidths: {}, tableWidth: '100%', merges: [], cellFormulas, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [] });
  const form = legacyForm('계약', [
    { key: 'p', label: '매입', type: '표', placeholder: tbl(['x', 'y'], [{ x: '구분', y: '금액' }, { x: '이익', y: '' }], { '1:y': { expression: '=[매출]![소계:금액] - 1' } }) },
    { key: 's', label: '매출', type: '표', section: '분석', placeholder: tbl(['구분', '금액'], [{ 구분: '구분', 금액: '금액' }, { 구분: '소계', 금액: '' }]) },
  ]);
  const { sheet: s, warnings } = legacyFormToSheet(form);
  const profit = findText(s, '이익')!;
  const total = findText(s, '소계')!;
  // 두 표 모두 둘째 열('금액')이 같은 시트 열에 놓인다 — 수식도 그 열을 가리킨다
  const amountCol = findText(s, '금액')!.c;
  assert.ok(amountCol > 1, '표 열이 시트 열에 나뉘어 놓임');
  assert.equal(s.formulas[`${profit.r}:${s.cols[amountCol]}`], `=${colLetter(amountCol)}${total.r + 1} - 1`);
  assert.ok(!warnings.some((w) => w.includes('수식')));
});

test('열 너비 — 고르게 나누되 한 열에만 든 긴 이름표는 잘리지 않게 넓히고, 전체 폭은 그대로', () => {
  const tbl = JSON.stringify({
    version: 2,
    cols: ['a', 'b', 'c', 'd', 'e', 'f'],
    rows: [{ a: '공급자 담당 / 연락처', b: '', c: '', d: '', e: '', f: '' }],
    colWidths: {}, tableWidth: '100%', merges: [], cellFormulas: {}, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [],
  });
  const { sheet: s } = legacyFormToSheet(legacyForm('발주', [{ key: 't', label: '정보', type: '표', placeholder: tbl }]));
  const w = s.cols.map((c) => s.colWidths[c]);
  assert.ok(w[0] > w[1], '긴 이름표 열이 더 넓다');
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 718) <= s.cols.length, '전체 폭은 A4 폭');
});

test('금액 모양 — 금액 항목, 금액 수식(소계)이 든 열의 빈 입력 칸은 천 단위 쉼표', () => {
  const tbl = JSON.stringify({
    version: 2,
    cols: ['구분', '금액'],
    rows: [{ 구분: '구분', 금액: '금액' }, { 구분: 'SW', 금액: '' }, { 구분: '소계', 금액: '' }],
    legacyHeaderRow: true,
    colWidths: {}, tableWidth: '100%', merges: [], cellFormulas: { '2:금액': { expression: '=SUM(ABOVE)', format: 'currency' } }, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [],
  });
  const { sheet: s } = legacyFormToSheet(legacyForm('계약', [
    { key: 'amount', label: '청구 금액', type: '금액' },
    { key: 't', label: '매출', type: '표', placeholder: tbl },
  ]));
  const amt = findText(s, '청구 금액')!;
  assert.equal(s.styles[`${amt.r}:${s.cols[1]}`]?.numFmt, 'currency');
  const sw = findText(s, 'SW')!;
  const money = findText(s, '금액')!; // 표의 금액 열 머리 — 그 열이 놓인 시트 열
  assert.equal(approvalCellProps(s, sw.r, money.c).input?.type, 'currency');
  assert.equal(s.styles[`${sw.r}:${s.cols[money.c]}`]?.numFmt, 'currency');
  assert.equal(approvalCellProps(s, money.r, money.c).input?.type, 'text', '머리 줄 이름표는 그대로');
});

test('기존 표 변환 — 금액 칸·금액 수식 칸은 오른쪽 정렬(기존 표의 가운데 정렬 대신), 글자 칸은 그대로', () => {
  const table = JSON.stringify({
    version: 2,
    cols: ['a', 'b', 'c'],
    rows: [
      { a: '품명', b: '단가', c: '공급가액' },
      { a: '', b: '', c: '' },
    ],
    colWidths: {},
    tableWidth: '100%',
    merges: [],
    cellFormulas: { '1:c': { expression: '=B2*2', format: 'currency' } },
    cellStyles: {
      '1:a': { align: 'center' },
      '1:b': { align: 'center', numFmt: 'currency' },
      '1:c': { align: 'center', numFmt: 'currency' },
    },
    secretCols: [],
    secretCells: [],
    secretRows: [],
  });
  const { sheet: s } = legacyFormToSheet(legacyForm('발주', [{ key: 'items', label: '품목', type: '표', placeholder: table }]));
  const head = findText(s, '품명')!;
  const r = head.r + 1;
  assert.equal(s.styles[`${r}:${s.cols[0]}`]?.align, 'center', '글자 칸은 기존 정렬');
  assert.equal(s.styles[`${r}:${s.cols[1]}`]?.align, 'right', '금액 입력 칸');
  assert.equal(s.styles[`${r}:${s.cols[2]}`]?.align, 'right', '금액 수식 칸');
});

test('표 열 나누기 — 기존 양식의 열 너비 비율대로, 모든 열이 한 칸은 받고 합은 시트 열 수', () => {
  assert.deepEqual(spreadColumns([1, 1, 1, 1], 12), [3, 3, 3, 3]);
  assert.deepEqual(spreadColumns([100, 100, 100, 300], 12), [2, 2, 2, 6]);
  assert.deepEqual(spreadColumns([1, 1], 4), [2, 2]);
  assert.deepEqual(spreadColumns([1, 1, 1], 4), [2, 1, 1]);
  // 아주 좁은 열이 있어도 한 칸은 받는다
  assert.deepEqual(spreadColumns([1, 1000, 1], 12), [1, 10, 1]);
  // 표 열 수 = 시트 열 수면 그대로
  assert.deepEqual(spreadColumns([5, 1, 9], 3), [1, 1, 1]);
  for (const [w, n] of [[[3, 1, 4, 1, 5], 12], [[1, 1, 1, 1, 1, 1, 1], 12], [[0, NaN, 2], 9]] as const) {
    const spans = spreadColumns([...w], n);
    assert.equal(spans.reduce((a, x) => a + x, 0), n);
    assert.ok(spans.every((x) => x >= 1));
  }
});

test('열이 적은 표는 시트 폭에 고르게 놓인다 — 마지막 열만 넓어지지 않는다(대금 지급 조건 표)', () => {
  const tbl = (cols: string[], rows: Record<string, string>[], extra: Record<string, unknown> = {}) =>
    JSON.stringify({ version: 2, cols, rows, legacyHeaderRow: true, colWidths: {}, tableWidth: '100%', merges: [], cellFormulas: {}, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [], ...extra });
  const wide = Array.from({ length: 12 }, (_, i) => `c${i}`);
  const form = legacyForm('발주', [
    { key: 'w', label: '견적', type: '표', placeholder: tbl(wide, [Object.fromEntries(wide.map((c) => [c, c]))]) },
    {
      key: 'pay', label: '지급 조건', type: '표',
      placeholder: tbl(['구분', '비율', '금액', '조건'], [{ 구분: '구분', 비율: '비율', 금액: '금액', 조건: '조건' }, { 구분: '선금', 비율: '', 금액: '', 조건: '' }], {
        colWidths: { 구분: '100px', 비율: '100px', 금액: '100px', 조건: '300px' },
        merges: [{ startRow: 1, startCol: 1, rowSpan: 1, colSpan: 2 }],
        cellFormulas: { '1:조건': { expression: '=[금액]' } },
      }),
    },
  ]);
  const { sheet: s } = legacyFormToSheet(form);
  assert.equal(s.cols.length, 12);
  const head = findText(s, '구분')!;
  // 열 자리 — 너비 비율 1:1:1:3 → 2·2·2·6 칸
  assert.deepEqual(['구분', '비율', '금액', '조건'].map((t) => findText(s, t)!.c), [0, 2, 4, 6]);
  const mergeAt = (r: number, c: number) => s.merges.find((m) => m.startRow === r && m.startCol === c);
  assert.equal(mergeAt(head.r, 0)?.colSpan, 2);
  assert.equal(mergeAt(head.r, 6)?.colSpan, 6);
  // 표 안 병합(비율~금액)은 두 열이 차지한 시트 칸 전체로
  assert.equal(mergeAt(head.r + 1, 2)?.colSpan, 4);
  // 수식의 열 이름은 그 열이 놓인 시트 열로
  assert.equal(s.formulas[`${head.r + 1}:${s.cols[6]}`], `=E${head.r + 2}`);
});
