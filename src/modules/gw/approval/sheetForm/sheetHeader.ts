/**
 * 시트 서식이 문서 머리(문서 정보 표·제목 줄)를 맡을 때(§11.15)
 * - 시트에 기안 정보·문서 항목 칸이 있으면 문서 머리의 같은 항목을 뺀다 — 문서가 쓴 서식 버전의 시트로 정하므로
 *   서식을 고쳐도 이미 쓴 문서의 머리는 바뀌지 않는다
 * - [문서 정보 표 넣기] — 시트 맨 위에 표준 문서 정보 표를 끼운다
 * - 대외 문서에서 숨길 행 — 거래처용 모양(서식 '대외 문서' + 결재 완료)에서 행째 뺀다
 */
import { applyBorder, applyStyle, deleteRow, insertCol, insertRow, mergeRange, setCellValue, setRowMeta, type Sheet } from '@/lib/sheet';
import type { HeaderItem } from '@/domain/approvalForm/headerItems';
import { HEADER_ITEMS, STAMP_TABLE, TITLE_ROW } from '@/domain/approvalForm/headerItems';
import { APPROVAL_NS, DEFAULT_CLOSING, setApprovalProp, type BindSource } from './approvalSheet';

/** 칸의 자동 채우기·문서 항목 → 문서 머리에서 뺄 항목 */
const HEADER_OF_BIND: Record<string, HeaderItem | typeof TITLE_ROW> = {
  'draft.docNo': 'docNo',
  'draft.dept': 'drafterDept',
  'draft.drafter': 'drafter',
  'draft.date': 'draftDate',
  'draft.completedDate': 'completedDate',
  'doc.formTitle': 'docTitle',
  'doc.preservation': 'preservation',
  'doc.visibility': 'visibility',
  'doc.title': TITLE_ROW,
};

/**
 * 시트 안에 있어서 문서 머리에서 뺄 항목.
 * 결재란이 시트에 있으면 문서 머리 전체(상단 바·큰 제목·결재란·문서 정보·제목 줄·맺음말)가 시트 안에 있는 것 — 모두 뺀다.
 */
export function sheetHeaderItems(s: Sheet | null | undefined): string[] {
  if (!s) return [];
  const binds = Object.values(s.cellMeta[APPROVAL_NS.bind] ?? {});
  if (binds.includes('doc.approvalLine')) return [...HEADER_ITEMS, TITLE_ROW, STAMP_TABLE];
  const out = new Set<string>();
  binds.forEach((b) => {
    const item = typeof b === 'string' ? HEADER_OF_BIND[b] : undefined;
    if (item) out.add(item);
  });
  return [...out];
}

/** 시트가 문서 머리 전체를 맡는가(결재란이 시트 안에) */
export const isFullHeaderSheet = (s: Sheet | null | undefined) => sheetHeaderItems(s).includes(STAMP_TABLE);

/** 문서 정보 표 라벨 칸 바탕 — 문서 머리 표와 같은 회색(넣은 뒤 서식에 맞게 바꿔 쓰면 됨) */
const LABEL_BG = '#f2f2f2';
/** 문서 정보 표 줄 수(빈 줄 하나 더 붙음) */
export const DOC_INFO_ROWS = 5;

/**
 * 시트 맨 위에 표준 문서 정보 표를 끼운다 — 문서번호·기안부서 / 기안자·기안일 / 보존연한·공개범위 / 결재 완료일 / 제목, 아래 빈 줄 하나.
 * (문서 머리의 문서 정보 표와 같은 항목 — 결재 완료일은 결재가 끝난 뒤에만 값이 보인다)
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
  label(3, 0, '결재 완료일');
  value(3, 1, n - 1, 'draft.completedDate');
  label(4, 0, '제목');
  value(4, 1, n - 1, 'doc.title');
  s = applyStyle(s, { r1: 4, r2: 4, c1: 1, c2: 1 }, { bold: true });
  s = applyBorder(s, { r1: 0, r2: DOC_INFO_ROWS - 1, c1: 0, c2: n - 1 }, 'all');
  for (let r = 0; r <= DOC_INFO_ROWS; r++) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
  return s;
}

/** 큰 제목·결재란 줄 높이(px) — 결재란(이름·도장 칸)이 들어갈 만큼 */
const TITLE_ROW_HEIGHT = 96;

/**
 * 문서 머리 전체를 시트에 넣는다 — 위: 회사 로고 / 큰 제목·결재란 / 문서 정보 표, 아래: 맺음말·기안일·기안자 서명.
 * formTitle: 큰 제목 칸에 '문서 이름' 부품(서식의 격식 문서명·서식명이 저절로) — 아니면 title 글자, 둘 다 없으면(엑셀처럼 제목이 이미 본문에 있을 때) 비워 둔다.
 * 대외 문서에서 숨김: 로고 줄·문서 정보 표·맺음말(큰 제목 줄은 남김 — 결재란 칸은 대외 문서에서 저절로 빈다)
 */
export function insertDocHeader(
  s0: Sheet,
  opts: {
    title?: string;
    formTitle?: boolean;
    closing?: string;
    /** 회사 로고 줄(기본 넣음) */
    logo?: boolean;
    /** 문서 정보 표(기본 넣음) */
    info?: boolean;
    /** 맺음말·기안일·기안자 서명(기본 넣음) */
    closingBlock?: boolean;
  } = {},
): Sheet {
  let s = s0;
  while (s.cols.length < 4) s = insertCol(s, s.cols.length);
  const n = s.cols.length;
  const all = (r: number) => ({ r1: r, r2: r, c1: 0, c2: n - 1 });
  // 아래 — 맺음말(빈 줄 · 문구 · 기안일 · 기안자 서명)
  if (opts.closingBlock !== false) s = appendClosing(s, opts.closing);
  // 위 — 문서 정보 표, 그 위에 로고 줄·큰 제목/결재란 줄·빈 줄
  if (opts.info !== false) s = insertDocInfoBlock(s);
  const logo = opts.logo !== false;
  const top = logo ? 3 : 2;
  for (let i = 0; i < top; i++) s = insertRow(s, 0);
  const mid = Math.floor(n / 2);
  if (logo) {
    s = mergeRange(s, all(0));
    s = setApprovalProp(s, { r1: 0, r2: 0, c1: 0, c2: 0 }, APPROVAL_NS.bind, 'doc.logo');
    s = setRowMeta(s, APPROVAL_NS.extHide, 0, true);
  }
  const t = logo ? 1 : 0;
  if (mid > 1) s = mergeRange(s, { r1: t, r2: t, c1: 0, c2: mid - 1 });
  if (n - 1 > mid) s = mergeRange(s, { r1: t, r2: t, c1: mid, c2: n - 1 });
  const title = opts.title?.trim() ?? '';
  if (opts.formTitle) s = setApprovalProp(s, { r1: t, r2: t, c1: 0, c2: 0 }, APPROVAL_NS.bind, 'doc.formTitle');
  else if (title) s = setCellValue(s, t, 0, title, { allowFormula: false });
  if (opts.formTitle || title) s = applyStyle(s, { r1: t, r2: t, c1: 0, c2: 0 }, { bold: true, fontSize: 20, align: 'center', valign: 'middle' });
  s = setApprovalProp(s, { r1: t, r2: t, c1: mid, c2: mid }, APPROVAL_NS.bind, 'doc.approvalLine');
  s = applyStyle(s, { r1: t, r2: t, c1: mid, c2: mid }, { align: 'right', valign: 'top' });
  s = { ...s, rowHeights: { ...s.rowHeights, [String(t)]: TITLE_ROW_HEIGHT } };
  // 큰 제목이 비면 대외 문서에선 줄째 뺀다(빈 큰 줄이 남지 않게)
  if (!title && !opts.formTitle) s = setRowMeta(s, APPROVAL_NS.extHide, t, true);
  s = setRowMeta(s, APPROVAL_NS.extHide, t + 1, true);
  return s;
}

/** 맺음말 — 빈 줄 · 문구 · 기안일 · 기안자 서명(가운데, 대외 문서에서 숨김) */
function appendClosing(s0: Sheet, closing: string | undefined): Sheet {
  let s = s0;
  const n = s.cols.length;
  const all = (r: number) => ({ r1: r, r2: r, c1: 0, c2: n - 1 });
  const center = (r: number) => (s = applyStyle(s, all(r), { align: 'center' }));
  const end = s.rows.length;
  for (let i = 0; i < 4; i++) s = insertRow(s, s.rows.length);
  for (let r = end + 1; r <= end + 3; r++) s = mergeRange(s, all(r));
  s = setCellValue(s, end + 1, 0, closing ?? DEFAULT_CLOSING, { allowFormula: false });
  s = setApprovalProp(s, { r1: end + 2, r2: end + 2, c1: 0, c2: 0 }, APPROVAL_NS.bind, 'draft.date');
  s = setApprovalProp(s, { r1: end + 3, r2: end + 3, c1: 0, c2: 0 }, APPROVAL_NS.bind, 'draft.sign');
  for (let r = end + 1; r <= end + 3; r++) center(r);
  s = applyStyle(s, all(end + 2), { bold: true });
  for (let r = end; r <= end + 3; r++) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
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
