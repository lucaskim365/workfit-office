import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sheet } from '@/lib/sheet';
import { approvalFormSchema, formFieldSchema, type ApprovalForm } from '@/domain/approvalForm/schema';
import { APPROVAL_NS, approvalCellProps, conditionHiddenRows, rowConditionOf } from './approvalSheet';
import { legacyFormToSheet } from './fromLegacyForm';
import { repeatSections } from './repeatRows';
import { isFullHeaderSheet } from './sheetHeader';

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
    cellFormulas: { '1:b': { expr: 'A1' } },
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
  assert.equal(approvalCellProps(s, head.r + 1, 1).input, undefined, '수식 칸은 입력 칸이 아님');
  assert.equal(repeatSections(s).length, 1);
  assert.equal(repeatSections(s)[0].first, head.r + 1);
  assert.ok(warnings.some((w) => w.includes('수식')));
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
    { key: 'sort_carr', label: '분류', type: '선택', options: ['우편/택배', '퀵서비스'], visibleIf: 'expenseItem:운반비', width: 'half' },
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

test('기존 서식 → 시트 — 표의 미리 쓴 글자 칸도 입력 칸(기존 표는 수식 칸 말고 모두 고칠 수 있었음)', () => {
  const table = JSON.stringify({
    cols: ['구분', '항목', '내용'],
    rows: [{ 구분: '구분', 항목: '항목', 내용: '내용' }, { 구분: '자재', 항목: '', 내용: '' }],
    legacyHeaderRow: true,
    colWidths: {}, tableWidth: '100%', merges: [], cellFormulas: {}, cellStyles: {}, secretCols: [], secretCells: [], secretRows: [],
  });
  const { sheet: s } = legacyFormToSheet(legacyForm('발주', [{ key: 'body', label: '내역', type: '표', placeholder: table }]));
  const head = findText(s, '항목')!;
  assert.equal(approvalCellProps(s, head.r, 0).input, undefined, '머리 줄은 고정 글자');
  const pre = findText(s, '자재')!;
  assert.equal(approvalCellProps(s, pre.r, pre.c).input?.type, 'text', '미리 쓴 글자는 기본값이 든 입력 칸');
});
