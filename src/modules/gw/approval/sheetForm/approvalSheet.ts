/**
 * 전자결재 시트 서식 — 시트 모듈(@/lib/sheet)의 부가 정보 이름공간에 결재 전용 칸 속성을 얹는다
 * - input: 입력 칸 종류(CellInput) / name: 칸 이름(연동 키) / bind: 데이터 불러오기(BindSource)
 * - lock: 기안자 수정 잠금 / secret: 비공개(칸·행·열) / seal: 회사 직인 칸 — 값은 모두 true
 */
import { cellKey, setCellValue, type Sheet } from '@/lib/sheet';

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
