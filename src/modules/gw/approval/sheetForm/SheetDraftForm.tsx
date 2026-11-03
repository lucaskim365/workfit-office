import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SheetView, displayValue, parseNumber, recalculate, setCellValue, type Sheet } from '@/lib/sheet';
import { Plus, Trash2 } from 'lucide-react';
import { useFormVersionSheet } from '@/features/gw/useApprovalFormVersions';
import { versionKey } from '@/domain/approvalForm/sheetVersion';
import {
  CHECK_MARK,
  SHEET_VALUES_KEY,
  applyValues,
  draftInputOf,
  invalidNumberCells,
  readSheetValues,
  sheetDocFields,
  type CellInput,
} from './approvalSheet';
import { SHEET_ROWS_KEY, addRepeatRow, expandRepeats, readRowExtras, removeRepeatRow, repeatSections } from './repeatRows';

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
      title={invalid ? '숫자만 입력할 수 있습니다' : undefined}
      className={`${FIELD} ${invalid ? 'bg-rose-100 ring-1 ring-rose-400' : ''}`}
      style={{ ...INHERIT, textAlign: 'right' }}
    />
  );
}

function CellField({ input, sheet, r, c, onSet }: { input: CellInput; sheet: Sheet; r: number; c: number; onSet: (text: string) => void }) {
  const col = sheet.cols[c];
  const raw = String(sheet.rows[r]?.[col] ?? '');
  switch (input.type) {
    case 'multiline':
      return <AutoTextarea value={raw} onChange={onSet} />;
    case 'number':
    case 'currency':
      return <NumberInput raw={raw} shown={displayValue(sheet, r, col)} invalid={raw.trim() !== '' && parseNumber(raw) === null} onChange={onSet} />;
    case 'date':
      return <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''} onChange={(e) => onSet(e.target.value)} className={FIELD} style={INHERIT} />;
    case 'dateRange': {
      const [from = '', to = ''] = raw.split('~').map((x) => x.trim());
      const set = (a: string, b: string) => onSet(a || b ? `${a} ~ ${b}` : '');
      return (
        <span className="flex items-center gap-1">
          <input type="date" value={from} onChange={(e) => set(e.target.value, to)} className={FIELD} style={INHERIT} />
          <span>~</span>
          <input type="date" value={to} onChange={(e) => set(from, e.target.value)} className={FIELD} style={INHERIT} />
        </span>
      );
    }
    case 'select':
      return (
        <select value={raw} onChange={(e) => onSet(e.target.value)} className={`${FIELD} print:appearance-none`} style={INHERIT}>
          <option value="">선택</option>
          {(input.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {raw && !(input.options ?? []).includes(raw) && <option value={raw}>{raw}</option>}
        </select>
      );
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
    default:
      // text·user·dept — 사람·부서 고르기는 조직도 연결 때 바꾼다
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
}

export function SheetDraftForm({ formId, version, values, onFields, onIssues }: SheetDraftFormProps) {
  const { data: loaded, isLoading, error } = useFormVersionSheet(formId, version);
  const key = versionKey(formId, version);
  const rawValues = values[SHEET_VALUES_KEY];
  const rawRows = values[SHEET_ROWS_KEY];
  const extras = useMemo(() => readRowExtras(rawRows), [rawRows]);
  // 반복 구간을 문서의 줄 수만큼 펼친 틀 → 값 얹고 다시 계산
  const sheet = useMemo(
    () => (loaded?.sheet ? applyValues(expandRepeats(loaded.sheet, extras), readSheetValues(rawValues), { recalc: true }) : null),
    [loaded, rawValues, extras]
  );
  const sections = useMemo(() => (sheet ? repeatSections(sheet) : []), [sheet]);

  // 처음 열 때 서식 버전·수식 결과를 문서 값에 남긴다(아무것도 안 쓰고 저장해도 어느 틀인지 알게)
  const needsInit = !!sheet && values['__formVersion'] !== key;
  useEffect(() => {
    if (sheet && needsInit) onFields(sheetDocFields(sheet, key, extras));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit]);

  useEffect(() => {
    if (sheet) onIssues?.(invalidNumberCells(sheet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (isLoading) return <div className="py-10 text-center text-[12px] text-[#888]">서식을 불러오는 중…</div>;
  if (error || !sheet) return <div className="py-10 text-center text-[12px] text-rose-600">서식 틀(v{version})을 읽지 못했습니다.</div>;

  const set = (r: number, c: number, text: string) => {
    // 기안자가 쓴 '='는 수식이 아니라 글자 — 수식은 서식 틀에만 있다
    const next = setCellValue(sheet, r, c, text, { allowFormula: false });
    onFields(sheetDocFields(recalculate(next), key, extras));
  };

  /** 반복 구간 줄 수 바꾸기 — 값 자리를 옮기고 다시 펼친다 */
  const changeRows = (id: string, add: boolean) => {
    if (!loaded?.sheet) return;
    const fn = add ? addRepeatRow : removeRepeatRow;
    const next = fn(loaded.sheet, extras, readSheetValues(rawValues), id);
    const expanded = applyValues(expandRepeats(loaded.sheet, next.extras), next.values, { recalc: true });
    onFields(sheetDocFields(expanded, key, next.extras));
  };

  return (
    // 서식이 A4보다 넓으면 작성 중에는 줄이지 않고 옆으로 밀어 본다(글씨가 작아지지 않게). 문서 보기·인쇄는 맞춰 줄임
    <div>
      <div className="overflow-x-auto">
        <SheetView
          sheet={sheet}
          renderCell={(r, c) => {
            const input = draftInputOf(sheet, r, c);
            return input ? <CellField input={input} sheet={sheet} r={r} c={c} onSet={(t) => set(r, c, t)} /> : undefined;
          }}
          renderOverlay={(r, c) => {
            // 반복 구간 — 첫 열 왼쪽에 보라색 띠(아래 [행 추가]와 같은 색). 인쇄에는 안 나옴
            if (c !== 0) return null;
            const sec = sections.find((x) => r >= x.first && r <= x.last);
            return sec ? <span aria-hidden title={`${sec.label} — 아래 [행 추가]로 줄을 늘립니다`} className="absolute inset-y-0 left-0 w-[3px] bg-violet-500 print:hidden" /> : null;
          }}
        />
      </div>
      {sections.length > 0 && (
        // 반복 구간 줄 수 — 기존 서식 '표'의 [행 추가]·[행 삭제]와 같다(마지막 줄을 지운다). 인쇄에는 나오지 않음
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 print:hidden">
          {sections.map((sec) => {
            const rows = sec.last - sec.first + 1;
            const added = extras[sec.id] ?? 0;
            return (
              <div key={sec.id} className="flex items-center gap-1.5 text-[11px]">
                <span className="inline-block h-3 w-[3px] rounded-sm bg-violet-500" aria-hidden />
                <span className="font-semibold text-violet-700">{sec.label}</span>
                <span className="text-[#888]">{rows}줄</span>
                {added > 0 && (
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
                <button
                  type="button"
                  onClick={() => changeRows(sec.id, true)}
                  className="flex items-center gap-0.5 rounded bg-teal-soft/40 px-2 py-0.5 font-bold text-teal hover:bg-teal-soft/70"
                >
                  <Plus className="h-3 w-3" />
                  행 추가
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
