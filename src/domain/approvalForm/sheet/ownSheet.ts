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
import { DEFAULT_COL_WIDTH, cellKey, insertCol, parseSheet, pasteTsv, type CellRange, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, coveredKeys, isStructureLocked, setApprovalCellValue } from './approvalSheet';

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

/** 기안자 병합 — 가려지는 칸(왼쪽 위 말고)에 보호 칸(금액·연동 칸, 문서 정보 등)이 있으면 안 됨. 입력 칸 설정만 있는 칸은 빼고 병합 */
export function draftCanMerge(s: Sheet, range: CellRange): boolean {
  return coveredKeys(s, range).every((key) => {
    const i = key.indexOf(':');
    const c = s.cols.indexOf(key.slice(i + 1));
    return c < 0 || !isProtectedCell(s, Number(key.slice(0, i)), c);
  });
}

/** 문서 머리 행 — 결재란·기안 정보·문서 항목·로고·직인 칸이 든 행 */
function docHeadRows(s: Sheet): Set<number> {
  const rows = new Set<number>();
  for (const ns of [APPROVAL_NS.bind, APPROVAL_NS.seal]) for (const key of Object.keys(s.cellMeta[ns] ?? {})) rows.add(Number(key.slice(0, key.indexOf(':'))));
  return rows;
}

/**
 * 기안자 열 넣기 — 열은 시트 전체에 생기지만, 문서 머리 행(기안부서·기안일·결재란 등)에 생긴 새 칸은 왼쪽 칸에 합쳐
 * 문서 머리 모양·테두리가 그대로 남게 한다(그 칸들은 보호 칸이라 기안자가 직접 병합할 수 없다)
 */
export function draftInsertCol(s: Sheet, at: number): Sheet {
  let next = insertCol(s, at);
  // 새 열은 옆 칸(왼쪽, 맨 앞이면 오른쪽)과 같은 폭으로 넣고, 모든 열을 같은 비율로 줄여 시트 전체 폭을 그대로 둔다
  // — 종이 밖으로 밀리지 않고, 한 칸만 좁아져 글자가 세로로 쪼개지지도 않게
  const neighbor = next.cols[at > 0 ? at - 1 : at + 1];
  const added = next.cols[at];
  if (neighbor !== undefined && added !== undefined) {
    const widthOf = (c: string) => next.colWidths[c] ?? DEFAULT_COL_WIDTH;
    const before = s.cols.reduce((n, c) => n + (s.colWidths[c] ?? DEFAULT_COL_WIDTH), 0);
    const widths: Record<string, number> = { ...next.colWidths, [added]: widthOf(neighbor) };
    const after = next.cols.reduce((n, c) => n + (widths[c] ?? DEFAULT_COL_WIDTH), 0);
    const k = before / after;
    const scaled = Object.fromEntries(next.cols.map((c) => [c, Math.max(16, Math.round((widths[c] ?? DEFAULT_COL_WIDTH) * k))]));
    next = { ...next, colWidths: { ...next.colWidths, ...scaled } };
  }
  if (at <= 0) return next;
  const heads = docHeadRows(next);
  const covers = (m: Sheet['merges'][number], r: number, c: number) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan;
  const merges = next.merges.map((m) => ({ ...m }));
  const extended = new Set<number>();
  for (const r of heads) {
    if (merges.some((m) => covers(m, r, at))) continue; // 이미 넓어진 병합 안(열을 병합 가운데에 넣음)
    const left = merges.findIndex((m) => covers(m, r, at - 1));
    if (left >= 0) {
      const m = merges[left];
      if (m.startCol + m.colSpan - 1 === at - 1 && !extended.has(left)) {
        m.colSpan += 1;
        extended.add(left);
      }
      continue;
    }
    merges.push({ startRow: r, startCol: at - 1, rowSpan: 1, colSpan: 2 });
  }
  next = { ...next, merges };
  return next;
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

const textAt = (s: Sheet, key: string) => {
  const i = key.indexOf(':');
  return String(s.rows[Number(key.slice(0, i))]?.[key.slice(i + 1)] ?? '');
};

/** 글자가 든 사람 칸(사람·사람 여러 명)을 '열 + 글자'로 묶은 것 — 묶음마다 행 번호를 위에서부터 */
function personCellGroups(s: Sheet): Map<string, { col: string; rows: number[] }> {
  const out = new Map<string, { col: string; rows: number[] }>();
  Object.entries(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach(([key, v]) => {
    const type = (v as { type?: unknown } | undefined)?.type;
    if (type !== 'user' && type !== 'users') return;
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    const t = textAt(s, key);
    if (!t || !s.cols.includes(col) || r < 0 || r >= s.rows.length) return;
    const id = `${col}\u0000${t}`;
    const g = out.get(id) ?? { col, rows: [] };
    g.rows.push(r);
    out.set(id, g);
  });
  out.forEach((g) => g.rows.sort((a, b) => a - b));
  return out;
}

/**
 * 고친 뒤 사람 칸 ID — 행을 넣거나 지워 사람 칸 자리가 옮겨져도 ID 가 따라간다(업무 대행자·동행자 연동이 이 ID 를 읽는다).
 * 열 키는 열을 넣어도 바뀌지 않고 행 차례도 그대로라, 같은 열에서 같은 글자(이름)인 사람 칸을 위에서부터 차례로 짝짓는다.
 * 짝이 분명하지 않으면(그 이름의 칸 수가 달라짐) ID 가 모두 같은 사람일 때만 남기고, 아니면 뺀다(다른 사람 ID 가 붙지 않게).
 * 병합으로 다른 열로 옮겨진 사람 칸, 사람 칸이 아닌 칸의 ID 는 같은 자리에 같은 글자가 남았을 때만 그대로 둔다
 */
export function keepRefsAfterEdit(refs: Record<string, string>, before: Sheet, after: Sheet): Record<string, string> {
  const out: Record<string, string> = {};
  const was = personCellGroups(before);
  const now = personCellGroups(after);
  const matched = new Set<string>();
  was.forEach((b, id) => {
    b.rows.forEach((r) => matched.add(cellKey(r, b.col)));
    const a = now.get(id);
    if (!a) return;
    const ids = b.rows.map((r) => refs[cellKey(r, b.col)]);
    if (a.rows.length === b.rows.length) {
      a.rows.forEach((r, i) => {
        if (ids[i]) out[cellKey(r, a.col)] = ids[i];
      });
    } else if (a.rows.length < b.rows.length && ids[0] && ids.every((x) => x === ids[0])) {
      a.rows.forEach((r) => (out[cellKey(r, a.col)] = ids[0]));
    }
  });
  Object.entries(refs).forEach(([key, id]) => {
    if (!matched.has(key) && textAt(before, key) !== '' && textAt(before, key) === textAt(after, key)) out[key] = id;
  });
  return out;
}
