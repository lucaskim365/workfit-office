/**
 * 반복 구간 — 기안자가 [행 추가]·[행 삭제]로 줄 수를 바꾸는 행 범위(기존 서식 '표'의 행 추가와 같은 역할, §11.3).
 *
 * 시트는 한 장의 격자라 줄을 넣으면 행 전체가 들어간다(엑셀 '행 삽입'과 같음). 같은 행에 나란히 있는 표는 함께 늘어난다.
 * - 관리자: 행 범위를 반복 구간으로 지정 — rowMeta.repeat[행] = { id, label }
 * - 기안자: 구간 끝에 행을 붙인다. 붙인 행은 구간 마지막 행을 본뜬다(서식·테두리·입력 칸·수식, 수식은 한 행 아래로 옮겨서)
 *   - 구간 끝에 붙이므로 구간을 덮는 범위 수식(=SUM(E8:E12))은 늘어난 행까지 따라간다(shiftFormula: 끝 바로 다음 삽입은 늘어남)
 *   - 구간 전체를 세로로 덮는 병합(왼쪽 '매출구분' 같은 이름 칸)도 늘린다. 마지막 행 안의 가로 병합은 새 행에도 만든다
 * - 문서에는 구간별로 더 붙인 줄 수만 저장한다(fieldValues.__rows). 틀은 서식 버전에 그대로 두고,
 *   보기·작성 때 같은 규칙으로 펼친다(expandRepeats) — 같은 틀·같은 줄 수면 항상 같은 모양
 */
import { cellKey, insertRow, translateFormula, type Merge, type Sheet } from '@/lib/sheet';
import { APPROVAL_NS, type SheetValues } from './approvalSheet';

export interface RepeatMark {
  id: string;
  label: string;
}

export interface RepeatSection extends RepeatMark {
  /** 첫 행·마지막 행(0부터, 펼친 시트 기준) */
  first: number;
  last: number;
}

/** 구간별로 더 붙인 줄 수 */
export type RowExtras = Record<string, number>;

/** 문서 fieldValues 에 붙인 줄 수를 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const SHEET_ROWS_KEY = '__rows';

/** 한 구간에 더 붙일 수 있는 줄 수 */
export const MAX_EXTRA_ROWS = 200;

/** 붙인 행에 본뜨는 칸 속성 — 칸 이름(서식에 하나뿐)·직인은 본뜨지 않는다 */
const COPY_CELL_NS = [APPROVAL_NS.input, APPROVAL_NS.bind, APPROVAL_NS.lock, APPROVAL_NS.secret];

const markAt = (s: Sheet, r: number): RepeatMark | undefined => {
  const v = s.rowMeta[APPROVAL_NS.repeat]?.[String(r)] as RepeatMark | undefined;
  return v && typeof v === 'object' && typeof v.id === 'string' ? v : undefined;
};

/** 반복 구간 목록 — 같은 id 가 이어진 행 묶음, 위에서부터 */
export function repeatSections(s: Sheet): RepeatSection[] {
  const out: RepeatSection[] = [];
  for (let r = 0; r < s.rows.length; r++) {
    const m = markAt(s, r);
    if (!m) continue;
    const prev = out[out.length - 1];
    if (prev && prev.id === m.id && prev.last === r - 1) prev.last = r;
    else out.push({ id: m.id, label: m.label, first: r, last: r });
  }
  return out;
}

/** 이 행이 든 반복 구간 */
export function repeatSectionAt(s: Sheet, r: number): RepeatSection | undefined {
  return repeatSections(s).find((x) => r >= x.first && r <= x.last);
}

/** 관리자가 행 범위를 반복 구간으로 지정 — 겹치는 다른 구간의 행은 이 구간으로 옮겨진다 */
export function setRepeatSection(s: Sheet, r1: number, r2: number, label: string): Sheet {
  const from = Math.min(r1, r2);
  const to = Math.max(r1, r2);
  const id = `rep_${Math.random().toString(36).slice(2, 8)}`;
  const rec = { ...(s.rowMeta[APPROVAL_NS.repeat] ?? {}) };
  for (let r = from; r <= to; r++) rec[String(r)] = { id, label: label.trim() || '반복 구간' };
  return { ...s, rowMeta: { ...s.rowMeta, [APPROVAL_NS.repeat]: rec } };
}

/** 반복 구간 해제 */
export function clearRepeatSection(s: Sheet, id: string): Sheet {
  const rec = Object.fromEntries(Object.entries(s.rowMeta[APPROVAL_NS.repeat] ?? {}).filter(([, v]) => (v as RepeatMark)?.id !== id));
  const rowMeta = { ...s.rowMeta };
  if (Object.keys(rec).length) rowMeta[APPROVAL_NS.repeat] = rec;
  else delete rowMeta[APPROVAL_NS.repeat];
  return { ...s, rowMeta };
}

/** 반복 구간 이름 바꾸기 */
export function renameRepeatSection(s: Sheet, id: string, label: string): Sheet {
  const rec = Object.fromEntries(
    Object.entries(s.rowMeta[APPROVAL_NS.repeat] ?? {}).map(([k, v]) => [k, (v as RepeatMark)?.id === id ? { id, label } : v])
  );
  return { ...s, rowMeta: { ...s.rowMeta, [APPROVAL_NS.repeat]: rec } };
}

/** 서식 저장 전 검사 — 끊긴 구간, 구간 안의 칸 이름(새 행에 본뜨지 않으므로) */
export function repeatIssues(s: Sheet): string[] {
  const errors: string[] = [];
  const sections = repeatSections(s);
  const seen = new Set<string>();
  sections.forEach((x) => {
    if (seen.has(x.id)) errors.push(`반복 구간 '${x.label}'이 중간에 끊겼습니다. 구간 행을 다시 골라 지정해 주세요.`);
    seen.add(x.id);
  });
  // 구간 안 칸 이름은 그 구간의 '열 이름'(관련 문서 값 가져오기) — 한 열에 하나만. 금액 키는 한 값이라 구간 밖에
  const colNames = new Map<string, string>();
  Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).forEach(([key, name]) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const x = sections.find((sec) => r >= sec.first && r <= sec.last);
    if (!x) return;
    if (name === 'amount') {
      errors.push(`반복 구간 '${x.label}' 안의 칸에는 금액 키를 붙일 수 없습니다. 합계처럼 구간 밖 칸에 붙여 주세요.`);
      return;
    }
    const colKey = `${x.id}|${key.slice(i + 1)}`;
    if (colNames.has(colKey)) errors.push(`반복 구간 '${x.label}'의 한 열에 칸 이름이 둘입니다('${colNames.get(colKey)}', '${String(name)}'). 열마다 하나만 붙여 주세요.`);
    else colNames.set(colKey, String(name));
  });
  return errors;
}

/** 구간 끝에 행 하나 붙이기 — 마지막 행을 본뜬다 */
function appendRow(s: Sheet, sec: RepeatSection): Sheet {
  const last = sec.last;
  const at = last + 1;
  const n = insertRow(s, at);
  const styles = { ...n.styles };
  const formulas = { ...n.formulas };
  const cellMeta = { ...n.cellMeta };
  COPY_CELL_NS.forEach((ns) => {
    if (cellMeta[ns]) cellMeta[ns] = { ...cellMeta[ns] };
  });
  n.cols.forEach((col) => {
    const from = cellKey(last, col);
    const to = cellKey(at, col);
    if (n.styles[from]) styles[to] = { ...n.styles[from] };
    const f = n.formulas[from];
    if (f !== undefined) formulas[to] = translateFormula(f, 1, 0);
    COPY_CELL_NS.forEach((ns) => {
      const v = n.cellMeta[ns]?.[from];
      if (v !== undefined) cellMeta[ns] = { ...cellMeta[ns], [to]: v };
    });
  });
  const rowHeights = { ...n.rowHeights };
  if (n.rowHeights[String(last)] !== undefined) rowHeights[String(at)] = n.rowHeights[String(last)];
  const rowMeta = { ...n.rowMeta };
  [APPROVAL_NS.repeat, APPROVAL_NS.secret].forEach((ns) => {
    const v = n.rowMeta[ns]?.[String(last)];
    if (v !== undefined) rowMeta[ns] = { ...rowMeta[ns], [String(at)]: v };
  });
  // 병합: 구간 전체를 세로로 덮는 것(이름 칸)은 늘리고, 마지막 행 안의 가로 병합은 새 행에도
  const merges: Merge[] = [];
  n.merges.forEach((m) => {
    const end = m.startRow + m.rowSpan - 1;
    if (m.startRow <= sec.first && end === last) merges.push({ ...m, rowSpan: m.rowSpan + 1 });
    else merges.push(m);
    if (m.startRow === last && m.rowSpan === 1) merges.push({ ...m, startRow: at });
  });
  return { ...n, styles, formulas, cellMeta, rowHeights, rowMeta, merges };
}

/** 틀에 문서의 붙인 줄 수만큼 행을 펼친다 — 아래 구간부터 펼쳐 위 구간 행 번호가 흔들리지 않게 */
export function expandRepeats(template: Sheet, extras: RowExtras): Sheet {
  let s = template;
  const sections = repeatSections(template).sort((a, b) => b.first - a.first);
  for (const sec of sections) {
    const count = Math.max(0, Math.min(MAX_EXTRA_ROWS, Math.floor(extras[sec.id] ?? 0)));
    let cur = sec;
    for (let k = 0; k < count; k++) {
      s = appendRow(s, cur);
      cur = { ...cur, last: cur.last + 1 };
    }
  }
  return s;
}

/** fieldValues.__rows(JSON 글자) → 붙인 줄 수. 없거나 깨졌으면 빈 값 */
export function readRowExtras(raw: unknown): RowExtras {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number' && v > 0)) as RowExtras;
  } catch {
    return {};
  }
}

/** 값 키의 행을 옮긴다 — fn 이 null 이면 그 값은 버린다 */
function remapValues(values: SheetValues, fn: (r: number) => number | null): SheetValues {
  const out: SheetValues = {};
  Object.entries(values).forEach(([key, v]) => {
    const i = key.indexOf(':');
    const r = fn(Number(key.slice(0, i)));
    if (r !== null) out[`${r}${key.slice(i)}`] = v;
  });
  return out;
}

/** 펼친 시트에서 이 구간의 지금 마지막 행 */
function currentLast(template: Sheet, extras: RowExtras, id: string): number | undefined {
  return repeatSections(expandRepeats(template, extras)).find((x) => x.id === id)?.last;
}

/** [행 추가] — 구간 끝에 빈 행. 아래 행 값은 한 줄씩 내린다 */
export function addRepeatRow(template: Sheet, extras: RowExtras, values: SheetValues, id: string): { extras: RowExtras; values: SheetValues } {
  const last = currentLast(template, extras, id);
  if (last === undefined || (extras[id] ?? 0) >= MAX_EXTRA_ROWS) return { extras, values };
  return {
    extras: { ...extras, [id]: (extras[id] ?? 0) + 1 },
    values: remapValues(values, (r) => (r > last ? r + 1 : r)),
  };
}

/** [행 삭제] — 구간 마지막 행을 지운다. 관리자가 그린 줄 수보다는 줄지 않는다 */
export function removeRepeatRow(template: Sheet, extras: RowExtras, values: SheetValues, id: string): { extras: RowExtras; values: SheetValues } {
  const last = currentLast(template, extras, id);
  if (last === undefined || (extras[id] ?? 0) <= 0) return { extras, values };
  const next = { ...extras, [id]: extras[id] - 1 };
  if (next[id] === 0) delete next[id];
  return {
    extras: next,
    values: remapValues(values, (r) => (r === last ? null : r > last ? r - 1 : r)),
  };
}

/**
 * 관리자가 구간 한가운데에 행을 넣으면 새 행엔 표시가 없어 구간이 끊긴다 —
 * 위·아래 행이 같은 구간이면 그 사이 빈 행도 그 구간으로 채운다(서식 편집기가 바뀔 때마다 부른다)
 */
export function healRepeatSections(s: Sheet): Sheet {
  const rec = s.rowMeta[APPROVAL_NS.repeat];
  if (!rec) return s;
  let next: Record<string, unknown> | null = null;
  for (let r = 1; r < s.rows.length - 1; r++) {
    if (markAt(s, r)) continue;
    const up = markAt(s, r - 1);
    const down = markAt(s, r + 1);
    if (up && down && up.id === down.id) {
      next = next ?? { ...rec };
      next[String(r)] = up;
    }
  }
  return next ? { ...s, rowMeta: { ...s.rowMeta, [APPROVAL_NS.repeat]: next } } : s;
}
