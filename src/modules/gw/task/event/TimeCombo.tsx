import { useLayoutEffect, useRef, useState } from 'react';
import { DAY_END, parseTimeInput, toHHmm } from '@/domain/workPlan/timeGrid';

/** ↑·↓ 키로 옮기는 폭(분) */
const ARROW_STEP = 15;

const clockOf = (minutes: number) => (minutes >= DAY_END ? '24:00' : toHHmm(minutes));

interface TimeComboProps {
  'aria-label': string;
  value: number | null;
  /** 고르기 목록 — label 은 목록에만 쓰고 입력칸엔 'HH:mm' 만 */
  options: Array<{ minute: number; label: string }>;
  /** 고른 값(검증은 호출부) — 직접 입력·목록·↑↓ 공용 */
  onChange: (minute: number) => void;
  /** 값이 없을 때 목록을 열면 맞출 시각 */
  anchor?: number;
  /** 근무시간 — 목록에서 진하게, 그 밖은 흐리게 */
  work: { start: number; end: number };
  placeholder?: string;
  disabled?: boolean;
  /** 터치 화면 — 글자판을 띄우지 않고 큰 목록으로만 고른다 */
  touch?: boolean;
  className?: string;
}

/**
 * 시각 고르기(입력 + 목록) — 구글 캘린더·Outlook 방식.
 * 칸을 누르면 지금 값(없으면 anchor) 위치로 스크롤된 30분 목록이 열리고, 직접 '930'·'오후 2시'처럼 쳐도 된다
 * (Enter·칸 밖 누르기 = 확정, 못 읽으면 원래 값). ↑·↓ = 15분씩.
 */
export function TimeCombo({
  'aria-label': ariaLabel,
  value,
  options,
  onChange,
  anchor,
  work,
  placeholder,
  disabled,
  touch = false,
  className = '',
}: TimeComboProps) {
  const [open, setOpen] = useState(false);
  // 입력 중인 글 — null 이면 값 그대로 보인다
  const [text, setText] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 목록을 열면 지금 값(또는 anchor)에 가장 가까운 칸을 가운데로
  useLayoutEffect(() => {
    const list = listRef.current;
    const target = value ?? anchor;
    if (!open || !list || target === undefined || options.length === 0) return;
    const nearest = options.reduce((best, o) => (Math.abs(o.minute - target) < Math.abs(best.minute - target) ? o : best));
    const el = list.querySelector<HTMLElement>(`[data-minute="${nearest.minute}"]`);
    if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
  }, [open]); // 열 때 한 번만(값이 바뀔 때마다 스크롤을 옮기지 않는다)

  const commit = () => {
    if (text === null) return;
    const minute = parseTimeInput(text);
    setText(null);
    if (minute !== null && minute !== value) onChange(minute);
  };
  const pick = (minute: number) => {
    setText(null);
    setOpen(false);
    if (minute !== value) onChange(minute);
  };

  const inWork = (minute: number) => minute >= work.start && minute <= work.end;

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="none"
        value={text ?? (value === null ? '' : clockOf(value))}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={touch}
        className="h-9 w-full rounded-md border border-border-hi bg-panel px-3 text-[13px] tabular-nums text-ink outline-none transition-colors placeholder:text-ink3 focus:border-teal disabled:bg-panel-alt"
        onFocus={(e) => {
          setOpen(true);
          if (!touch) e.target.select();
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          commit();
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            setOpen(false);
          } else if (e.key === 'Escape' && (open || text !== null)) {
            // 목록·입력만 취소한다(창의 ESC 닫기까지 가지 않게)
            e.nativeEvent.stopPropagation();
            setText(null);
            setOpen(false);
          } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && value !== null) {
            e.preventDefault();
            setText(null);
            const next = value + (e.key === 'ArrowDown' ? ARROW_STEP : -ARROW_STEP);
            onChange(Math.min(Math.max(next, 0), DAY_END));
          }
        }}
      />
      {open && !disabled && options.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={`${ariaLabel} 목록`}
          className={`absolute left-0 top-full z-30 mt-1 w-full min-w-[9.5rem] overflow-y-auto rounded-lg border border-border bg-panel py-1 shadow-lg ${
            touch ? 'max-h-72' : 'max-h-56'
          }`}
        >
          {options.map((o) => {
            const selected = o.minute === value;
            return (
              <button
                key={o.minute}
                type="button"
                role="option"
                aria-selected={selected}
                data-minute={o.minute}
                tabIndex={-1}
                // 입력칸 blur 보다 먼저 받는다
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.minute);
                }}
                className={`block w-full whitespace-nowrap px-3 text-left tabular-nums ${touch ? 'py-2.5 text-[14px]' : 'py-1.5 text-[12px]'} ${
                  selected
                    ? 'bg-blue-soft font-bold text-blue'
                    : `${inWork(o.minute) ? 'font-semibold text-ink' : 'text-ink3'} hover:bg-panel-alt`
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
