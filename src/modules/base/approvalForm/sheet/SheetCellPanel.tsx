import { useEffect, useState } from 'react';
import type { Sheet, SheetSelection } from '@/lib/sheet';
import {
  APPROVAL_NS,
  COMMON_CELL_NAMES,
  approvalCellProps,
  cellAddress,
  cellCaption,
  CHECK_MARK,
  DIRECT_INPUT_OPTION,
  isDirectInputOption,
  rowConditionOf,
  setRowCondition,
  setApprovalProp,
  setCellName,
  type CellInput,
  LEAVE_TYPE_NAMES,
  LINK_TYPES,
  linkTypeDef,
  nameLabel,
  PLACEHOLDER_INPUTS,
  PLACEHOLDER_MAX,
  titleHintOf,
} from '@/domain/approvalForm/sheet/approvalSheet';
import {
  clearDependent,
  dependentCheck,
  ensureSourceName,
  hasValueRules,
  makeDependent,
  patchSameInputs,
  ruleSourceKind,
  rowsWithOtherCondition,
  showRowsFor,
  valueSourceAt,
  valueSources,
} from '@/domain/approvalForm/sheet/valueRules';
import { BranchInput, ValueRulesPanel, type ValuePick } from './ValueRulesPanel';
import { PART_SECTIONS, applyPart } from './SheetPalette';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { clearRepeatSection, renameRepeatSection, repeatSectionAt, setRepeatSection } from '@/domain/approvalForm/sheet/repeatRows';
import { isExternalHiddenRow, setExternalHiddenRows } from '@/domain/approvalForm/sheet/sheetHeader';
import { AutoNumberSettings } from '../components/ApprovalFormEditor';
import { useCompanyMarks } from '@/features/companyMark/useCompanyMarks';
import { marksOf } from '@/domain/companyMark/schema';
import { autoNumberPreview } from '@/domain/approvalForm/autoNumber';
import { AMOUNT_NAME, isLockedName, lockInfo, lockTitle, ruleNames, type LockedNames } from '@/domain/approvalForm/sheet/linkLock';
import { canEditCellLinks } from './cellLinkGate';

/** 잠긴 이름 없음(기본값) */
const NO_LOCKED: LockedNames = new Set();

/**
 * 시트 서식 편집기 — 고른 칸의 결재 속성(칸 종류·필수·잠금·직인·칸 이름·비공개·작성 요령)과 그 줄의 설정(보이기 조건·거래처용 숨김·반복 구간).
 * 보이는 값은 초점 칸 기준이고, 바꾸면 고른 범위 전체에 넣는다(칸 이름만 초점 칸 하나에).
 */
/** 칸 이름 고르기에서 '직접 쓰기' 항목 값 */
const CUSTOM = '__custom__';
const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2 py-1.5 text-[12px] text-ink outline-none focus:border-teal disabled:opacity-50';

/** (?) — 마우스를 올리면 설명(늘 펼쳐 두면 화면이 글로 가득하다) */
function HelpMark({ text, size = 'h-3 w-3' }: { text: string; size?: string }) {
  return (
    <span
      role="img"
      aria-label={`설명: ${text}`}
      title={text}
      // 체크 칸 label 안에 있어도 체크가 바뀌지 않게
      onClick={(e) => e.preventDefault()}
      className="inline-flex cursor-help text-ink3 hover:text-teal"
    >
      <CircleHelp className={size} />
    </span>
  );
}

/** 제목 옆 (?) */
export function Help({ text, size, children }: { text?: string; size?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      {children}
      {text && <HelpMark text={text} size={size} />}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Help text={hint}>
        <span className="text-[11px] font-bold text-ink2">{label}</span>
      </Help>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label, hint, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 rounded-md px-1 py-0.5 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-panel-alt'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-teal" />
      <span className="text-[11.5px] font-semibold text-ink">{label}</span>
      <HelpMark text={hint} />
    </label>
  );
}

/** 접는 묶음 — 접혀 있을 때도 무엇이 켜져 있는지 한 줄로 */
function Fold({
  title,
  summary,
  open,
  onToggle,
  flat = false,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  /** 위 구분선 없이(묶음 안에서) */
  flat?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={flat ? undefined : 'border-t border-border pt-2'}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full min-w-0 items-center gap-1 text-left text-[11px] font-bold text-ink2 hover:text-teal">
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="shrink-0">{title}</span>
        {!open && summary && <span className="truncate font-normal text-ink3">· {summary}</span>}
      </button>
      {open && <div className="mt-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

/** '칸 종류' 고르기 — 왼쪽 부품 목록과 같은 묶음·같은 동작 */
const KIND_GROUPS = PART_SECTIONS.map((s) => ({ title: s.title, parts: s.groups.flatMap((g) => g.parts) }));
const KIND_PARTS = new Map(KIND_GROUPS.flatMap((g) => g.parts).map((p) => [p.id, p]));
const UNKNOWN_KIND = '__unknown__';

export function SheetCellPanel({
  sheet,
  selection,
  onChange,
  link = null,
  locked = NO_LOCKED,
}: {
  sheet: Sheet;
  selection: SheetSelection;
  onChange: (next: Sheet) => void;
  /** 연동 기능(연동 유형) — 있으면 그 연동 칸 이름(휴가 기간 등)을 칸 이름 목록에 */
  link?: string | null;
  /** 잠긴 이름(🔒) — 마지막으로 저장한 판으로 정한 것(linkLock.lockedNamesOf) */
  locked?: LockedNames;
}) {
  const linkDef = linkTypeDef(link);
  const systemKeys = new Set([...COMMON_CELL_NAMES.map((n) => n.key), ...(linkDef?.names.map((n) => n.key) ?? [])]);
  const { range, focus } = selection;
  const props = approvalCellProps(sheet, focus.r, focus.c);
  const multi = range.r1 !== range.r2 || range.c1 !== range.c2;
  const where = multi ? `${cellAddress(range.r1, range.c1)}:${cellAddress(range.r2, range.c2)}` : cellAddress(focus.r, focus.c);
  const isFormula = sheet.formulas[`${focus.r}:${sheet.cols[focus.c]}`] !== undefined;
  /** 연동 기능이 늘 잠그는 칸 이름(휴일근무 출근·퇴근 시각·근무 시간) — 이 칸이면 잠금 체크를 켠 채 고정 */
  const systemLocked = props.name ? linkDef?.names.find((n) => n.key === props.name && n.locked) : undefined;
  // 칸 이름·연동은 개발 담당자 몫 — 일반 편집자에겐 이름 대신 🔒, 그 칸의 종류는 못 바꾼다(연동이 칸 종류에 맞춰 값을 읽음)
  const devLinks = canEditCellLinks();
  const lockedName = isLockedName(locked, props.name) ? props.name : undefined;
  const kindLocked = !devLinks && !!lockedName;
  // 금액 칸으로 정할 수 없는 까닭 — 잠긴 칸이거나 '값에 따라 바뀌는 것'의 기준 칸(그 이름을 규칙이 가리킴). 그 밖의 이름(규칙을 풀어 남은 것)은 덮어도 된다
  const amountBlock =
    !props.name || props.name === AMOUNT_NAME
      ? undefined
      : lockedName
        ? '이 칸은 이미 다른 기능에 쓰여서 금액 칸으로 정할 수 없어요.'
        : ruleNames(sheet).has(props.name)
          ? "이 칸은 '값에 따라 바뀌는 것'의 기준 칸이에요 — 금액 칸으로 정하려면 그 규칙을 먼저 지워 주세요."
          : undefined;
  // 금액 칸 — 편집자가 체크로 정한다(서식에 하나 — 다른 칸에 있으면 이 칸으로 옮김, 칸 이름 고르기와 같은 규칙)
  const amountKey = Object.entries(sheet.cellMeta[APPROVAL_NS.name] ?? {}).find(([, n]) => n === AMOUNT_NAME)?.[0];
  const amountAt = (() => {
    if (!amountKey) return undefined;
    const i = amountKey.indexOf(':');
    const r = Number(amountKey.slice(0, i));
    const c = sheet.cols.indexOf(amountKey.slice(i + 1));
    return c < 0 || (r === focus.r && c === focus.c) ? undefined : cellAddress(r, c);
  })();

  // 선택 항목은 줄마다 하나 — 입력 중엔 글자 그대로 두고, 칸을 벗어날 때 넣는다
  const optionsText = (props.input?.options ?? []).join('\n');
  const [options, setOptions] = useState(optionsText);
  useEffect(() => setOptions(optionsText), [optionsText, focus.r, focus.c]);

  // 여러 칸을 골랐어도 초점 칸과 종류가 같은 칸에만, 고친 속성만 넣는다 — 종류가 다른 칸의 종류·항목·종속이 지워지지 않게
  const patchInputs = (patch: (input: CellInput) => CellInput, opts?: { skipDependent?: boolean }) =>
    onChange(patchSameInputs(sheet, range, focus, patch, opts));
  const commitOptions = () => {
    if (!props.input) return;
    const list = options.split('\n').map((o) => o.trim()).filter(Boolean);
    patchInputs((input) => ({ ...input, options: list }), { skipDependent: true });
  };

  const hasOptions = props.input?.type === 'select' || props.input?.type === 'multiSelect';

  // 입력 예시(플레이스홀더) — 입력 중엔 글자 그대로 두고, 칸을 벗어날 때 넣는다(고를 항목과 같음)
  // 문서 제목 칸은 입력 칸이 아니라(문서에 저장) 예시를 따로 둔다 — 비우면 작성 화면의 기본 문구
  const isTitleCell = props.bind === 'doc.title';
  const canPlaceholder = isTitleCell || (!!props.input && PLACEHOLDER_INPUTS.has(props.input.type));
  const placeholderText = isTitleCell ? (titleHintOf(sheet, focus.r, focus.c) ?? '') : (props.input?.placeholder ?? '');
  const [placeholder, setPlaceholder] = useState(placeholderText);
  useEffect(() => setPlaceholder(placeholderText), [placeholderText, focus.r, focus.c]);
  const commitPlaceholder = () => {
    const p = placeholder.trim().slice(0, PLACEHOLDER_MAX);
    if (isTitleCell) {
      if (p !== placeholderText) onChange(setApprovalProp(sheet, { r1: focus.r, r2: focus.r, c1: focus.c, c2: focus.c }, APPROVAL_NS.titleHint, p));
      return;
    }
    if (!props.input) return;
    if (p === (props.input.placeholder ?? '')) return;
    patchInputs((input) => {
      const { placeholder: _old, ...rest } = input;
      return p ? { ...rest, placeholder: p } : rest;
    });
  };

  // 칸 종류 — 입력 칸·자동 채우기·자동번호를 하나로(부품을 누르는 것과 같다)
  const kindValue = props.input
    ? `input.${props.input.type}`
    : props.autoNo
      ? 'autoNo'
      : props.bind
        ? KIND_PARTS.has(`bind.${props.bind}`)
          ? `bind.${props.bind}`
          : UNKNOWN_KIND
        : '';
  const setKind = (id: string) => {
    if (id === kindValue || id === UNKNOWN_KIND) return;
    // 자동번호는 다른 종류와 함께 두지 않는다(입력·자동 채우기는 부품이 서로 지운다)
    const base = id === 'autoNo' ? sheet : setApprovalProp(sheet, range, APPROVAL_NS.autoNo, undefined);
    if (!id) return onChange(setApprovalProp(setApprovalProp(base, range, APPROVAL_NS.input, undefined), range, APPROVAL_NS.bind, undefined));
    // 자동번호는 한 칸에만 — 이 고르기가 보이는 초점 칸에(범위 왼쪽 위가 아니라)
    const res = applyPart(base, id === 'autoNo' ? focusRange : range, id);
    if ('notice' in res) return alert(res.notice);
    onChange(res);
  };
  const kindNote = kindLocked
    ? `🔒 ${lockTitle(lockedName!, link)} — 칸 종류는 바꿀 수 없어요(모양·글자는 바꿔도 돼요).`
    : kindValue === UNKNOWN_KIND
      ? '지금은 없는 자동 채우기 항목입니다 — 다른 종류를 고르거나 글자 칸으로 빼세요.'
      : props.input?.depends
        ? '고를 항목이 다른 칸 값에 따라 바뀌는 선택 칸입니다 — 항목은 아래에서 기준 칸 값마다 적습니다.'
        : (KIND_PARTS.get(kindValue)?.hint ??
        (isFormula
          ? '수식 칸 — 계산한 값이 보입니다. 수식 칸은 기안자가 쓰는 칸으로 바꿀 수 없습니다.'
          : '쓴 글자가 그대로 보입니다. 기안자가 쓰게 하려면 위에서 종류를 고르거나 왼쪽 부품을 누르세요.'));

  // 더 보기 — 접혀 있어도 켜진 것은 한 줄로 보인다
  const [moreOpen, setMoreOpen] = useState(false);
  const nameSummary = !props.name
    ? ''
    : devLinks
      ? `칸 이름: ${nameLabel(props.name)}`
      : props.name === AMOUNT_NAME
        ? '문서 금액'
        : lockedName
          ? `🔒 ${lockInfo(lockedName, link).label}`
          : '';
  const moreSet = [nameSummary, props.secret ? '비공개' : '', props.guide ? '작성 요령' : ''].filter(Boolean);
  const moreSummary = moreSet.length ? moreSet.join(' · ') : devLinks ? '칸 이름 · 비공개 · 작성 요령' : '문서 금액 · 비공개 · 작성 요령';
  const { data: marks } = useCompanyMarks();
  const seals = marksOf(marks, 'seal');
  const logos = marksOf(marks, 'logo');
  const focusRange = { r1: focus.r, r2: focus.r, c1: focus.c, c2: focus.c };

  // 대외 문서에서 숨김 — 행 단위(칸만 비우면 빈 줄이 남아 어색함). 고른 행이 모두 켜져 있으면 켜짐으로 보인다
  const rowFrom = Math.min(range.r1, range.r2);
  const rowTo = Math.max(range.r1, range.r2);
  const rowLabel = rowFrom === rowTo ? `${rowFrom + 1}행` : `${rowFrom + 1}~${rowTo + 1}행`;
  let rowsExternalHidden = true;
  for (let r = rowFrom; r <= rowTo; r++) if (!isExternalHiddenRow(sheet, r)) rowsExternalHidden = false;

  // 칸 이름 직접 쓰기 — 시스템 이름(금액 키)과 겹치거나 '__'로 시작하는 이름은 받지 않는다(저장 키와 섞이지 않게)
  const [customNameMode, setCustomNameMode] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  useEffect(() => {
    setCustomNameMode(false);
    setNameDraft('');
  }, [focus.r, focus.c]);
  const commitCustomName = () => {
    const name = nameDraft.trim();
    setCustomNameMode(false);
    setNameDraft('');
    // 시스템·연동 이름(키나 한글 이름)과 겹치는 이름은 받지 않는다 — 목록에서 고르게
    const reserved = [...COMMON_CELL_NAMES, ...LINK_TYPES.flatMap((t) => t.names)];
    if (!name || name.startsWith('__') || reserved.some((n) => n.key === name || n.label === name)) return;
    onChange(setCellName(sheet, focus.r, focus.c, name));
  };

  // ── 값에 따라 바뀌는 것(기준 칸 중심 설정) ──
  // 고르기는 '선택을 모아 두었다가 [넣기]' — 누르는 순간 넣으면 끌어서 여러 행 고르기·화살표 이동과 구분이 안 된다.
  // 기준 칸 설정은 걸린 것이 있는 칸을 골랐을 때, 행·칸을 고르는 동안(pick), 그리고 다른 칸을 누르기 전까지(hold — 넣은 직후·'설정 열기'로 연 때) 보인다.
  // 아직 걸린 것이 없는 선택·체크 칸은 한 줄 단추로 접어 둔다 — 값이 많은 칸(종속 칸 등)에서 칸 속성이 아래로 밀리지 않게
  const [pick, setPick] = useState<{ what: ValuePick; src: { r: number; c: number }; from: string } | null>(null);
  const [hold, setHold] = useState<{ src: { r: number; c: number }; at: string } | null>(null);
  const selKey = `${range.r1}:${range.c1}:${range.r2}:${range.c2}:${focus.r}:${focus.c}`;
  const isSource = (p: { r: number; c: number } | null | undefined) => (p && valueSourceAt(sheet, p.r, p.c) ? p : null);
  const focusSource = multi ? null : isSource(focus);
  const focusSrc = focusSource ? valueSourceAt(sheet, focusSource.r, focusSource.c) : null;
  const ruleSource = isSource(pick?.src) ?? (hold?.at === selKey ? isSource(hold.src) : null) ?? (focusSrc && hasValueRules(sheet, focusSrc) ? focusSource : null);
  /** 다른 칸에서 그 기준 칸 설정을 연다 — 다른 칸을 누르면 닫힌다 */
  const openSource = (src: { r: number; c: number }) => setHold({ src: { r: src.r, c: src.c }, at: selKey });
  // 선택이 바뀌면 열어 둔 설정을 잊는다 — 그 칸으로 돌아왔을 때 누르지 않았는데 다시 열리지 않게
  useEffect(() => setHold((h) => (h && h.at !== selKey ? null : h)), [selKey]);
  // 고르던 기준 칸이 더는 기준 칸이 아니면(입력 종류를 바꿈 등) 고르기를 푼다
  useEffect(() => {
    if (pick && !isSource(pick.src)) setPick(null);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // 종속 칸을 누르면 그 기준 칸 설정으로 갈 수 있게
  const dependsOn = props.input?.depends?.name;
  const dependsSource = dependsOn ? valueSources(sheet).find((x) => x.name === dependsOn) : undefined;
  const startPick = (what: ValuePick | null) => setPick(what && ruleSource ? { what, src: ruleSource, from: selKey } : null);

  // 지금 선택을 고른 것으로 보면 — 넣을 수 있나(block), 넣기 전에 물을 것(ask), 무엇을(target)
  const pickPlan = (() => {
    if (!pick || pick.from === selKey) return null;
    const src = valueSourceAt(sheet, pick.src.r, pick.src.c);
    if (!src) return null;
    if (pick.what.kind === 'rows') {
      const r1 = Math.min(range.r1, range.r2);
      const r2 = Math.max(range.r1, range.r2);
      const target = r1 === r2 ? `${r1 + 1}행` : `${r1 + 1}~${r2 + 1}행`;
      if (src.r >= r1 && src.r <= r2) return { target, block: '기준 칸이 있는 행은 고를 수 없습니다(자기를 숨기면 다시 못 보임).' };
      const others = rowsWithOtherCondition(sheet, r1, r2, src.name ?? '');
      return { target, ask: others.length ? `${others.map((r) => r + 1).join('·')}행에는 다른 칸 조건이 걸려 있습니다. 이 조건으로 바꿀까요?` : undefined };
    }
    return { target: `${cellCaption(sheet, focus.r, focus.c)}(${cellAddress(focus.r, focus.c)})`, ...dependentCheck(sheet, focus.r, focus.c, src) };
  })();
  const applyPick = () => {
    if (!pick || !pickPlan || pickPlan.block) return;
    if (pickPlan.ask && !confirm(pickPlan.ask)) return;
    const { sheet: named, name } = ensureSourceName(sheet, pick.src.r, pick.src.c);
    if (pick.what.kind === 'rows') onChange(showRowsFor(named, Math.min(range.r1, range.r2), Math.max(range.r1, range.r2), name, pick.what.value));
    else onChange(makeDependent(named, focus.r, focus.c, name));
    setHold({ src: pick.src, at: selKey });
    setPick(null);
  };

  return (
    <div className="space-y-3.5 text-[12px]">
      {ruleSource && (
        <ValueRulesPanel
          sheet={sheet}
          source={ruleSource}
          pick={pick?.what ?? null}
          pickPlan={pickPlan}
          onApplyPick={applyPick}
          // 패널에서 고치는 동안은 열어 둔다 — 마지막 조건을 빼도 바로 접히지 않게
          onChange={(next) => {
            setHold({ src: ruleSource, at: selKey });
            onChange(next);
          }}
          onPick={startPick}
        />
      )}
      {focusSource && !ruleSource && (
        <button
          type="button"
          onClick={() => openSource(focusSource)}
          title="이 칸에서 고른 값에 따라 보일 행이나, 다른 칸에서 고를 항목을 바꿉니다"
          className="w-full rounded-lg border border-dashed border-indigo-300 px-2 py-1.5 text-left text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          + 이 칸 값에 따라 행·항목 바꾸기
        </button>
      )}
      {dependsOn && !dependsSource && (
        // 기준 칸이 지워졌거나 입력 종류가 바뀐 종속 칸 — 풀 수만 있게
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-rose-300 px-2 py-1.5 text-[11px] text-rose-600">
          <span>항목의 기준 칸 '{nameLabel(dependsOn)}'이(가) 없거나 선택 칸이 아닙니다.</span>
          <button type="button" onClick={() => onChange(clearDependent(sheet, focus.r, focus.c))} className="shrink-0 rounded border border-rose-300 px-1.5 py-0.5 font-semibold hover:bg-rose-50">
            종속 풀기
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-extrabold text-ink">칸 속성</span>
          <span className="font-mono text-[11px] font-bold text-teal">{where}</span>
        </div>
        <select
          className={`${inp} font-semibold`}
          value={kindValue}
          onChange={(e) => setKind(e.target.value)}
          disabled={kindLocked}
          title={kindLocked ? '다른 기능에 쓰이는 칸이라 종류를 바꿀 수 없어요' : '이 칸이 무엇인지 — 왼쪽 부품을 누르는 것과 같습니다'}
        >
          <option value="">글자 칸 (그대로 보임)</option>
          {KIND_GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.parts.map((p) => (
                <option key={p.id} value={p.id} disabled={isFormula && (p.id.startsWith('input.') || p.id === 'autoNo')}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
          {kindValue === UNKNOWN_KIND && <option value={UNKNOWN_KIND}>{props.bind} (지금은 없는 항목)</option>}
        </select>
        <div className="text-[10.5px] leading-snug text-ink3">{kindNote}</div>
      </div>

      {canPlaceholder && (
        <Row label="입력 예시" hint="기안자가 이 칸에 무엇을 어떻게 쓰면 되는지 알려 주는 글입니다. 비어 있는 칸 안에 흐리게 보이고, 쓰기 시작하면 사라집니다. 작성 화면에만 — 값으로 저장되지 않고 결재·인쇄엔 안 나옵니다.">
          <input
            className={inp}
            value={placeholder}
            maxLength={PLACEHOLDER_MAX}
            onChange={(e) => setPlaceholder(e.target.value)}
            onBlur={commitPlaceholder}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            placeholder={isTitleCell ? '비워 두면 "문서 제목을 입력하세요 (필수)"' : '기안자에게 보일 예시나 쓰는 법'}
          />
        </Row>
      )}
      {hasOptions && !props.input?.depends && (
        <Row label="고를 항목" hint="한 줄에 하나씩 적습니다">
          <textarea className={`${inp} min-h-[84px] resize-y`} value={options} onChange={(e) => setOptions(e.target.value)} onBlur={commitOptions} />
        </Row>
      )}
      {/* 종속 칸 — 다른 화면으로 가지 않고 제자리에서 기준 칸 값마다 항목을 고친다(기준 칸 설정의 같은 입력과 같은 값) */}
      {props.input?.depends && dependsSource && !multi && (
        <Row
          label={`고를 항목 — '${dependsSource.label}' 값마다`}
          hint="기준 칸 값마다 고를 항목을 한 줄에 하나씩 적습니다. 비워 둔 값을 고르면 이 칸은 쓸 수 없는 칸(—)이 됩니다. 항목에 '직접입력'을 넣으면 그 값일 때 직접 쓸 수 있습니다."
        >
          <div className="space-y-1 rounded-lg bg-panel-alt px-2 py-1.5">
            {dependsSource.options.map((when) => (
              <label key={when} className="flex items-start gap-1.5 text-[11px]">
                <span className="w-[72px] shrink-0 truncate pt-1 font-semibold text-ink2" title={when}>
                  {when}
                </span>
                <BranchInput sheet={sheet} dep={{ r: focus.r, c: focus.c, input: props.input! }} when={when} onChange={onChange} />
              </label>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                title="값마다 다른 항목을 그만두고, 모든 항목을 한 목록으로 합칩니다"
                onClick={() => onChange(clearDependent(sheet, focus.r, focus.c))}
                className="text-[10.5px] font-semibold text-ink3 hover:text-rose-600"
              >
                종속 풀기
              </button>
            </div>
          </div>
        </Row>
      )}
      {props.input?.type === 'select' && !props.input.depends && (
        <Check
          checked={(props.input.options ?? []).some(isDirectInputOption)}
          onChange={(v) =>
            // 칸마다 제 항목은 그대로 두고 '직접입력'만 붙이거나 뗀다
            patchInputs(
              (input) => {
                const rest = (input.options ?? []).filter((o) => !isDirectInputOption(o));
                return { ...input, options: v ? [...rest, DIRECT_INPUT_OPTION] : rest };
              },
              { skipDependent: true }
            )
          }
          label="직접 입력 허용"
          hint="목록 끝에 '직접입력'이 붙습니다. 기안자가 그걸 고르면 글자 칸으로 바뀌어 목록에 없는 값을 직접 씁니다."
        />
      )}

      {props.autoNo && (
        <Row label="번호 모양" hint={`상신할 때 이 모양으로 번호를 매깁니다 — 예: ${autoNumberPreview(props.autoNo)}. 모양을 바꾸면 새 순번(1번)부터 시작합니다.`}>
          <AutoNumberSettings value={props.autoNo} onChange={(v) => onChange(setApprovalProp(sheet, focusRange, APPROVAL_NS.autoNo, v))} />
        </Row>
      )}

      {props.bind === 'doc.logo' && (
        <Row label="쓸 로고" hint="기준 정보 → 회사 정보에 등록한 로고 중에서 고릅니다. 고르지 않으면 대표 로고.">
          <select
            className={inp}
            value={props.logoMark && logos.some((m) => m.id === props.logoMark) ? props.logoMark : ''}
            onChange={(e) => onChange(setApprovalProp(sheet, focusRange, APPROVAL_NS.logoMark, e.target.value || undefined))}
          >
            <option value="">대표 로고</option>
            {logos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Row>
      )}

      <div className="space-y-0.5">
        {props.input && (
          <Check
            checked={props.required}
            onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.required, v))}
            label="필수 입력"
            hint="비어 있으면 상신할 수 없습니다(임시 저장은 됨)."
          />
        )}
        {/* 잠금은 글자·수식 칸에도 쓴다 — [표 모양 고치기]에서 그 칸을 못 고치고 그 행·열을 못 지움 */}
        {systemLocked ? (
          // 연동 기능이 늘 잠그는 칸(휴일근무 출근·퇴근 시각·근무 시간) — 체크와 상관없이 기안 화면이 막으므로 켜진 채 고정
          <Check
            checked
            disabled
            onChange={() => {}}
            label="기안자 수정 잠금 (자동)"
            hint={`${systemLocked.label} 칸은 ${linkDef?.label ?? '연동'} 연동이 늘 잠급니다 — ${systemLocked.hint ?? '시스템이 채우는 칸'}. 이 칸의 잠금은 풀 수 없습니다.`}
          />
        ) : (
          <Check
            checked={props.lock}
            onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.lock, v))}
            label="기안자 수정 잠금"
            hint="기안자가 이 칸을 고칠 수 없습니다 — 입력 칸이면 값을, 글자·수식 칸이면 [표 모양 고치기]에서 그 칸과 그 행·열을 못 바꿉니다."
          />
        )}
        <Check
          checked={props.seal}
          onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.seal, v))}
          label="회사 직인 자리"
          hint="결재가 끝나면 이 칸에 회사 직인을 찍습니다."
        />
        {props.seal && seals.length > 1 && (
          <div className="pb-1 pl-6">
            <select
              className={inp}
              value={props.sealMark ?? ''}
              onChange={(e) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.sealMark, e.target.value || undefined))}
              title="찍을 직인 — 회사 정보 화면의 로고·직인 목록"
            >
              <option value="">대표 직인</option>
              {seals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Fold title="더 보기" summary={moreSummary} open={moreOpen} onToggle={() => setMoreOpen((v) => !v)}>
        {!devLinks && lockedName && (
          // 다른 기능이 이 칸 값을 찾는 이름 — 보기만(바꾸려면 개발 담당자)
          <div
            className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
            title="이 칸은 다른 기능과 이어져 있어 지우거나 종류를 바꿀 수 없어요. 모양·글자는 바꿔도 돼요."
          >
            🔒 {lockTitle(lockedName, link)}
          </div>
        )}
        {!devLinks && (
          <Check
            checked={props.name === AMOUNT_NAME}
            disabled={!!amountBlock}
            onChange={(v) => onChange(setCellName(sheet, focus.r, focus.c, v ? AMOUNT_NAME : undefined))}
            label="이 칸이 문서 금액이에요 (결재선 금액 조건에 쓰여요)"
            hint={
              amountBlock ??
              `결재선 규칙의 금액 조건이 이 칸 값을 문서 금액으로 읽어요. 숫자·금액 칸이나 수식 칸이어야 해요. 서식에 한 칸만 — ${amountAt ? `지금은 ${amountAt} 칸이고, 체크하면 이 칸으로 옮겨요.` : '다른 칸을 체크하면 그 칸으로 옮겨요.'}`
            }
          />
        )}
        {devLinks && (
        <Row
          label="칸 이름"
          hint={
            multi
              ? '칸 이름은 한 칸에만 붙습니다(지금 초점 칸).'
              : "다른 기능·다른 문서가 이 칸 값을 찾는 이름(서식에 하나씩). 금액 키는 결재선 금액, 직접 쓴 이름(예: 품명·공급가액)은 '관련 문서 값 가져오기'에서 같은 이름 칸끼리 복사됩니다. 반복 구간 안이면 그 열의 이름."
          }
        >
          <select
            className={inp}
            value={customNameMode ? CUSTOM : (props.name ?? '')}
            onChange={(e) => {
              if (e.target.value === CUSTOM) return setCustomNameMode(true);
              setCustomNameMode(false);
              let next = setCellName(sheet, focus.r, focus.c, e.target.value || undefined);
              // '휴가 종류'는 휴가 정책이 아는 이름만 — 선택 칸과 항목을 채워 둔다(관리자가 고칠 수 있음)
              if (e.target.value === 'leaveType' && props.input?.type !== 'select') {
                next = setApprovalProp(next, { r1: focus.r, c1: focus.c, r2: focus.r, c2: focus.c }, APPROVAL_NS.input, { type: 'select', options: LEAVE_TYPE_NAMES });
              }
              onChange(next);
            }}
          >
            <option value="">이름 없음</option>
            {COMMON_CELL_NAMES.map((n) => (
              <option key={n.key} value={n.key} title={n.hint}>
                {n.label}
              </option>
            ))}
            {linkDef && (
              <optgroup label={`연동 기능 — ${linkDef.code}`}>
                {linkDef.names.map((n) => (
                  <option key={n.key} value={n.key} title={n.hint}>
                    {n.label}
                    {n.required ? ' *' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {props.name && !systemKeys.has(props.name) && (
              <option value={props.name}>
                {nameLabel(props.name)}
                {LINK_TYPES.some((t) => t.names.some((n) => n.key === props.name)) ? ' (지금 연동 기능에선 안 쓰는 이름 — 지워 주세요)' : ''}
              </option>
            )}
            <option value={CUSTOM}>직접 쓰기…</option>
          </select>
          {customNameMode && (
            <input
              className={inp}
              autoFocus
              maxLength={30}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitCustomName()}
              onBlur={commitCustomName}
              placeholder="이름(예: 품명) 쓰고 Enter"
            />
          )}
        </Row>
        )}
        <Check
          checked={props.secret}
          onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.secret, v))}
          label="비공개"
          hint="결재선에 없는 사람에게는 '비공개'로 보입니다."
        />
        <Check
          checked={props.guide}
          // 작성 요령 칸은 기안자가 쓰는 칸이 아니다 — 켜면 입력 칸에서 뺀다
          onChange={(v) => onChange(setApprovalProp(v ? setApprovalProp(sheet, range, APPROVAL_NS.input, undefined) : sheet, range, APPROVAL_NS.guide, v))}
          // 켜면 입력 칸에서 빠진다 — 다른 기능에 쓰이는 입력 칸은 못 켠다
          disabled={kindLocked && !!props.input && !props.guide}
          label="작성 요령"
          hint="칸에 쓴 글을 작성 화면에만 흐리게 보입니다(결재·인쇄 화면엔 안 나옴) — 기안자에게 쓰는 법을 알려 줄 때. 입력 칸이었다면 글자 칸으로 바뀝니다."
        />
      </Fold>

      <div className="space-y-2 rounded-lg border border-border bg-panel-alt/40 px-2 py-2">
        <div className="text-[11.5px] font-extrabold text-ink">이 줄 ({rowLabel})</div>
        <RowConditionPanel sheet={sheet} selection={selection} onChange={onChange} onOpenSource={openSource} />
        <Check
          checked={rowsExternalHidden}
          onChange={(v) => onChange(setExternalHiddenRows(sheet, range.r1, range.r2, v))}
          label="거래처용에서 숨김"
          hint="문서를 거래처용으로 볼 때(문서 화면의 [거래처용]·발주서 PDF) 이 줄을 통째로 뺍니다."
        />
        <RepeatPanel sheet={sheet} selection={selection} onChange={onChange} />
      </div>
    </div>
  );
}

/**
 * 행 보이기 조건 — 이 줄에 걸린 조건을 보여 주고 푼다.
 * 거는 곳은 한 군데: 기준 칸(선택·체크 칸)의 '값에 따라 바뀌는 것'에서 값마다 [+ 행 고르기]
 */
function RowConditionPanel({
  sheet,
  selection,
  onChange,
  onOpenSource,
}: {
  sheet: Sheet;
  selection: SheetSelection;
  onChange: (next: Sheet) => void;
  /** 조건의 기준 칸 설정('값에 따라 바뀌는 것') 열기 */
  onOpenSource: (src: { r: number; c: number }) => void;
}) {
  const { range, focus } = selection;
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const current = rowConditionOf(sheet, focus.r);
  const src = current && valueSources(sheet).find((x) => x.name === current.name);
  const kind = current ? ruleSourceKind(sheet, current.name) : null;
  // 기준 칸의 고를 항목에 없는 값에만 걸렸나(직접 입력을 받는 칸은 목록 밖 값도 나온다)
  const openEnded = !!src && (approvalCellProps(sheet, src.r, src.c).input?.options ?? []).some(isDirectInputOption);
  const dead = !!current && !!src && !openEnded && !current.values.some((v) => src.options.includes(v));
  const rowsText = r1 === r2 ? '' : `${r1 + 1}~${r2 + 1}행 `;
  return (
    <div className="space-y-1">
      <Help text="다른 칸 값에 따라 이 줄을 보이거나 숨깁니다(예: 지출 항목이 '식대'일 때만 식대 분류 줄). 정하려면 기준이 되는 선택·체크 칸을 누르고, 위에 뜨는 '값에 따라 바뀌는 것'에서 값마다 [+ 행 고르기]를 누르세요.">
        <span className="text-[11px] font-bold text-ink2">보이기 조건</span>
      </Help>
      {!current ? (
        <div className="text-[10.5px] text-ink3">항상 보임</div>
      ) : (
        <>
          <div className="text-[11px] font-semibold text-indigo-600">
            {src?.label ?? nameLabel(current.name)} = {current.values.map((v) => (v === CHECK_MARK ? '체크' : v)).join(' · ')}일 때만 보임
          </div>
          {kind === 'missing' && <div className="text-[10.5px] text-rose-600">기준 칸이 시트에 없어 지금은 항상 보입니다.</div>}
          {kind === 'plain' && <div className="text-[10.5px] text-rose-600">기준 칸이 선택·체크 칸이 아니어서 기안 화면에서 이 줄이 보이지 않을 수 있습니다. 기준 칸에 부품을 다시 넣거나 조건을 푸세요.</div>}
          {dead && <div className="text-[10.5px] text-rose-600">기준 칸의 고를 항목에 없는 값이라 기안 화면에서 이 줄이 보이지 않습니다. [설정 열기]에서 지금 값에 다시 넣어 주세요.</div>}
          <div className="flex gap-1.5">
            {src && (
              <button type="button" onClick={() => onOpenSource(src)} className="rounded-lg border border-indigo-300 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50">
                설정 열기
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(setRowCondition(sheet, r1, r2, undefined))}
              className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-ink2 hover:text-rose-600"
            >
              {rowsText}조건 풀기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 반복 구간 — 고른 행들을 기안자가 행 추가·삭제하는 구간으로 */
function RepeatPanel({ sheet, selection, onChange }: { sheet: Sheet; selection: SheetSelection; onChange: (next: Sheet) => void }) {
  const { range, focus } = selection;
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const current = repeatSectionAt(sheet, focus.r);
  const [label, setLabel] = useState('');
  useEffect(() => setLabel(current?.label ?? ''), [current?.id, current?.label]);

  // 반복 구간이 아닌 줄은 접어 둔다(드물게 씀) — 다른 줄로 옮기면 다시 접힘
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [focus.r]);
  const help = '품목 표처럼 문서마다 줄 수가 다른 줄을 고르고 지정하면, 기안자가 [행 추가]·[행 삭제]로 줄 수를 바꿉니다. 줄 전체가 늘어나므로 같은 줄에 나란히 있는 표도 함께 늘어납니다.';
  if (!current)
    return (
      <Fold title="반복 구간으로 지정" open={open} onToggle={() => setOpen((v) => !v)} flat>
        <div className="text-[10.5px] leading-snug text-ink3">{help}</div>
        <div className="flex gap-1.5">
          <input className={inp} value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder="구간 이름(예: 품목)" />
          <button
            type="button"
            onClick={() => onChange(setRepeatSection(sheet, r1, r2, label || '반복 구간'))}
            className="shrink-0 rounded-lg bg-violet-500 px-2.5 text-[11px] font-bold text-white hover:opacity-90"
          >
            {r1 === r2 ? `${r1 + 1}행` : `${r1 + 1}~${r2 + 1}행`} 지정
          </button>
        </div>
      </Fold>
    );
  return (
    <div className="space-y-1">
      <Help text={help}>
        <span className="text-[11px] font-bold text-ink2">반복 구간</span>
      </Help>
      <div className="text-[11px] text-ink3">
        <span className="font-semibold text-violet-600">{current.label}</span> · {current.first + 1}~{current.last + 1}행
      </div>
      <div className="flex gap-1.5">
        <input
          className={inp}
          value={label}
          maxLength={30}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label.trim() !== current.label && onChange(renameRepeatSection(sheet, current.id, label.trim()))}
          placeholder="구간 이름(예: 품목)"
        />
        <button
          type="button"
          onClick={() => onChange(clearRepeatSection(sheet, current.id))}
          className="shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-semibold text-ink2 hover:text-rose-600"
        >
          해제
        </button>
      </div>
    </div>
  );
}
