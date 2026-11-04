/**
 * 전자결재 시트 서식 — 시트 모듈(@/lib/sheet)의 부가 정보 이름공간에 결재 전용 칸 속성을 얹는다
 * - input: 입력 칸 종류(CellInput) / name: 칸 이름(연동 키) / bind: 데이터 불러오기(BindSource)
 * - lock: 기안자 수정 잠금 / secret: 비공개(칸·행·열) / seal: 회사 직인 칸 — 값은 모두 true
 */
import { cellKey, colLetter, parseNumber, pasteTsv, recalculate, setCellMeta, setCellValue, type CellRange, type Sheet } from '@/lib/sheet';
import { LEAVE_TYPE_OPTIONS, calculateLeaveDays, isHalfDayLeave, isQuarterDayLeave } from '@/domain/leave/policy';

/** 시트 부가 정보 이름공간 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const APPROVAL_NS = {
  input: 'input',
  name: 'name',
  bind: 'bind',
  lock: 'lock',
  secret: 'secret',
  seal: 'seal',
  /** 반복 구간(행) — rowMeta, 값 { id, label } */
  repeat: 'repeat',
  /** 대외 문서에서 숨길 행 — rowMeta, 값 true. 서식의 '대외 문서'가 켜진 결재 완료 문서(거래처용 모양·발주서 PDF)에서 행째 뺀다 */
  extHide: 'extHide',
} as const;

export type CellInputType =
  | 'text'
  | 'multiline'
  | 'number'
  | 'currency'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'checkbox'
  | 'user'
  | 'dept';

/** cellMeta.input 값 — options는 select·multiSelect만 */
export interface CellInput {
  type: CellInputType;
  options?: string[];
}

/**
 * cellMeta.bind 값 — '출처.항목'. 지금 쓰는 출처는 프로젝트뿐(project.계약일자 등):
 * 기안자가 서식에서 프로젝트를 고르면 이 값이 붙은 칸들을 그 프로젝트 값으로 한꺼번에 채운다.
 * 프로젝트 항목은 프로젝트 관리 데이터가 정해진 뒤 BIND_GROUPS 에 더한다(§11.4).
 */
export type BindSource = `draft.${string}` | `doc.${string}` | `project.${string}`;

/**
 * 기안 정보 — 자동 채우기 'draft.*' 칸에 보일 값. 작성 중엔 작성자·오늘, 상신된 문서는 문서에 남은 값(바뀌지 않음).
 * title·preservation·visibility 는 '문서 항목'(doc.*) 칸 — 문서 보기에서 문서의 제목·보존연한·공개범위
 */
export interface DraftInfo {
  drafter: string;
  dept: string;
  date: string;
  docNo: string;
  /** 결재 완료일 — 결재가 끝난 문서만(작성·결재 중엔 빈 값) */
  completedDate?: string;
  title?: string;
  preservation?: string;
  visibility?: string;
}

const INFO_KEY: Record<string, keyof DraftInfo> = {
  'draft.drafter': 'drafter',
  'draft.dept': 'dept',
  'draft.date': 'date',
  'draft.docNo': 'docNo',
  'draft.completedDate': 'completedDate',
  'doc.title': 'title',
  'doc.preservation': 'preservation',
  'doc.visibility': 'visibility',
};

/** 기안 정보 날짜 글자 — 문서 머리와 같은 '2026년 11월 4일'. 못 읽으면 빈 값 */
export function korDateText(d: Date | string | null | undefined): string {
  if (!d) return '';
  const t = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(t.getTime()) ? '' : `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`;
}

/** 자동 채우기 칸의 값 — 기안 정보(draft.*)·문서 항목(doc.*)이면 그 값, 아니면 undefined */
export function draftInfoValue(bind: string | undefined, info: DraftInfo | undefined): string | undefined {
  const key = bind ? INFO_KEY[bind] : undefined;
  if (!key || !info) return undefined;
  return info[key];
}

/**
 * 문서 항목(doc.*) — 문서의 제목·보존연한·공개범위를 시트 칸에서 쓴다. 값은 칸이 아니라 문서 자체(제목·보존연한·공개범위)에
 * 저장되므로 문서 목록·검색·모바일은 그대로 읽는다.
 */
export const DOC_FIELD_BINDS = ['doc.title', 'doc.preservation', 'doc.visibility'] as const;
export type DocFieldBind = (typeof DOC_FIELD_BINDS)[number];
export const isDocFieldBind = (bind: string | undefined): bind is DocFieldBind => (DOC_FIELD_BINDS as readonly string[]).includes(bind ?? '');
/**
 * 문서 머리 부품 — 칸에 그림을 끼운다(값 없음). 그림은 문서를 그리는 쪽(기안·문서 보기)이 만들어 넘긴다(SheetSlots):
 * 결재란(결재선에 따라 칸 수가 바뀜, 결재하면 도장)·회사 로고·기안자 서명(이름+도장/서명)
 */
export interface SheetSlots {
  approvalLine?: import('react').ReactNode;
  logo?: import('react').ReactNode;
  drafterSign?: import('react').ReactNode;
}
const SLOT_OF: Record<string, keyof SheetSlots> = {
  'doc.approvalLine': 'approvalLine',
  'doc.logo': 'logo',
  'draft.sign': 'drafterSign',
};
/** 이 칸이 문서 머리 부품이면 그 이름 */
export const slotOf = (bind: string | undefined): keyof SheetSlots | undefined => (bind ? SLOT_OF[bind] : undefined);
/** 맺음말 기본 문구 — 문서 머리와 같음 */
export const DEFAULT_CLOSING = '위와 같이 상신하오니 재가하여 주시기 바랍니다.';

/** 회사 직인 칸이 있는 시트 — 직인 서식(결재가 끝나면 결재란 대신 회사 직인, [[seal]]) */
export function sheetHasSeal(s: Sheet | null | undefined): boolean {
  return !!s && Object.values(s.cellMeta[APPROVAL_NS.seal] ?? {}).some(Boolean);
}

/** 보존연한 고르기 — 문서 머리와 같은 목록 */
export const PRESERVATION_OPTIONS = ['1년', '3년', '5년', '10년', '영구'];
/** 공개범위 저장값 → 보이는 글자(문서 머리와 같음) */
export const VISIBILITY_LABEL: Record<string, string> = { 부서: '부서 공개', 비공개: '비공개' };

/** 이 이름공간의 칸이 든 행·열은 기안자가 지울 수 없음 */
const STRUCTURE_LOCK_NS = [APPROVAL_NS.name, APPROVAL_NS.bind, APPROVAL_NS.secret, APPROVAL_NS.seal];

/** 칸 이름·데이터 불러오기·비공개·직인이 든 행/열인지 — 기안자 삭제 금지 판단 */
export function isStructureLocked(s: Sheet, axis: 'row' | 'col', index: number): boolean {
  if (axis === 'row' && s.rowMeta[APPROVAL_NS.secret]?.[String(index)]) return true;
  const col = s.cols[index];
  if (axis === 'col' && col !== undefined && s.colMeta[APPROVAL_NS.secret]?.[col]) return true;
  return STRUCTURE_LOCK_NS.some((ns) =>
    Object.keys(s.cellMeta[ns] ?? {}).some((key) => {
      const i = key.indexOf(':');
      return axis === 'row' ? Number(key.slice(0, i)) === index : key.slice(i + 1) === col;
    })
  );
}

/** 값 입력 — 이름 붙은 칸(연동 칸)은 '='로 시작해도 수식이 아니라 값으로 저장 */
export function setApprovalCellValue(s: Sheet, r: number, c: number, text: string): Sheet {
  const col = s.cols[c];
  const named = col !== undefined && s.cellMeta[APPROVAL_NS.name]?.[cellKey(r, col)] !== undefined;
  return setCellValue(s, r, c, text, { allowFormula: !named });
}

/** 칸에 결재 이름공간 값이 있는가 */
const hasMeta = (s: Sheet, ns: string, r: number, c: number): boolean => {
  const col = s.cols[c];
  return col !== undefined && s.cellMeta[ns]?.[cellKey(r, col)] !== undefined;
};

/**
 * 기안자가 고칠 수 있는 칸인가 — 관리자가 입력 칸으로 정했고 잠그지 않은 칸만.
 * 기안자는 틀(행·열·병합·서식·수식)을 바꾸지 않는다: 서식 버전의 틀 위에 값만 얹어 저장하기 위해서다.
 */
export function isDraftEditable(s: Sheet, r: number, c: number): boolean {
  return hasMeta(s, APPROVAL_NS.input, r, c) && !hasMeta(s, APPROVAL_NS.lock, r, c);
}

/** 기안자 붙여넣기 — 입력 칸에만 들어가고, 시트를 늘리지 않으며, 이름 붙은 칸은 '='도 값으로 */
export function pasteDraftTsv(s: Sheet, r: number, c: number, text: string): Sheet {
  return pasteTsv(s, r, c, text, {
    grow: false,
    canWrite: (rr, cc) => isDraftEditable(s, rr, cc),
    allowFormula: (rr, cc) => !hasMeta(s, APPROVAL_NS.name, rr, cc),
  });
}

/** 병합으로 값이 지워지면 안 되는 칸(입력·이름·불러오기·직인) — 왼쪽 위 대표 칸은 남으므로 제외 */
const MERGE_GUARD_NS = [APPROVAL_NS.input, APPROVAL_NS.name, APPROVAL_NS.bind, APPROVAL_NS.seal];

/** 관리자 병합 가능 여부 — 연동 칸을 덮어 값·연결을 잃게 되면 false */
export function canMergeApprovalRange(s: Sheet, range: CellRange): boolean {
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const c1 = Math.min(range.c1, range.c2);
  const c2 = Math.max(range.c1, range.c2);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r === r1 && c === c1) continue;
      if (MERGE_GUARD_NS.some((ns) => hasMeta(s, ns, r, c))) return false;
    }
  }
  return true;
}

/** 문서에 저장할 값 — 칸 키 → 보이는 글자(수식 칸은 계산 결과). 빈 칸은 뺀다 */
export type SheetValues = Record<string, string>;

/**
 * 문서에는 시트 전체 대신 값만 저장한다. 틀은 서식 버전에 한 번만 둔다.
 * 수식 결과까지 저장해, 계산 규칙이 바뀌어도 결재 당시 숫자가 그대로 보이게 한다.
 */
export function extractValues(s: Sheet): SheetValues {
  const computed = recalculate(s);
  const out: SheetValues = {};
  computed.rows.forEach((row, r) => {
    computed.cols.forEach((col) => {
      const v = row[col];
      const c = s.cols.indexOf(col);
      // 입력·불러오기·수식 칸 + 이름 붙은 칸(시스템이 계산해 넣는 휴가 일수 등 — 입력 칸이 아니어도 값이 있다)
      const keep = s.formulas[cellKey(r, col)] !== undefined || hasMeta(s, APPROVAL_NS.input, r, c) || hasMeta(s, APPROVAL_NS.bind, r, c) || hasMeta(s, APPROVAL_NS.name, r, c);
      if (v !== undefined && v !== '' && keep) {
        out[cellKey(r, col)] = v;
      }
    });
  });
  return out;
}

/**
 * 서식 틀에 문서 값을 얹는다. 틀에 없는 칸 키는 버린다.
 * recalc: 작성 중에는 true(입력값으로 다시 계산), 상신된 문서를 볼 때는 false(저장된 결과를 그대로)
 */
export function applyValues(template: Sheet, values: SheetValues, opts: { recalc: boolean }): Sheet {
  const rows = template.rows.map((row) => ({ ...row }));
  Object.entries(values).forEach(([key, v]) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    if (rows[r] && template.cols.includes(col)) rows[r][col] = v;
  });
  const sheet = { ...template, rows };
  return opts.recalc ? recalculate(sheet) : sheet;
}

/** 이름 붙은 칸의 값 — 문서 fieldValues 에 이름으로 복사해 연동(결재선·휴가·근태·대시보드)이 읽는다 */
export function namedValues(s: Sheet): Record<string, string> {
  const computed = recalculate(s);
  const out: Record<string, string> = {};
  Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).forEach(([key, name]) => {
    const i = key.indexOf(':');
    const v = computed.rows[Number(key.slice(0, i))]?.[key.slice(i + 1)];
    if (typeof name === 'string' && v !== undefined) out[name] = v;
  });
  return out;
}

// ── 서식 편집기(관리자)용 — 칸 속성 이름표·읽기·쓰기·저장 전 검사 ──

/** 입력 칸 종류 이름표 (화면 표시 순서) */
export const CELL_INPUT_LABELS: Record<CellInputType, string> = {
  text: '한 줄 글',
  multiline: '여러 줄 글',
  number: '숫자',
  currency: '금액',
  date: '날짜',
  dateRange: '기간',
  select: '선택(하나)',
  multiSelect: '선택(여러 개)',
  checkbox: '체크',
  user: '사람',
  dept: '부서',
};

/**
 * 프로젝트 값 채우기 항목 — 묶음별. 프로젝트 관리 데이터(담당 차장 엑셀)를 받은 뒤 항목을 정한다(§11.4).
 * 비어 있는 동안 서식 편집기는 이 칸을 '준비 중'으로 보여 준다.
 */
export const BIND_GROUPS: { label: string; items: { value: BindSource; label: string }[] }[] = [
  {
    // 엑셀 양식 안의 '작성일자'·'담당자' 같은 칸 — 문서 머리의 문서 정보 표를 끄고 시트가 문서 전체가 될 때(§11 B안)
    label: '기안 정보',
    items: [
      { value: 'draft.drafter', label: '기안자' },
      { value: 'draft.dept', label: '기안 부서' },
      { value: 'draft.date', label: '기안일' },
      { value: 'draft.docNo', label: '문서번호' },
      { value: 'draft.completedDate', label: '결재 완료일' },
    ],
  },
  {
    // 문서 머리의 제목·보존연한·공개범위를 시트 안으로 — 기안자가 이 칸에서 쓰고, 값은 문서 자체에 저장
    label: '문서 항목',
    items: [
      { value: 'doc.title', label: '제목' },
      { value: 'doc.preservation', label: '보존연한' },
      { value: 'doc.visibility', label: '공개범위' },
    ],
  },
  {
    // 문서 머리 전체를 시트 안으로 — 결재란이 시트에 있으면 문서 머리를 모두 뺀다(§11.16)
    label: '문서 머리',
    items: [
      { value: 'doc.approvalLine', label: '결재란' },
      { value: 'doc.logo', label: '회사 로고' },
      { value: 'draft.sign', label: '기안자 서명' },
    ],
  },
];

export function bindLabel(source: string): string {
  for (const g of BIND_GROUPS) {
    const hit = g.items.find((i) => i.value === source);
    if (hit) return `${g.label} · ${hit.label}`;
  }
  return source;
}

/**
 * 칸 이름 — 시스템이 정한 목록에서만 고른다(연동이 이 이름으로 값을 찾음). 화면에는 한글 이름만.
 * 지금 읽는 기능이 있는 이름만 둔다: 금액키(기존 서식의 '금액키'와 같은 역할 — 문서 금액이 되어 결재선 규칙의 금액 조건이 읽음).
 * 본문(body)·휴가 기간 같은 연동 이름은 휴가원 등을 시트로 옮길 때(§11.7-5) 더한다. 저장 키(amount)는 바꾸지 말 것.
 */
export const COMMON_CELL_NAMES: { key: string; label: string; hint: string }[] = [
  { key: 'amount', label: '금액 키', hint: '문서 금액 — 결재선 규칙의 금액 조건이 읽음(기존 서식의 금액키와 같음)' },
];

export function cellNameLabel(key: string): string {
  return COMMON_CELL_NAMES.find((n) => n.key === key)?.label ?? key;
}

/** 한 칸의 결재 속성 */
export interface ApprovalCellProps {
  input?: CellInput;
  name?: string;
  bind?: string;
  lock: boolean;
  secret: boolean;
  seal: boolean;
}

const metaAt = (s: Sheet, ns: string, r: number, c: number): unknown => {
  const col = s.cols[c];
  return col === undefined ? undefined : s.cellMeta[ns]?.[cellKey(r, col)];
};

export function approvalCellProps(s: Sheet, r: number, c: number): ApprovalCellProps {
  const input = metaAt(s, APPROVAL_NS.input, r, c) as CellInput | undefined;
  const name = metaAt(s, APPROVAL_NS.name, r, c);
  const bind = metaAt(s, APPROVAL_NS.bind, r, c);
  return {
    input: input && typeof input === 'object' ? input : undefined,
    name: typeof name === 'string' ? name : undefined,
    bind: typeof bind === 'string' ? bind : undefined,
    lock: metaAt(s, APPROVAL_NS.lock, r, c) === true,
    secret: metaAt(s, APPROVAL_NS.secret, r, c) === true,
    seal: metaAt(s, APPROVAL_NS.seal, r, c) === true,
  };
}

/** 범위 안의 칸 — 병합에 가려진 칸은 빼고 대표 칸만 */
function visibleCells(s: Sheet, range: CellRange): { r: number; c: number }[] {
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const c1 = Math.min(range.c1, range.c2);
  const c2 = Math.max(range.c1, range.c2);
  const out: { r: number; c: number }[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const covered = s.merges.some(
        (m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan && !(r === m.startRow && c === m.startCol)
      );
      if (!covered) out.push({ r, c });
    }
  }
  return out;
}

/**
 * 범위의 모든 칸에 속성 하나를 넣거나 뺀다(value undefined/false → 뺌).
 * 칸 이름은 서식에 하나뿐이어야 하므로 이 함수가 아니라 setCellName 을 쓴다.
 */
export function setApprovalProp(
  s: Sheet,
  range: CellRange,
  ns: typeof APPROVAL_NS.input | typeof APPROVAL_NS.bind | typeof APPROVAL_NS.lock | typeof APPROVAL_NS.secret | typeof APPROVAL_NS.seal,
  value: CellInput | string | boolean | undefined
): Sheet {
  const v = value === false || value === '' ? undefined : value;
  return visibleCells(s, range).reduce((acc, { r, c }) => setCellMeta(acc, ns, r, c, v), s);
}

/** 칸 이름 붙이기 — 같은 이름이 다른 칸에 있으면 그 칸에서 뗀다(이름은 서식에 하나) */
export function setCellName(s: Sheet, r: number, c: number, name: string | undefined): Sheet {
  const col = s.cols[c];
  if (col === undefined) return s;
  const key = cellKey(r, col);
  const rec = { ...(s.cellMeta[APPROVAL_NS.name] ?? {}) };
  Object.keys(rec).forEach((k) => {
    if (k === key || (name && rec[k] === name)) delete rec[k];
  });
  if (name) rec[key] = name;
  const cellMeta = { ...s.cellMeta };
  if (Object.keys(rec).length > 0) cellMeta[APPROVAL_NS.name] = rec;
  else delete cellMeta[APPROVAL_NS.name];
  return { ...s, cellMeta };
}

/** 칸 주소(A1) — 안내 문구용 */
export function cellAddress(r: number, c: number): string {
  return `${colLetter(c)}${r + 1}`;
}

/**
 * 서식 저장 전 검사 — 기안이 안 되거나 연동이 틀어질 설정을 막는다.
 * 돌려준 문구가 하나라도 있으면 저장하지 않는다.
 */
export function validateApprovalSheet(s: Sheet): string[] {
  const errors: string[] = [];
  const at = (key: string) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const c = s.cols.indexOf(key.slice(i + 1));
    return { r, c, ok: c >= 0 && r >= 0 && r < s.rows.length };
  };
  if (!Object.keys(s.cellMeta[APPROVAL_NS.input] ?? {}).length) {
    errors.push('입력 칸이 하나도 없습니다. 기안자가 쓸 칸을 골라 \'입력 칸\'으로 정해 주세요.');
  }
  Object.entries(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach(([key, v]) => {
    const p = at(key);
    if (!p.ok) return;
    const input = v as CellInput;
    if ((input.type === 'select' || input.type === 'multiSelect') && !(input.options ?? []).some((o) => o.trim())) {
      errors.push(`${cellAddress(p.r, p.c)}: 선택 칸에 고를 항목이 없습니다.`);
    }
    if (s.formulas[key] !== undefined) {
      errors.push(`${cellAddress(p.r, p.c)}: 수식 칸은 입력 칸이 될 수 없습니다(기안자가 쓰면 수식이 지워짐).`);
    }
  });
  Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).forEach(([key, name]) => {
    const p = at(key);
    if (!p.ok) return;
    if (name === 'amount') {
      const input = s.cellMeta[APPROVAL_NS.input]?.[key] as CellInput | undefined;
      const numeric = input ? input.type === 'number' || input.type === 'currency' : s.formulas[key] !== undefined;
      if (!numeric) errors.push(`${cellAddress(p.r, p.c)}: '금액 키' 칸은 숫자·금액 입력 칸이거나 수식 칸이어야 합니다.`);
    }
  });
  return errors;
}

/** A4 세로 인쇄 폭(px, 좌우 여백 10mm) — 서식 편집기의 안내선, 문서 보기의 맞춤 폭 */
export const SHEET_PAGE_WIDTH = 718;

// ── 기안·문서 저장 (§11.2) ──

/** 문서 fieldValues 에 시트 값·서식 버전을 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const SHEET_VALUES_KEY = '__values';
export const SHEET_VERSION_KEY = '__formVersion';
/**
 * 사람 칸이 가리키는 사용자 ID — { 칸 키: 사용자 ID } JSON. 칸 값은 기안 당시의 '이름 (부서)'라
 * 문서 보기·인쇄는 그대로 두고(결재 당시 모습), 동명이인 구분·알림·연동은 이 ID 로 한다
 */
export const SHEET_REFS_KEY = '__refs';

/** 체크 칸에 넣는 값 */
export const CHECK_MARK = '✓';

/** fieldValues.__values(JSON 글자) → 칸 값. 없거나 깨졌으면 빈 값 */
export function readSheetValues(raw: unknown): SheetValues {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string')) as SheetValues;
  } catch {
    return {};
  }
}

/**
 * 문서 fieldValues 로 저장할 것 — 칸 값(JSON), 서식 버전, 이름 붙은 칸 값(body·amount 등).
 * 이름 붙은 칸 값은 연동 기능이 이름으로 읽는다(지금은 amount → 문서 금액 → 결재선 금액 조건).
 */
export function sheetDocFields(s: Sheet, formVersion: string, rowExtras: Record<string, number> = {}): Record<string, string> {
  // 시스템 이름(금액 키 등)만 문서 맨 위 칸으로 — 연동이 그 키로 읽는다. 직접 쓴 이름은 __named 에만(relatedImport.ts)
  const system = new Set(COMMON_CELL_NAMES.map((n) => n.key));
  const named = Object.fromEntries(Object.entries(namedValues(s)).filter(([k]) => system.has(k)));
  return {
    ...named,
    [SHEET_VALUES_KEY]: JSON.stringify(extractValues(s)),
    [SHEET_VERSION_KEY]: formVersion,
    // 반복 구간에 붙인 줄 수(repeatRows.ts SHEET_ROWS_KEY) — 없어도 키는 남겨 줄을 다 지운 뒤 옛 값이 남지 않게
    __rows: JSON.stringify(rowExtras),
  };
}

/** 기안자가 이 칸에 쓰는 입력 종류 — 고칠 수 없는 칸이면 undefined */
export function draftInputOf(s: Sheet, r: number, c: number): CellInput | undefined {
  if (!isDraftEditable(s, r, c)) return undefined;
  return approvalCellProps(s, r, c).input;
}

/** 숫자·금액 입력 칸인데 숫자로 읽히지 않는 칸 주소 — 상신 전 검사 */
export function invalidNumberCells(s: Sheet): string[] {
  const out: string[] = [];
  Object.entries(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach(([key, v]) => {
    const type = (v as CellInput).type;
    if (type !== 'number' && type !== 'currency') return;
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    const c = s.cols.indexOf(col);
    const raw = String(s.rows[r]?.[col] ?? '').trim();
    if (c >= 0 && raw !== '' && parseNumber(raw) === null) out.push(cellAddress(r, c));
  });
  return out;
}

/** 비공개 칸인가 — 칸·행·열 어느 쪽에든 비공개가 걸려 있으면 */
export function isSecretCell(s: Sheet, r: number, c: number): boolean {
  const col = s.cols[c];
  if (col === undefined) return false;
  return (
    s.cellMeta[APPROVAL_NS.secret]?.[cellKey(r, col)] === true ||
    s.rowMeta[APPROVAL_NS.secret]?.[String(r)] === true ||
    s.colMeta[APPROVAL_NS.secret]?.[col] === true
  );
}

/** 회사 직인 자리인가 */
export function isSealCell(s: Sheet, r: number, c: number): boolean {
  return approvalCellProps(s, r, c).seal;
}

// ── 대체 서식(연동 유형)과 연동 칸 이름 (§5.3, 5단계) ──

/**
 * 연동 칸 이름 — 연동 코드가 문서 fieldValues 에서 읽는 기존 필드 키 그대로(period·leaveType·workDate…).
 * 관리자 화면엔 label 만 보인다.
 */
export interface LinkName {
  key: string;
  label: string;
  /** 서식 저장 때 이 칸이 없으면 막는다 */
  required?: boolean;
  /** 기간 칸('시작 ~ 끝')이면 key·key__end 로 나눠 넣는다 */
  range?: boolean;
  /** 사람 칸 — 글자 대신 사용자 ID(__refs)를 넣는다 */
  userId?: boolean;
  /** 시스템이 계산해 넣는 칸(기안자 입력 아님) */
  computed?: boolean;
  hint?: string;
}

export interface LinkTypeDef {
  /** 대신하는 기존 서식 코드 — 연동 코드가 보는 값(docLinkType) */
  code: string;
  label: string;
  names: LinkName[];
}

const PERIOD_END = (label: string): LinkName => ({ key: 'period__end', label, hint: '기간을 날짜 칸 둘로 나눌 때 끝 날짜' });
const MEMO: LinkName = { key: 'body', label: '사유', hint: '목록·일정 설명에 쓰는 글' };

/** 시트 서식이 대신할 수 있는 기존 서식 — 연동이 있는 서식만 */
export const LINK_TYPES: LinkTypeDef[] = [
  {
    code: '휴가',
    label: '휴가원',
    names: [
      { key: 'leaveType', label: '휴가 종류', required: true, hint: '선택 칸 — 항목을 연차·반차·반반차 등 휴가 종류 이름과 똑같이' },
      { key: 'period', label: '휴가 기간', required: true, range: true, hint: '기간 칸(시작~종료) 또는 날짜 칸(시작일)' },
      PERIOD_END('휴가 종료일'),
      { key: 'period__days', label: '휴가 일수', computed: true, hint: '시스템이 계산해 넣음(공휴일 제외·반차) — 입력 칸으로 두지 않음' },
      { key: 'startTime', label: '시작 시각' },
      { key: 'endTime', label: '종료 시각' },
      { key: 'substituteId', label: '업무 대행자', userId: true, hint: '사람 칸' },
      { key: 'emergencyContact', label: '긴급 연락처' },
      MEMO,
    ],
  },
  {
    code: '외근',
    label: '외근 신청서',
    names: [
      { key: 'period', label: '외근 일자', required: true, range: true, hint: '날짜 칸 또는 기간 칸' },
      PERIOD_END('외근 종료일'),
      { key: 'destination', label: '외근지', required: true },
      { key: 'outsideType', label: '외근 구분' },
      { key: 'startTime', label: '시작 시각' },
      { key: 'endTime', label: '종료 시각' },
      { key: 'purpose', label: '목적' },
      { key: 'transportation', label: '교통수단' },
      { key: 'companions', label: '동행자' },
      MEMO,
    ],
  },
  ...(['국내출장', '해외출장'] as const).map(
    (code): LinkTypeDef => ({
      code,
      label: code === '국내출장' ? '국내출장 신청서' : '해외출장 신청서',
      names: [
        { key: 'period', label: '출장 기간', required: true, range: true, hint: '기간 칸 또는 날짜 칸' },
        PERIOD_END('출장 종료일'),
        { key: 'destination', label: '출장지', required: true },
        { key: 'purpose', label: '목적' },
        { key: 'transportation', label: '교통수단' },
        { key: 'companions', label: '동행자' },
        ...(code === '해외출장' ? [{ key: 'overseasType', label: '출장 구분' }] : []),
        MEMO,
      ],
    })
  ),
  {
    code: '휴일근무',
    label: '휴일근무 신청서',
    names: [
      { key: 'workDate', label: '근무 일자', required: true, hint: '날짜 칸 — 주말·공휴일만 고를 수 있음' },
      { key: 'workStart', label: '출근 시각' },
      { key: 'workEnd', label: '퇴근 시각' },
      { key: 'workHours', label: '근무 시간' },
      MEMO,
    ],
  },
];

export function linkTypeDef(link: string | null | undefined): LinkTypeDef | undefined {
  return link ? LINK_TYPES.find((t) => t.code === link) : undefined;
}

/** 칸 이름 표시 — 시스템 이름(금액 키)·연동 이름은 한글로, 직접 쓴 이름은 그대로 */
export function nameLabel(key: string): string {
  const common = COMMON_CELL_NAMES.find((n) => n.key === key);
  if (common) return common.label;
  for (const t of LINK_TYPES) {
    const hit = t.names.find((n) => n.key === key);
    if (hit) return hit.label;
  }
  return key;
}

/** 대체 서식 저장 전 검사 — 꼭 있어야 할 연동 칸 */
export function linkIssues(s: Sheet, link: string | null | undefined): string[] {
  const def = linkTypeDef(link);
  if (!def) return [];
  const names = new Set(Object.values(s.cellMeta[APPROVAL_NS.name] ?? {}));
  const errors = def.names
    .filter((n) => n.required && !names.has(n.key))
    .map((n) => `${def.label}을(를) 대신하려면 '${n.label}' 칸이 필요합니다. 그 칸을 골라 칸 이름에서 '${n.label}'을(를) 붙여 주세요.`);
  // 휴가 종류는 휴가 정책이 아는 이름이어야 일수·차감이 맞다(반차 0.5일 등)
  if (def.code === '휴가') {
    const key = Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).find(([, n]) => n === 'leaveType')?.[0];
    const input = key ? (s.cellMeta[APPROVAL_NS.input]?.[key] as CellInput | undefined) : undefined;
    const known = new Set<string>(LEAVE_TYPE_OPTIONS.map((o) => o.value));
    if (key && input?.type !== 'select') errors.push(`'휴가 종류' 칸은 선택 칸이어야 합니다(항목: ${[...known].join(', ')}).`);
    const wrong = (input?.options ?? []).filter((o) => !known.has(o));
    if (wrong.length) errors.push(`'휴가 종류' 칸의 항목 ${wrong.join(', ')}은(는) 휴가 종류에 없습니다. 쓸 수 있는 이름: ${[...known].join(', ')}`);
  }
  return errors;
}

/** 휴가 종류 칸에 쓸 수 있는 항목 — 칸 속성 패널이 '휴가 종류' 이름을 붙일 때 채워 준다 */
export const LEAVE_TYPE_NAMES: string[] = LEAVE_TYPE_OPTIONS.map((o) => o.value);

/**
 * 연동 칸 값 → 문서 맨 위 칸(fieldValues) — 연동 코드가 기존 필드 키로 읽게.
 * 기간 칸은 key·key__end 로 나누고, 사람 칸은 사용자 ID 를 넣는다. 연동 유형(__link)도 함께
 */
export function linkFieldValues(s: Sheet, link: string | null | undefined, refs: Record<string, string> = {}): Record<string, string> {
  const def = linkTypeDef(link);
  if (!def) return {};
  const computed = recalculate(s);
  const out: Record<string, string> = { __link: def.code };
  Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).forEach(([key, name]) => {
    const n = def.names.find((x) => x.key === name);
    if (!n) return;
    const i = key.indexOf(':');
    const v = String(computed.rows[Number(key.slice(0, i))]?.[key.slice(i + 1)] ?? '');
    if (n.userId) out[n.key] = refs[key] ?? '';
    else if (n.range && v.includes('~')) {
      const [a, b] = v.split('~').map((x) => x.trim());
      out[n.key] = a;
      if (b) out[`${n.key}__end`] = b;
    } else out[n.key] = v;
  });
  return out;
}

/**
 * 시스템이 계산하는 연동 칸 — 지금은 휴가 일수(기존 휴가원과 같은 calculateLeaveDays: 공휴일 제외·반차·반반차).
 * 기안 화면·서식 편집기 '기안 미리보기'가 같이 쓴다
 */
export function linkSystemValues(
  link: string,
  linked: Record<string, string>,
  holidays: Array<{ date: string; name?: string }>
): Record<string, string> {
  if (link !== '휴가' || !linked.period) return {};
  const leaveType = linked.leaveType || '연차';
  const isPart = isHalfDayLeave(leaveType) || isQuarterDayLeave(leaveType);
  const days = calculateLeaveDays({
    leaveType,
    startDate: linked.period,
    endDate: isPart ? linked.period : linked.period__end || linked.period,
    holidays,
  });
  return { period__days: days > 0 ? String(days) : '' };
}

/**
 * 결재 문서 안의 시트 — 문서 머리 표와 한 문서처럼 보이게(§11 A안)
 * - 폭: 문서 종이 글자 폭(800px 종이 − 좌우 여백 32px×2)에 맞춘다. 좁으면 열 비율대로 늘리고 넓으면 줄인다
 *   (원래 폭이 절반보다 좁은 작은 표는 늘리지 않음)
 * - 가는 테두리: 문서 머리 표와 같은 색. 굵은 선·배경색은 엑셀 그대로
 */
export const DOC_SHEET_WIDTH = 736;
export const DOC_SHEET_VIEW = { fitWidth: DOC_SHEET_WIDTH, stretchTo: DOC_SHEET_WIDTH, thinBorderColor: '#bbb' } as const;
