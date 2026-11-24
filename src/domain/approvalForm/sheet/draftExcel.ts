/**
 * 기안 문서를 엑셀로 받아 채운 뒤 다시 올리기 — 엑셀에서 쓴 값을 기안 화면의 입력 칸에 채운다.
 *
 * 받기(draftXlsxExport): 지금 작성 화면 모양 그대로(쓴 값·수식 포함). 기안자가 쓰는 칸은 화면처럼 옅은 노란색.
 *   줄·열마다 숨은 엑셀 '이름'을 심는다 — 엑셀에서 행·열을 넣고 지워도 이름이 그 줄을 따라가므로 올릴 때 줄을 다시 찾는다.
 * 올리기(fillFromXlsx): 값은 '칸 자리'로 짝짓는다(라벨 글자는 보지 않는다).
 *   - 기안자가 쓰는 칸만 받는다. 머리(결재란·기안자·문서번호 등)·라벨·수식 칸은 엑셀에서 고쳐도 무시 — 수식은 서식 것으로 다시 계산
 *   - 반복 구간 안에 줄을 넣거나 지웠으면 문서의 줄 수도 따라 바꾼다. 그 밖의 자리에 넣은 줄·열은 받지 않고 알린다
 *   - 엑셀에서 비운 칸: 받을 때 값이 있던 자리면 화면에서도 비운다(엑셀에서 지웠거나 표를 정렬한 것).
 *     받을 때도 비어 있던 자리면 화면 값을 그대로 둔다(받은 뒤 화면에서 고른 기간·사람이 지워지지 않게)
 *   - 사람·부서 칸은 엑셀에 쓴 이름으로 조직도에서 찾아 넣는다('홍길동' 또는 '홍길동 (영업팀)'). 못 찾거나 같은 이름이 여럿이면 받지 않고 알린다
 *   - 엑셀에서 못 받는 칸: 선택 창으로 고르는 칸, 시스템이 채우는 칸 — 화면 값 그대로
 *   - 표에 줄을 넣고 지워도 화면 값(사람 칸의 ID 포함)은 제 줄을 따라간다
 *   - 다른 서식·다른 버전에서 받은 파일, 이 기능으로 받지 않은 파일은 받지 않는다
 */
import { cellKey, parseNumber, sheetSignature, type Sheet, type XlsxDefinedName, type XlsxExportOptions, type XlsxNames } from '@/lib/sheet/core';
import { APPROVAL_NS, CHECK_MARK, applyValues, approvalCellProps, cellCaption, draftInputOf, draftOptions, isDirectInputOption, type CellInput, type SheetValues } from './approvalSheet';
import { MAX_EXTRA_ROWS, expandRepeats, extraRowCount, repeatSections, type RowExtras } from './repeatRows';

const NAME_FORM = '_wf_form';
const NAME_ROWS = '_wf_rows';
const rowName = (r: number) => `_wf_r${r}`;
const colName = (c: number) => `_wf_c${c}`;
/** 받을 때 그 줄에서 값이 있던 칸의 열 번호들('1,2,4') — 엑셀 글자 값은 255자까지라 줄마다 나눠 담는다 */
const filledName = (r: number) => `_wf_v${r}`;

/** 기안자가 쓰는 칸 바탕(작성 화면과 같은 색) */
const INPUT_BG = '#fffbe8';

/** 이 화면의 [엑셀로 받기]로 받은 파일인가 — 아니면 열 제목으로 맞춰 받는다(listExcel.ts) */
export const isDraftXlsx = (names: XlsxNames) => names.texts[NAME_FORM] !== undefined;

/** 파일이 어느 틀에서 나왔는지 — 서식 버전 + 틀 모양(기안자가 표 모양을 고친 문서는 모양이 다르다) */
const markOf = (formKey: string, template: Sheet) => `${formKey}#${sheetSignature(template)}`;

/** 엑셀로 주고받는 칸인가 — 기안자가 직접 쓰는 칸 중 시스템이 채우는 칸·선택 창 칸을 뺀 것 */
export function fillable(s: Sheet, r: number, c: number, skipNames: readonly string[]): CellInput | undefined {
  const input = draftInputOf(s, r, c);
  if (!input) return undefined;
  const p = approvalCellProps(s, r, c);
  if (p.bind || p.autoNo || p.guide) return undefined;
  if (p.name && skipNames.includes(p.name)) return undefined;
  // 병합에 가려진 칸은 값이 없다
  if (s.merges.some((m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan && (r !== m.startRow || c !== m.startCol))) return undefined;
  return input;
}

export interface DraftXlsxExportInput {
  /** 지금 작성 화면의 시트(반복 구간 펼침 + 값 + 계산) */
  sheet: Sheet;
  /** 서식 틀(펼치기 전) */
  template: Sheet;
  extras: RowExtras;
  /** 서식 버전 키(versionKey) */
  formKey: string;
  /** 화면에서 숨은 줄 — 엑셀에서도 숨긴다(줄 번호는 그대로) */
  hiddenRows?: (r: number) => boolean;
  /** 화면이 따로 그리는 칸의 글자(기안자·문서번호·결재란 등) — undefined 면 시트 값 */
  cellText?: (r: number, c: number) => string | undefined;
  /** 엑셀로 받지 않는 이름 붙은 칸(시스템이 채우는 칸·선택 창 칸) */
  skipNames?: readonly string[];
  sheetName?: string;
}

/** 받을 엑셀 — 내보낼 시트(쓰는 칸에 바탕색)와 내보내기 설정 */
export function draftXlsxExport({ sheet, template, extras, formKey, hiddenRows, cellText, skipNames = [], sheetName }: DraftXlsxExportInput): { sheet: Sheet; options: XlsxExportOptions } {
  const styles = { ...sheet.styles };
  /**
   * 글자로 담을 칸 — 엑셀이 숫자로 바꾸면 글자가 달라지는 칸. 숫자로 담는 것은 수식·숫자·금액 칸과, 글자 그대로가 숫자인 값('15')뿐.
   * 화면이 따로 그리는 칸(문서 제목 '12341', 문서번호 등)과 '2026.'·'1,000' 같은 글은 글자로 — 그대로 올렸을 때 값이 바뀌지 않게
   */
  const textCell = (r: number, c: number): boolean => {
    const col = sheet.cols[c];
    if (cellText?.(r, c) !== undefined) return true;
    if (sheet.formulas[cellKey(r, col)] !== undefined) return false;
    const type = approvalCellProps(sheet, r, c).input?.type;
    if (type === 'number' || type === 'currency') return false;
    const text = String(sheet.rows[r]?.[col] ?? '').trim();
    const n = parseNumber(text);
    return n === null || String(n) !== text;
  };
  sheet.rows.forEach((row, r) =>
    sheet.cols.forEach((col, c) => {
      const key = cellKey(r, col);
      if (fillable(sheet, r, c, skipNames) && !styles[key]?.bg) styles[key] = { ...(styles[key] ?? {}), bg: INPUT_BG };
      // 화면은 정렬을 안 정한 숫자 모양 글('1,000')을 오른쪽에 붙인다 — 글자로 담아도 같은 자리에 보이게
      if (cellText?.(r, c) === undefined && !styles[key]?.align && textCell(r, c) && parseNumber(String(row[col] ?? '')) !== null) styles[key] = { ...(styles[key] ?? {}), align: 'right' };
    })
  );
  /** 글 입력 칸 — 엑셀 '텍스트' 서식으로(빈 칸에 '010…'을 써도 앞자리 0이 남는다) */
  const textFormat = (r: number, c: number): boolean => {
    const type = fillable(sheet, r, c, skipNames)?.type;
    // 여러 줄 글 칸은 뺀다 — 엑셀은 텍스트 서식 칸의 긴 글(255자 넘음)을 '####'으로 보인다
    return type === 'text';
  };
  // 받을 때 값이 있던 칸(줄마다 열 번호) — 올릴 때 엑셀에서 비워 둔 칸이 '지운 것'인지 '원래 빈 칸'인지 가린다
  const filledNames: XlsxDefinedName[] = [];
  sheet.rows.forEach((row, r) => {
    const cols = sheet.cols.flatMap((col, c) => (fillable(sheet, r, c, skipNames) && (cellText?.(r, c) ?? String(row[col] ?? '')).trim() !== '' ? [c] : []));
    if (cols.length) filledNames.push({ name: filledName(r), text: cols.join(',') });
  });
  const definedNames: XlsxDefinedName[] = [
    { name: NAME_FORM, text: markOf(formKey, template) },
    { name: NAME_ROWS, text: JSON.stringify(extras) },
    ...sheet.rows.map((_, r) => ({ name: rowName(r), row: r })),
    ...sheet.cols.map((_, c) => ({ name: colName(c), col: c })),
    ...filledNames,
  ];
  return { sheet: { ...sheet, styles }, options: { sheetName, formulas: true, hiddenRow: hiddenRows, cellText, textCell, textFormat, definedNames } };
}

/** 펼친 시트의 줄마다 '틀의 어느 줄(구간이면 몇 번째 줄)'인지 — 줄 수가 다른 두 펼침 사이에서 같은 줄을 찾는 열쇠 */
export function rowPlan(template: Sheet, extras: RowExtras): string[] {
  const sections = repeatSections(template);
  const out: string[] = [];
  for (let t = 0; t < template.rows.length; t++) {
    const sec = sections.find((x) => x.first === t);
    if (!sec) {
      out.push(`t${t}`);
      continue;
    }
    const len = sec.last - sec.first + 1 + extraRowCount(extras, sec);
    for (let k = 0; k < len; k++) out.push(`s${sec.id}:${k}`);
    t = sec.last;
  }
  return out;
}

/** 조직도 — 사람·부서 칸에 쓴 이름을 찾는 데 쓴다 */
export interface XlsxPeople {
  users: { id: string; name: string; dept?: string }[];
  depts: string[];
}

/** 여러 명 칸의 이름 나누기 — 괄호 안 쉼표는 나누지 않는다(작성 화면과 같은 규칙) */
export const splitNames = (text: string) =>
  text
    .split(/,\s*(?![^()]*\))/)
    .map((x) => x.trim())
    .filter(Boolean);

/** 이름 글자 → 화면에 남기는 글자('이름 (부서)')와 사용자 ID. 없으면 'none', 같은 이름이 여럿이면 'many' */
export function findUser(text: string, people: XlsxPeople): { text: string; id: string } | 'none' | 'many' {
  const m = text.trim().match(/^(.+?)\s*\((.+)\)$/);
  const name = (m ? m[1] : text).trim();
  const dept = m?.[2].trim();
  const hits = people.users.filter((u) => u.name === name && (!dept || u.dept === dept));
  if (hits.length === 0) return 'none';
  if (hits.length > 1) return 'many';
  const u = hits[0];
  return { text: u.dept ? `${u.name} (${u.dept})` : u.name, id: u.id };
}

/** 값 키의 줄 번호를 새 줄 번호로 — src[새 줄] 이 그 줄이 온 원래 줄(from 의 열쇠). 없어진 줄의 값은 버린다 */
export function remap(values: SheetValues, from: string[], src: (string | undefined)[]): SheetValues {
  const at = new Map<string, number>();
  src.forEach((k, i) => k !== undefined && at.set(k, i));
  const out: SheetValues = {};
  Object.entries(values).forEach(([key, v]) => {
    const i = key.indexOf(':');
    const r = at.get(from[Number(key.slice(0, i))] ?? '');
    if (r !== undefined) out[`${r}${key.slice(i)}`] = v;
  });
  return out;
}

/** 날짜 글자를 YYYY-MM-DD 로 — '2026.11.3', '2026/11/03', '2026년 11월 3일' 도 받는다. 날짜가 아니면 null */
function toIsoDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 체크로 보는 글자 — 'x' 는 '아님' 표시로도 쓰여 넣지 않는다 */
const CHECKED = new Set([CHECK_MARK, 'v', 'o', '○', '●', '√', 'true', '1', 'y', 'yes', '예']);

/** 엑셀 칸 글자 → 칸 종류에 맞는 값. 그 종류로 읽을 수 없으면 null(선택 칸의 목록 검사는 값을 다 얹은 뒤 따로) */
export function convert(input: CellInput, text: string): string | null {
  const t = text.trim();
  if (t === '') return '';
  switch (input.type) {
    case 'text':
      return t.replace(/\r?\n/g, ' ');
    case 'multiline':
      return text.replace(/\r\n/g, '\n').trim();
    case 'number':
    case 'currency':
      return parseNumber(t) === null ? null : t.replace(/,/g, '');
    case 'date':
      return toIsoDate(t);
    case 'dateRange': {
      const [a = '', b = ''] = t.split('~').map((x) => x.trim());
      const from = toIsoDate(a);
      const to = b ? toIsoDate(b) : from;
      // 끝이 시작보다 빠른 기간은 받지 않는다(화면 달력도 고를 수 없는 값)
      return from && to && from <= to ? `${from} ~ ${to}` : null;
    }
    case 'multiSelect': {
      const picked = t.split(',').map((x) => x.trim());
      const known = (input.options ?? []).filter((o) => picked.includes(o));
      return known.length === picked.filter(Boolean).length ? known.join(', ') : null;
    }
    case 'checkbox':
      return CHECKED.has(t.toLowerCase()) ? CHECK_MARK : null;
    case 'user':
    case 'users':
    case 'dept':
      // 조직도에서 찾는 칸 — fillFromXlsx 가 따로 읽는다
      return null;
    default:
      return t;
  }
}

export interface DraftXlsxFillInput {
  template: Sheet;
  formKey: string;
  /** 지금 문서의 줄 수·값·사람 칸 ID */
  extras: RowExtras;
  values: SheetValues;
  refs: SheetValues;
  /** 올린 파일 — importXlsx 의 시트와 xlsxDefinedNames 의 이름 */
  xlsx: Sheet;
  names: XlsxNames;
  skipNames?: readonly string[];
  /** 조직도 — 없으면 사람·부서 칸은 받지 않는다 */
  people?: XlsxPeople;
}

export type DraftXlsxFillResult =
  | { ok: false; error: string }
  | {
      ok: true;
      extras: RowExtras;
      values: SheetValues;
      refs: SheetValues;
      /** 엑셀 값을 얹기 전 — 지금 화면의 값·사람 칸 ID 를 새 줄 번호로 옮긴 것(미리보기에서 칸별로 되돌릴 때 쓴다) */
      base: SheetValues;
      baseRefs: SheetValues;
      /** 값이 바뀐 칸 수 */
      changed: number;
      /** 반복 구간에서 늘어난(음수면 줄어든) 줄 수 */
      rowDelta: number;
      /** 받지 못했거나 무시한 것 — 기안자에게 보일 안내 */
      notes: string[];
    };

/** 안내에 칸 이름을 몇 개까지 늘어놓을지 */
const NOTE_CELLS = 5;
export const listOf = (labels: string[]) => {
  const uniq = [...new Set(labels)];
  return uniq.slice(0, NOTE_CELLS).join(', ') + (uniq.length > NOTE_CELLS ? ` 외 ${uniq.length - NOTE_CELLS}칸` : '');
};

/** 올린 엑셀의 값을 문서 값으로 */
export function fillFromXlsx({ template, formKey, extras, values, refs, xlsx, names, skipNames = [], people }: DraftXlsxFillInput): DraftXlsxFillResult {
  const mark = names.texts[NAME_FORM];
  if (mark === undefined) return { ok: false, error: '이 화면의 [엑셀로 받기]로 받은 파일이 아닙니다. 먼저 [엑셀로 받기]로 양식을 받아 그 파일에 써 주세요.' };
  if (mark !== markOf(formKey, template)) return { ok: false, error: '다른 서식이거나 서식이 바뀌기 전에 받은 파일입니다. [엑셀로 받기]로 양식을 다시 받아 써 주세요.' };

  // 받을 때의 줄 수 — 그때 펼친 모양(줄 번호)으로 이름을 심었다
  let gotExtras: RowExtras = {};
  try {
    const p = JSON.parse(names.texts[NAME_ROWS] ?? '{}');
    if (p && typeof p === 'object' && !Array.isArray(p)) gotExtras = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number')) as RowExtras;
  } catch {
    /* 줄 수 표시가 깨졌으면 서식 처음 줄 수로 본다 */
  }
  const notes: string[] = [];
  const got = rowPlan(template, gotExtras);
  /** 받을 때 줄 번호 → 올린 파일의 줄 번호(지워졌으면 undefined) */
  const xRow = (r: number) => names.rows[rowName(r)];
  const lastXRow = xlsx.rows.length - 1;

  // 반복 구간 — 올린 파일에서 구간이 차지한 줄(구간 위·아래 줄 사이 전부). 넣은 줄·지운 줄이 여기서 드러난다
  const sections = repeatSections(template);
  const nextExtras: RowExtras = {};
  /** 구간 id → 올린 파일의 줄 번호들(위에서부터) */
  const sectionRows = new Map<string, number[]>();
  let rowDelta = 0;
  const hasContent = (x: number) => Object.values(xlsx.rows[x] ?? {}).some((v) => String(v ?? '').trim() !== '');
  /** 앞 구간이 차지한 마지막 줄 — 구간 둘이 붙어 있을 때 그 사이에 넣은 줄은 위 구간에만 넣는다 */
  let taken = -1;
  for (const sec of sections) {
    const tplLen = sec.last - sec.first + 1;
    const first = got.indexOf(`s${sec.id}:0`);
    const len = tplLen + extraRowCount(gotExtras, sec);
    const own = Array.from({ length: len }, (_, k) => xRow(first + k)).filter((x): x is number => x !== undefined);
    const above = first > 0 ? xRow(first - 1) : -1;
    const atEnd = first + len >= got.length;
    const below = atEnd ? undefined : xRow(first + len);
    const start = above !== undefined ? above + 1 : own.length ? Math.min(...own) : undefined;
    const from = start === undefined ? undefined : Math.max(start, taken + 1);
    let to = below !== undefined ? below - 1 : own.length ? Math.max(...own) : undefined;
    // 구간이 시트 맨 끝이면 아래 경계가 없다 — 구간에 붙어 이어진 줄까지만(한참 아래에 쓴 메모를 표의 줄로 받지 않게)
    if (atEnd && to !== undefined) while (to + 1 <= lastXRow && hasContent(to + 1)) to++;
    if (from === undefined || to === undefined || to < from) {
      // 구간을 찾을 수 없다 — 줄 수·값을 화면 그대로 둔다
      if (extras[sec.id]) nextExtras[sec.id] = extras[sec.id];
      notes.push(`'${sec.label}' 표의 줄을 찾지 못해 그 표는 화면에 있던 대로 두었습니다.`);
      continue;
    }
    let rows = Array.from({ length: to - from + 1 }, (_, k) => from + k);
    if (rows.length > tplLen + MAX_EXTRA_ROWS) {
      notes.push(`'${sec.label}' 표는 ${tplLen + MAX_EXTRA_ROWS}줄까지만 받았습니다(엑셀 ${rows.length}줄).`);
      rows = rows.slice(0, tplLen + MAX_EXTRA_ROWS);
    }
    if (rows.length !== tplLen) nextExtras[sec.id] = rows.length - tplLen;
    sectionRows.set(sec.id, rows);
    taken = rows[rows.length - 1];
    rowDelta += rows.length - (tplLen + extraRowCount(extras, sec));
  }

  // 새 줄 수로 펼친 틀
  const now = rowPlan(template, extras);
  const next = rowPlan(template, nextExtras);
  const shape = expandRepeats(template, nextExtras);

  const gotAt = new Map(got.map((k, i) => [k, i]));
  /** 올린 파일의 줄 번호 → 받을 때 줄의 열쇠(이름이 남은 줄만) */
  const keyAtX = new Map<number, string>();
  got.forEach((k, g) => {
    const x = xRow(g);
    if (x !== undefined) keyAtX.set(x, k);
  });
  /** 줄 열쇠가 가리키는 반복 구간 id — 구간 밖 줄이면 undefined */
  const sectionOf = (key: string) => (key.startsWith('s') ? key.slice(1, key.lastIndexOf(':')) : undefined);
  /** 새 줄 번호 → 올린 파일의 줄 번호 */
  const xRowOf = (r: number): number | undefined => {
    const key = next[r];
    const id = sectionOf(key);
    if (id !== undefined) return sectionRows.get(id)?.[Number(key.slice(key.lastIndexOf(':') + 1))];
    const g = gotAt.get(key);
    return g === undefined ? undefined : xRow(g);
  };
  /**
   * 새 줄마다 화면의 어느 줄에서 왔는가 — 표의 줄은 엑셀에 남은 이름으로 제 줄을 찾는다(가운데에 줄을 넣어도 아래 줄의 값이 따라 내려간다).
   * 엑셀에서 새로 넣은 줄은 undefined
   */
  const src = next.map((key, r) => {
    const id = sectionOf(key);
    if (id === undefined || !sectionRows.has(id)) return key;
    const from = keyAtX.get(xRowOf(r) ?? -1);
    return from !== undefined && sectionOf(from) === id ? from : undefined;
  });
  // 지금 값·사람 칸 ID 를 새 줄 번호로 옮겨 놓고 그 위에 엑셀 값을 얹는다
  const baseValues = remap(values, now, src);
  const baseRefs = remap(refs, now, src);
  const nextRefs = { ...baseRefs };
  /** 받을 때 그 자리(줄 열쇠·열)에 값이 있었는가 — 표시가 없는 옛 파일은 늘 아니오(비운 칸은 화면 값 그대로) */
  const filledCols = new Map<string, Set<number>>();
  const wasFilled = (rowKey: string | undefined, c: number): boolean => {
    const g = rowKey === undefined ? undefined : gotAt.get(rowKey);
    if (g === undefined) return false;
    let cols = filledCols.get(rowKey!);
    if (!cols) {
      cols = new Set((names.texts[filledName(g)] ?? '').split(',').filter(Boolean).map(Number));
      filledCols.set(rowKey!, cols);
    }
    return cols.has(c);
  };
  const before = applyValues(shape, baseValues, { recalc: false });

  const out: SheetValues = { ...baseValues };
  const lostRows = new Set<number>();
  const lostCols = new Set<number>();
  const unreadable: string[] = [];
  const skipped: string[] = [];
  const noUser: string[] = [];
  const manyUsers: string[] = [];
  /** 엑셀에서 받은 선택 칸 — 값을 다 얹은 뒤 목록에 있는 값인지 본다 */
  const selects: { r: number; c: number; key: string; prev: string }[] = [];
  let changed = 0;
  for (let r = 0; r < shape.rows.length; r++) {
    for (let c = 0; c < shape.cols.length; c++) {
      const input = draftInputOf(shape, r, c);
      if (!input) continue;
      const key = cellKey(r, shape.cols[c]);
      const prev = String(before.rows[r]?.[shape.cols[c]] ?? '');
      const xr = xRowOf(r);
      const xc = names.cols[colName(c)];
      const text = xr !== undefined && xc !== undefined ? String(xlsx.rows[xr]?.[xlsx.cols[xc]] ?? '') : undefined;
      const cellInput = fillable(shape, r, c, skipNames);
      if (!cellInput) continue;
      // 줄을 찾지 못해 화면대로 두기로 한 표 — 값을 읽지 않는다(위에서 이미 알렸다)
      const secId = sectionOf(next[r]);
      if (secId !== undefined && !sectionRows.has(secId)) continue;
      if (text === undefined) {
        if (xr === undefined) lostRows.add(r);
        else lostCols.add(c);
        continue;
      }
      if (text.trim() === '') {
        // 엑셀에서 새로 넣은 줄은 빈 칸(틀에 미리 쓴 글자가 비쳐 보이지 않게)
        if (src[r] === undefined) out[key] = '';
        // 받을 때 값이 있던 자리인데 비어 있다 — 엑셀에서 지웠거나 정렬로 옮겨 간 것이라 화면에서도 비운다.
        // 받을 때도 비어 있던 자리는 화면 값을 그대로 둔다(받은 뒤 화면에서 고른 기간·사람이 지워지지 않게)
        else if (wasFilled(src[r], c) && prev.trim() !== '') {
          out[key] = '';
          delete nextRefs[key];
          changed++;
        }
        continue;
      }
      // 화면 값과 같은 글 — 그대로 둔다(날짜 칸에 미리 쓴 '2026.', 시작일만 고른 기간처럼 칸 종류로는 못 읽는 글도 받은 그대로면 건드리지 않는다)
      if (text.trim() === prev.trim()) continue;
      // 틀에 미리 써 둔 글자('2026.')가 온 칸 — 칸 종류로는 못 읽어도 안 쓴 칸이라는 뜻이라 그 글자로 되돌린다
      // (엑셀에서 표를 정렬해 안 쓴 줄이 이 자리로 왔을 때 화면의 다른 줄 값이 남지 않게)
      const preset = String(shape.rows[r]?.[shape.cols[c]] ?? '').trim();
      if (preset !== '' && text.trim() === preset) {
        out[key] = preset;
        delete nextRefs[key];
        changed++;
        continue;
      }
      // 사람·부서 칸 — 엑셀에 쓴 이름으로 조직도에서 찾는다
      if (cellInput.type === 'user' || cellInput.type === 'users' || cellInput.type === 'dept') {
        const caption = `${cellCaption(before, r, c)}(${text.trim()})`;
        if (!people) {
          skipped.push(caption);
          continue;
        }
        if (cellInput.type === 'dept') {
          if (!people.depts.includes(text.trim())) {
            noUser.push(caption);
            continue;
          }
          out[key] = text.trim();
        } else {
          const found = (cellInput.type === 'users' ? splitNames(text) : [text]).map((t) => findUser(t, people));
          if (found.includes('many')) manyUsers.push(caption);
          if (found.includes('none')) noUser.push(caption);
          const hits = found.filter((x): x is { text: string; id: string } => typeof x === 'object');
          if (hits.length !== found.length || hits.length === 0) continue;
          const shown = hits.map((h) => h.text).join(', ');
          if (shown === prev.trim()) continue;
          out[key] = shown;
          nextRefs[key] = hits.map((h) => h.id).join(',');
        }
        changed++;
        continue;
      }
      const v = convert(cellInput, text);
      if (v === null) {
        unreadable.push(cellCaption(before, r, c));
        continue;
      }
      if (cellInput.type === 'select') selects.push({ r, c, key, prev });
      // 같은 값이면 화면의 글자 그대로 둔다 — 숫자는 크기로 비교('12000.50' = 12000.5), 글은 앞뒤 공백 빼고
      const numeric = cellInput.type === 'number' || cellInput.type === 'currency';
      // 한 줄 글 칸에 서식이 줄바꿈을 미리 넣어 둔 글('산업보안\n(OT/IT)')은 줄바꿈만 다른 것 — 그대로 둔다
      const oneLine = cellInput.type === 'text' && v === prev.trim().replace(/\r?\n/g, ' ');
      const same = v === prev.trim() || oneLine || (numeric && v !== '' && parseNumber(v) === parseNumber(prev));
      if (same) continue;
      changed++;
      out[key] = v;
    }
  }

  // 선택 칸 — 고를 수 있는 항목(종속 선택은 기준 칸 값에 맞는 갈래)에 없는 값은 받지 않는다
  const filled = applyValues(shape, out, { recalc: false });
  const badSelect: string[] = [];
  for (const s of selects) {
    const v = out[s.key];
    const input = draftInputOf(filled, s.r, s.c);
    if (!v || !input) continue;
    const options = draftOptions(filled, input);
    if (options.includes(v) || options.some(isDirectInputOption)) continue;
    badSelect.push(`${cellCaption(before, s.r, s.c)}(${v})`);
    out[s.key] = options.includes(s.prev) ? s.prev : '';
    if (v !== s.prev) changed--;
  }

  /*
    번호 열 — 엑셀에서 줄을 넣거나 지운 구간만 다시 1, 2, 3…. 작성 화면의 [행 추가]·[행 삭제]와 같은 기준이다:
    서식에 1, 2, 3…을 미리 적어 둔 열이고, 올리기 전 화면에서도 빠짐없이 차례였을 때만(기안자가 10·20·30 으로 바꿔 둔 번호는 손대지 않는다)
  */
  const screen = applyValues(expandRepeats(template, extras), values, { recalc: false });
  /** 받은 뒤 화면에서 넣어, 엑셀에 없어 빠지는 줄 수 */
  let screenOnly = 0;
  for (const sec of sections) {
    if (!sectionRows.has(sec.id)) continue;
    const prefix = `s${sec.id}:`;
    const nowFirst = now.indexOf(`${prefix}0`);
    const nowLen = now.filter((k) => k.startsWith(prefix)).length;
    const first = next.indexOf(`${prefix}0`);
    const len = next.filter((k) => k.startsWith(prefix)).length;
    const from = src.slice(first, first + len);
    const gotLen = got.filter((k) => k.startsWith(prefix)).length;
    const kept = new Set(from);
    for (let k = gotLen; k < nowLen; k++) if (!kept.has(`${prefix}${k}`)) screenOnly++;
    // 줄이 그대로면(같은 줄이 같은 차례) 번호를 건드리지 않는다
    if (len === nowLen && from.every((k, i) => k === `${prefix}${i}`)) continue;
    template.cols.forEach((col, c) => {
      for (let r = sec.first; r <= sec.last; r++) {
        if (!draftInputOf(template, r, c) || String(template.rows[r]?.[col] ?? '').trim() !== String(r - sec.first + 1)) return;
      }
      for (let k = 0; k < nowLen; k++) if (String(screen.rows[nowFirst + k]?.[col] ?? '').trim() !== String(k + 1)) return;
      // 엑셀에서 번호를 직접 고쳐 썼으면('2-1' 등) 그 번호를 둔다 — 빈 칸·숫자뿐일 때만 다시 매긴다
      for (let k = 0; k < len; k++) if (!/^\d*$/.test((out[cellKey(first + k, col)] ?? '').trim())) return;
      for (let k = 0; k < len; k++) out[cellKey(first + k, col)] = String(k + 1);
    });
  }
  if (screenOnly) notes.push(`양식을 받은 뒤 화면에서 넣은 줄 ${screenOnly}줄은 엑셀에 없어 빠집니다. 필요하면 [엑셀로 받기]로 다시 받아 써 주세요.`);

  if (unreadable.length) notes.push(`칸 종류(숫자·날짜 등)에 맞지 않는 값이라 받지 않았습니다: ${listOf(unreadable)}`);
  if (badSelect.length) notes.push(`고를 수 있는 항목이 아니라 받지 않았습니다: ${listOf(badSelect)}`);
  if (noUser.length) notes.push(`조직도에서 찾지 못한 이름이라 받지 않았습니다: ${listOf(noUser)}`);
  if (manyUsers.length) notes.push(`같은 이름이 여럿이라 받지 않았습니다. '이름 (부서)'로 적어 주세요: ${listOf(manyUsers)}`);
  if (skipped.length) notes.push(`사람·부서 칸은 받지 못했습니다. 화면에서 골라 주세요: ${listOf(skipped)}`);
  if (lostRows.size) notes.push(`엑셀에서 지워진 줄이 ${lostRows.size}줄 있어, 그 줄의 칸은 화면에 있던 대로 두었습니다.`);
  if (lostCols.size) notes.push(`엑셀에서 지워진 열이 ${lostCols.size}개 있어, 그 열의 칸은 화면에 있던 대로 두었습니다.`);
  // 표 밖에 넣은 줄·열 — 서식에 자리가 없어 받지 않는다
  const usedRows = new Set<number>([...Array.from({ length: got.length }, (_, r) => xRow(r)).filter((x): x is number => x !== undefined), ...[...sectionRows.values()].flat()]);
  const extraRows = xlsx.rows.filter((row, i) => !usedRows.has(i) && Object.values(row).some((v) => String(v ?? '').trim() !== '')).length;
  if (extraRows) notes.push(`표 밖에 새로 넣은 줄 ${extraRows}줄은 서식에 자리가 없어 받지 않았습니다.`);

  return { ok: true, extras: nextExtras, values: out, refs: nextRefs, base: baseValues, baseRefs, changed: Math.max(0, changed), rowDelta, notes };
}

/** 이 서식이 엑셀로 주고받을 칸을 하나라도 가졌는가 — 없으면 [엑셀로 받기]·[엑셀 올리기]를 보이지 않는다 */
export function hasXlsxFillCells(template: Sheet, skipNames: readonly string[] = []): boolean {
  return Object.keys(template.cellMeta[APPROVAL_NS.input] ?? {}).some((key) => {
    const i = key.indexOf(':');
    return !!fillable(template, Number(key.slice(0, i)), template.cols.indexOf(key.slice(i + 1)), skipNames);
  });
}
