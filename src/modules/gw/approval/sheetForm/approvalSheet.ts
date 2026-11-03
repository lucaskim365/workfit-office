/**
 * 전자결재 시트 서식 — 시트 모듈(@/lib/sheet)의 부가 정보 이름공간에 결재 전용 칸 속성을 얹는다
 * - input: 입력 칸 종류(CellInput) / name: 칸 이름(연동 키) / bind: 데이터 불러오기(BindSource)
 * - lock: 기안자 수정 잠금 / secret: 비공개(칸·행·열) / seal: 회사 직인 칸 — 값은 모두 true
 */
import { cellKey, pasteTsv, recalculate, setCellValue, type CellRange, type Sheet } from '@/lib/sheet';

/** 시트 부가 정보 이름공간 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const APPROVAL_NS = {
  input: 'input',
  name: 'name',
  bind: 'bind',
  lock: 'lock',
  secret: 'secret',
  seal: 'seal',
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

/** cellMeta.bind 값 — 기안 시작 때 채우는 데이터 */
export type BindSource =
  | 'company.name'
  | 'company.bizNo'
  | 'company.ceo'
  | 'company.address'
  | 'company.phone'
  | 'company.fax'
  | 'draft.drafter'
  | 'draft.dept'
  | 'draft.date';

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
      if (v !== undefined && v !== '' && (s.formulas[cellKey(r, col)] !== undefined || hasMeta(s, APPROVAL_NS.input, r, s.cols.indexOf(col)) || hasMeta(s, APPROVAL_NS.bind, r, s.cols.indexOf(col)))) {
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
