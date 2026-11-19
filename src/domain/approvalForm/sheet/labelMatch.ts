/**
 * 관련 문서 값 가져오기 — 칸 이름이 없는 칸은 '칸 옆 글자(라벨)'가 같은 칸끼리 맞춘다.
 * 서식 편집에서 칸 이름을 더는 붙이지 않으므로, 기안자가 보는 글자('품명'·'금액(VAT 포함)')로 찾는다. 칸 이름이 있으면 이름이 먼저.
 *
 * - 칸 옆 글자: 같은 줄 왼쪽에서 가장 가까운 글자 칸, 없으면 위쪽 3줄까지(cellLabel). 반복 구간 안 칸은 그 열의 머리글(구간 바로 위 글자)
 *   입력·수식·데이터 불러오기·자동번호·직인·이름 붙은 칸을 만나면 거기서 멈춘다(그 너머 글자는 그 칸의 라벨) — 기안자 값·계산 결과도 라벨이 되지 않는다
 *   작성 요령·숫자만 있는 글자는 라벨이 아니고 지나간다
 * - 칸 이름이 있는 칸은 이름으로 먼저 맞추고, 원본에 그 이름이 없을 때만 라벨로 맞춘다(규칙이 붙인 이름 등)
 * - 맞추는 글자: 빈칸을 모두 빼고, 괄호 기호만 빼고(안 글자는 남김), 앞뒤 ':'·'*'를 뺀다 — '금액(VAT 포함) :' → '금액VAT포함'
 * - 한 서식 안에서 같은 라벨인 입력 칸이 둘 이상이면 어느 칸인지 모르니 라벨로는 맞추지 않는다. 글자가 없는 라벨(기호뿐)도
 * - 비공개 칸은 라벨 값으로 남기지도, 채우지도 않는다
 * - 라벨 키는 '__label:' + 맞추는 글자 — 직접 쓴 칸 이름은 '__'로 시작할 수 없어(서식 편집기 검사) 진짜 이름과 겹치지 않는다
 *
 * 원본 문서는 상신 때 fieldValues.__labeled 에 { 라벨 키: 값 | 값[] } 을 남긴다(__named 옆). 받는 쪽은 서식 틀에 라벨 키를
 * 잠깐 칸 이름처럼 붙여 importNamed 로 채운다 — 붙인 이름은 가져오기 계산에만 쓰고 문서 시트·__named 에는 남기지 않는다
 */
import { FORMULA_ERROR, cellKey, parseNumber, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, approvalCellProps, isSecretCell, namedCaption, readSheetValues, SHEET_VALUES_KEY, type SheetValues } from './approvalSheet';
import { importNamed, legacyFieldValue, type ImportResult, type NamedValues } from './relatedImport';
import { SHEET_ROWS_KEY, expandRepeats, readRowExtras, repeatSections, type RepeatSection, type RowExtras } from './repeatRows';

/**
 * 기안 화면의 [다른 문서 값 가져오기] 줄과 가이드북 설명을 보일지 — 지금은 숨긴다.
 * 서식끼리 라벨이 달라 실제로 이어지는 칸이 적다(계약보고서 ↔ 발주서 0칸). 프로젝트 정보에서 값을 가져오게 될 때 다시 정한다.
 * 상신 때 __named·__labeled 를 남기는 것은 그대로 — 켜면 그동안 쓴 문서에서도 가져올 수 있다
 */
export const RELATED_IMPORT_ENABLED = false;

/** 문서 fieldValues 에 라벨 값을 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const SHEET_LABELED_KEY = '__labeled';

/** 라벨 키 머리 — 칸 이름은 '__'로 시작할 수 없으므로 겹치지 않는다 */
export const LABEL_KEY_PREFIX = '__label:';

export const labelKeyOf = (norm: string) => `${LABEL_KEY_PREFIX}${norm}`;
export const isLabelKey = (key: string) => key.startsWith(LABEL_KEY_PREFIX);

/** 라벨 맞추는 글자 — 빈칸 모두 빼고, 괄호 기호만 빼고(안 글자는 남김), 앞뒤 ':'·'*' 빼기. 글자(문자)가 하나도 없으면 '' */
export function normalizeLabel(text: string): string {
  const s = String(text ?? '')
    .replace(/\s+/g, '')
    .replace(/[()[\]{}<>（）［］｛｝〈〉《》「」『』【】〔〕]/g, '')
    .replace(/^[:*：＊]+/, '')
    .replace(/[:*：＊]+$/, '');
  return /\p{L}/u.test(s) ? s : '';
}

/** 라벨로 보일 글자 — 빈칸만 하나로 */
const displayOf = (text: string) => text.trim().replace(/\s+/g, ' ');

/** 위쪽에서 라벨을 찾는 줄 수 — 바로 위 머리글·한두 줄 띄운 머리글까지만(멀리 있는 제목 '발 주 서'가 라벨이 되지 않게) */
export const LABEL_UP_ROWS = 3;

/** (r, c)를 덮는 병합(없으면 undefined) */
const mergeAt = (s: Sheet, r: number, c: number) =>
  s.merges.find((x) => r >= x.startRow && r < x.startRow + x.rowSpan && c >= x.startCol && c < x.startCol + x.colSpan);

/**
 * 라벨을 찾다 만난 칸 — 'label'(라벨 글자), 'stop'(여기서 멈춤: 이 너머 글자는 다른 칸의 라벨), 'skip'(지나감).
 * 병합 칸 안이면 대표(왼쪽 위) 칸으로 본다.
 * 멈추는 칸: 입력·데이터 불러오기·수식·이름 붙은·직인·자동번호 칸 — 그 칸이 사이에 있으면 더 먼 글자는 그 칸의 라벨이다.
 * 지나가는 칸: 빈칸·숫자만 있는 글자·작성 요령·글자가 없는(기호뿐) 칸
 */
type LabelHit = { kind: 'label'; text: string; colSpan: number } | { kind: 'stop' } | { kind: 'skip' };

function labelAt(s: Sheet, r0: number, c0: number): LabelHit {
  const m = mergeAt(s, r0, c0);
  const r = m ? m.startRow : r0;
  const c = m ? m.startCol : c0;
  const col = s.cols[c];
  if (col === undefined) return { kind: 'skip' };
  const p = approvalCellProps(s, r, c);
  if (s.formulas[cellKey(r, col)] !== undefined || p.input || p.bind || p.name || p.autoNo || p.seal) return { kind: 'stop' };
  const t = String(s.rows[r]?.[col] ?? '').trim();
  if (!t || t === FORMULA_ERROR || parseNumber(t) !== null || p.guide || !normalizeLabel(t)) return { kind: 'skip' };
  return { kind: 'label', text: t, colSpan: m ? m.colSpan : 1 };
}

/**
 * 칸 옆 글자 — 같은 줄 왼쪽, 없으면 위쪽. 반복 구간 안 칸은 위쪽(열 머리글)만, 구간 바로 위에서부터.
 * - 왼쪽: 가장 가까운 라벨 글자. 사이에 멈추는 칸(입력·불러오기·수식·이름·직인·자동번호)이 있으면 왼쪽은 그만두고 위쪽을 본다
 *   ('[수량][입력][입력]'의 둘째 입력 칸은 '수량'이 아니다 — 표 모양이면 위 머리글이 라벨)
 * - 위쪽: LABEL_UP_ROWS(3) 줄까지만. 멈추는 칸을 만나면 라벨 없음.
 *   이 칸보다 넓게 병합된 글자(제목·구역 이름 '발 주 서')를 만나도 라벨 없음 — 열 머리글은 그 칸 너비 이하
 */
export function cellLabel(s: Sheet, r: number, c: number, sec?: Pick<RepeatSection, 'first'>): string {
  if (!sec) {
    for (let cc = c - 1; cc >= 0; cc--) {
      const h = labelAt(s, r, cc);
      if (h.kind === 'stop') break;
      if (h.kind === 'label') return displayOf(h.text);
    }
  }
  const own = mergeAt(s, r, c);
  const span = own ? own.colSpan : 1;
  const top = sec ? sec.first : r;
  for (let rr = top - 1; rr >= Math.max(0, top - LABEL_UP_ROWS); rr--) {
    const h = labelAt(s, rr, c);
    if (h.kind === 'stop') return '';
    if (h.kind === 'label') return h.colSpan > span ? '' : displayOf(h.text);
  }
  return '';
}

/** 라벨로 맞출 칸 하나 — 한 칸, 또는 반복 구간의 한 열(줄마다 같은 머리글이라 한 묶음) */
export interface LabelSlot {
  /** 칸 키 — 반복 구간 열이면 구간 첫 줄 칸 */
  key: string;
  r: number;
  c: number;
  sec?: RepeatSection;
  /** 보일 라벨 글자 */
  label: string;
  /** 라벨 키(__label:맞추는 글자) */
  labelKey: string;
  named: boolean;
  secret: boolean;
}

/** 입력 칸 → 라벨 칸 목록(라벨이 있는 것만). 같은 라벨이 여럿인 칸은 ambiguous 에 */
function labelSlots(s: Sheet): { slots: LabelSlot[]; ambiguous: Set<string> } {
  const sections = repeatSections(s);
  const seen = new Set<string>();
  const slots: LabelSlot[] = [];
  const names = s.cellMeta[APPROVAL_NS.name] ?? {};
  Object.keys(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach((key) => {
    const i = key.indexOf(':');
    const r0 = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    const c = s.cols.indexOf(col);
    if (c < 0 || r0 >= s.rows.length) return;
    const sec = sections.find((x) => r0 >= x.first && r0 <= x.last);
    const r = sec ? sec.first : r0;
    const slotKey = cellKey(r, col);
    if (seen.has(slotKey)) return;
    seen.add(slotKey);
    const label = cellLabel(s, r, c, sec);
    const norm = normalizeLabel(label);
    if (!norm) return;
    const rows = sec ? Array.from({ length: sec.last - sec.first + 1 }, (_, k) => sec.first + k) : [r];
    slots.push({
      key: slotKey,
      r,
      c,
      sec,
      label,
      labelKey: labelKeyOf(norm),
      named: rows.some((rr) => typeof names[cellKey(rr, col)] === 'string' && !!names[cellKey(rr, col)]),
      secret: rows.some((rr) => isSecretCell(s, rr, c)),
    });
  });
  const count = new Map<string, number>();
  slots.forEach((x) => count.set(x.labelKey, (count.get(x.labelKey) ?? 0) + 1));
  return { slots, ambiguous: new Set([...count].filter(([, n]) => n > 1).map(([k]) => k)) };
}

/** 라벨로 맞출 수 있는 칸 — 라벨이 서식에 하나뿐이고 비공개가 아닌 칸 */
function uniqueSlots(s: Sheet): LabelSlot[] {
  const { slots, ambiguous } = labelSlots(s);
  return slots.filter((x) => !ambiguous.has(x.labelKey) && !x.secret);
}

const trimTail = (list: string[]) => {
  const out = [...list];
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
};

/**
 * 펼치고 계산까지 끝난 시트 → 라벨 값(원본 쪽, 상신 때 __labeled). 이름 붙은 칸도 라벨로 남긴다 —
 * 받는 서식은 칸 이름 없이 라벨만 있을 수 있다. 반복 구간 열은 줄마다 값 목록. 비공개 칸은 뺀다
 */
export function collectLabeled(sheet: Sheet): NamedValues {
  const out: NamedValues = {};
  uniqueSlots(sheet).forEach((x) => {
    const col = sheet.cols[x.c];
    if (x.sec) {
      const list: string[] = [];
      for (let rr = x.sec.first; rr <= x.sec.last; rr++) list.push(String(sheet.rows[rr]?.[col] ?? ''));
      out[x.labelKey] = trimTail(list);
    } else out[x.labelKey] = String(sheet.rows[x.r]?.[col] ?? '');
  });
  return out;
}

/** 시트 문서의 저장 값(틀 + __values·__rows) → 라벨 값 — __labeled 가 없는 예전 문서용 */
export function labeledFromDoc(template: Sheet, fieldValues: Record<string, unknown>): NamedValues {
  const extras: RowExtras = readRowExtras(fieldValues[SHEET_ROWS_KEY]);
  return collectLabeled(applyValues(expandRepeats(template, extras), readSheetValues(fieldValues[SHEET_VALUES_KEY]), { recalc: true }));
}

/** 옛 서식 문서 → 라벨 값. 한 칸짜리 필드만(namedFromLegacy 와 같음), 비공개 항목은 늘 뺀다(쓴 사람이어도), 라벨이 겹치면 뺀다 */
export function labeledFromLegacy(
  fields: Array<{ key: string; label: string; type: string; isSecret?: boolean }>,
  fieldValues: Record<string, unknown>
): NamedValues {
  const count = new Map<string, number>();
  const keyed = fields.map((f) => {
    const norm = normalizeLabel(f.label);
    if (norm) count.set(norm, (count.get(norm) ?? 0) + 1);
    return { f, norm };
  });
  const out: NamedValues = {};
  keyed.forEach(({ f, norm }) => {
    if (!norm || count.get(norm) !== 1 || f.isSecret) return;
    const v = legacyFieldValue(f, fieldValues);
    if (v !== undefined) out[labelKeyOf(norm)] = v;
  });
  return out;
}

/** 이 서식에 관련 문서 값을 가져올 칸이 있는가(가져오기 단추를 보일지) — 이름 붙은 칸, 또는 라벨로 맞출 칸 */
export function canImportRelated(template: Sheet): boolean {
  return Object.keys(template.cellMeta[APPROVAL_NS.name] ?? {}).length > 0 || uniqueSlots(template).length > 0;
}

/** 슬롯 칸들의 키 — 반복 구간 열이면 구간의 모든 줄 */
function slotKeys(s: Sheet, x: LabelSlot): string[] {
  const col = s.cols[x.c];
  const sec = x.sec;
  const rows = sec ? Array.from({ length: sec.last - sec.first + 1 }, (_, k) => sec.first + k) : [x.r];
  return rows.map((rr) => cellKey(rr, col));
}

export interface RelatedImportResult extends ImportResult {
  /** 채운 칸을 사람에게 보일 글자(확인 창) — 이름 칸은 칸 옆 글자, 라벨 칸은 서식에 적힌 라벨 그대로 */
  captions: string[];
}

/**
 * 관련 문서 값 가져오기 — 칸 이름으로 먼저, 이름 없는 칸과 이름이 원본에 없는 칸은 라벨로. source 는 이름 값과 라벨 값을 합친 것.
 * 한 칸은 한 번만 채운다(이름이 원본에 있으면 라벨은 보지 않음). 라벨이 겹치는 칸·비공개 칸은 라벨로 채우지 않는다.
 * 라벨 키는 틀의 복사본에만 잠깐 칸 이름으로 붙인다 — 돌려주는 것은 값·줄 수·사람 칸 ID 뿐이라 문서 시트에는 남지 않는다
 * (sheetWith 에는 원래 틀을 넘길 것)
 */
export function importRelated(template: Sheet, extras: RowExtras, values: SheetValues, refs: SheetValues, source: NamedValues): RelatedImportResult {
  const names = { ...(template.cellMeta[APPROVAL_NS.name] ?? {}) };
  const nameIn = (key: string) => {
    const n = names[key];
    return typeof n === 'string' && n ? n : undefined;
  };
  // 이름 붙은 칸은 그 이름이 원본에 하나도 없을 때만 라벨로 — 이 복사본에서만 이름을 라벨 키로 바꿔 붙인다
  const slots = uniqueSlots(template).filter(
    (x) => !x.named || slotKeys(template, x).every((k) => { const n = nameIn(k); return !n || source[n] === undefined; })
  );
  const labelOf = new Map<string, string>();
  slots.forEach((x) => {
    if (x.named) slotKeys(template, x).forEach((k) => delete names[k]);
    names[x.key] = x.labelKey;
    labelOf.set(x.labelKey, x.label);
  });
  const work: Sheet = slots.length ? { ...template, cellMeta: { ...template.cellMeta, [APPROVAL_NS.name]: names } } : template;
  const res = importNamed(work, extras, values, refs, source);
  return { ...res, captions: res.filled.map((n) => labelOf.get(n) ?? namedCaption(template, n)) };
}
