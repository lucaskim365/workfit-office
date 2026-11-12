import { useEffect, useState } from 'react';
import type { Sheet, SheetSelection } from '@/lib/sheet';
import {
  APPROVAL_NS,
  BIND_GROUPS,
  CELL_INPUT_LABELS,
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
  type CellInputType,
  LEAVE_TYPE_NAMES,
  LINK_TYPES,
  linkTypeDef,
  nameLabel,
} from '@/domain/approvalForm/sheet/approvalSheet';
import {
  clearDependent,
  dependentCheck,
  ensureSourceName,
  makeDependent,
  rowsWithOtherCondition,
  showRowsFor,
  valueSourceAt,
  valueSources,
  withBranchOptions,
} from '@/domain/approvalForm/sheet/valueRules';
import { ValueRulesPanel, type ValuePick } from './ValueRulesPanel';import { clearRepeatSection, renameRepeatSection, repeatSectionAt, setRepeatSection } from '@/domain/approvalForm/sheet/repeatRows';
import { isExternalHiddenRow, setExternalHiddenRows } from '@/domain/approvalForm/sheet/sheetHeader';
import { AutoNumberSettings } from '../components/ApprovalFormEditor';
import { useCompanyMarks } from '@/features/companyMark/useCompanyMarks';
import { marksOf } from '@/domain/companyMark/schema';
import { autoNumberPreview } from '@/domain/approvalForm/autoNumber';

/**
 * 시트 서식 편집기 — 고른 칸의 결재 속성(입력 칸·칸 이름·불러오기·잠금·비공개·직인).
 * 보이는 값은 초점 칸 기준이고, 바꾸면 고른 범위 전체에 넣는다(칸 이름만 초점 칸 하나에).
 */
/** 칸 이름 고르기에서 '직접 쓰기' 항목 값 */
const CUSTOM = '__custom__';
const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2 py-1.5 text-[12px] text-ink outline-none focus:border-teal disabled:opacity-50';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-bold text-ink2">{label}</div>
      {children}
      {hint && <div className="text-[10.5px] leading-snug text-ink3">{hint}</div>}
    </div>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-panel-alt">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-teal" />
      <span>
        <span className="block text-[11.5px] font-semibold text-ink">{label}</span>
        <span className="block text-[10.5px] leading-snug text-ink3">{hint}</span>
      </span>
    </label>
  );
}

export function SheetCellPanel({
  sheet,
  selection,
  onChange,
  link = null,
  onPreview,
}: {
  sheet: Sheet;
  selection: SheetSelection;
  onChange: (next: Sheet) => void;
  /** '값에 따라 바뀌는 것' 미리보기 — 기준 칸 값이 이것일 때 숨는 행을 편집 화면에서 흐리게 */
  onPreview?: (preview: { name: string; value: string } | null) => void;
  /** 연동 기능(연동 유형) — 있으면 그 연동 칸 이름(휴가 기간 등)을 칸 이름 목록에 */
  link?: string | null;
}) {
  const linkDef = linkTypeDef(link);
  const systemKeys = new Set([...COMMON_CELL_NAMES.map((n) => n.key), ...(linkDef?.names.map((n) => n.key) ?? [])]);
  const { range, focus } = selection;
  const props = approvalCellProps(sheet, focus.r, focus.c);
  const multi = range.r1 !== range.r2 || range.c1 !== range.c2;
  const where = multi ? `${cellAddress(range.r1, range.c1)}:${cellAddress(range.r2, range.c2)}` : cellAddress(focus.r, focus.c);
  const isFormula = sheet.formulas[`${focus.r}:${sheet.cols[focus.c]}`] !== undefined;

  // 선택 항목은 줄마다 하나 — 입력 중엔 글자 그대로 두고, 칸을 벗어날 때 넣는다
  const optionsText = (props.input?.options ?? []).join('\n');
  const [options, setOptions] = useState(optionsText);
  useEffect(() => setOptions(optionsText), [optionsText, focus.r, focus.c]);

  const setInput = (input: CellInput | undefined) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.input, input));
  const commitOptions = () => {
    if (!props.input) return;
    const list = options.split('\n').map((o) => o.trim()).filter(Boolean);
    setInput({ ...props.input, options: list });
  };

  const hasOptions = props.input?.type === 'select' || props.input?.type === 'multiSelect';
  const { data: marks } = useCompanyMarks();
  const seals = marksOf(marks, 'seal');
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
  // 고정하면 다른 칸을 눌러도 그 기준 칸 설정이 남는다(행·칸을 시트에서 눌러 고르는 동안에도)
  // 고르기는 '선택을 모아 두었다가 [적용]' — 누르는 순간 넣으면 끌어서 여러 행 고르기·화살표 이동과 구분이 안 된다.
  // 고르는 동안·적용 직후(다른 칸을 누르기 전)에는 기준 칸 설정을 계속 보인다 — 사용자가 켜지 않은 고정은 남기지 않는다
  const [pinned, setPinned] = useState<{ r: number; c: number } | null>(null);
  const [pick, setPick] = useState<{ what: ValuePick; src: { r: number; c: number }; from: string } | null>(null);
  const [hold, setHold] = useState<{ src: { r: number; c: number }; at: string } | null>(null);
  const selKey = `${range.r1}:${range.c1}:${range.r2}:${range.c2}:${focus.r}:${focus.c}`;
  const isSource = (p: { r: number; c: number } | null | undefined) => (p && valueSourceAt(sheet, p.r, p.c) ? p : null);
  const focusSource = multi ? null : isSource(focus);
  const ruleSource = isSource(pinned) ?? isSource(pick?.src) ?? (hold?.at === selKey ? isSource(hold.src) : null) ?? focusSource;
  // 고정한 칸이 더는 기준 칸이 아니면(입력 종류를 바꿈 등) 고정·고르기를 푼다
  useEffect(() => {
    if (pinned && !isSource(pinned)) setPinned(null);
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
          pinned={!!pinned}
          pick={pick?.what ?? null}
          pickPlan={pickPlan}
          onApplyPick={applyPick}
          onChange={onChange}
          onPick={startPick}
          onPin={(on) => setPinned(on ? ruleSource : null)}
          onPreview={onPreview}
        />
      )}
      {!ruleSource && dependsSource && (
        <button
          type="button"
          onClick={() => setPinned({ r: dependsSource.r, c: dependsSource.c })}
          className="w-full rounded-lg border border-dashed border-indigo-300 px-2 py-1.5 text-left text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          이 칸의 항목은 '{dependsSource.label}' 값에 따라 바뀝니다 — 그 설정 열기
        </button>
      )}
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-extrabold text-ink">칸 속성</span>
        <span className="font-mono text-[11px] font-bold text-teal">{where}</span>
      </div>

      <Row
        label="입력 칸"
        hint={isFormula ? '수식 칸은 입력 칸으로 정할 수 없습니다(기안자가 쓰면 수식이 지워짐).' : '기안자가 값을 쓰는 칸. 숫자만 받기·드롭다운 같은 입력 규칙은 기안 화면에서 적용됩니다(여기 관리 편집에서는 모든 칸을 고칠 수 있음).'}
      >
        <select
          className={inp}
          value={props.input?.type ?? ''}
          disabled={isFormula && !props.input}
          onChange={(e) => {
            const type = e.target.value as CellInputType | '';
            if (!type) return setInput(undefined);
            const keep = type === 'select' || type === 'multiSelect' ? { options: props.input?.options ?? [] } : {};
            setInput({ type, ...keep });
          }}
        >
          <option value="">입력 안 함</option>
          {(Object.keys(CELL_INPUT_LABELS) as CellInputType[]).map((t) => (
            <option key={t} value={t}>
              {CELL_INPUT_LABELS[t]}
            </option>
          ))}
        </select>
      </Row>

      {hasOptions && !props.input?.depends && (
        <Row label="고를 항목" hint="한 줄에 하나씩">
          <textarea className={`${inp} min-h-[84px] resize-y`} value={options} onChange={(e) => setOptions(e.target.value)} onBlur={commitOptions} />
        </Row>
      )}
      {props.input?.type === 'select' && !props.input.depends && (
        <Check
          checked={(props.input.options ?? []).some(isDirectInputOption)}
          onChange={(v) => {
            const rest = (props.input?.options ?? []).filter((o) => !isDirectInputOption(o));
            setInput({ ...props.input!, options: v ? [...rest, DIRECT_INPUT_OPTION] : rest });
          }}
          label="직접 입력 허용"
          hint="목록 끝에 '직접입력'이 붙습니다. 기안자가 그걸 고르면 글자 칸으로 바뀌어 목록에 없는 값을 직접 씁니다."
        />
      )}
      {props.input?.type === 'select' && !multi && (
        <DependsEditor sheet={sheet} r={focus.r} c={focus.c} input={props.input} onChange={onChange} />
      )}

      {props.autoNo && (
        <Row label="자동번호" hint={`상신할 때 이 모양으로 번호를 매깁니다 — 예: ${autoNumberPreview(props.autoNo)}. 모양을 바꾸면 새 순번(1번)부터 시작합니다.`}>
          <AutoNumberSettings value={props.autoNo} onChange={(v) => onChange(setApprovalProp(sheet, focusRange, APPROVAL_NS.autoNo, v))} />
        </Row>
      )}

      <Row
        label="자동 채우기"
        hint="기안 정보: 작성할 때 기안자·부서·오늘 날짜로 채우고, 상신한 문서는 그 문서의 기안자·부서·기안일·문서번호를 보여 줍니다(기안자가 고칠 수 없음). 엑셀 양식에 이런 칸이 있으면 위 '문서 머리에 보일 항목'에서 같은 항목을 꺼 겹치지 않게 하세요. 프로젝트 값은 준비 중."
      >
        <select
          className={inp}
          value={props.bind ?? ''}
          onChange={(e) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.bind, e.target.value || undefined))}
        >
          <option value="">채우지 않음</option>
          {BIND_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="프로젝트 (준비 중 — 프로젝트 관리 항목을 정한 뒤)">
            <option disabled value="project">프로젝트 값</option>
          </optgroup>
          {props.bind && !BIND_GROUPS.some((g) => g.items.some((i) => i.value === props.bind)) && <option value={props.bind}>{props.bind} (지금은 없는 항목)</option>}
        </select>
      </Row>

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

      <div className="space-y-0.5 border-t border-border pt-2.5">
        <Check
          checked={props.lock}
          onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.lock, v))}
          label="기안자 수정 잠금"
          hint="입력 칸이라도 기안자가 고칠 수 없습니다(불러온 값 보호 등)."
        />
        <Check
          checked={props.secret}
          onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.secret, v))}
          label="비공개"
          hint="결재선에 없는 사람에게는 '비공개'로 보입니다."
        />
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
        {props.input && (
          <Check
            checked={props.required}
            onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.required, v))}
            label="필수 입력"
            hint="비어 있으면 상신할 수 없습니다(임시 저장은 됨)."
          />
        )}
        <Check
          checked={props.guide}
          onChange={(v) => onChange(setApprovalProp(sheet, range, APPROVAL_NS.guide, v))}
          label="안내문"
          hint="칸에 쓴 글을 작성 화면에만 흐리게 보입니다(결재·인쇄 화면엔 안 나옴)."
        />
        <Check
          checked={rowsExternalHidden}
          onChange={(v) => onChange(setExternalHiddenRows(sheet, range.r1, range.r2, v))}
          label={`대외 문서에서 숨김 (${rowLabel})`}
          hint="문서를 거래처용으로 볼 때(문서 화면의 [거래처용]·발주서 PDF) 이 행을 통째로 뺍니다."
        />
      </div>

      <RowConditionPanel sheet={sheet} selection={selection} onChange={onChange} />
      <RepeatPanel sheet={sheet} selection={selection} onChange={onChange} />
    </div>
  );
}

/** 기준 칸 고르기 목록의 값 — 이름이 있으면 이름, 없으면 칸 자리(@행:열) */
const sourceOptionKey = (x: { name?: string; r: number; c: number }) => x.name ?? `@${x.r}:${x.c}`;

/**
 * 종속 선택 — 이 선택 칸의 항목을 다른 선택 칸 값에 따라 바꾼다(엑셀 종속 드롭다운).
 * 예: 지출 항목이 식대면 [간식대·외근식대·야근식대], 운반비면 [우편/택배·퀵서비스], 그 밖엔 칸을 쓸 수 없음
 */
function DependsEditor({ sheet, r, c, input, onChange }: { sheet: Sheet; r: number; c: number; input: CellInput; onChange: (next: Sheet) => void }) {
  const at = { r1: r, r2: r, c1: c, c2: c };
  const onInput = (next: CellInput) => onChange(setApprovalProp(sheet, at, APPROVAL_NS.input, next));
  // 기준 칸 후보 — 이름 없는 칸도(고르면 이름을 지어 붙인다). 자기 자신·체크 칸은 빼고
  const sources = valueSources(sheet).filter((x) => !(x.r === r && x.c === c) && x.kind !== 'checkbox');
  const dep = input.depends;
  const src = dep ? sources.find((x) => x.name === dep.name) : undefined;
  // 갈래 항목 글자 — 칸을 벗어날 때 넣는다(입력 중 쉼표 그대로)
  const textOf = (when: string) => (dep?.branches.find((b) => b.when === when)?.options ?? []).join(', ');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => setDrafts({}), [r, c, dep?.name]);
  // 반영하면 입력 중 글자는 지운다(되돌리기와 어긋나지 않게). 글자가 그대로면 시트를 바꾸지 않는다(눌렀다 나가기만 해도 항목이 지워지지 않게)
  const commit = (when: string, text: string) => {
    setDrafts(({ [when]: _done, ...rest }) => rest);
    if (!dep || text === textOf(when)) return;
    onInput(withBranchOptions(input, when, text.split(/[,\n]/).map((o) => o.trim()).filter(Boolean)));
  };
  const choose = (key: string) => {
    // 종속 해제 — 모든 갈래 항목을 일반 목록으로
    if (!key) return onChange(clearDependent(sheet, r, c));
    const pick = sources.find((x) => sourceOptionKey(x) === key);
    if (!pick) return;
    // 기준 칸에 이름이 없으면 지어 붙이고 같은 판에서 종속을 건다
    const { sheet: named, name } = ensureSourceName(sheet, pick.r, pick.c);
    onChange(setApprovalProp(named, at, APPROVAL_NS.input, { ...input, depends: { name, branches: [] }, options: input.options ?? [] }));
  };
  if (!dep && sources.length === 0) return null;
  return (
    <Row
      label="항목을 다른 칸 값에 따라"
      hint="기준 칸 값마다 고를 항목을 쉼표로 적습니다. 비워 둔 값을 고르면 이 칸은 쓸 수 없는 칸(—)이 됩니다. 항목에 '직접입력'을 넣으면 그 값일 때 직접 쓸 수 있습니다."
    >
      <select className={inp} value={dep?.name ?? ''} onChange={(e) => choose(e.target.value)}>
        <option value="">항상 같은 항목 (위 '고를 항목')</option>
        {sources.map((x) => (
          <option key={sourceOptionKey(x)} value={sourceOptionKey(x)}>
            {x.label} 값에 따라
          </option>
        ))}
        {dep && !src && <option value={dep.name}>{nameLabel(dep.name)} (칸 없음)</option>}
      </select>
      {dep && src && (
        <div className="mt-1 space-y-1 rounded-lg bg-panel-alt px-2 py-1.5">
          {src.options.map((when) => {
            const key = dep.branches.find((b) => b.when === when)?.key;
            return (
              <label key={when} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-[72px] shrink-0 truncate font-semibold text-ink2" title={when}>
                  {when}
                </span>
                <input
                  className={inp}
                  value={drafts[when] ?? textOf(when)}
                  placeholder="(이 값이면 칸 안 씀)"
                  onChange={(e) => setDrafts((d) => ({ ...d, [when]: e.target.value }))}
                  onBlur={(e) => commit(when, e.target.value)}
                  title={key ? `이 값일 때 칸 값을 '${key}' 이름으로도 남깁니다(기존 서식 결재선 규칙 조건)` : undefined}
                />
              </label>
            );
          })}
        </div>
      )}
    </Row>
  );
}

/**
 * 행 보이기 조건 — 고른 행을 '지출 항목이 식대일 때만'처럼 다른 칸 값에 따라 보이게(기존 서식 visibleIf).
 * 조건 칸은 칸 이름이 붙은 선택·여러 선택·체크 칸
 */
function RowConditionPanel({ sheet, selection, onChange }: { sheet: Sheet; selection: SheetSelection; onChange: (next: Sheet) => void }) {
  const { range, focus } = selection;
  const r1 = Math.min(range.r1, range.r2);
  const r2 = Math.max(range.r1, range.r2);
  const rowLabel = r1 === r2 ? `${r1 + 1}행` : `${r1 + 1}~${r2 + 1}행`;
  const current = rowConditionOf(sheet, focus.r);
  // 고른 행 안의 칸은 조건 칸이 될 수 없다(자기를 숨기면 다시 못 보임). 이름 없는 칸도 — 고르면 이름을 지어 붙인다
  const sources = valueSources(sheet).filter((x) => x.r < r1 || x.r > r2);
  // 고른 기준 칸(sourceOptionKey) — 이름 없는 칸은 값을 처음 고를 때(조건을 실제로 걸 때) 이름을 지어 붙인다
  const [key, setKey] = useState('');
  // 다른 행으로 옮기면 그 행 조건으로, 조건이 바뀌면(되돌리기 등) 그 칸으로 — 칸만 고르고 값을 아직 안 고른 상태는 지우지 않는다
  useEffect(() => setKey(current?.name ?? ''), [focus.r]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (current?.name) setKey(current.name);
  }, [current?.name]);
  const src = sources.find((x) => sourceOptionKey(x) === key);
  const name = src ? src.name : key;
  const values = name && current?.name === name ? current.values : [];
  // 기존 서식 조건에 걸린 값이 지금 항목에 없으면(직접입력 등) 그 값도 보여 준다 — 풀 수 있게
  const shownOptions = src ? [...src.options, ...values.filter((v) => !src.options.includes(v))] : [];
  const toggle = (opt: string, on: boolean) => {
    if (!src) return;
    const next = on ? [...values, opt] : values.filter((v) => v !== opt);
    const named = ensureSourceName(sheet, src.r, src.c);
    if (named.name !== key) setKey(named.name);
    onChange(setRowCondition(named.sheet, r1, r2, next.length ? { name: named.name, values: next } : undefined));
  };

  return (
    <div className="space-y-1.5 border-t border-border pt-2.5">
      <div className="text-[11px] font-bold text-ink2">행 보이기 조건 ({rowLabel})</div>
      {sources.length === 0 && !current ? (
        <div className="text-[10.5px] leading-snug text-ink3">
          다른 칸 값에 따라 이 행을 보이거나 숨깁니다(예: 지출 항목이 '식대'일 때만 식대 분류 행). 조건으로 쓸 선택·체크 입력 칸을 먼저 만드세요.
        </div>
      ) : (
        <>
          <select
            className={inp}
            value={key}
            onChange={(e) => {
              // 조건 칸을 바꾸면 고른 값은 새로 — 비우면 조건 없음(항상 보임)
              setKey(e.target.value);
              if (current) onChange(setRowCondition(sheet, r1, r2, undefined));
            }}
          >
            <option value="">항상 보이기 (조건 없음)</option>
            {sources.map((x) => (
              <option key={sourceOptionKey(x)} value={sourceOptionKey(x)}>
                {x.label} 칸 값에 따라
              </option>
            ))}
            {current && !sources.some((x) => x.name === current.name) && <option value={current.name}>{nameLabel(current.name)} (칸 없음)</option>}
          </select>
          {key && src && (
            <div className="space-y-0.5 rounded-lg bg-panel-alt px-2 py-1.5">
              <div className="text-[10.5px] text-ink3">
                <b className="text-ink2">{src.label}</b>이(가) 다음 중 하나일 때만 보입니다
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {shownOptions.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-1 text-[11.5px] text-ink">
                    <input type="checkbox" checked={values.includes(opt)} onChange={(e) => toggle(opt, e.target.checked)} className="h-3.5 w-3.5 accent-teal" />
                    {opt === CHECK_MARK ? '체크했을 때' : opt}
                  </label>
                ))}
              </div>
              {values.length === 0 && <div className="text-[10.5px] text-amber-600">값을 하나 이상 고르면 조건이 걸립니다.</div>}
            </div>
          )}
          {key && !src && <div className="text-[10.5px] text-rose-600">조건 칸 '{nameLabel(key)}'이(가) 시트에 없어 이 행은 항상 보입니다.</div>}
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

  return (
    <div className="space-y-1.5 border-t border-border pt-2.5">
      <div className="text-[11px] font-bold text-ink2">반복 구간</div>
      {current ? (
        <>
          <div className="text-[11px] text-ink3">
            <span className="font-semibold text-violet-600">{current.label}</span> · {current.first + 1}~{current.last + 1}행 — 기안자가 구간 끝에 행을 추가·삭제합니다.
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
        </>
      ) : (
        <>
          <div className="text-[10.5px] leading-snug text-ink3">
            품목 표처럼 문서마다 줄 수가 다른 행을 고르고 지정하면, 기안자가 [행 추가]·[행 삭제]로 줄 수를 바꿉니다. 행 전체가 늘어나므로 같은 행에 나란히 있는 표도 함께 늘어납니다.
          </div>
          <div className="flex gap-1.5">
            <input className={inp} value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder="구간 이름(예: 품목)" />
            <button
              type="button"
              onClick={() => onChange(setRepeatSection(sheet, r1, r2, label || '반복 구간'))}
              className="shrink-0 rounded-lg bg-violet-500 px-2.5 text-[11px] font-bold text-white hover:opacity-90"
            >
              {r1 + 1 === r2 + 1 ? `${r1 + 1}행` : `${r1 + 1}~${r2 + 1}행`} 지정
            </button>
          </div>
        </>
      )}
    </div>
  );
}
