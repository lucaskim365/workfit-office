/**
 * 기존 서식 → 시트 서식 초안 자동 변환(§11.17). 기존 서식은 읽기만 한다 — 결과는 새 서식으로 저장된다.
 *
 * - 항목은 [라벨 | 값] 칸으로: 반쪽(half) 항목은 한 줄에 둘, 한 줄(full) 항목은 값 칸을 끝까지 합침. 섹션은 제목 줄
 * - 입력 종류·금액 키·연동 칸 이름(휴가 기간 등)·비공개·대외 숨김을 옮긴다
 * - '표'는 칸·병합·굵게·정렬·회색 바탕을 옮기고 마지막 줄을 반복 구간으로(수식은 값만 — 경고)
 * - 직인·자동번호·회사정보·안내문은 시트 부품으로, 문서제목은 문서 정보 표의 제목 칸이 대신한다
 * - 맨 위·아래에 문서 머리 전체(로고·큰 제목·결재란·문서 정보·맺음말)를 넣는다
 */
import {
  applyBorder,
  applyStyle,
  createSheet,
  insertRow,
  mergeRange,
  setCellValue,
  setRowMeta,
  type CellRange,
  type CellStyle,
  type Sheet,
} from '@/lib/sheet';
import type { ApprovalForm, FormField } from '@/domain/approvalForm/schema';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import { normalizeTablePayload } from '../formFields/sheetModel';
import { APPROVAL_NS, LINK_TYPES, linkTypeDef, setApprovalProp, setCellName, type CellInputType } from './approvalSheet';
import { setRepeatSection } from './repeatRows';
import { insertDocHeader } from './sheetHeader';

/** A4 인쇄 폭(SHEET_PAGE_WIDTH)과 같게 */
const PAGE = 718;
const LABEL_BG = '#f2f2f2';
const SECTION_BG = '#e8eef5';

const INPUT_OF: Partial<Record<FormField['type'], CellInputType>> = {
  텍스트: 'text',
  장문: 'multiline',
  숫자: 'number',
  금액: 'currency',
  날짜: 'date',
  기간: 'dateRange',
  선택: 'select',
  다중선택: 'multiSelect',
  체크: 'checkbox',
  사용자: 'user',
  부서: 'dept',
};

export interface LegacyConversion {
  sheet: Sheet;
  /** 대체 서식(연동 유형) — 기존 서식 코드가 연동 서식(휴가 등)이면 그 코드 */
  link: string | null;
  /** 옮기지 못했거나 손봐야 할 것 */
  warnings: string[];
}

export function legacyFormToSheet(form: ApprovalForm): LegacyConversion {
  const warnings: string[] = [];
  const link = LINK_TYPES.some((t) => t.code === form.code) ? form.code : null;
  const linkNames = new Set(linkTypeDef(link)?.names.map((n) => n.key) ?? []);
  const fields = form.fields ?? [];
  // 기존 서식이 숨긴 문서 머리 항목 — 공문처럼 머리를 거의 다 끈 서식은 그 모양 그대로
  const hiddenHead = new Set(form.hiddenHeaderItems ?? []);
  const INFO_ITEMS = ['docNo', 'drafterDept', 'drafter', 'draftDate', 'preservation', 'visibility'];
  const withInfo = !INFO_ITEMS.every((i) => hiddenHead.has(i));

  // 열 수 — 표가 넓으면 표에 맞춘다(최소 4: 라벨·값·라벨·값)
  const tableCols = fields.filter((f) => f.type === '표').map((f) => normalizeTablePayload(f.placeholder).cols.length);
  const n = Math.max(4, ...tableCols);
  const mid = Math.floor(n / 2);
  let s = createSheet(1, n);
  s = { ...s, colWidths: Object.fromEntries(s.cols.map((c) => [c, Math.floor(PAGE / n)])) };
  let row = 0;
  /** 다음 줄 — 시트를 한 줄 늘려 그 번호를 준다 */
  const nextRow = () => {
    if (row >= s.rows.length) s = insertRow(s, s.rows.length);
    return row++;
  };
  const span = (r: number, c1: number, c2: number): CellRange => ({ r1: r, r2: r, c1, c2 });
  const merge = (r: number, c1: number, c2: number) => {
    if (c2 > c1) s = mergeRange(s, span(r, c1, c2));
  };
  const label = (r: number, c: number, text: string) => {
    s = setCellValue(s, r, c, text, { allowFormula: false });
    s = applyStyle(s, span(r, c, c), { bold: true, bg: LABEL_BG, align: 'center' });
  };
  /** 값 칸 — 항목 종류에 맞는 부품·이름·비공개 */
  const value = (r: number, c1: number, c2: number, f: FormField) => {
    merge(r, c1, c2);
    const at = span(r, c1, c1);
    const input = INPUT_OF[f.type];
    if (input) {
      const options = input === 'select' || input === 'multiSelect' ? { options: f.options ?? [] } : {};
      s = setApprovalProp(s, at, APPROVAL_NS.input, { type: input, ...options });
      if (f.required) s = setApprovalProp(s, at, APPROVAL_NS.required, true);
    } else if (f.type === '자동번호') {
      // 같은 서식 코드에 붙이므로 그 항목의 순번을 이어 쓴다(1번부터 다시 시작하지 않게)
      s = setApprovalProp(s, at, APPROVAL_NS.autoNo, { ...(f.autoNumber ?? DEFAULT_AUTO_NUMBER), channelKey: f.key });
    }
    // 금액 키 → 결재선 금액, 연동 서식의 연동 칸(휴가 기간 등)은 같은 이름
    if (f.type === '금액' && f.isAmountKey) s = setCellName(s, r, c1, 'amount');
    else if (linkNames.has(f.key)) s = setCellName(s, r, c1, f.key);
    // 선택 항목은 기존 키 그대로 — 결재선 규칙 조건(예: 지출결의 expenseItem = 식대)이 이 키로 값을 읽는다
    else if (f.type === '선택' || f.type === '다중선택') s = setCellName(s, r, c1, f.key);
    if (f.isSecret) s = setApprovalProp(s, at, APPROVAL_NS.secret, true);
    if (f.type === '장문') s = { ...s, rowHeights: { ...s.rowHeights, [String(r)]: 80 } };
  };
  const box = (r1: number, r2: number) => (s = applyBorder(s, { r1, r2, c1: 0, c2: n - 1 }, 'all'));
  const extHide = (r: number, f: FormField) => {
    if (f.hideOnExternal) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
  };

  if (fields.some((f) => f.visibleIf)) warnings.push('조건부로 보이던 항목(탭·선택에 따라 숨김)은 모두 한꺼번에 보입니다 — 필요 없으면 지우세요.');

  // 섹션 순서대로
  const sections: string[] = [];
  fields.forEach((f) => !sections.includes(f.section ?? '') && sections.push(f.section ?? ''));
  let pendingHalf: FormField | null = null;
  let halfRow = -1;
  const flushHalf = () => {
    pendingHalf = null;
  };

  for (const section of sections) {
    flushHalf();
    if (section) {
      const r = nextRow();
      merge(r, 0, n - 1);
      s = setCellValue(s, r, 0, section, { allowFormula: false });
      s = applyStyle(s, span(r, 0, 0), { bold: true, bg: SECTION_BG });
      box(r, r);
    }
    for (const f of fields.filter((x) => (x.section ?? '') === section)) {
      // 문서 제목은 문서 정보 표의 제목 칸이 맡는다(문서 정보 표를 안 넣는 서식은 이 자리에 제목 칸)
      if (f.type === '문서제목') {
        if (withInfo) continue;
        flushHalf();
        const r = nextRow();
        label(r, 0, f.label || '제목');
        merge(r, 1, n - 1);
        s = setApprovalProp(s, span(r, 1, 1), APPROVAL_NS.bind, 'doc.title');
        s = applyStyle(s, span(r, 1, 1), { bold: true });
        box(r, r);
        continue;
      }
      if (f.type === '안내문') {
        flushHalf();
        const r = nextRow();
        merge(r, 0, n - 1);
        s = setCellValue(s, r, 0, f.placeholder || f.label, { allowFormula: false });
        s = setApprovalProp(s, span(r, 0, 0), APPROVAL_NS.guide, true);
        continue;
      }
      if (f.type === '회사정보') {
        flushHalf();
        const r = nextRow();
        merge(r, 0, n - 1);
        s = setApprovalProp(s, span(r, 0, 0), APPROVAL_NS.bind, 'doc.letterhead');
        extHide(r, f);
        continue;
      }
      if (f.type === '직인') {
        flushHalf();
        const r = nextRow();
        merge(r, 0, n - 2);
        s = setCellValue(s, r, 0, f.label, { allowFormula: false });
        s = applyStyle(s, span(r, 0, 0), { bold: true, align: 'right', fontSize: 15 });
        s = setApprovalProp(s, span(r, n - 1, n - 1), APPROVAL_NS.seal, true);
        if (f.markId) s = setApprovalProp(s, span(r, n - 1, n - 1), APPROVAL_NS.sealMark, f.markId);
        s = { ...s, rowHeights: { ...s.rowHeights, [String(r)]: 76 } };
        continue;
      }
      if (f.type === '표') {
        flushHalf();
        s = placeTable(f);
        continue;
      }
      // 라벨·값 항목 — 반쪽은 한 줄에 둘
      if (f.width === 'half' && f.type !== '장문') {
        if (pendingHalf) {
          label(halfRow, mid, f.label);
          value(halfRow, mid + 1, n - 1, f);
          extHide(halfRow, f);
          pendingHalf = null;
          continue;
        }
        const r = nextRow();
        label(r, 0, f.label);
        value(r, 1, mid - 1, f);
        // 짝이 없으면 오른쪽 절반은 빈 라벨·값으로 남는다(테두리는 줄 전체)
        box(r, r);
        extHide(r, f);
        pendingHalf = f;
        halfRow = r;
        continue;
      }
      flushHalf();
      const r = nextRow();
      label(r, 0, f.label);
      value(r, 1, n - 1, f);
      box(r, r);
      extHide(r, f);
    }
  }

  /** '표' — 제목 줄 + 표 칸(병합·굵게·정렬·회색 바탕), 빈 칸은 입력 칸, 마지막 줄은 반복 구간 */
  function placeTable(f: FormField): Sheet {
    const t = normalizeTablePayload(f.placeholder);
    if (f.label) {
      const r = nextRow();
      merge(r, 0, n - 1);
      s = setCellValue(s, r, 0, f.label, { allowFormula: false });
      s = applyStyle(s, span(r, 0, 0), { bold: true });
    }
    const top = row;
    const tc = t.cols.length;
    t.rows.forEach((tr, i) => {
      const r = nextRow();
      t.cols.forEach((tcol, j) => {
        // 표 열이 시트보다 적으면 마지막 열이 남는 열을 덮는다
        const c2 = j === tc - 1 ? n - 1 : j;
        if (c2 > j) merge(r, j, c2);
        const text = String(tr[tcol] ?? '');
        if (text) s = setCellValue(s, r, j, text, { allowFormula: false });
        const st = t.cellStyles[`${i}:${tcol}`];
        const patch: Partial<CellStyle> = {};
        if (st?.bold) patch.bold = true;
        if (st?.align) patch.align = st.align;
        if (st?.bg === 'gray') patch.bg = LABEL_BG;
        if (st?.numFmt && st.numFmt !== 'general') patch.numFmt = st.numFmt;
        if (Object.keys(patch).length) s = applyStyle(s, span(r, j, j), patch);
        if (st?.seal) s = setApprovalProp(s, span(r, j, j), APPROVAL_NS.seal, true);
        // 제목 줄(굵게·0번 줄)이 아니고 비어 있는 칸은 기안자가 쓰는 칸
        const header = i === 0 && (t.legacyHeaderRow || st?.bold);
        if (!text && !header && !st?.seal && !t.cellFormulas[`${i}:${tcol}`]) {
          s = setApprovalProp(s, span(r, j, j), APPROVAL_NS.input, { type: st?.numFmt === 'currency' ? 'currency' : 'text' });
        }
      });
      if (f.hideOnExternal) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
    });
    // 표 안 병합
    t.merges.forEach((m) => {
      s = mergeRange(s, { r1: top + m.startRow, r2: top + m.startRow + m.rowSpan - 1, c1: m.startCol, c2: m.startCol + m.colSpan - 1 });
    });
    const bottom = row - 1;
    if (bottom >= top) {
      s = applyBorder(s, { r1: top, r2: bottom, c1: 0, c2: n - 1 }, 'all');
      // 기존 '표'는 기안자가 행을 추가하던 표 — 마지막 줄을 반복 구간으로(머리 줄 하나뿐이면 두지 않음)
      if (bottom > top || !(t.legacyHeaderRow ?? false)) s = setRepeatSection(s, bottom, bottom, f.label || '반복 구간');
    }
    if (Object.keys(t.cellFormulas).length) warnings.push(`'${f.label || '표'}'의 수식은 값만 옮겼습니다 — 합계 등은 시트 수식(=SUM 등)으로 다시 넣어 주세요.`);
    return s;
  }

  // 빈 마지막 줄(시작용 한 줄을 안 썼을 때) 정리는 하지 않는다 — 본문 아래 여유 줄
  if (row === 0) warnings.push('옮길 항목이 없습니다 — 빈 본문으로 만들었습니다.');

  if (withInfo && INFO_ITEMS.some((i) => hiddenHead.has(i))) {
    warnings.push('기존 서식에서 일부만 숨겼던 문서 정보 항목도 문서 정보 표에 들어 있습니다 — 필요 없으면 그 칸을 지우세요.');
  }
  s = insertDocHeader(s, {
    formTitle: !hiddenHead.has('docTitle'),
    closing: form.closing ?? undefined,
    logo: !hiddenHead.has('topBar'),
    info: withInfo,
    closingBlock: !hiddenHead.has('closing'),
  });
  return { sheet: s, link, warnings };
}
