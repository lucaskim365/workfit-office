import { useState, useRef, useEffect } from 'react';
import { daysBetween } from './utils';

interface CalendarRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

export function CalendarRangePicker({
  start,
  end,
  onChange,
}: CalendarRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-left text-[12.5px] text-ink outline-none focus:border-teal flex justify-between items-center hover:bg-panel-alt/80 transition-colors"
      >
        <span>
          {start
            ? `${start} ~ ${end || '종료일 선택'}${daysLabel > 0 ? ` (${daysLabel}일)` : ''}`
            : '기간을 선택하세요'}
        </span>
        <span className="text-ink3 text-xs">📅</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 z-50 w-72 rounded-xl border border-border bg-panel p-3 shadow-xl">
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
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11.5px]">
            {dateItems.map((item, idx) => {
              const { dateStr, day, currentMonth } = item;
              const isStart = start === dateStr;
              const isEnd = end === dateStr;
              const isWithinRange = start && end && dateStr >= start && dateStr <= end;

              let btnClass = 'h-8 w-8 mx-auto grid place-items-center rounded-lg transition-all ';
              if (!currentMonth) {
                btnClass += 'text-ink3/40 ';
              } else {
                btnClass += 'text-ink ';
              }

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
