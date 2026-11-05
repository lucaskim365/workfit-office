/**
 * 관련 문서 값 가져오기 (§11.4) — 관련 문서로 고른 문서의 '이름 붙은 칸' 값을 이 문서의 같은 이름 칸으로 복사한다.
 * 위치(B3)가 아니라 칸 이름으로 찾으므로 서식이 달라도 된다(품의서 → 발주서 등).
 *
 * - 칸 이름은 관리자가 붙인다(금액 키 같은 시스템 이름 + 직접 쓴 이름 '품명'·'공급가액' 등)
 * - 반복 구간 안 칸의 이름은 그 구간의 '열 이름' — 값은 줄마다 하나씩(목록). 가져올 때 줄이 모자라면 행을 늘린다
 * - 문서에는 이름 붙은 칸 값을 fieldValues.__named 에 { 이름: 값 | 값[] } 로 남긴다 — 다른 문서가 이걸 읽는다
 * - 옛 서식 문서는 필드 이름(라벨)을 칸 이름처럼 쓴다(글·숫자·날짜 같은 한 칸짜리 필드만)
 * 가져온 값은 이 문서에 복사되어 저장된다 — 원본 문서가 나중에 바뀌어도 이 문서는 그대로
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, type SheetValues } from './approvalSheet';
import { addRepeatRow, expandRepeats, repeatSections, type RowExtras } from './repeatRows';

/** 이름 → 값(한 칸) 또는 값 목록(반복 구간 열) */
export type NamedValues = Record<string, string | string[]>;

/** 문서 fieldValues 에 이름 붙은 칸 값을 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const SHEET_NAMED_KEY = '__named';

const trimTail = (list: string[]) => {
  const out = [...list];
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
};

/** 펼치고 계산까지 끝난 시트에서 이름 붙은 칸 값 모으기 */
export function collectNamed(sheet: Sheet): NamedValues {
  const sections = repeatSections(sheet);
  const out: NamedValues = {};
  Object.entries(sheet.cellMeta[APPROVAL_NS.name] ?? {}).forEach(([key, name]) => {
    if (typeof name !== 'string' || !name) return;
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    const sec = sections.find((x) => r >= x.first && r <= x.last);
    if (sec) {
      const list: string[] = [];
      for (let rr = sec.first; rr <= sec.last; rr++) list.push(String(sheet.rows[rr]?.[col] ?? ''));
      out[name] = trimTail(list);
    } else out[name] = String(sheet.rows[r]?.[col] ?? '');
  });
  return out;
}

/** fieldValues.__named(JSON 글자) → 이름 값. 없거나 깨졌으면 빈 값 */
export function readNamed(raw: unknown): NamedValues {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    const out: NamedValues = {};
    Object.entries(p).forEach(([k, v]) => {
      if (typeof v === 'string') out[k] = v;
      else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === 'string' ? x : String(x ?? '')));
    });
    return out;
  } catch {
    return {};
  }
}

/** 옛 서식 문서 → 이름 값. 라벨을 이름으로, 한 칸짜리 필드만(표·직인·안내문 등은 뺌) */
export function namedFromLegacy(
  fields: Array<{ key: string; label: string; type: string }>,
  fieldValues: Record<string, unknown>
): NamedValues {
  const SIMPLE = new Set(['텍스트', '장문', '숫자', '금액', '날짜', '선택', '다중선택', '부서']);
  const out: NamedValues = {};
  fields.forEach((f) => {
    const label = f.label.trim();
    if (!label) return;
    if (f.type === '기간') {
      const a = fieldValues[f.key];
      const b = fieldValues[`${f.key}__end`];
      if (a) out[label] = b ? `${a} ~ ${b}` : String(a);
      return;
    }
    if (!SIMPLE.has(f.type)) return;
    const v = fieldValues[f.key];
    if (v !== undefined && v !== null && v !== '') out[label] = String(v);
  });
  return out;
}

export interface ImportResult {
  extras: RowExtras;
  values: SheetValues;
  /** 사람 칸 ID — 가져온 값으로 바뀐 칸은 지운다(가져온 이름은 글자뿐), 행이 늘면 함께 옮긴다 */
  refs: SheetValues;
  /** 채운 칸 이름 */
  filled: string[];
}

/** 가져와 채울 수 있는 칸 — 입력 칸이거나 프로젝트 값 칸이고 수식이 아닌 칸 */
const fillable = (s: Sheet, key: string) =>
  s.formulas[key] === undefined && (s.cellMeta[APPROVAL_NS.input]?.[key] !== undefined || s.cellMeta[APPROVAL_NS.bind]?.[key] !== undefined);

/**
 * 원본 이름 값을 이 문서로 — 같은 이름 칸을 채운다. 반복 구간 열은 줄 수만큼 행을 늘려 위에서부터 채우고 남는 줄은 비운다.
 * 한 칸에 목록이 오면 ', '로 잇는다.
 */
export function importNamed(template: Sheet, extras: RowExtras, values: SheetValues, refs: SheetValues, source: NamedValues): ImportResult {
  let ex = extras;
  let vals = values;
  let rf = refs;
  const filled: string[] = [];
  const names = Object.values(template.cellMeta[APPROVAL_NS.name] ?? {}).filter((n): n is string => typeof n === 'string');
  for (const name of names) {
    const src = source[name];
    if (src === undefined) continue;
    let sheet = expandRepeats(template, ex);
    const at = () => Object.entries(sheet.cellMeta[APPROVAL_NS.name] ?? {}).find(([, n]) => n === name)?.[0];
    let key = at();
    if (!key) continue;
    let r = Number(key.slice(0, key.indexOf(':')));
    const col = key.slice(key.indexOf(':') + 1);
    let sec = repeatSections(sheet).find((x) => r >= x.first && r <= x.last);
    if (sec) {
      const list = trimTail(Array.isArray(src) ? src : [src]);
      // 줄이 모자라면 늘린다(값·사람 칸 ID 를 같이 옮김)
      while (sec.last - sec.first + 1 < list.length) {
        const before = ex;
        const next = addRepeatRow(template, before, vals, sec.id);
        if (next.extras === before) break; // 더 못 늘림(최대)
        rf = addRepeatRow(template, before, rf, sec.id).values;
        ex = next.extras;
        vals = next.values;
        sheet = expandRepeats(template, ex);
        key = at();
        if (!key) break;
        r = Number(key.slice(0, key.indexOf(':')));
        sec = repeatSections(sheet).find((x) => r >= x.first && r <= x.last);
        if (!sec) break;
      }
      if (!sec) continue;
      if (!fillable(sheet, cellKey(sec.first, col))) continue;
      vals = { ...vals };
      rf = { ...rf };
      for (let rr = sec.first; rr <= sec.last; rr++) {
        const k = cellKey(rr, col);
        const v = list[rr - sec.first] ?? '';
        if (v) vals[k] = v;
        else delete vals[k];
        delete rf[k];
      }
      filled.push(name);
    } else {
      if (!fillable(sheet, key)) continue;
      const v = Array.isArray(src) ? src.filter(Boolean).join(', ') : src;
      vals = { ...vals, [key]: v };
      rf = { ...rf };
      delete rf[key];
      filled.push(name);
    }
  }
  return { extras: ex, values: vals, refs: rf, filled };
}

/** 이 서식에서 가져올 수 있는 칸 이름이 하나라도 있는가(가져오기 단추를 보일지) */
export function hasImportableNames(template: Sheet): boolean {
  return Object.keys(template.cellMeta[APPROVAL_NS.name] ?? {}).length > 0;
}

/** 가져온 값을 얹은 펼친 시트(다시 계산) — 작성 화면이 문서 값으로 바꿀 때 쓴다 */
export function sheetWith(template: Sheet, result: ImportResult): Sheet {
  return applyValues(expandRepeats(template, result.extras), result.values, { recalc: true });
}
