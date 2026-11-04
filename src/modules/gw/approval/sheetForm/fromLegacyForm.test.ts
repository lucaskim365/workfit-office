import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sheet } from '@/lib/sheet';
import { approvalFormSchema, formFieldSchema, type ApprovalForm } from '@/domain/approvalForm/schema';
import { APPROVAL_NS, approvalCellProps } from './approvalSheet';
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
