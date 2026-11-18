/**
 * 연결 칸 지키기 — 칸 이름(cellMeta.name)은 다른 기능(휴가 차감·매입 결제 관리·관련 문서 값 가져오기 등)이 값을 찾는 열쇠다.
 * 일반 편집자 화면에서는 칸 이름을 보이지 않고, 이름이 붙은 칸은 🔒로만 보인다. 모양은 마음대로 바꿔도 되지만
 * 그 이름이 사라지는 동작(행·열 지우기, 덮는 병합, 입력 종류 바꾸기 등)과 저장은 막는다.
 * 여기는 판단만 하는 순수 함수 — 누가 막히는지(개발자인지)는 화면 쪽(cellLinkGate)이 정한다.
 *
 * 잠그는 이름은 '마지막으로 저장한 판'으로 정한다(lockedNamesOf) — 지금 시트의 규칙으로 정하면
 * 편집자가 잠긴 칸에 규칙을 걸어 잠금을 풀 수 있기 때문. 저장한 판에서 'amount'(금액 키 — 편집자가 직접 체크로 정함)가 아닌 이름 중
 *  - 연동 기능 이름(LINK_TYPES 의 키)이면 잠금
 *  - 직접 쓴 이름은 그 판에서 '값에 따라 바뀌는 것'(행 보이기 조건·종속 선택)이 가리키지 않았으면 잠금
 *    (가리키던 이름은 편집자가 규칙을 걸 때 저절로 지어 붙는 것이라 편집자 몫이다)
 * 저장한 뒤 새로 붙은 이름(규칙이 지어 붙인 이름)은 잠그지 않는다. 연동 이름이 새로 생기는 것은 저장 검사가 막는다.
 */
import { cellKey, type CellRange, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, LINK_TYPES, cellAddress, cellCaption, coveredKeys, linkTypeDef, nameLabel, rowConditionOf, setCellName, type CellInput } from './approvalSheet';

/** 편집자가 직접 정하는 이름(잠그지 않음) — 금액 키 */
export const AMOUNT_NAME = 'amount';

const LINK_KEYS = new Set(LINK_TYPES.flatMap((t) => t.names.map((n) => n.key)));

/** 연동 기능 이름(휴가 기간·발주처 등)인가 — 어느 연동 기능이든 */
export const isLinkKey = (name: string): boolean => LINK_KEYS.has(name);

/** 잠긴 이름들 — 마지막으로 저장한 판에서 정한다(lockedNamesOf) */
export type LockedNames = ReadonlySet<string>;

/** '값에 따라 바뀌는 것'이 가리키는 이름 — 행 보이기 조건·종속 선택의 기준 칸 이름 */
export function ruleNames(s: Sheet): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < s.rows.length; r++) {
    const cond = rowConditionOf(s, r);
    if (cond) out.add(cond.name);
  }
  Object.values(s.cellMeta[APPROVAL_NS.input] ?? {}).forEach((v) => {
    const dep = (v as CellInput | undefined)?.depends;
    if (dep?.name) out.add(dep.name);
  });
  return out;
}

const keyRow = (key: string) => Number(key.slice(0, key.indexOf(':')));
const keyCol = (key: string) => key.slice(key.indexOf(':') + 1);

/** 칸 이름 전부 — 칸 키('행:열키') → 이름(금액 키 포함) */
const nameEntries = (s: Sheet): Array<[string, string]> =>
  Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]);

/** 저장한 판의 잠긴 이름 — 연동 이름, 그리고 그 판의 규칙이 가리키지 않던 직접 쓴 이름(금액 키는 빼고) */
export function lockedNamesOf(saved: Sheet): Set<string> {
  const rules = ruleNames(saved);
  const out = new Set<string>();
  nameEntries(saved).forEach(([, n]) => {
    if (n !== AMOUNT_NAME && (isLinkKey(n) || !rules.has(n))) out.add(n);
  });
  return out;
}

/** 이 이름이 잠긴 이름인가 */
export function isLockedName(locked: LockedNames, name: string | undefined): name is string {
  return !!name && name !== AMOUNT_NAME && locked.has(name);
}

/** 잠긴 이름이 붙은 칸 — 칸 키('행:열키') → 이름 */
export function lockedCells(s: Sheet, locked: LockedNames): Map<string, string> {
  return new Map(nameEntries(s).filter(([, n]) => isLockedName(locked, n)));
}

/** 잠긴 이름을 사람에게 — 이름표(지금 연동 기능의 한글 이름 우선)와 그 이름을 쓰는 기능 */
export function lockInfo(name: string, link: string | null | undefined): { label: string; feature: string } {
  const def = linkTypeDef(link);
  const own = def?.names.find((n) => n.key === name);
  if (def && own) {
    // '휴가 — 휴가 차감·근태·캘린더' → '휴가 차감·근태·캘린더'
    const i = def.feature.indexOf('— ');
    return { label: own.label, feature: i >= 0 ? def.feature.slice(i + 2) : def.feature };
  }
  return { label: nameLabel(name), feature: '관련 문서 값 가져오기' };
}

/** 칸 표시·안내 한 줄 — '휴가 기간 — 휴가 차감·근태·캘린더에 쓰여요' */
export function lockTitle(name: string, link: string | null | undefined): string {
  const { label, feature } = lockInfo(name, link);
  return `${label} — ${feature}에 쓰여요`;
}

const reason = (name: string, link: string | null | undefined): string => {
  const { label, feature } = lockInfo(name, link);
  return `'${label}'(${feature})`;
};

/** 이 칸이 '값에 따라 바뀌는 것'의 기준 칸이라 지울 수 없다는 안내 */
const ruleNote = (s: Sheet, r: number, c: number): string =>
  `${cellAddress(r, c)} 칸('${cellCaption(s, r, c)}') 값에 따라 바뀌는 규칙이 있어요. 규칙('값에 따라 바뀌는 것')을 먼저 지우면 지울 수 있어요.`;

/** 범위 안 칸 이름 중 막는 것 — 잠긴 이름이면 그 기능, 규칙 기준 칸이면 규칙 안내 */
function deleteBlock(s: Sheet, locked: LockedNames, link: string | null | undefined, inRange: (r: number, c: number) => boolean): string | null {
  const rules = ruleNames(s);
  let ruleHit: string | null = null;
  for (const [key, name] of nameEntries(s)) {
    const r = keyRow(key);
    const c = s.cols.indexOf(keyCol(key));
    if (c < 0 || !inRange(r, c)) continue;
    if (isLockedName(locked, name)) return `${cellAddress(r, c)} 칸은 ${reason(name, link)}에 쓰여서 지울 수 없어요.`;
    if (!ruleHit && rules.has(name)) ruleHit = ruleNote(s, r, c);
  }
  return ruleHit;
}

/** 행 r1~r2 를 지우면 사라지는 잠긴 이름·규칙 기준 칸이 있으면 막는 까닭, 없으면 null */
export function deleteRowsBlock(s: Sheet, r1: number, r2: number, link: string | null | undefined, locked: LockedNames): string | null {
  const lo = Math.min(r1, r2);
  const hi = Math.max(r1, r2);
  return deleteBlock(s, locked, link, (r) => r >= lo && r <= hi);
}

/** 열 c1~c2 를 지우면 사라지는 잠긴 이름·규칙 기준 칸이 있으면 막는 까닭, 없으면 null */
export function deleteColsBlock(s: Sheet, c1: number, c2: number, link: string | null | undefined, locked: LockedNames): string | null {
  const lo = Math.min(c1, c2);
  const hi = Math.max(c1, c2);
  return deleteBlock(s, locked, link, (_r, c) => c >= lo && c <= hi);
}

/**
 * 병합하면 잠긴 이름이 사라지나 — 막는 까닭, 괜찮으면 null.
 * 잠긴 칸이 남는 칸(왼쪽 위, 왼쪽 위가 비었으면 처음 나오는 내용 있는 칸 — 그 칸이 왼쪽 위로 옮겨짐)이면 괜찮다
 */
export function mergeBlock(s: Sheet, range: CellRange, link: string | null | undefined, locked: LockedNames): string | null {
  const cells = lockedCells(s, locked);
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const c1 = Math.min(range.c1, range.c2);
  const c2 = Math.max(range.c1, range.c2);
  const inside: string[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (s.cols[c] !== undefined && cells.has(cellKey(r, s.cols[c]))) inside.push(cellKey(r, s.cols[c]));
  if (inside.length >= 2) {
    const labels = inside.map((k) => `'${lockInfo(cells.get(k)!, link).label}'`).join('·');
    return `${labels} 칸은 다른 기능에 따로 쓰여서 한 칸으로 합칠 수 없어요.`;
  }
  const covered = new Set(coveredKeys(s, range));
  const hit = inside.find((k) => covered.has(k));
  return hit ? `이 칸은 ${reason(cells.get(hit)!, link)}에 쓰여서 가려지게 합칠 수 없어요. 이 칸이 왼쪽 위에 오도록 고르세요.` : null;
}

/** 이름별 개수 */
function countNames(names: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of names) out.set(n, (out.get(n) ?? 0) + 1);
  return out;
}

const allNames = (s: Sheet): string[] => nameEntries(s).map(([, n]) => n).filter((n) => n !== AMOUNT_NAME);

/** prev 의 잠긴 이름 중 next 에서 사라진(개수가 줄어든) 이름 */
export function droppedLockedNames(prev: Sheet, next: Sheet, locked: LockedNames): string[] {
  const before = countNames(lockedCells(prev, locked).values());
  const after = countNames(allNames(next));
  return [...before].filter(([n, k]) => (after.get(n) ?? 0) < k).map(([n]) => n);
}

/** 이 이름이 붙은 칸들의 입력 종류(입력 칸이 아니면 undefined) */
const inputTypesOf = (s: Sheet, name: string): Array<string | undefined> =>
  nameEntries(s)
    .filter(([, n]) => n === name)
    .map(([key]) => (s.cellMeta[APPROVAL_NS.input]?.[key] as CellInput | undefined)?.type);

/**
 * 잠긴 칸의 입력 종류가 바뀌었거나 빠졌나 — 연동 기능은 칸 종류(날짜·선택 등)에 맞춰 값을 읽는다.
 * 칸이 옮겨져도(행 넣기·병합) 이름으로 찾아 비교한다
 */
export function inputChangedLocked(prev: Sheet, next: Sheet, locked: LockedNames): string | undefined {
  for (const name of new Set(lockedCells(prev, locked).values())) {
    const was = new Set(inputTypesOf(prev, name));
    if (inputTypesOf(next, name).some((t) => !was.has(t))) return name;
  }
  return undefined;
}

/**
 * 편집자 동작(칸 속성·부품) 하나를 받아도 되나 — 막는 까닭, 괜찮으면 null.
 * 잠긴 이름이 사라지거나, 잠긴 칸의 입력 종류가 바뀌면 막는다
 */
export function sheetChangeBlock(prev: Sheet, next: Sheet, link: string | null | undefined, locked: LockedNames): string | null {
  const dropped = droppedLockedNames(prev, next, locked);
  if (dropped.length) return `이 칸은 ${reason(dropped[0], link)}에 쓰여서 지울 수 없어요.`;
  const changed = inputChangedLocked(prev, next, locked);
  if (changed) return `이 칸은 ${reason(changed, link)}에 쓰여서 칸 종류를 바꿀 수 없어요.`;
  const ruled = newRuleOnLocked(prev, next, locked);
  if (ruled) return `이 칸은 ${reason(ruled, link)}에 쓰여서 '값에 따라 바뀌는 것'의 기준 칸으로 쓸 수 없어요.`;
  return null;
}

/**
 * 잠긴 직접 쓴 이름이 새로 규칙의 기준 이름이 됐나 — 그러면 다음 저장부터 '규칙 이름'으로 보여 잠금이 풀리므로 막는다.
 * 연동 이름은 규칙과 상관없이 늘 잠기므로 기준 칸으로 써도 된다(휴가 종류에 따라 행 보이기 등)
 */
function newRuleOnLocked(prev: Sheet, next: Sheet, locked: LockedNames): string | undefined {
  const was = ruleNames(prev);
  return [...ruleNames(next)].find((n) => isLockedName(locked, n) && !isLinkKey(n) && !was.has(n));
}

/**
 * 규칙을 풀어 아무 규칙도 가리키지 않게 된 이름을 뗀다 — 규칙을 걸 때 저절로 지어 붙은 이름이 남아
 * 편집자가 볼 수도 뗄 수도 없는 이름으로 남지 않게. 잠긴 이름·연동 이름·금액 키는 그대로 둔다
 */
export function dropUnusedRuleNames(prev: Sheet, next: Sheet, locked: LockedNames): Sheet {
  const after = ruleNames(next);
  const gone = new Set([...ruleNames(prev)].filter((n) => !after.has(n) && n !== AMOUNT_NAME && !isLinkKey(n) && !locked.has(n)));
  if (!gone.size) return next;
  let out = next;
  for (const [key, name] of nameEntries(next)) {
    const c = next.cols.indexOf(keyCol(key));
    if (gone.has(name) && c >= 0) out = setCellName(out, keyRow(key), c, undefined);
  }
  return out;
}

/**
 * 저장 전 검사 — 마지막으로 저장한 것과 비교해 연결이 틀어졌으면 막는 까닭들(붙여넣기·버전 되살리기·되돌리기 등 어느 길로 왔든).
 * - 연동 기능이 바뀜
 * - 저장한 판의 잠긴 이름이 사라짐(개수가 줄어듦)
 * - 잠긴 칸의 입력 종류가 바뀜
 * - 연동 기능 이름이 새로 생기거나 늘어남(편집자는 연동 이름을 붙일 수 없다)
 * 이름 없는 새 서식, 규칙이 지어 붙인 이름·금액 키는 괜찮다
 */
export function saveLockIssues(
  saved: { sheet: Sheet; link: string | null },
  current: { sheet: Sheet; link: string | null }
): string[] {
  const issues: string[] = [];
  const locked = lockedNamesOf(saved.sheet);
  if ((saved.link ?? null) !== (current.link ?? null)) issues.push('연동 기능은 바꿀 수 없어요. 마지막으로 저장한 연동 기능으로 되돌려 주세요.');
  const dropped = droppedLockedNames(saved.sheet, current.sheet, locked);
  dropped.forEach((n) => issues.push(`${reason(n, saved.link)}에 쓰이는 칸이 사라졌어요. 되돌리기(Ctrl+Z)로 살려 주세요.`));
  for (const n of new Set(lockedCells(saved.sheet, locked).values())) {
    if (dropped.includes(n)) continue;
    const was = new Set(inputTypesOf(saved.sheet, n));
    if (inputTypesOf(current.sheet, n).some((t) => !was.has(t))) issues.push(`${reason(n, saved.link)}에 쓰이는 칸의 종류가 바뀌었어요. 되돌리기(Ctrl+Z)로 살려 주세요.`);
  }
  const ruled = newRuleOnLocked(saved.sheet, current.sheet, locked);
  if (ruled) issues.push(`${reason(ruled, saved.link)}에 쓰이는 칸을 '값에 따라 바뀌는 것'의 기준 칸으로 쓸 수 없어요. 규칙을 지워 주세요.`);
  const before = countNames(allNames(saved.sheet));
  const after = countNames(allNames(current.sheet));
  [...after].forEach(([n, k]) => {
    if (isLinkKey(n) && k > (before.get(n) ?? 0)) issues.push(`${reason(n, current.link)}에 쓰이는 칸이 새로 생겼어요. 연결 칸은 개발 담당자가 정해요.`);
  });
  return issues;
}
