import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEFAULT_COL_WIDTH, SheetEditor, SheetView, cellKey, displayValue, parseNumber, recalculate, setCellValue, shrinkFontSize, type Sheet } from '@/lib/sheet';
import { Building2, Download, Minus, Plus, Table2, Trash2, X } from 'lucide-react';
import { SHEET_OWN_KEY, canDraftDelete, draftCanMerge, draftInsertCol, draftEditIssues, draftEditPaste, draftEditSetValue, isProtectedCell, keepRefsAfterEdit, readOwnSheet } from '@/domain/approvalForm/sheet/ownSheet';
import { DateInput } from '@/shared/ui/form/DateInput';
import { nowLocalIso } from '@/shared/lib/datetime';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { CalendarRangePicker } from '../formFields/CalendarRangePicker';
import { SelectorDialog } from '../components/DraftRecipientSection';
import { useFormVersionSheet } from '@/features/gw/useApprovalFormVersions';
import { versionKey } from '@/domain/approvalForm/sheetVersion';
import { docTitleLook } from '@/domain/approvalForm/docTitle';
import { autoNumberPreview } from '@/domain/approvalForm/autoNumber';
import {
  CHECK_MARK,
  APPROVAL_NS,
  DOC_SHEET_VIEW,
  approvalCellProps,
  mergeApprovalRange,
  mergeDropsContent,
  draftInfoValue,
  type DraftInfo,
  linkFieldValues,
  SHEET_REFS_KEY,
  SHEET_VALUES_KEY,
  applyValues,
  draftInputOf,
  invalidNumberCells,
  requiredMissing,
  completedDateRows,
  conditionHiddenRows,
  clearConditionHidden,
  clearStaleDependent,
  draftOptions,
  isDirectInputOption,
  isDocFieldBind,
  slotOf,
  type SheetSlots,
  PRESERVATION_OPTIONS,
  VISIBILITY_LABEL,
  type DocFieldBind,
  readSheetValues,
  sheetDocFields,
  type CellInput,
} from '@/domain/approvalForm/sheet/approvalSheet';
import { SHEET_NAMED_KEY, collectNamed, hasImportableNames, importNamed, sheetWith, type NamedValues } from '@/domain/approvalForm/sheet/relatedImport';
import { SHEET_ROWS_KEY, addRepeatRow, expandRepeats, healRepeatSections, insertRepeatRowAfter, readRowExtras, removeRepeatRow, removeRepeatRowAt, repeatSections } from '@/domain/approvalForm/sheet/repeatRows';

/**
 * 시트 서식 기안 작성 — 서식 버전의 틀 위에 기안자가 입력 칸만 채운다(§11.3).
 * 문서 모양 그대로 보여 주고, 입력 칸 자리에만 칸 종류에 맞는 입력 상자를 둔다.
 * 바뀔 때마다 문서 fieldValues 로 저장할 것(칸 값·서식 버전·이름 붙은 칸 값)을 올려 보낸다.
 */

/** 입력 칸 바탕 — 인쇄에서는 지운다 */
const FIELD = 'block w-full min-w-0 bg-[#fffbe8] outline-none focus:bg-[#fff4c2] print:bg-transparent';
const INHERIT: CSSProperties = { font: 'inherit', color: 'inherit', textAlign: 'inherit' };

/**
 * 글 입력 — 칸 폭을 넘으면 다음 줄로 넘기고 행이 늘어난다(칸에 글씨가 잘리지 않게).
 * singleLine: 한 줄 글 칸 — 보이는 줄바꿈은 되지만 Enter·붙여넣기 줄바꿈은 넣지 않는다
 */
function AutoTextarea({ value, onChange, singleLine = false }: { value: string; onChange: (v: string) => void; singleLine?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(singleLine ? e.target.value.replace(/\r?\n/g, ' ') : e.target.value)}
      onKeyDown={singleLine ? (e) => e.key === 'Enter' && e.preventDefault() : undefined}
      className={`${FIELD} resize-none overflow-hidden`}
      style={INHERIT}
    />
  );
}

/** 숫자 칸에 넣을 수 있는 글자 — 부호·숫자·콤마·소수점 하나. 그 밖의 글자는 아예 들어가지 않는다 */
const NUMBER_TYPING = /^-?[\d,]*\.?\d*$/;

function NumberInput({ raw, shown, invalid, onChange }: { raw: string; shown: string; invalid: boolean; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      inputMode="decimal"
      value={focused ? raw : shown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const text = e.target.value.trim();
        if (NUMBER_TYPING.test(text)) onChange(text.replace(/,/g, ''));
      }}
      // 비어 있으면 흐린 0 — 숫자 칸임을 알 수 있게(인쇄엔 안 나옴)
      placeholder="0"
      title={invalid ? '숫자만 입력할 수 있습니다' : undefined}
      className={`${FIELD} placeholder:text-[#c8c8c8] print:placeholder:text-transparent ${invalid ? 'bg-rose-100 ring-1 ring-rose-400' : ''}`}
      style={{ ...INHERIT, textAlign: 'right' }}
    />
  );
}

/** 사람 칸 — 기존 서식 '사용자'와 같은 [임직원 검색] → 조직도 고르기. 칸에는 '이름 (부서)'로 남긴다 */
function UserField({ value, onSet, org }: { value: string; onSet: (text: string, ref?: string) => void; org: ReturnType<typeof useOrgTree> }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`${FIELD} flex items-center gap-1`}>
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-1 rounded px-1 text-left hover:bg-[#f0f4f4] print:px-0" style={INHERIT}>
        {value ? <span className="truncate">{value}</span> : <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-teal print:hidden"><Building2 size={12} />임직원 검색</span>}
      </button>
      {value && (
        <button type="button" onClick={() => onSet('')} className="text-[#999] hover:text-rose-500 print:hidden" title="지우기">
          <X size={12} />
        </button>
      )}
      {open && (
        <SelectorDialog
          title="임직원 선택"
          org={org}
          singleSelect
          deptOnly={false}
          onConfirm={(items) => {
            const picked = items.find((i) => i.type === 'user');
            const u = picked ? org.userById(picked.id) : null;
            // 칸에는 기안 당시 '이름 (부서)', 사용자 ID 는 따로(__refs)
            if (u) onSet(u.dept ? `${u.name} (${u.dept})` : u.name, u.id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/** 문서 항목 칸에 쓰는 문서 값 — 문서의 제목·보존연한·공개범위(칸이 아니라 문서에 저장) */
export interface DocFields {
  title: string;
  preservationPeriod: string;
  visibility: string;
}

/** 문서 항목 칸 — 문서 머리의 제목 줄·보존연한·공개범위와 같은 입력 */
function DocFieldCell({ bind, doc, onChange }: { bind: DocFieldBind; doc: DocFields; onChange: (patch: Partial<DocFields>) => void }) {
  if (bind === 'doc.title') {
    return (
      <input
        value={doc.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="문서 제목을 입력하세요 (필수)"
        className={`${FIELD} placeholder:font-normal placeholder:text-[#aaa]`}
        style={INHERIT}
      />
    );
  }
  if (bind === 'doc.preservation') {
    return (
      <select value={doc.preservationPeriod} onChange={(e) => onChange({ preservationPeriod: e.target.value })} className={`${FIELD} print:appearance-none`} style={INHERIT}>
        {PRESERVATION_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <select value={doc.visibility} onChange={(e) => onChange({ visibility: e.target.value })} className={`${FIELD} print:appearance-none`} style={INHERIT}>
      {Object.entries(VISIBILITY_LABEL).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** 문서 머리 부품을 칸 가운데에(칸 정렬을 따름) — 칸보다 크면 칸이 늘어난다 */
export function SlotCell({ node, slot }: { node: import('react').ReactNode; slot?: string }) {
  if (!node) return '';
  // 줄 안 상자(inline) — 칸의 가로 정렬(text-align)을 그대로 따른다
  return <span data-slot={slot} className="inline-flex py-0.5 align-middle">{node}</span>;
}

/**
 * 큰 제목(문서 이름) 칸 — 기존 문서 머리와 같은 모양(굵기·자간)으로, 같은 줄의 결재란을 뺀 나머지 폭 가운데에 놓는다.
 * 시트는 제목 줄을 반으로 갈라 왼쪽 반에 제목을 두므로, 결재란이 좁으면 제목이 왼쪽으로 치우쳐 보인다 — 그만큼 오른쪽으로 옮긴다
 */
export function SheetFormTitle({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const td = ref.current?.closest('td');
    const tr = td?.closest('tr');
    if (!td || !tr) return;
    // 옮긴 글자가 칸 밖(결재란 쪽 빈자리)으로 나가도 잘리지 않게
    td.style.overflow = 'visible';
    const measure = () => {
      const stamp = tr.querySelector<HTMLElement>('[data-slot="approvalLine"]');
      const t = td.getBoundingClientRect();
      const s = stamp?.getBoundingClientRect();
      if (!s || !t.width || s.left <= t.right) return setShift(0);
      // 화면 배율(zoom) — 화면 px 를 CSS px 로
      setShift(((s.left - t.right) / 2) * (td.offsetWidth / t.width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tr);
    const stamp = tr.querySelector('[data-slot="approvalLine"]');
    if (stamp) ro.observe(stamp);
    return () => ro.disconnect();
  }, [text]);
  // 글자 간격은 제목 길이에 맞춰(docTitle.ts) — 마지막 글자 뒤에도 붙는 간격만큼 왼쪽 여백을 줘 가운데를 맞춘다
  const look = docTitleLook(text);
  return (
    <span
      ref={ref}
      className="inline-block font-extrabold"
      style={{ letterSpacing: look.letterSpacing, paddingLeft: look.letterSpacing, ...(shift ? { transform: `translateX(${shift}px)` } : {}) }}
    >
      {look.text}
    </span>
  );
}

/**
 * 사람(여러 명) 칸 — 임직원 검색으로 여러 명을 더하고 하나씩 뺀다. 칸에는 '이름 (부서), 이름 (부서)',
 * 사용자 ID 는 쉼표로 이어 따로(__refs) — 기안 당시 이름 그대로 남는다
 */
function UsersField({ value, onSet, org }: { value: string; onSet: (text: string, ref?: string) => void; org: ReturnType<typeof useOrgTree> }) {
  const [open, setOpen] = useState(false);
  const names = value ? value.split(/,\s*(?![^()]*\))/).map((x) => x.trim()).filter(Boolean) : [];
  return (
    <span className={`${FIELD} flex flex-wrap items-center gap-1`}>
      {names.map((n, i) => (
        <span key={`${n}-${i}`} className="inline-flex items-center gap-0.5 rounded bg-teal-soft/40 px-1 print:bg-transparent print:px-0">
          {n}
          <button
            type="button"
            title="빼기"
            className="text-[#999] hover:text-rose-500 print:hidden"
            onClick={() => {
              const rest = names.filter((_, j) => j !== i);
              onSet(rest.join(', '), REMOVE_AT + String(i));
            }}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded px-1 text-[11.5px] font-semibold text-teal hover:bg-[#f0f4f4] print:hidden">
        <Building2 size={12} />
        {names.length ? '추가' : '임직원 검색'}
      </button>
      {open && (
        <SelectorDialog
          title="임직원 선택(여러 명)"
          org={org}
          deptOnly={false}
          onConfirm={(items) => {
            const picked = items.filter((i) => i.type === 'user').map((i) => org.userById(i.id)).filter(Boolean) as Array<{ id: string; name: string; dept?: string }>;
            if (picked.length) {
              const add = picked.map((u) => (u.dept ? `${u.name} (${u.dept})` : u.name));
              onSet([...names, ...add].join(', '), ADD_IDS + picked.map((u) => u.id).join(','));
            }
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
/** 사람(여러 명) 칸이 ID 목록을 고칠 때 보내는 표시 — 'add:id1,id2' / 'del:순번' */
const ADD_IDS = 'add:';
const REMOVE_AT = 'del:';

/**
 * 선택 칸 — 항목에 '직접입력'이 있으면 그걸 고를 때 글자 칸으로 바뀐다(기존 서식 선택 항목과 같음).
 * 칸 값은 기안자가 쓴 글자(목록에 없는 값이면 직접 입력한 값)
 */
function SelectCell({ options, raw, onSet }: { options: string[]; raw: string; onSet: (text: string) => void }) {
  const direct = options.find(isDirectInputOption);
  const custom = !!direct && raw !== '' && !options.includes(raw);
  const [typing, setTyping] = useState(custom);
  useEffect(() => {
    if (custom) setTyping(true);
  }, [custom]);
  if (direct && typing) {
    return (
      <span className="flex items-center gap-1">
        <input value={custom ? raw : ''} onChange={(e) => onSet(e.target.value)} placeholder="직접 입력하세요" className={FIELD} style={INHERIT} autoFocus={!custom} />
        <button
          type="button"
          onClick={() => {
            setTyping(false);
            onSet('');
          }}
          className="shrink-0 px-1 text-[10.5px] font-semibold text-teal hover:underline print:hidden"
        >
          선택으로
        </button>
      </span>
    );
  }
  return (
    <select
      value={raw}
      onChange={(e) => {
        if (direct && e.target.value === direct) {
          setTyping(true);
          onSet('');
        } else onSet(e.target.value);
      }}
      className={`${FIELD} print:appearance-none`}
      style={INHERIT}
    >
      <option value="">선택</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {raw && !options.includes(raw) && <option value={raw}>{raw}</option>}
    </select>
  );
}


function CellField({ input, sheet, r, c, width, onSet, org }: { input: CellInput; sheet: Sheet; r: number; c: number; width: number; onSet: (text: string, ref?: string) => void; org: ReturnType<typeof useOrgTree> }) {
  const col = sheet.cols[c];
  const raw = String(sheet.rows[r]?.[col] ?? '');
  switch (input.type) {
    case 'multiline':
      return <AutoTextarea value={raw} onChange={onSet} />;
    case 'number':
    case 'currency':
      return <NumberInput raw={raw} shown={displayValue(sheet, r, col)} invalid={raw.trim() !== '' && parseNumber(raw) === null} onChange={onSet} />;
    case 'date':
      return (
        <DateInput
          value={/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''}
          // 휴일근무 '근무 일자' 칸은 주말·공휴일만(기존 휴일근무 서식과 같음)
          restDaysOnly={sheet.cellMeta[APPROVAL_NS.name]?.[cellKey(r, col)] === 'workDate'}
          // 휴일근로는 사후 신청 — 오늘까지만
          max={sheet.cellMeta[APPROVAL_NS.name]?.[cellKey(r, col)] === 'workDate' ? nowLocalIso().slice(0, 10) : undefined}
          onChange={(e) => onSet(e.target.value)}
          className={FIELD}
          style={INHERIT}
        />
      );
    case 'dateRange': {
      const [from = '', to = ''] = raw.split('~').map((x) => x.trim());
      const set = (a: string, b: string) => onSet(a || b ? `${a} ~ ${b}` : '');
      return (
        <span className="block [&>div>button]:!rounded-none [&>div>button]:!border-0 [&>div>button]:!bg-[#fffbe8] [&>div>button]:!px-1 [&>div>button]:!py-0.5 [&>div>button]:!text-[length:inherit] print:[&>div>button]:!bg-transparent print:[&>div>button_svg]:hidden">
          <CalendarRangePicker start={from} end={to} onChange={(a, b) => set(a, b)} floating />
        </span>
      );
    }
    case 'select': {
      const options = draftOptions(sheet, input);
      // 종속 선택 — 기준 칸에서 아직 안 골랐거나 이 칸이 필요 없는 값이면 쓸 수 없는 칸
      if (input.depends && options.length === 0) return <span className="block px-1 text-[11px] text-[#bbb] print:hidden">—</span>;
      return <SelectCell options={options} raw={raw} onSet={onSet} />;
    }
    case 'multiSelect': {
      const picked = raw ? raw.split(',').map((x) => x.trim()) : [];
      const toggle = (o: string) => {
        const next = picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o];
        onSet((input.options ?? []).filter((x) => next.includes(x)).join(', '));
      };
      return (
        <span className={`${FIELD} flex flex-wrap gap-x-2`}>
          {(input.options ?? []).map((o) => (
            <label key={o} className="inline-flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={picked.includes(o)} onChange={() => toggle(o)} className="h-3 w-3 accent-teal" />
              {o}
            </label>
          ))}
        </span>
      );
    }
    case 'checkbox':
      return (
        <span className={`${FIELD} flex justify-center`}>
          <input type="checkbox" checked={raw === CHECK_MARK} onChange={(e) => onSet(e.target.checked ? CHECK_MARK : '')} className="h-3.5 w-3.5 accent-teal" />
        </span>
      );
    case 'user':
      return <UserField value={raw} onSet={onSet} org={org} />;
    case 'users':
      return <UsersField value={raw} onSet={onSet} org={org} />;
    case 'dept':
      // 기존 서식 '부서'와 같은 부서 목록
      return (
        <select value={raw} onChange={(e) => onSet(e.target.value)} className={`${FIELD} print:appearance-none`} style={INHERIT}>
          <option value="">부서 선택</option>
          {org.depts.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
          {raw && !org.depts.some((d) => d.name === raw) && <option value={raw}>{raw}</option>}
        </select>
      );
    default:
      // text
      // 셀에 맞춤 칸 — 줄을 바꾸지 않고 글씨를 줄여 칸에 맞춘다(엑셀과 같음). 아니면 넘칠 때 줄바꿈하며 행이 늘어난다
      if (sheet.styles[`${r}:${col}`]?.shrink) {
        const size = shrinkFontSize(raw, sheet.styles[`${r}:${col}`], width);
        return <input value={raw} onChange={(e) => onSet(e.target.value)} className={FIELD} style={{ ...INHERIT, ...(size ? { fontSize: size } : {}) }} />;
      }
      return <AutoTextarea value={raw} onChange={onSet} singleLine />;
  }
}

export interface SheetDraftFormProps {
  formId: string;
  version: number;
  /** 문서 fieldValues */
  values: Record<string, unknown>;
  /** fieldValues 로 넣을 것(칸 값·서식 버전·이름 붙은 칸 값) */
  onFields: (fields: Record<string, string>) => void;
  /** 상신 전 검사용 — 숫자 칸에 숫자가 아닌 값이 든 칸 주소 */
  onIssues?: (invalidCells: string[]) => void;
  /** 저장된 서식 버전 대신 이 틀로 — 서식 편집기의 '기안 미리보기'(편집 중인 틀, 저장 안 함) */
  template?: Sheet;
  /** 자동 채우기 '기안 정보' 칸 값(기안자·부서·기안일·문서번호) */
  draftInfo?: DraftInfo;
  /** 미리보기에서 쓸 대체 서식(연동 유형) — 저장된 버전은 버전에 든 값을 쓴다 */
  link?: string | null;
  /**
   * 시스템이 계산하는 연동 칸 값 — 예: 휴가 일수(공휴일 제외·반차). 연동 칸 값(linkFieldValues)을 받아 { 칸 이름: 값 }.
   * 그 이름이 붙은 칸에 넣는다
   */
  systemValues?: (link: string, linked: Record<string, string>) => Record<string, string>;
  /** 값을 가져올 수 있는 관련 문서 — load 는 그 문서의 이름 값(없으면 null) */
  relatedSources?: RelatedSource[];
  /** 문서 항목 칸(제목·보존연한·공개범위)에 보일 문서 값과 바꾸기 — 없으면 그 칸은 비어 보인다 */
  docFields?: DocFields;
  onDocField?: (patch: Partial<DocFields>) => void;
  /** 문서 머리 부품 칸(결재란·회사 로고·기안자 서명)에 그릴 것 — 문서 틀이 만들어 넘긴다 */
  slots?: SheetSlots;
  /** 상신 전 검사용 — 비어 있는 필수 칸 이름표 */
  onRequired?: (labels: string[]) => void;
  /** 기안자가 고칠 수 없는 이름 붙은 칸(시스템이 채움) — 휴일근로의 출근·퇴근 시각·근무 시간 */
  lockedNames?: readonly string[];
  /** systemValues 결과가 바뀌었음을 알리는 값 — 바뀌면 시트에 다시 넣는다(근태 기록을 늦게 받아 온 경우) */
  systemKey?: string;
}

export interface RelatedSource {
  id: string;
  /** 단추에 보일 이름(문서번호·제목) */
  label: string;
  load: () => NamedValues | null;
}

export function SheetDraftForm({
  formId,
  version,
  values,
  onFields,
  onIssues,
  template,
  relatedSources = [],
  link: linkProp = null,
  systemValues,
  draftInfo,
  docFields,
  onDocField,
  slots,
  onRequired,
  lockedNames,
  systemKey,
}: SheetDraftFormProps) {
  const fetched = useFormVersionSheet(template ? null : formId, template ? null : version);
  const loaded = useMemo(() => (template ? { sheet: template } : fetched.data), [template, fetched.data]);
  const isLoading = !template && fetched.isLoading;
  const error = template ? null : fetched.error;
  const org = useOrgTree();
  const key = versionKey(formId, version);
  const rawValues = values[SHEET_VALUES_KEY];
  const rawRows = values[SHEET_ROWS_KEY];
  const extras = useMemo(() => readRowExtras(rawRows), [rawRows]);
  // 기안자가 표 모양을 고친 문서 — 문서가 가진 시트를 틀로 쓴다(ownSheet.ts). 없으면 서식 버전의 틀
  const rawOwn = values[SHEET_OWN_KEY];
  const own = useMemo(() => readOwnSheet(rawOwn), [rawOwn]);
  const tplSheet: Sheet | null = own ?? loaded?.sheet ?? null;
  // [표 모양 고치기] — 고치는 중인 시트와 시작할 때 모양(끝낼 때 보호 칸 검사·사람 칸 ID 맞추기)
  const [editing, setEditing] = useState<{ start: Sheet; sheet: Sheet } | null>(null);
  const [editNotice, setEditNotice] = useState('');
  const rawRefs = values[SHEET_REFS_KEY];
  const refs = useMemo(() => readSheetValues(rawRefs), [rawRefs]);
  /** fieldValues 로 올려 보내기 — 칸 값·서식 버전·줄 수·이름 붙은 칸 값 + 사람 칸 ID */
  // 대체 서식(연동 유형) — 서식 버전에 묶여 있다(미리보기는 편집 중인 값)
  const link = (template ? linkProp : (fetched.data?.link ?? null)) || null;
  /** ownNext — 문서 시트 바꾸기(Sheet = 고친 모양 저장, null = 지우고 서식 틀로). 없으면 그대로 */
  const emit = (s0: Sheet, rowExtras: typeof extras, refMap0: Record<string, string>, ownNext?: Sheet | null) => {
    // 행 보이기 조건으로 숨은 행의 입력 값은 비운다 — 합계·금액·연동 값에 숨은 값이 남지 않게
    // 종속 선택 칸은 기준 칸이 바뀌어 목록에 없게 된 값을 비운다
    const cleared = clearConditionHidden(clearStaleDependent(s0), refMap0);
    let s = cleared.sheet;
    const refMap = cleared.refs;
    // 시스템이 계산하는 연동 칸(휴가 일수 등) — 기안 화면이 준 값으로 채운다
    if (link && systemValues) {
      const sys = systemValues(link, linkFieldValues(s, link, refMap));
      Object.entries(sys).forEach(([name, v]) => {
        const ck = Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).find(([, n]) => n === name)?.[0];
        if (!ck) return;
        const i = ck.indexOf(':');
        s = setCellValue(s, Number(ck.slice(0, i)), s.cols.indexOf(ck.slice(i + 1)), v, { allowFormula: false });
      });
      s = recalculate(s);
    }
    onFields({
      ...sheetDocFields(s, key, rowExtras),
      // 연동 칸 값을 기존 필드 키로(휴가 period·leaveType 등) + 연동 유형 __link — 휴가·근태·캘린더·결재선이 읽는다
      ...linkFieldValues(s, link, refMap),
      [SHEET_REFS_KEY]: JSON.stringify(refMap),
      // 이름 붙은 칸 값 — 다른 문서가 '관련 문서 값 가져오기'로 읽는다
      [SHEET_NAMED_KEY]: JSON.stringify(collectNamed(s)),
      ...(ownNext !== undefined ? { [SHEET_OWN_KEY]: ownNext ? JSON.stringify(ownNext) : '' } : {}),
    });
  };
  // 반복 구간을 문서의 줄 수만큼 펼친 틀 → 값 얹고 다시 계산
  const sheet = useMemo(
    () => (tplSheet ? applyValues(expandRepeats(tplSheet, extras), readSheetValues(rawValues), { recalc: true }) : null),
    [tplSheet, rawValues, extras]
  );
  const sections = useMemo(() => (sheet ? repeatSections(sheet) : []), [sheet]);
  // 결재 완료일 줄 — 작성 중엔 숨김(값이 없을 때)
  const completedRows = useMemo(() => new Set(sheet && !draftInfo?.completedDate ? completedDateRows(sheet) : []), [sheet, draftInfo?.completedDate]);
  // 행 보이기 조건 — 조건 칸(예: 지출 항목) 값에 맞지 않는 행은 숨긴다(기존 서식 '식대일 때만 보이기')
  const condHidden = useMemo(() => (sheet ? conditionHiddenRows(sheet) : new Set<number>()), [sheet]);

  // 처음 열 때 서식 버전·수식 결과를 문서 값에 남긴다(아무것도 안 쓰고 저장해도 어느 틀인지 알게)
  const needsInit = !!sheet && values['__formVersion'] !== key;
  useEffect(() => {
    if (sheet && needsInit) emit(sheet, extras, refs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit]);

  // 시스템 값(근태 기록 등)이 새로 정해지면 칸에 다시 넣는다 — 기안자가 칸을 건드리지 않아도
  useEffect(() => {
    if (sheet && !needsInit && systemKey !== undefined) emit(sheet, extras, refs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemKey]);

  useEffect(() => {
    if (sheet) onRequired?.(requiredMissing(sheet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  useEffect(() => {
    if (sheet) onIssues?.(invalidNumberCells(sheet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (isLoading) return <div className="py-10 text-center text-[12px] text-[#888]">서식을 불러오는 중…</div>;
  if (error || !sheet) return <div className="py-10 text-center text-[12px] text-rose-600">서식 틀(v{version})을 읽지 못했습니다.</div>;

  const set = (r: number, c: number, text: string, ref?: string) => {
    // 기안자가 쓴 '='는 수식이 아니라 글자 — 수식은 서식 틀에만 있다
    const next = setCellValue(sheet, r, c, text, { allowFormula: false });
    let refMap = refs;
    const inputType = draftInputOf(sheet, r, c)?.type;
    if (inputType === 'user' || inputType === 'users') {
      const k = cellKey(r, sheet.cols[c]);
      refMap = { ...refs };
      if (inputType === 'users') {
        const ids = (refs[k] ?? '').split(',').filter(Boolean);
        if (ref?.startsWith(ADD_IDS)) ids.push(...ref.slice(ADD_IDS.length).split(',').filter(Boolean));
        else if (ref?.startsWith(REMOVE_AT)) ids.splice(Number(ref.slice(REMOVE_AT.length)), 1);
        if (ids.length && text) refMap[k] = ids.join(',');
        else delete refMap[k];
      } else if (ref && text) refMap[k] = ref;
      else delete refMap[k];
    }
    emit(recalculate(next), extras, refMap);
  };

  /** 관련 문서의 이름 붙은 칸 값을 같은 이름 칸으로 복사 */
  const importFrom = (src: RelatedSource) => {
    if (!tplSheet) return;
    const named = src.load();
    if (!named) return alert(`'${src.label}' 문서를 읽지 못했습니다.`);
    const res = importNamed(tplSheet, extras, readSheetValues(rawValues), refs, named);
    if (!res.filled.length) return alert(`'${src.label}'에는 이 서식과 같은 이름의 칸이 없습니다.`);
    if (!confirm(`'${src.label}'에서 ${res.filled.join(', ')} 값을 가져옵니다.
이미 쓴 값은 가져온 값으로 바뀝니다.`)) return;
    emit(sheetWith(tplSheet, res), res.extras, res.refs);
  };
  const canImport = !!tplSheet && hasImportableNames(tplSheet) && relatedSources.length > 0;

  /**
   * 반복 구간 줄 수 바꾸기 — 값 자리를 옮기고 다시 펼친다. at 이 있으면 그 줄 아래에 넣기(+)·그 줄 지우기(−),
   * 없으면 구간 끝(아래 띠의 [행 추가]·[행 삭제]). 번호 열(1, 2, 3…)은 차례였으면 다시 매긴다
   */
  const changeRows = (id: string, add: boolean, at?: number) => {
    if (!tplSheet) return;
    const tpl = tplSheet;
    const run = (vals: Record<string, string>, renumber: boolean) =>
      at === undefined
        ? (add ? addRepeatRow : removeRepeatRow)(tpl, extras, vals, id)
        : (add ? insertRepeatRowAfter : removeRepeatRowAt)(tpl, extras, vals, id, at, { renumber });
    const next = run(readSheetValues(rawValues), true);
    // 사람 칸 ID 도 값과 같은 규칙으로 행을 옮긴다(번호는 안 매김)
    const nextRefs = run(refs, false).values;
    const expanded = applyValues(expandRepeats(tpl, next.extras), next.values, { recalc: true });
    emit(expanded, next.extras, nextRefs);
  };

  /** [표 모양 고치기] 끝 — 보호 칸이 그대로인지 보고, 고친 모양을 문서 시트로 저장(반복 구간 줄 수는 시트에 들었으니 0) */
  const finishEdit = () => {
    if (!editing) return;
    const issues = draftEditIssues(editing.start, editing.sheet);
    if (issues.length) {
      alert(`${issues.join('\n')}\n\n되돌리기(Ctrl+Z)로 되살리거나 [취소]로 처음 모양으로 돌아가 주세요.`);
      return;
    }
    const next = recalculate(editing.sheet);
    emit(next, {}, keepRefsAfterEdit(refs, editing.start, editing.sheet), next);
    setEditing(null);
    setEditNotice('');
  };
  /** [원래 양식으로] — 고친 모양과 입력 값을 지우고 서식 처음 모양으로 */
  const resetToTemplate = () => {
    if (!loaded?.sheet) return;
    if (!confirm('고친 표 모양과 입력한 값을 모두 지우고 서식 처음 모양으로 되돌립니다. 계속할까요?')) return;
    emit(recalculate(loaded.sheet), {}, {}, null);
  };
  const canEditShape = !template && !!loaded?.sheet;

  return (
    // 서식이 A4보다 넓으면 작성 중에는 줄이지 않고 옆으로 밀어 본다(글씨가 작아지지 않게). 문서 보기·인쇄는 맞춰 줄임
    <div className="relative">
      {canImport && (
        // 관련 문서 값 가져오기 — 관련 문서로 고른 문서의 같은 이름 칸 값을 복사(§11.4). 인쇄에는 안 나옴
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded border border-dashed border-teal/40 bg-teal-soft/20 px-2 py-1.5 text-[11px] print:hidden">
          <span className="font-semibold text-[#444]">관련 문서 값 가져오기</span>
          {relatedSources.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => importFrom(src)}
              className="flex max-w-[260px] items-center gap-1 rounded bg-white px-2 py-0.5 font-semibold text-teal shadow-xs hover:bg-teal-soft/60"
              title={`${src.label}의 같은 이름 칸 값을 가져옵니다`}
            >
              <Download className="h-3 w-3 shrink-0" />
              <span className="truncate">{src.label}</span>
            </button>
          ))}
        </div>
      )}
      {/* 표 모양 고치기 — 열·행 넣기·지우기, 병합, 수식(금액·연동 칸 등 보호 칸은 그대로). 인쇄에는 안 나옴 */}
      {canEditShape && !editing && (
        // 시트 위(종이 윗여백)에 띄운다 — 줄을 차지하면 시트 맨 위 로고가 종이 위에서 떨어져 보인다
        <div className="absolute bottom-full right-0 mb-1 flex flex-wrap items-center justify-end gap-1.5 text-[11px] print:hidden">
          {own && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">기안자가 표 모양을 고친 문서입니다</span>
          )}
          <button
            type="button"
            onClick={() => {
              setEditNotice('');
              setEditing({ start: sheet, sheet });
            }}
            className="ml-auto flex items-center gap-1 rounded border border-border bg-white px-2 py-0.5 font-semibold text-ink2 hover:border-teal hover:text-teal"
            title="열·행 넣기·지우기, 병합, 수식 고치기 — 금액·연동 칸, 문서 정보, 결재란 등은 고칠 수 없습니다"
          >
            <Table2 className="h-3 w-3" />표 모양 고치기
          </button>
          {own && (
            <button type="button" onClick={resetToTemplate} className="rounded px-1.5 py-0.5 font-semibold text-rose-500 hover:bg-rose-50">
              원래 양식으로
            </button>
          )}
        </div>
      )}
      {editing ? (
        <div className="print:hidden">
          <div className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">
            엑셀처럼 열·행을 넣거나 지우고, 병합하고, 수식을 고칠 수 있습니다. 🔒 표시 칸(금액·연동 칸, 문서 정보, 결재란, 직인, 자동번호)과 그 칸이 든 행·열은 고칠 수 없습니다.
            새로 만든 칸에 쓸 글자도 여기서 쓰세요. 다 고쳤으면 [고치기 끝].
            {editNotice && <div className="mt-0.5 font-semibold text-rose-600">{editNotice}</div>}
          </div>
          <SheetEditor
            value={editing.sheet}
            onChange={(next) => setEditing((e) => (e ? { ...e, sheet: next } : e))}
            mode="design"
            normalize={healRepeatSections}
            canMerge={draftCanMerge}
            insertColumn={draftInsertCol}
            mergeCells={(s, range) => {
              // 왼쪽 위 칸이 기준 — 나머지 칸의 글자와 부품(입력 칸 등)은 빠진다
              if (mergeDropsContent(s, range) && !confirm('병합하면 왼쪽 위 칸만 남고 다른 칸의 글자는 지워집니다. 병합할까요?')) return s;
              return mergeApprovalRange(s, range);
            }}
            canDeleteRow={(s, r) => canDraftDelete(s, 'row', r)}
            canDeleteCol={(s, c) => canDraftDelete(s, 'col', c)}
            setValue={(s, r, c, text) => {
              const next = draftEditSetValue(s, r, c, text);
              if (next) return next;
              setEditNotice('이 칸은 고칠 수 없습니다(금액·연동 칸, 문서 정보 등).');
              return s;
            }}
            paste={draftEditPaste}
            renderBadge={(r, c) => (isProtectedCell(editing.sheet, r, c) ? <span className="text-[9px]" title="고칠 수 없는 칸">🔒</span> : null)}
            onNotice={setEditNotice}
            height="60vh"
            toolbarExtra={
              <>
                <button
                  type="button"
                  onClick={finishEdit}
                  className="h-7 rounded-md bg-teal px-2.5 text-[11.5px] font-bold text-white hover:opacity-90"
                >
                  고치기 끝
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditNotice('');
                  }}
                  className="h-7 rounded-md border border-border bg-white px-2 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
              </>
            }
          />
        </div>
      ) : (
      <>
      {/* 오른쪽에 [+][−] 자리(종이 여백 안) — 넘침 상자를 그만큼 넓힌다 */}
      {/* 단추 폭(약 30px)이 이 여백(32px) 안에 들어가야 가로 스크롤이 생기지 않는다 — 종이 좌우 여백(px-8)과 같은 폭 */}
      <div className={`overflow-x-auto ${sections.length ? '-mr-8 pr-8' : ''}`}>
        <SheetView
          sheet={sheet}
          // 문서 머리 표와 폭·선 색 맞춤 — 넓은 서식은 줄이지 않고 옆으로 밀어 쓴다(글씨가 작아지지 않게)
          // 테두리 2px 만큼 덜 늘린다 — 꽉 채우면 넘침 상자(overflow-x-auto)가 맨 오른쪽 테두리를 잘라 먹는다
          stretchTo={DOC_SHEET_VIEW.stretchTo - 4}
          thinBorderColor={DOC_SHEET_VIEW.thinBorderColor}
          renderCell={(r, c) => {
            const props = approvalCellProps(sheet, r, c);
            const bind = props.bind;
            // 자동번호 칸 — 상신하면 서식 규칙으로 번호가 매겨진다(재상신은 받은 번호 그대로)
            if (props.autoNo) {
              const v = String(sheet.rows[r]?.[sheet.cols[c]] ?? '');
              return v || <span className="text-[11px] text-[#999] print:hidden">상신하면 자동으로 매겨집니다 (예: {autoNumberPreview(props.autoNo)})</span>;
            }
            // 안내문 칸 — 작성할 때만 흐리게(결재·인쇄 화면엔 안 나옴)
            if (props.guide) return <span className="text-[11px] text-[#777] print:hidden">{String(sheet.rows[r]?.[sheet.cols[c]] ?? '')}</span>;
            // 문서 머리 부품 칸 — 결재란(누르면 결재선 편집)·로고·기안자 서명
            const slot = slotOf(bind);
            if (slot) return <SlotCell node={slots?.[slot]} slot={slot} />;
            if (bind === 'doc.formTitle') return <SheetFormTitle text={draftInfoValue(bind, draftInfo) ?? ''} />;
            // 문서 항목 칸 — 문서의 제목·보존연한·공개범위를 여기서 쓴다
            if (isDocFieldBind(bind)) return docFields && onDocField ? <DocFieldCell bind={bind} doc={docFields} onChange={onDocField} /> : '';
            // 기안 정보 칸 — 시스템 값(입력 칸이어도 고칠 수 없음)
            const auto = draftInfoValue(bind, draftInfo);
            if (auto !== undefined) return auto;
            const input = draftInputOf(sheet, r, c);
            if (!input) return undefined;
            // 시스템이 채우는 칸 — 글자로만(휴일근로 출근·퇴근 시각·근무 시간은 근태 기록에서)
            const cellName = sheet.cellMeta[APPROVAL_NS.name]?.[cellKey(r, sheet.cols[c])];
            if (typeof cellName === 'string' && lockedNames?.includes(cellName)) {
              const shown = displayValue(sheet, r, sheet.cols[c]);
              return <span title="근태 기록에서 자동으로 채웁니다">{shown || <span className="text-[11px] text-[#999] print:hidden">근태 기록에서 채움</span>}</span>;
            }
            const span = sheet.merges.find((m) => m.startRow === r && m.startCol === c)?.colSpan ?? 1;
            const width = sheet.cols.slice(c, c + span).reduce((sum, k) => sum + (sheet.colWidths[k] ?? DEFAULT_COL_WIDTH), 0);
            return <CellField input={input} sheet={sheet} r={r} c={c} width={width} onSet={(t, ref) => set(r, c, t, ref)} org={org} />;
          }}
          // 결재 완료일 줄 — 작성 중엔 아직 결재 전이라 줄째 숨김(기존 문서 머리와 같음)
          hiddenRows={(r) => completedRows.has(r) || condHidden.has(r)}
          // 반복 구간 줄 수 — 구간 바로 아래 띠(기존 서식 '표'의 [행 추가]·[행 삭제]와 같음, 인쇄 안 됨)
          afterRow={(r) => {
            const sec = sections.find((x) => x.last === r);
            if (!sec) return null;
            return (
              <div className="flex items-center gap-1.5 border-x border-b border-dashed border-violet-300 bg-violet-50/60 px-2 py-1 text-[11px]">
                <span className="font-semibold text-violet-700">{sec.label}</span>
                <span className="text-[#888]">{sec.last - sec.first + 1}줄</span>
                <button
                  type="button"
                  onClick={() => changeRows(sec.id, true)}
                  className="ml-auto flex items-center gap-0.5 rounded bg-white px-2 py-0.5 font-bold text-teal shadow-xs hover:bg-teal-soft/70"
                >
                  <Plus className="h-3 w-3" />
                  행 추가
                </button>
                {/* 그린 줄도 지울 수 있다(기존 서식 표와 같음) — 1줄은 남김 */}
                {sec.last > sec.first && (
                  <button
                    type="button"
                    onClick={() => changeRows(sec.id, false)}
                    title="마지막 줄 삭제"
                    className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    행 삭제
                  </button>
                )}
              </div>
            );
          }}
          // 반복 구간 줄 — 마우스를 올리면 표 오른쪽 바깥에 [+]·[−](그 줄 아래에 넣기·그 줄 지우기, 인쇄 안 됨)
          rowClassName={(r) => (sections.some((x) => r >= x.first && r <= x.last) ? 'group/rep' : undefined)}
          rowEnd={(r) => {
            const sec = sections.find((x) => r >= x.first && r <= x.last);
            if (!sec) return null;
            const btn = 'flex h-3 w-3 items-center justify-center rounded-sm bg-white font-bold leading-none shadow-sm ring-1 ring-black/15';
            return (
              // 투명하게 늘 있다 — 줄이나 단추 자리에 마우스를 올리면 보인다(전엔 줄에서 마우스가 나가면 바로 사라져 누르기 어려웠다)
              <span className="flex gap-px opacity-0 transition-opacity group-hover/rep:opacity-100 hover:opacity-100 focus-within:opacity-100">
                <button type="button" title="이 줄 아래에 줄 넣기" onClick={() => changeRows(sec.id, true, r)} className={`${btn} text-teal hover:bg-teal-soft`}>
                  <Plus className="h-2 w-2" />
                </button>
                {sec.last > sec.first && (
                  <button type="button" title="이 줄 지우기" onClick={() => changeRows(sec.id, false, r)} className={`${btn} text-rose-500 hover:bg-rose-50`}>
                    <Minus className="h-2 w-2" />
                  </button>
                )}
              </span>
            );
          }}
          cellClassName={(r, c) => {
            // 반복 구간 — 첫 열 왼쪽에 보라색 띠(아래 [행 추가]와 같은 색). 칸 위치 지정 없이 안쪽 그림자로, 인쇄엔 안 나옴
            if (c !== 0) return undefined;
            return sections.some((x) => r >= x.first && r <= x.last) ? 'shadow-[inset_3px_0_0_#8b5cf6] print:shadow-none' : undefined;
          }}
        />
      </div>
      </>
      )}
    </div>
  );
}
