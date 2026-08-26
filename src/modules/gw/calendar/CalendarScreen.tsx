import { useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { buildCalendarMonth, calendarToday, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import { resolveDeptId } from '@/domain/department/engine';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useDepartments } from '@/features/department/useDepartments';
import { useProjects } from '@/features/project/useProjects';
import { useUsers } from '@/features/user/useUsers';
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import CalendarEventModal from './CalendarEventModal';
import MonthCalendar from './MonthCalendar';

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}년 ${monthNumber}월`;
}

/** 목록 모달 제목. 요일은 UTC로 뽑는다 — 달력 격자를 만드는 방식과 같아야 하루가 밀리지 않는다. */
function dayTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

function scheduleTime(event: { allDay: boolean; startTime: string | null; endTime: string | null }): string {
  return event.allDay ? '종일' : `${event.startTime} ~ ${event.endTime}`;
}

function LocalCalendarScreen() {
  const { user: authenticatedUser, loading: authLoading } = useAuth();
  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  /** 목록 모달을 띄운 날짜. 닫혀 있으면 null. */
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  const [demoUserId, setDemoUserId] = useState('U009');
  const [modalTarget, setModalTarget] = useState<{ date: string; event?: CalendarEvent } | null>(null);
  const [notice, setNotice] = useState('');
  const usersQuery = useUsers();
  const users = usersQuery.data ?? [];
  const actor = authenticatedUser
    ?? users.find((user) => user.id === demoUserId)
    ?? users.find((user) => user.status === '사용')
    ?? null;
  /*
    공유 판정에 쓸 소속 정보.

    `user.dept`는 부서 ID가 아니라 이름이라 부서 목록으로 옮겨야 한다(`resolveDeptId`).
    프로젝트는 **참여 중인 것만** 모은다 — `useProjects`는 전사 공개 프로젝트까지 돌려주는데,
    그것까지 넣으면 참여하지도 않은 프로젝트의 일정이 보이게 된다.
  */
  const departmentsQuery = useDepartments();
  const deptId = useMemo(
    () => resolveDeptId(departmentsQuery.data ?? [], actor?.dept),
    [departmentsQuery.data, actor],
  );

  const projectAccess = useMemo<ProjectAccessContext>(() => ({
    userId: actor?.id ?? '__anonymous__',
    deptId,
    active: actor?.status === '사용',
  }), [actor, deptId]);
  const projectsQuery = useProjects(projectAccess);
  const myProjects = useMemo(() => {
    const userId = actor?.id ?? '';
    return (projectsQuery.data ?? []).filter(
      (project) => project.ownerUserId === userId || project.memberUserIds.includes(userId),
    );
  }, [projectsQuery.data, actor]);

  const access = useMemo<CalendarEventActor>(() => ({
    userId: actor?.id ?? '__anonymous__',
    deptId,
    projectIds: myProjects.map((project) => project.id),
    active: actor?.status === '사용',
  }), [actor, deptId, myProjects]);
  /** 공유받은 일정의 주인 이름. 내 일정이면 null이라 화면이 아무것도 덧붙이지 않는다. */
  const ownerNameOf = (event?: CalendarEvent): string | null => {
    if (!event || event.ownerUserId === (actor?.id ?? '')) return null;
    return users.find((user) => user.id === event.ownerUserId)?.name ?? '다른 사용자';
  };

  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);
  const eventsQuery = useCalendarEvents(access, range);
  const events = eventsQuery.data ?? [];
  const dayEvents = dayListDate ? events.filter((event) => event.date === dayListDate) : [];
  const loading = authLoading || usersQuery.isLoading || eventsQuery.isLoading;
  const queryError = usersQuery.error ?? eventsQuery.error;

  /** 등록·수정 모달로 넘어간다. 목록 모달은 겹치지 않게 닫는다. */
  const openEventModal = (target: { date: string; event?: CalendarEvent }) => {
    setDayListDate(null);
    setModalTarget(target);
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

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-sm">
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
        <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
        <h2 className="ml-1 text-[16px] font-extrabold text-ink">{monthLabel(month)}</h2>
        <span className="ml-auto text-[10px] font-semibold text-ink3">날짜를 누르면 그 날 일정을 봅니다 · 칸 위에 마우스를 올리면 <span className="font-bold text-ink2">+</span> 로 바로 등록</span>
      </div>

      <div className="mt-4">
        <MonthCalendar
          month={month}
          today={today}
          events={events}
          onOpenDay={(date) => setDayListDate(date)}
          onAddOn={(date) => openEventModal({ date })}
          onSelectEvent={(event) => openEventModal({ date: event.date, event })}
        />
      </div>

      {/* 그 날 일정 전체. 칸 안 미리보기는 3개까지라 나머지는 여기서 본다. */}
      {dayListDate && (
        <Modal
          open
          onClose={() => setDayListDate(null)}
          title={dayTitle(dayListDate)}
          width={460}
          footer={(
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold text-ink3">일정 {dayEvents.length}개</span>
              <div className="flex items-center gap-1.5">
                <Button onClick={() => setDayListDate(null)}>닫기</Button>
                <Button variant="primary" onClick={() => openEventModal({ date: dayListDate })}>+ 일정 추가</Button>
              </div>
            </div>
          )}
        >
          {dayEvents.length === 0 ? (
            <div className="py-8 text-center text-[11px] font-semibold text-ink3">등록된 일정이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((event) => {
                const owner = ownerNameOf(event);
                return (
                  <button type="button" key={event.id} onClick={() => openEventModal({ date: event.date, event })} className="block w-full rounded-lg border border-border px-3 py-2.5 text-left hover:border-teal/35 hover:bg-teal-soft/15 focus:outline-none focus:ring-2 focus:ring-teal/30">
                    <div className="flex items-center justify-between gap-3"><div className="truncate text-[11.5px] font-bold text-ink">{event.title}</div><span className="shrink-0 text-[10px] font-semibold text-teal">{scheduleTime(event)}</span></div>
                    {/* 공유받은 일정은 누구 것인지 밝힌다. 내 일정과 섞이면 왜 못 고치는지 알 수 없다. */}
                    {owner && <div className="mt-1 text-[10px] font-semibold text-ink3">공유 · {owner}</div>}
                    {event.memo && <p className="mt-1 line-clamp-2 text-[10px] text-ink3">{event.memo}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {modalTarget && (
        <CalendarEventModal
          key={modalTarget.event?.id ?? `new-${modalTarget.date}`}
          actor={access}
          initialDate={modalTarget.date}
          event={modalTarget.event}
          myProjects={myProjects}
          deptName={actor?.dept ?? null}
          ownerName={ownerNameOf(modalTarget.event)}
          onClose={() => setModalTarget(null)}
          onSaved={(saved) => {
            setModalTarget(null);
            setMonth(saved.date.slice(0, 7));
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
