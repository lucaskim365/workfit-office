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
  cellAddress,
  cellCaption,
  dependentKeyValues,
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

/** 이 기준 칸에 걸린 것이 있나 — 값에 따라 보이는 행이나 항목이 바뀌는 칸(지금 항목에 없는 값에 걸린 것도 센다) */
export function hasValueRules(s: Sheet, src: ValueSource): boolean {
  const name = src.name;
  if (!name) return false;
  if (dependentCells(s, name).length > 0) return true;
  for (let r = 0; r < s.rows.length; r++) if (rowConditionOf(s, r)?.name === name) return true;
  return false;
}

/**
 * 이 기준 칸에 걸려 있지만 지금 '고를 항목'에 없는 값 — 항목 이름을 고치거나 지워서 남은 것.
 * 그 값에 걸린 행은 보이지 않고 종속 항목은 쓰이지 않으니, 편집기가 보여 주어 옮기거나 풀 수 있게 한다
 */
export function staleRuleValues(s: Sheet, src: ValueSource): string[] {
  const name = src.name;
  if (!name) return [];
  const seen = new Set<string>();
  for (let r = 0; r < s.rows.length; r++) {
    const cond = rowConditionOf(s, r);
    if (cond?.name === name) cond.values.forEach((v) => seen.add(v));
  }
  dependentCells(s, name).forEach((d) => d.input.depends?.branches.forEach((b) => b.options.length && seen.add(b.when)));
  return [...seen].filter((v) => !src.options.includes(v));
}

/** 조건이 가리키는 이름이 무엇인가 — choice: 선택·체크 칸, key: 종속 갈래 이름(기존 서식), plain: 이름은 있지만 고르는 칸이 아님, missing: 시트에 없음 */
export function ruleSourceKind(s: Sheet, name: string): 'choice' | 'key' | 'plain' | 'missing' {
  if (valueSources(s).some((x) => x.name === name)) return 'choice';
  if (Object.values(s.cellMeta[APPROVAL_NS.name] ?? {}).includes(name)) return 'plain';
  return name in dependentKeyValues(s) ? 'key' : 'missing';
}

const rowsLabel = (rows: number[]) => rows.map((r) => r + 1).join('·') + '행';

/**
 * 끊긴 '값에 따라 바뀌는 것' — 저장은 되지만 기안 화면에서 뜻대로 움직이지 않는 것을 알려 준다(막지는 않음).
 * 기준 칸에서 부품을 빼거나, 고를 항목 이름을 고치거나, 칸 이름을 지웠을 때 생긴다
 */
export function valueRuleIssues(s: Sheet): string[] {
  const out: string[] = [];
  const sources = valueSources(s);
  // 직접 입력을 받는 기준 칸은 목록에 없는 값도 나올 수 있어 '없는 값'으로 보지 않는다
  const openEnded = (src: ValueSource) => (approvalCellProps(s, src.r, src.c).input?.options ?? []).some(isDirectInputOption);

  // 행 보이기 조건 — 이름별로 모아서
  const byName = new Map<string, Array<{ r: number; values: string[] }>>();
  for (let r = 0; r < s.rows.length; r++) {
    const cond = rowConditionOf(s, r);
    if (cond) byName.set(cond.name, [...(byName.get(cond.name) ?? []), { r, values: cond.values }]);
  }
  byName.forEach((rows, name) => {
    const kind = ruleSourceKind(s, name);
    const all = rows.map((x) => x.r);
    if (kind === 'missing') out.push(`${rowsLabel(all)}: 보이기 조건의 기준 칸 '${name}'이(가) 시트에 없어 항상 보입니다. 조건을 풀거나 기준 칸을 다시 정해 주세요.`);
    if (kind === 'plain') out.push(`${rowsLabel(all)}: 보이기 조건의 기준 칸 '${name}'이(가) 선택·체크 칸이 아닙니다. 기안 화면에서 이 줄이 보이지 않을 수 있습니다.`);
    const src = sources.find((x) => x.name === name);
    if (!src || openEnded(src)) return;
    const dead = rows.filter((x) => !x.values.some((v) => src.options.includes(v)));
    if (dead.length) {
      const values = [...new Set(dead.flatMap((x) => x.values))].join('·');
      out.push(`${rowsLabel(dead.map((x) => x.r))}: '${src.label}'의 고를 항목에 없는 값(${values})에만 걸려 있어 기안 화면에서 보이지 않습니다.`);
    }
  });

  // 종속 선택
  Object.entries(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach(([key, v]) => {
    const dep = (v as CellInput | undefined)?.depends;
    if (!dep) return;
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const c = s.cols.indexOf(key.slice(i + 1));
    if (c < 0 || r >= s.rows.length) return;
    const where = `${cellCaption(s, r, c)}(${cellAddress(r, c)})`;
    const src = sources.find((x) => x.name === dep.name);
    if (!src) return void out.push(`${where}: 고를 항목의 기준 칸 '${dep.name}'이(가) 없거나 선택 칸이 아닙니다. 기안 화면에서 항목이 뜻대로 나오지 않습니다.`);
    const dead = dep.branches.filter((b) => b.options.length && !src.options.includes(b.when)).map((b) => b.when);
    if (dead.length) out.push(`${where}: '${src.label}'의 고를 항목에 없는 값(${dead.join('·')})에 적어 둔 항목은 쓰이지 않습니다.`);
  });
  return out;
}

/**
 * 종속 칸으로 고를 수 있나 — 막히면 이유, 바꾸기 전에 물어볼 것이 있으면 ask.
 * 이름표(글자만 있는 칸)·수식 칸·저절로 채워지는 칸·자동번호 칸·기준 칸 자신은 안 되고, 선택 칸이 아닌 입력 칸·다른 기준 칸의 종속 칸은 묻는다
 */
export function dependentCheck(s: Sheet, r: number, c: number, src: { r: number; c: number; name?: string }): { block?: string; ask?: string } {
  if (r === src.r && c === src.c) return { block: '기준 칸 자신은 고를 수 없습니다.' };
  const key = `${r}:${s.cols[c]}`;
  if (s.formulas[key] !== undefined) return { block: '수식 칸은 고를 항목 칸이 될 수 없습니다.' };
  const props = approvalCellProps(s, r, c);
  // 시스템이 채우는 칸을 선택 칸으로 만들면 '저절로 채워짐'과 '기안자가 고름'이 한 칸에 함께 남는다
  if (props.bind || props.autoNo) return { block: '저절로 채워지는 칸·자동번호 칸은 고를 수 없습니다. 그 칸의 부품을 먼저 빼 주세요.' };
  const input = props.input;
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

/**
 * 여러 칸을 고른 채 입력 칸 속성 하나(입력 예시·고를 항목·직접 입력 허용)를 고칠 때 —
 * 초점 칸과 입력 종류가 같은 칸에만, patch 가 바꾼 속성만 넣는다. 종류가 다른 칸은 그대로 둔다(종류·항목·종속이 지워지지 않게).
 * skipDependent: 종속 칸은 건너뛴다(고를 항목이 기준 칸 값마다 따로라 한 목록으로 덮으면 안 됨)
 */
export function patchSameInputs(
  s: Sheet,
  range: { r1: number; r2: number; c1: number; c2: number },
  focus: { r: number; c: number },
  patch: (input: CellInput) => CellInput,
  opts: { skipDependent?: boolean } = {}
): Sheet {
  const type = approvalCellProps(s, focus.r, focus.c).input?.type;
  if (!type) return s;
  let out = s;
  for (let r = Math.min(range.r1, range.r2); r <= Math.max(range.r1, range.r2); r++) {
    for (let c = Math.min(range.c1, range.c2); c <= Math.max(range.c1, range.c2); c++) {
      const cur = approvalCellProps(s, r, c).input;
      if (!cur || cur.type !== type || (opts.skipDependent && cur.depends)) continue;
      out = setApprovalProp(out, cellRange(r, c), APPROVAL_NS.input, patch(cur));
    }
  }
  return out;
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
