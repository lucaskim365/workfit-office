import { useEffect, useState } from 'react';
import type { Sheet, SheetSelection } from '@/lib/sheet';
import {
  APPROVAL_NS,
  BIND_GROUPS,
  CELL_INPUT_LABELS,
  COMMON_CELL_NAMES,
  approvalCellProps,
  cellAddress,
  setApprovalProp,
  setCellName,
  type CellInput,
  type CellInputType,
} from '@/modules/gw/approval/sheetForm/approvalSheet';
import { clearRepeatSection, renameRepeatSection, repeatSectionAt, setRepeatSection } from '@/modules/gw/approval/sheetForm/repeatRows';

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

export function SheetCellPanel({ sheet, selection, onChange }: { sheet: Sheet; selection: SheetSelection; onChange: (next: Sheet) => void }) {
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
    if (!name || name.startsWith('__') || COMMON_CELL_NAMES.some((n) => n.key === name || n.label === name)) return;
    onChange(setCellName(sheet, focus.r, focus.c, name));
  };

  return (
    <div className="space-y-3.5 text-[12px]">
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

      {hasOptions && (
        <Row label="고를 항목" hint="한 줄에 하나씩">
          <textarea className={`${inp} min-h-[84px] resize-y`} value={options} onChange={(e) => setOptions(e.target.value)} onBlur={commitOptions} />
        </Row>
      )}

      <Row
        label="프로젝트 값 채우기"
        hint={
          BIND_GROUPS.length
            ? '기안자가 서식에서 프로젝트를 고르면 이 칸을 그 프로젝트의 값으로 채웁니다. 입력 칸이면 고쳐 쓸 수 있습니다.'
            : '준비 중 — 기안자가 프로젝트를 고르면 계약일자·고객사명 같은 칸을 한꺼번에 채우는 기능입니다. 프로젝트 관리 항목을 정한 뒤 열립니다.'
        }
      >
        <select
          className={inp}
          value={props.bind ?? ''}
          disabled={!BIND_GROUPS.length && !props.bind}
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
            onChange(setCellName(sheet, focus.r, focus.c, e.target.value || undefined));
          }}
        >
          <option value="">이름 없음</option>
          {COMMON_CELL_NAMES.map((n) => (
            <option key={n.key} value={n.key} title={n.hint}>
              {n.label}
            </option>
          ))}
          {props.name && props.name !== 'body' && !COMMON_CELL_NAMES.some((n) => n.key === props.name) && <option value={props.name}>{props.name}</option>}
          {props.name === 'body' && <option value="body">본문 (지금은 쓰지 않는 이름 — 지워 주세요)</option>}
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
      </div>

      <RepeatPanel sheet={sheet} selection={selection} onChange={onChange} />
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
