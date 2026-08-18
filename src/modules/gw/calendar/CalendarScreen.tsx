import { useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { buildCalendarMonth, calendarToday, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useUsers } from '@/features/user/useUsers';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import CalendarEventModal from './CalendarEventModal';
import MonthCalendar from './MonthCalendar';

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}년 ${monthNumber}월`;
}

function scheduleTime(event: { allDay: boolean; startTime: string | null; endTime: string | null }): string {
  return event.allDay ? '종일' : `${event.startTime} ~ ${event.endTime}`;
}

function LocalCalendarScreen() {
  const { user: authenticatedUser, loading: authLoading } = useAuth();
  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [demoUserId, setDemoUserId] = useState('U009');
  const [modalTarget, setModalTarget] = useState<{ date: string; event?: CalendarEvent } | null>(null);
  const [notice, setNotice] = useState('');
  const usersQuery = useUsers();
  const users = usersQuery.data ?? [];
  const actor = authenticatedUser
    ?? users.find((user) => user.id === demoUserId)
    ?? users.find((user) => user.status === '사용')
    ?? null;
  const access = useMemo<CalendarEventActor>(() => ({
    userId: actor?.id ?? '__anonymous__',
    active: actor?.status === '사용',
  }), [actor]);
  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);
  const eventsQuery = useCalendarEvents(access, range);
  const events = eventsQuery.data ?? [];
  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const loading = authLoading || usersQuery.isLoading || eventsQuery.isLoading;
  const queryError = usersQuery.error ?? eventsQuery.error;

  const selectDate = (date: string) => {
    setSelectedDate(date);
    if (!date.startsWith(`${month}-`)) setMonth(date.slice(0, 7));
  };

  const showToday = () => {
    setMonth(today.slice(0, 7));
    setSelectedDate(today);
  };

  const moveMonth = (amount: number) => {
    const next = moveCalendarMonth(month, amount);
    setMonth(next);
    setSelectedDate(`${next}-01`);
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">일정을 불러오는 중…</div>;
  if (queryError) return <div className="grid min-h-[60vh] place-items-center px-5 text-center text-[12px] font-semibold text-danger">일정을 불러오지 못했습니다.<br />{queryError instanceof Error ? queryError.message : ''}</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="📅"
        name="일정관리"
        right={!authenticatedUser ? (
          <select value={actor.id} onChange={(event) => { setDemoUserId(event.target.value); setModalTarget(null); }} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
            {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        ) : undefined}
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      <GwSplit
        nav={(
          <GwSideNav title="내 달력" desc="개인 일정을 등록하고 관리합니다.">
            <Button variant="primary" block onClick={() => setModalTarget({ date: selectedDate })}>+ 일정 등록</Button>
            <div>
              <div className="border-b border-border pb-2 text-[11px] font-bold text-ink2">{selectedDate} 일정 {selectedEvents.length}개</div>
              {selectedEvents.length === 0 ? (
                <div className="py-6 text-center text-[10.5px] font-semibold text-ink3">등록된 일정이 없습니다.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedEvents.map((event) => (
                    <button type="button" key={event.id} onClick={() => setModalTarget({ date: event.date, event })} className="block w-full rounded-lg border border-border px-3 py-2.5 text-left hover:border-teal/35 hover:bg-teal-soft/15 focus:outline-none focus:ring-2 focus:ring-teal/30">
                      <div className="flex items-center justify-between gap-3"><div className="truncate text-[11px] font-bold text-ink">{event.title}</div><span className="shrink-0 text-[9.5px] font-semibold text-teal">{scheduleTime(event)}</span></div>
                      {event.memo && <p className="mt-1 line-clamp-2 text-[9.5px] text-ink3">{event.memo}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </GwSideNav>
        )}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-sm">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
          <Button size="sm" onClick={showToday}>오늘</Button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
          <h2 className="ml-1 text-[16px] font-extrabold text-ink">{monthLabel(month)}</h2>
        </div>

        <div className="mt-4"><MonthCalendar month={month} selectedDate={selectedDate} today={today} events={events} onSelectDate={selectDate} onSelectEvent={(event) => setModalTarget({ date: event.date, event })} /></div>
      </GwSplit>

      {modalTarget && (
        <CalendarEventModal
          key={modalTarget.event?.id ?? `new-${modalTarget.date}`}
          actor={access}
          initialDate={modalTarget.date}
          event={modalTarget.event}
          onClose={() => setModalTarget(null)}
          onSaved={(saved) => {
            setModalTarget(null);
            setMonth(saved.date.slice(0, 7));
            setSelectedDate(saved.date);
            setNotice(`‘${saved.title}’ 일정을 저장했습니다.`);
          }}
          onRemoved={(removed) => {
            setModalTarget(null);
            setNotice(`‘${removed.title}’ 일정을 삭제했습니다.`);
          }}
        />
      )}
    </div>
  );
}

export default function CalendarScreen() {
  return <LocalCalendarScreen />;
}
