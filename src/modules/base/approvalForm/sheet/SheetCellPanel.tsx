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

/**
 * 시트 서식 편집기 — 고른 칸의 결재 속성(입력 칸·칸 이름·불러오기·잠금·비공개·직인).
 * 보이는 값은 초점 칸 기준이고, 바꾸면 고른 범위 전체에 넣는다(칸 이름만 초점 칸 하나에).
 */
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
        hint={multi ? '칸 이름은 한 칸에만 붙습니다(지금 초점 칸).' : '다른 기능이 이 칸 값을 찾는 이름. 한 서식에 하나씩만 붙고, 다른 칸에 붙이면 옮겨집니다.'}
      >
        <select className={inp} value={props.name ?? ''} onChange={(e) => onChange(setCellName(sheet, focus.r, focus.c, e.target.value || undefined))}>
          <option value="">이름 없음</option>
          {COMMON_CELL_NAMES.map((n) => (
            <option key={n.key} value={n.key}>
              {n.label} — {n.hint}
            </option>
          ))}
          {props.name && !COMMON_CELL_NAMES.some((n) => n.key === props.name) && (
            <option value={props.name}>{props.name === 'body' ? '본문' : props.name} (지금은 쓰지 않는 이름 — 지워 주세요)</option>
          )}
        </select>
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
    </div>
  );
}
