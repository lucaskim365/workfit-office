import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import { DateInput } from '@/shared/ui/form/DateInput';
import { NO_DATE_FILTER, isDateFilterOn, type DateFilter, type DateState } from './purchaseFilter';

const POPUP_W = 232;

/**
 * 열 제목 옆 깔때기 단추 — 누르면 그 열의 필터 창이 뜬다(엑셀 열 필터). 필터가 걸린 열은 단추에 색이 들어온다.
 * 표 상자가 옆으로 밀리는 상자(overflow)라 창을 그 안에 두면 잘린다 — 문서 맨 위에 고정 위치로 띄운다.
 */
export function ColumnFilterButton({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 화면 배율(body zoom) 안의 고정 위치라 좌표를 배율로 나눈다(DateInput 달력과 같은 계산)
  const place = useCallback(() => {
    if (!button.current) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    const r = button.current.getBoundingClientRect();
    const vw = window.innerWidth / zoom;
    setPos({ left: Math.max(4, Math.min(r.left / zoom, vw - POPUP_W - 4)), top: r.bottom / zoom + 6 });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      // 필터 창 안의 날짜 칸이 띄운 달력도 이 창의 일부로 본다(달력은 문서 맨 위에 따로 뜬다)
      if (popup.current?.contains(t) || button.current?.contains(t) || t.closest?.('[role="dialog"][aria-label="날짜 선택"]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${label} 필터`}
        aria-expanded={open}
        title={`${label} 필터`}
        className={`ml-1 inline-grid h-5 w-5 place-items-center rounded align-middle transition-colors ${
          active ? 'bg-teal text-white' : open ? 'bg-panel text-ink2' : 'text-ink3/70 hover:bg-panel hover:text-ink2'
        }`}
      >
        <Filter size={11} />
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={popup}
            role="dialog"
            aria-label={`${label} 필터`}
            style={{ left: pos.left, top: pos.top, width: POPUP_W }}
            className="fixed z-[1000000] flex flex-col gap-2 rounded-xl border border-border bg-panel p-3 text-left text-[12px] font-normal text-ink2 shadow-xl"
          >
            <span className="text-[11px] font-bold text-ink3">{label}</span>
            {children}
          </div>,
          document.body
        )}
    </>
  );
}

const clearBtn = 'self-end rounded px-1.5 py-0.5 text-[11px] font-bold text-teal hover:bg-panel-alt disabled:text-ink3/50 disabled:hover:bg-transparent';

/** 값 필터 창 — 고른 값 중 하나와 같은 줄만 보인다. 아무것도 안 고르면 필터 없음 */
export function SetFilterPanel({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <>
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-panel-alt">
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="accent-teal" />
            <span className="truncate text-ink">{o.label}</span>
          </label>
        ))}
      </div>
      <button type="button" disabled={!value.length} onClick={() => onChange([])} className={clearBtn}>필터 풀기</button>
    </>
  );
}

const STATES: { value: DateState; label: string }[] = [
  { value: 'any', label: '전체' },
  { value: 'empty', label: '비어 있음' },
  { value: 'filled', label: '입력됨' },
];
const dateBox = 'h-7 w-full rounded-md border border-border-hi bg-panel px-2 text-[11px] text-ink outline-none focus:border-teal disabled:opacity-50';

/** 날짜 필터 창 — 기간(시작~끝), 비어 있을 수 있는 날짜는 '비어 있음 / 입력됨'도 */
export function DateFilterPanel({ value, canBeEmpty, onChange }: { value: DateFilter; canBeEmpty: boolean; onChange: (next: DateFilter) => void }) {
  const noRange = value.state === 'empty';
  return (
    <>
      {canBeEmpty && (
        <div className="flex gap-1">
          {STATES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value === 'empty' ? { from: '', to: '', state: 'empty' } : { ...value, state: s.value })}
              className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-bold ${value.state === s.value ? 'bg-teal text-white' : 'bg-panel-alt text-ink2 hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1 text-[11px] text-ink3">
        시작
        <DateInput value={value.from} max={value.to || undefined} disabled={noRange} onChange={(e) => onChange({ ...value, from: e.target.value })} className={dateBox} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink3">
        끝
        <DateInput value={value.to} min={value.from || undefined} disabled={noRange} onChange={(e) => onChange({ ...value, to: e.target.value })} className={dateBox} />
      </label>
      <button type="button" disabled={!isDateFilterOn(value)} onClick={() => onChange(NO_DATE_FILTER)} className={clearBtn}>필터 풀기</button>
    </>
  );
}
