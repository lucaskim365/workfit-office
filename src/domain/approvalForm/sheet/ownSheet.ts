/**
 * 기안자가 표 모양을 고친 문서 — 문서가 자기 시트를 갖는다.
 *
 * 보통 시트 문서는 '서식 버전 + 칸 값'만 저장하고, 볼 때 서식 버전의 틀에 값을 얹는다.
 * 기안자가 [표 모양 고치기]로 열·행 넣기·지우기, 병합, 수식 고치기를 하면 틀이 서식 버전과 달라지므로
 * 고친 시트 전체를 fieldValues[SHEET_OWN_KEY] 에 담고, 그 문서는 이 시트를 틀로 쓴다(반복 구간·자동번호·값 가져오기 모두).
 * 틀을 안 고친 문서는 지금처럼 저장한다(이 키 없음).
 *
 * 고치지 못하는 칸(보호 칸) — 결재선·연동·문서 머리가 깨지지 않게:
 *   이름 붙은 칸(금액·휴가 기간 등 연동 값), 문서 머리 부품·기안 정보 칸(bind), 직인, 자동번호, 비공개, 관리자가 잠근 칸.
 *   그 칸이 든 행·열은 지울 수 없고(isStructureLocked), 입력 칸이 아닌 보호 칸은 내용(수식 포함)도 바꿀 수 없다.
 */
import { cellKey, parseSheet, pasteTsv, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, isStructureLocked, setApprovalCellValue } from './approvalSheet';

/** 문서가 가진 시트(JSON). 빈 값이면 서식 버전의 틀을 쓴다 */
export const SHEET_OWN_KEY = '__sheet';

/** 지우거나 바꾸면 안 되는 칸의 이름공간 */
const PROTECTED_NS = [APPROVAL_NS.name, APPROVAL_NS.bind, APPROVAL_NS.seal, APPROVAL_NS.autoNo, APPROVAL_NS.secret, APPROVAL_NS.lock] as const;

/** fieldValues 의 문서 시트 — 없거나 깨졌으면 null */
export function readOwnSheet(raw: unknown): Sheet | null {
  if (typeof raw !== 'string' || !raw) return null;
  return parseSheet(raw);
}

/** 이 문서의 틀 — 기안자가 고친 시트가 있으면 그것, 없으면 서식 버전의 틀 */
export function docTemplateOf(template: Sheet | null | undefined, fieldValues: Record<string, unknown> | null | undefined): Sheet | null {
  return readOwnSheet(fieldValues?.[SHEET_OWN_KEY]) ?? template ?? null;
}

export function hasOwnSheet(fieldValues: Record<string, unknown> | null | undefined): boolean {
  return readOwnSheet(fieldValues?.[SHEET_OWN_KEY]) !== null;
}

const metaOf = (s: Sheet, ns: string, r: number, c: number) => {
  const col = s.cols[c];
  return col === undefined ? undefined : s.cellMeta[ns]?.[cellKey(r, col)];
};

/** 보호 칸인가 */
export function isProtectedCell(s: Sheet, r: number, c: number): boolean {
  return PROTECTED_NS.some((ns) => metaOf(s, ns, r, c) !== undefined);
}

/** 기안자가 내용을 바꿀 수 있는 칸인가 — 보호 칸이라도 입력 칸(잠그지 않은)이면 값은 쓸 수 있다 */
export function canDraftWrite(s: Sheet, r: number, c: number): boolean {
  if (!isProtectedCell(s, r, c)) return true;
  return metaOf(s, APPROVAL_NS.input, r, c) !== undefined && metaOf(s, APPROVAL_NS.lock, r, c) === undefined && metaOf(s, APPROVAL_NS.bind, r, c) === undefined;
}

/** 표 모양 고치기의 값 넣기 — 보호 칸은 그대로(null = 막힘), 이름 붙은 칸은 '='도 값으로 */
export function draftEditSetValue(s: Sheet, r: number, c: number, text: string): Sheet | null {
  if (!canDraftWrite(s, r, c)) return null;
  return setApprovalCellValue(s, r, c, text);
}

/** 표 모양 고치기의 붙여넣기 — 보호 칸은 건너뛰고, 이름 붙은 칸은 '='도 값으로 */
export function draftEditPaste(s: Sheet, r: number, c: number, text: string): Sheet {
  return pasteTsv(s, r, c, text, {
    canWrite: (rr, cc) => canDraftWrite(s, rr, cc),
    allowFormula: (rr, cc) => metaOf(s, APPROVAL_NS.name, rr, cc) === undefined,
  });
}

/** 행·열을 지워도 되는가 — 보호 칸이 든 행·열은 안 됨 */
export const canDraftDelete = (s: Sheet, axis: 'row' | 'col', index: number): boolean =>
  !isStructureLocked(s, axis, index) &&
  !Object.keys(s.cellMeta[APPROVAL_NS.lock] ?? {}).some((key) => {
    const i = key.indexOf(':');
    return axis === 'row' ? Number(key.slice(0, i)) === index : key.slice(i + 1) === s.cols[index];
  });

/** 보호 칸의 지문 — 이름공간별 개수와, 입력 칸이 아닌 보호 칸의 내용(수식 포함) */
function protectedPrint(s: Sheet): { counts: Record<string, number>; contents: Map<string, string> } {
  const counts: Record<string, number> = {};
  const contents = new Map<string, string>();
  for (const ns of PROTECTED_NS) {
    const rec = s.cellMeta[ns] ?? {};
    counts[ns] = Object.keys(rec).length;
    for (const [key, v] of Object.entries(rec)) {
      const i = key.indexOf(':');
      const r = Number(key.slice(0, i));
      const c = s.cols.indexOf(key.slice(i + 1));
      if (c < 0 || canDraftWrite(s, r, c)) continue;
      // 자리가 옮겨져도 같은 칸으로 알아보게 이름공간·값으로 묶는다(이름 칸은 이름, 그 밖은 차례)
      const id = ns === APPROVAL_NS.name ? `${ns}:${String(v)}` : `${ns}:${JSON.stringify(v)}`;
      // 수식 칸은 수식이 남아 있는지만 본다 — 행·열을 넣으면 수식 주소는 저절로 옮겨지므로(=SUM(B1:B2) → C2:C3).
      // 수식 글자를 바꾸는 건 draftEditSetValue 가 막는다
      const content = s.formulas[key] !== undefined ? '\u0001수식' : String(s.rows[r]?.[s.cols[c]] ?? '');
      contents.set(id, (contents.get(id) ?? '') + '\u0000' + content);
    }
  }
  return { counts, contents };
}

/** 고치기를 끝낼 때 검사 — 보호 칸이 지워졌거나 바뀌었으면 그 이유들 */
export function draftEditIssues(before: Sheet, after: Sheet): string[] {
  const a = protectedPrint(before);
  const b = protectedPrint(after);
  const issues: string[] = [];
  for (const ns of PROTECTED_NS) {
    if ((b.counts[ns] ?? 0) < (a.counts[ns] ?? 0)) issues.push('지울 수 없는 칸(금액·연동 칸, 문서 정보, 직인, 자동번호 등)이 지워졌습니다.');
  }
  for (const [id, content] of a.contents) {
    if (b.contents.get(id) !== content) {
      issues.push('고칠 수 없는 칸(금액 합계·연동 칸, 문서 정보 등)의 내용이나 수식이 바뀌었습니다.');
      break;
    }
  }
  return [...new Set(issues)];
}

/**
 * 고친 뒤 사람 칸 ID — 칸 자리가 옮겨졌을 수 있어, 같은 자리에 같은 글자(이름)가 남은 칸만 그대로 둔다.
 * 옮겨진 사람 칸은 글자(이름·부서)는 남고 ID 만 빠진다(동명이인 구분·알림만 영향)
 */
export function keepRefsAfterEdit(refs: Record<string, string>, before: Sheet, after: Sheet): Record<string, string> {
  const text = (s: Sheet, key: string) => {
    const i = key.indexOf(':');
    return String(s.rows[Number(key.slice(0, i))]?.[key.slice(i + 1)] ?? '');
  };
  return Object.fromEntries(Object.entries(refs).filter(([key]) => text(before, key) !== '' && text(before, key) === text(after, key)));
}
