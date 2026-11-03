import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { daysBetween } from './utils';
import { useHolidays } from '@/features/holiday/useHolidays';
import { dayTone, type DayTone } from '@/shared/ui/form/datePickerGrid';

/** 달력 크기(w-72·높이 대략) — 고정 위치에서 화면 밖으로 나가지 않게 */
const POPUP_W = 288;
const POPUP_H = 330;

const TONE_TEXT: Record<DayTone, string> = { holiday: 'text-danger', sun: 'text-danger', sat: 'text-blue', normal: 'text-ink' };

interface CalendarRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  singleDateOnly?: boolean;
  /**
   * 달력을 화면에 고정해 띄운다 — 감싼 칸이 밖을 잘라도(시트 칸·가로 스크롤 영역) 달력이 보이게.
   * 기본(false)은 지금처럼 버튼 아래에 붙는다
   */
  floating?: boolean;
}

export function CalendarRangePicker({
  start,
  end,
  onChange,
  singleDateOnly = false,
  floating = false,
}: CalendarRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 고정 위치 — 화면 배율(--font-scale) 안이라 좌표를 배율로 나눈다(DateInput 과 같음). 스크롤하면 닫는다
  useLayoutEffect(() => {
    if (!floating || !open || !containerRef.current) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    const r = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    const below = r.bottom / zoom + 4;
    const top = below + POPUP_H > vh && r.top / zoom - POPUP_H - 4 > 0 ? r.top / zoom - POPUP_H - 4 : below;
    setPos({ left: Math.max(4, Math.min(r.left / zoom, vw - POPUP_W - 4)), top });
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [floating, open]);

  const [currentDate, setCurrentDate] = useState(() => {
    const initial = start ? new Date(start) : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [start]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDateClick = (dateStr: string) => {
    if (singleDateOnly) {
      onChange(dateStr, dateStr);
      setOpen(false);
      return;
    }
    if (!start || (start && end)) {
      onChange(dateStr, '');
    } else {
      if (dateStr < start) {
        onChange(dateStr, '');
      } else {
        onChange(start, dateStr);
        setOpen(false);
      }
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dateItems: { dateStr: string; day: number; currentMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, prevMonthDays - i);
    const yStr = prevDate.getFullYear();
    const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(prevDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: prevMonthDays - i,
      currentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    dateItems.push({
      dateStr: `${year}-${mStr}-${dStr}`,
      day: i,
      currentMonth: true,
    });
  }

  const remaining = 42 - dateItems.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(nextDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: i,
      currentMonth: false,
    });
  }

  const daysLabel = start && end ? daysBetween(start, end) : 0;
  const { data: holidays = [] } = useHolidays(String(year));
  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-left text-[12.5px] text-ink outline-none focus:border-teal flex justify-between items-center hover:bg-panel-alt/80 transition-colors"
      >
        <span>
          {start
            ? singleDateOnly
              ? start
              : `${start} ~ ${end || '종료일 선택'}${daysLabel > 0 ? ` (${daysLabel}일)` : ''}`
            : singleDateOnly
              ? '날짜를 선택하세요'
              : '기간을 선택하세요'}
        </span>
        <Calendar size={14} className="text-ink3" />
      </button>

      {open && (
        <div
          className={`${floating ? 'fixed z-[400]' : 'absolute left-0 mt-1 z-50'} w-72 rounded-xl border border-border bg-panel p-3 shadow-xl`}
          style={floating ? { left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' } : undefined}
        >
          <div className="flex justify-between items-center mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ◀
            </button>
            <span className="text-[12.5px] font-bold text-ink">
              {year}년 {month + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[10.5px] font-bold text-ink3 mb-1.5">
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <span key={w} className={w === '일' ? 'text-danger' : w === '토' ? 'text-blue' : undefined}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11.5px]">
            {dateItems.map((item, idx) => {
              const { dateStr, day, currentMonth } = item;
              const isStart = start === dateStr;
              const isEnd = !singleDateOnly && end === dateStr;
              const isWithinRange = !singleDateOnly && start && end && dateStr >= start && dateStr <= end;

              let btnClass = 'h-8 w-8 mx-auto grid place-items-center rounded-lg transition-all ';
              // 일요일·공휴일 빨강, 토요일 파랑
              if (!isStart && !isEnd && !isWithinRange) btnClass += `${TONE_TEXT[dayTone(dateStr, idx % 7, holidayMap)]} `;
              if (!currentMonth) btnClass += 'opacity-35 ';

              if (isStart || isEnd) {
                btnClass += 'bg-teal text-white font-bold ';
              } else if (isWithinRange) {
                btnClass += 'bg-teal-soft/75 text-teal font-medium ';
              } else if (currentMonth) {
                btnClass += 'hover:bg-panel-alt ';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  title={holidayMap.get(dateStr)}
                  onClick={() => handleDateClick(dateStr)}
                  className={btnClass}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
