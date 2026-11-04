/**
 * 시트 서식이 문서 머리(문서 정보 표·제목 줄)를 맡을 때(§11.15)
 * - 시트에 기안 정보·문서 항목 칸이 있으면 문서 머리의 같은 항목을 뺀다 — 문서가 쓴 서식 버전의 시트로 정하므로
 *   서식을 고쳐도 이미 쓴 문서의 머리는 바뀌지 않는다
 * - [문서 정보 표 넣기] — 시트 맨 위에 표준 문서 정보 표를 끼운다
 * - 대외 문서에서 숨길 행 — 거래처용 모양(서식 '대외 문서' + 결재 완료)에서 행째 뺀다
 */
import { applyBorder, applyStyle, deleteRow, insertCol, insertRow, mergeRange, setCellValue, setRowMeta, type Sheet } from '@/lib/sheet';
import type { HeaderItem } from '@/domain/approvalForm/headerItems';
import { TITLE_ROW } from '@/domain/approvalForm/headerItems';
import { APPROVAL_NS, setApprovalProp, type BindSource } from './approvalSheet';

/** 칸의 자동 채우기·문서 항목 → 문서 머리에서 뺄 항목 */
const HEADER_OF_BIND: Record<string, HeaderItem | typeof TITLE_ROW> = {
  'draft.docNo': 'docNo',
  'draft.dept': 'drafterDept',
  'draft.drafter': 'drafter',
  'draft.date': 'draftDate',
  'doc.preservation': 'preservation',
  'doc.visibility': 'visibility',
  'doc.title': TITLE_ROW,
};

/** 시트 안에 있어서 문서 머리에서 뺄 항목 */
export function sheetHeaderItems(s: Sheet | null | undefined): string[] {
  if (!s) return [];
  const out = new Set<string>();
  Object.values(s.cellMeta[APPROVAL_NS.bind] ?? {}).forEach((b) => {
    const item = typeof b === 'string' ? HEADER_OF_BIND[b] : undefined;
    if (item) out.add(item);
  });
  return [...out];
}

/** 문서 정보 표 라벨 칸 바탕 — 문서 머리 표와 같은 회색(넣은 뒤 서식에 맞게 바꿔 쓰면 됨) */
const LABEL_BG = '#f2f2f2';
/** 문서 정보 표 줄 수(빈 줄 하나 더 붙음) */
export const DOC_INFO_ROWS = 4;

/**
 * 시트 맨 위에 표준 문서 정보 표를 끼운다 — 문서번호·기안부서 / 기안자·기안일 / 보존연한·공개범위 / 제목, 아래 빈 줄 하나.
 * 열이 넷보다 적으면 늘린다. 넣은 행(빈 줄 포함)은 '대외 문서에서 숨김'.
 */
export function insertDocInfoBlock(s0: Sheet): Sheet {
  let s = s0;
  while (s.cols.length < 4) s = insertCol(s, s.cols.length);
  for (let i = 0; i <= DOC_INFO_ROWS; i++) s = insertRow(s, 0);
  const n = s.cols.length;
  const mid = Math.floor(n / 2);
  const label = (r: number, c: number, text: string) => {
    s = setCellValue(s, r, c, text, { allowFormula: false });
    s = applyStyle(s, { r1: r, r2: r, c1: c, c2: c }, { bold: true, bg: LABEL_BG, align: 'center' });
  };
  const value = (r: number, c1: number, c2: number, bind: BindSource) => {
    if (c2 > c1) s = mergeRange(s, { r1: r, r2: r, c1, c2 });
    s = setApprovalProp(s, { r1: r, r2: r, c1, c2: c1 }, APPROVAL_NS.bind, bind);
  };
  const pairs: Array<[string, BindSource, string, BindSource]> = [
    ['문서번호', 'draft.docNo', '기안부서', 'draft.dept'],
    ['기안자', 'draft.drafter', '기안일', 'draft.date'],
    ['보존연한', 'doc.preservation', '공개범위', 'doc.visibility'],
  ];
  pairs.forEach(([l1, b1, l2, b2], r) => {
    label(r, 0, l1);
    value(r, 1, mid - 1, b1);
    label(r, mid, l2);
    value(r, mid + 1, n - 1, b2);
  });
  label(3, 0, '제목');
  value(3, 1, n - 1, 'doc.title');
  s = applyStyle(s, { r1: 3, r2: 3, c1: 1, c2: 1 }, { bold: true });
  s = applyBorder(s, { r1: 0, r2: DOC_INFO_ROWS - 1, c1: 0, c2: n - 1 }, 'all');
  for (let r = 0; r <= DOC_INFO_ROWS; r++) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
  return s;
}

/** 대외 문서에서 숨길 행인가 */
export function isExternalHiddenRow(s: Sheet, r: number): boolean {
  return !!s.rowMeta[APPROVAL_NS.extHide]?.[String(r)];
}

/** 행들의 '대외 문서에서 숨김' 켜고 끄기 */
export function setExternalHiddenRows(s0: Sheet, r1: number, r2: number, on: boolean): Sheet {
  let s = s0;
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) s = setRowMeta(s, APPROVAL_NS.extHide, r, on || undefined);
  return s;
}

/** 대외 문서 모양 — 숨길 행을 뺀 시트(아래 행부터 지워 번호가 밀리지 않게) */
export function withoutExternalRows(s0: Sheet): Sheet {
  const rows = Object.keys(s0.rowMeta[APPROVAL_NS.extHide] ?? {})
    .map(Number)
    .filter((r) => isExternalHiddenRow(s0, r) && r < s0.rows.length)
    .sort((a, b) => b - a);
  return rows.reduce((s, r) => deleteRow(s, r), s0);
}
