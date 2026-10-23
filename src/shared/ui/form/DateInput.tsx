import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useHolidays } from '@/features/holiday/useHolidays';
import { buildMonthGrid, dayTone, isDateSelectable, shiftMonth, toDateStr, type DayTone } from './datePickerGrid';

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TONE_TEXT: Record<DayTone, string> = { holiday: 'text-danger', sun: 'text-danger', sat: 'text-blue', normal: 'text-ink' };
const POPUP_W = 252;
const POPUP_H = 300;
/** 바깥 칸 너비·배치용 클래스는 감싸는 칸으로 옮겨야 입력칸 폭이 그대로 유지됨 */
const LAYOUT_CLASS = /^!?(w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-span|self-)/;

/**
 * 날짜 입력칸 — 브라우저 기본 달력 대신 주말·공휴일 색이 구분되는 달력을 띄움.
 * 실제 값은 기존 <input type="date"> 그대로라 value/onChange/react-hook-form register 를 똑같이 쓸 수 있다.
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(({ className = '', disabled, readOnly, ...rest }, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );
  const wrapClass = className.split(/\s+/).filter((c) => LAYOUT_CLASS.test(c)).join(' ');
  const locked = disabled || readOnly;
  // 터치 기기는 입력칸을 누르면 기본 달력이 떠 버리므로 직접 입력을 막고 새 달력만 쓴다
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  return (
    <span className={`relative inline-flex align-middle ${wrapClass}`}>
      <input
        ref={setRefs}
        type="date"
        disabled={disabled}
        readOnly={readOnly || touch}
        {...rest}
        onClick={(e) => {
          rest.onClick?.(e);
          if (!locked && touch) setOpen(true);
        }}
        className={`${className} !pr-8 [&::-webkit-calendar-picker-indicator]:hidden`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="달력 열기"
        disabled={locked}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-ink3 hover:bg-panel-alt hover:text-ink disabled:opacity-40"
      >
        <CalendarDays size={14} />
      </button>
      {open && <DatePopup input={inputRef} onClose={() => setOpen(false)} />}
    </span>
  );
});
DateInput.displayName = 'DateInput';

/** React 가 onChange 를 받도록 실제 입력칸 값을 바꾸고 input 이벤트를 보냄 */
function commitValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function DatePopup({ input, onClose }: { input: React.RefObject<HTMLInputElement | null>; onClose: () => void }) {
  const el = input.current;
  const value = el?.value ?? '';
  const min = el?.min || undefined;
  const max = el?.max || undefined;
  const today = toDateStr(new Date());
  const base = value || (max && today > max ? max : min && today < min ? min : today);
  const [view, setView] = useState({ year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // 화면 배율(body zoom) 안의 고정 위치라 좌표를 배율로 나눈다
  const place = useCallback(() => {
    if (!input.current) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    const r = input.current.getBoundingClientRect();
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    const left = Math.max(4, Math.min(r.left / zoom, vw - POPUP_W - 4));
    const below = r.bottom / zoom + 4;
    const top = below + POPUP_H > vh && r.top / zoom - POPUP_H - 4 > 0 ? r.top / zoom - POPUP_H - 4 : below;
    setPos({ left, top });
  }, [input]);

  useLayoutEffect(place, [place]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || input.current?.parentElement?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [input, onClose, place]);

  const { data: holidays = [] } = useHolidays(String(view.year));
  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const move = (delta: number) => setView((v) => shiftMonth(v.year, v.month, delta));
  const pick = (date: string) => {
    if (!input.current || !isDateSelectable(date, min, max)) return;
    commitValue(input.current, date);
    onClose();
  };

  if (!pos) return null;
  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label="날짜 선택"
      style={{ left: pos.left, top: pos.top, width: POPUP_W }}
      className="fixed z-[1000001] rounded-xl border border-border bg-panel p-2.5 shadow-xl"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <button type="button" aria-label="이전 달" onClick={() => move(-1)} className="grid h-7 w-7 place-items-center rounded-md text-ink2 hover:bg-panel-alt">
          <ChevronLeft size={15} />
        </button>
        <span className="text-[13px] font-bold text-ink">
          {view.year}년 {view.month}월
        </span>
        <button type="button" aria-label="다음 달" onClick={() => move(1)} className="grid h-7 w-7 place-items-center rounded-md text-ink2 hover:bg-panel-alt">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`py-1 text-[10.5px] font-bold ${i === 0 ? 'text-danger' : i === 6 ? 'text-blue' : 'text-ink3'}`}>
            {w}
          </span>
        ))}
        {cells.map((c) => {
          const selected = c.date === value;
          const enabled = isDateSelectable(c.date, min, max);
          const holidayName = holidayMap.get(c.date);
          const tone = selected ? 'text-white' : TONE_TEXT[dayTone(c.date, c.weekday, holidayMap)];
          return (
            <button
              key={c.date}
              type="button"
              title={holidayName}
              disabled={!enabled}
              onClick={() => pick(c.date)}
              className={`relative mx-auto my-px grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold ${tone} ${
                selected ? 'bg-teal' : 'hover:bg-panel-alt'
              } ${c.inMonth ? '' : 'opacity-35'} ${c.date === today && !selected ? 'ring-1 ring-teal' : ''} disabled:cursor-not-allowed disabled:opacity-20`}
            >
              {c.day}
              {holidayName && !selected && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-danger" />}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-end border-t border-border pt-1.5">
        <button
          type="button"
          disabled={!isDateSelectable(today, min, max)}
          onClick={() => pick(today)}
          className="rounded-md px-2.5 py-1 text-[11.5px] font-bold text-teal hover:bg-teal/10 disabled:opacity-40"
        >
          오늘
        </button>
      </div>
    </div>,
    document.body
  );
}
