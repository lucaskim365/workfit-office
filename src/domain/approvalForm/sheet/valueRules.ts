/**
 * 값에 따라 바뀌는 것 — 기준 칸(선택·여러 선택·체크 칸) 하나를 중심으로 '이 값일 때 보이는 행'과 '이 값일 때 고를 항목(종속 선택)'을 다룬다.
 * 서식 편집기의 '값에 따라 바뀌는 것' 패널이 쓴다. 저장 모양은 기존과 같다(행 보이기 조건 showIf, 종속 선택 input.depends).
 * 기준 칸에 칸 이름이 없으면 이름표(지출 항목)로 이름을 지어 붙인다 — 관리자가 칸 이름을 먼저 붙이지 않아도 되게.
 */
import type { Sheet } from '@/lib/sheet/core';
import {
  APPROVAL_NS,
  CHECK_MARK,
  COMMON_CELL_NAMES,
  LINK_TYPES,
  approvalCellProps,
  cellCaption,
  isDirectInputOption,
  rowConditionOf,
  setApprovalProp,
  setCellName,
  setRowCondition,
  type CellInput,
} from './approvalSheet';
import { repeatSectionAt } from './repeatRows';

export interface ValueSource {
  r: number;
  c: number;
  /** 칸 이름 — 아직 없으면 undefined(처음 규칙을 걸 때 지어 붙인다) */
  name?: string;
  /** 칸 왼쪽 글자(예: '지출 항목') */
  label: string;
  /** 고를 수 있는 값 — 체크 칸은 CHECK_MARK 하나, '직접입력'은 뺀다 */
  options: string[];
  kind: 'select' | 'multiSelect' | 'checkbox';
}

const cellRange = (r: number, c: number) => ({ r1: r, r2: r, c1: c, c2: c });

/**
 * 기준 칸이 될 수 있나 — 선택·여러 선택·체크 입력 칸.
 * 반복 구간 안의 이름 없는 칸은 빼다(구간 안 칸은 첫 줄 값만 조건에 쓰이고, 이름을 지어 붙이면 한 열에 이름이 둘이 될 수 있음)
 */
export function valueSourceAt(s: Sheet, r: number, c: number): ValueSource | null {
  const p = approvalCellProps(s, r, c);
  const kind = p.input?.type;
  if (kind !== 'select' && kind !== 'multiSelect' && kind !== 'checkbox') return null;
  if (!p.name && repeatSectionAt(s, r)) return null;
  const options = kind === 'checkbox' ? [CHECK_MARK] : (p.input?.options ?? []).filter((o) => !isDirectInputOption(o));
  return { r, c, name: p.name, label: cellCaption(s, r, c), options, kind };
}

/** 기준 칸 후보 전부(이름 없는 칸 포함) — 위에서 아래 순서. 같은 이름이 두 칸에 있으면(옛 데이터) 앞 칸만 */
export function valueSources(s: Sheet): ValueSource[] {
  const out: ValueSource[] = [];
  Object.keys(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach((key) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const c = s.cols.indexOf(key.slice(i + 1));
    if (c < 0 || r >= s.rows.length) return;
    const src = valueSourceAt(s, r, c);
    if (src) out.push(src);
  });
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.r - b.r || a.c - b.c)
    .filter((x) => !x.name || (!seen.has(x.name) && !!seen.add(x.name)));
}

/** 이미 쓰이는 이름 — 칸 이름, 행 조건·종속이 가리키는 이름(칸을 지워 남은 것 포함), 기존 서식 갈래 키 */
function usedNames(s: Sheet): Set<string> {
  const used = new Set(Object.values(s.cellMeta[APPROVAL_NS.name] ?? {}).filter((v): v is string => typeof v === 'string'));
  for (let r = 0; r < s.rows.length; r++) {
    const cond = rowConditionOf(s, r);
    if (cond) used.add(cond.name);
  }
  Object.values(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach((v) => {
    const dep = (v as CellInput | undefined)?.depends;
    if (!dep) return;
    used.add(dep.name);
    dep.branches.forEach((b) => b.key && used.add(b.key));
  });
  return used;
}

/** 시스템·연동 기능이 쓰는 이름 — 지어 붙이는 이름이 이것과 겹치면 안 된다 */
const RESERVED = new Set([...COMMON_CELL_NAMES, ...LINK_TYPES.flatMap((t) => t.names)].flatMap((n) => [n.key, n.label]));

/** 기준 칸에 이름을 보장한다 — 없으면 이름표로(공백·기호 뺌, 겹치면 뒤에 숫자) 지어 붙인다 */
export function ensureSourceName(s: Sheet, r: number, c: number): { sheet: Sheet; name: string } {
  const own = approvalCellProps(s, r, c).name;
  if (own) return { sheet: s, name: own };
  const used = usedNames(s);
  const caption = cellCaption(s, r, c).replace(/[\s\p{P}\p{S}]/gu, '').slice(0, 20);
  // 이름표가 없어 칸 주소(B12)가 나오거나 숫자뿐이면(1.) 그걸로는 짓지 않는다
  const base = caption && !/^[A-Z]+\d+$/.test(caption) && !/^\d+$/.test(caption) ? caption : '조건칸';
  let name = base;
  for (let n = 2; used.has(name) || RESERVED.has(name); n++) name = `${base}${n}`;
  return { sheet: setCellName(s, r, c, name), name };
}

/** 이 값일 때 보이는 행 — 이어진 행은 묶어서(14~15행) */
export function rowsShownFor(s: Sheet, name: string, value: string): Array<{ r1: number; r2: number }> {
  const out: Array<{ r1: number; r2: number }> = [];
  for (let r = 0; r < s.rows.length; r++) {
    const cond = rowConditionOf(s, r);
    if (cond?.name !== name || !cond.values.includes(value)) continue;
    const last = out[out.length - 1];
    if (last && last.r2 === r - 1) last.r2 = r;
    else out.push({ r1: r, r2: r });
  }
  return out;
}

/** 다른 기준 칸 조건이 이미 걸린 행 — 덮기 전에 알리려고 */
export function rowsWithOtherCondition(s: Sheet, r1: number, r2: number, name: string): number[] {
  const out: number[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    const cond = rowConditionOf(s, r);
    if (cond && cond.name !== name) out.push(r);
  }
  return out;
}

/** 행들을 이 값일 때도 보이게 — 같은 기준 칸 조건이면 값을 더하고, 다른 기준 칸 조건·조건 없음이면 이 조건으로 */
export function showRowsFor(s0: Sheet, r1: number, r2: number, name: string, value: string): Sheet {
  let s = s0;
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    const cond = rowConditionOf(s, r);
    const values = cond?.name === name ? [...new Set([...cond.values, value])] : [value];
    s = setRowCondition(s, r, r, { name, values });
  }
  return s;
}

/** 행들에서 이 값을 뺀다 — 값이 다 빠지면 조건 없음(항상 보임) */
export function removeRowsFor(s0: Sheet, r1: number, r2: number, name: string, value: string): Sheet {
  let s = s0;
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    const cond = rowConditionOf(s, r);
    if (cond?.name !== name) continue;
    const values = cond.values.filter((v) => v !== value);
    s = setRowCondition(s, r, r, values.length ? { name, values } : undefined);
  }
  return s;
}

export interface DependentCell {
  r: number;
  c: number;
  label: string;
  input: CellInput;
}

/** 이 기준 칸 값에 따라 고를 항목이 바뀌는 칸(종속 선택) */
export function dependentCells(s: Sheet, name: string): DependentCell[] {
  const out: DependentCell[] = [];
  Object.entries(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach(([key, v]) => {
    const input = v as CellInput | undefined;
    if (input?.depends?.name !== name) return;
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const c = s.cols.indexOf(key.slice(i + 1));
    if (c >= 0) out.push({ r, c, label: cellCaption(s, r, c), input });
  });
  return out.sort((a, b) => a.r - b.r || a.c - b.c);
}

/** 이 기준 칸에 걸린 것이 있나 — 값에 따라 보이는 행이나 항목이 바뀌는 칸 */
export function hasValueRules(s: Sheet, src: ValueSource): boolean {
  const name = src.name;
  if (!name) return false;
  return dependentCells(s, name).length > 0 || src.options.some((v) => rowsShownFor(s, name, v).length > 0);
}

/**
 * 종속 칸으로 고를 수 있나 — 막히면 이유, 바꾸기 전에 물어볼 것이 있으면 ask.
 * 이름표(글자만 있는 칸)·수식 칸·기준 칸 자신은 안 되고, 선택 칸이 아닌 입력 칸·다른 기준 칸의 종속 칸은 묻는다
 */
export function dependentCheck(s: Sheet, r: number, c: number, src: { r: number; c: number; name?: string }): { block?: string; ask?: string } {
  if (r === src.r && c === src.c) return { block: '기준 칸 자신은 고를 수 없습니다.' };
  const key = `${r}:${s.cols[c]}`;
  if (s.formulas[key] !== undefined) return { block: '수식 칸은 고를 항목 칸이 될 수 없습니다.' };
  const input = approvalCellProps(s, r, c).input;
  if (!input) return (s.rows[r]?.[s.cols[c]] ?? '').trim() ? { block: '글자가 적힌 칸(이름표)은 고를 수 없습니다. 값을 고를 빈 칸을 누르세요.' } : {};
  if (input.depends && src.name && input.depends.name === src.name) return {};
  if (input.depends) return { ask: '이 칸은 다른 칸 값에 따라 항목이 바뀌는 칸입니다. 이 기준 칸으로 옮길까요? (그 칸 값별 항목은 지워집니다)' };
  if (input.type !== 'select') return { ask: `'${cellCaption(s, r, c)}' 칸은 선택 칸이 아닙니다. 선택 칸으로 바꿀까요?` };
  return {};
}

/** 칸을 이 기준 칸의 종속 선택 칸으로 — 쓰던 항목은 갈래가 정해질 때까지 그대로 둔다. 이미 이 기준 칸의 종속이면 그대로(갈래·키 보존) */
export function makeDependent(s: Sheet, r: number, c: number, name: string): Sheet {
  const cur = approvalCellProps(s, r, c).input;
  if (cur?.depends?.name === name) return s;
  const input: CellInput = { type: 'select', options: cur?.type === 'select' || cur?.type === 'multiSelect' ? (cur.options ?? []) : [], depends: { name, branches: [] } };
  return setApprovalProp(s, cellRange(r, c), APPROVAL_NS.input, input);
}

/** 종속 선택을 푼다 — 모든 갈래 항목을 한 목록으로 */
export function clearDependent(s: Sheet, r: number, c: number): Sheet {
  const cur = approvalCellProps(s, r, c).input;
  if (!cur?.depends) return s;
  const { depends: _drop, ...rest } = cur;
  return setApprovalProp(s, cellRange(r, c), APPROVAL_NS.input, { ...rest, options: cur.options ?? [] });
}

/** 종속 선택 한 갈래(기준 값 when)의 항목 — 빈 목록이면 그 값일 때 칸을 쓸 수 없다. 기존 서식에서 온 갈래 키(key)는 지킨다 */
export function withBranchOptions(input: CellInput, when: string, options: string[]): CellInput {
  const dep = input.depends;
  if (!dep) return input;
  const known = dep.branches.find((b) => b.when === when);
  const branches = known ? dep.branches.map((b) => (b.when === when ? { ...b, options } : b)) : [...dep.branches, { when, options }];
  const kept = branches.filter((b) => b.options.length || b.key);
  return { ...input, depends: { ...dep, branches: kept }, options: [...new Set(kept.flatMap((b) => b.options))] };
}

/** 칸 하나의 종속 갈래 항목 바꾸기 */
export function setBranchOptions(s: Sheet, r: number, c: number, when: string, options: string[]): Sheet {
  const input = approvalCellProps(s, r, c).input;
  if (!input?.depends) return s;
  return setApprovalProp(s, cellRange(r, c), APPROVAL_NS.input, withBranchOptions(input, when, options));
}
