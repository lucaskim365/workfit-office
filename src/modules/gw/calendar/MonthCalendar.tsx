import { useMemo } from 'react';
import { buildCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';

interface MonthCalendarProps {
  month: string;
  selectedDate: string;
  today: string;
  events: CalendarEvent[];
  onSelectDate: (date: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function eventLabel(event: CalendarEvent): string {
  return event.allDay ? event.title : `${event.startTime} ${event.title}`;
}

export default function MonthCalendar({ month, selectedDate, today, events, onSelectDate, onSelectEvent }: MonthCalendarProps) {
  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const eventsByDate = useMemo(() => {
    const rows = new Map<string, CalendarEvent[]>();
    events.forEach((event) => rows.set(event.date, [...(rows.get(event.date) ?? []), event]));
    return rows;
  }, [events]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-border bg-panel-alt/65">
          {WEEKDAYS.map((day, index) => (
            <div key={day} className={`px-2 py-2.5 text-center text-[10px] font-bold ${index === 5 ? 'text-blue' : index === 6 ? 'text-danger' : 'text-ink3'}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            const rows = eventsByDate.get(cell.date) ?? [];
            const selected = cell.date === selectedDate;
            const isToday = cell.date === today;
            return (
              /*
                셀 전체가 클릭 대상이다. 예전에는 24px짜리 날짜 숫자 동그라미에만 핸들러가
                있어서, 사용자가 칸의 빈 곳을 눌러도 아무 일이 없었다 — 달력에서 날짜를
                고르는 자연스러운 동작이 먹히지 않는다. 키보드 접근은 안쪽 날짜 버튼이
                그대로 담당한다(클릭이 여기로 버블링된다).
              */
              <div
                key={cell.date}
                onClick={() => onSelectDate(cell.date)}
                className={`min-h-28 cursor-pointer border-b border-r border-border p-2 text-left align-top transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <button type="button" aria-label={`${cell.date} 선택, 일정 ${rows.length}개`} aria-pressed={selected} className={`grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-bold focus:outline-none focus:ring-2 focus:ring-teal/40 ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</button>
                <span className="mt-1.5 block space-y-1">
                  {rows.slice(0, 3).map((event) => (
                    /* 일정 칩은 상세를 연다. 셀 선택까지 겹쳐 일어나지 않게 전파를 끊는다. */
                    <button type="button" key={event.id} onClick={(clicked) => { clicked.stopPropagation(); onSelectEvent(event); }} title={eventLabel(event)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[8.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-teal/40 ${event.allDay ? 'bg-teal-soft/75 text-teal' : 'bg-blue/10 text-blue'}`}>
                      {eventLabel(event)}
                    </button>
                  ))}
                  {rows.length > 3 && <button type="button" className="block px-1 text-[8.5px] font-bold text-ink3 hover:text-teal">+{rows.length - 3}개 더보기</button>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
