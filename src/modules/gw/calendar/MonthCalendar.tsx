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
              <div
                key={cell.date}
                className={`min-h-28 border-b border-r border-border p-2 text-left align-top transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <button type="button" onClick={() => onSelectDate(cell.date)} aria-label={`${cell.date} 선택, 일정 ${rows.length}개`} aria-pressed={selected} className={`grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-bold focus:outline-none focus:ring-2 focus:ring-teal/40 ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</button>
                <span className="mt-1.5 block space-y-1">
                  {rows.slice(0, 3).map((event) => (
                    <button type="button" key={event.id} onClick={() => onSelectEvent(event)} title={eventLabel(event)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[8.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-teal/40 ${event.allDay ? 'bg-teal-soft/75 text-teal' : 'bg-blue/10 text-blue'}`}>
                      {eventLabel(event)}
                    </button>
                  ))}
                  {rows.length > 3 && <button type="button" onClick={() => onSelectDate(cell.date)} className="block px-1 text-[8.5px] font-bold text-ink3 hover:text-teal">+{rows.length - 3}개 더보기</button>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
