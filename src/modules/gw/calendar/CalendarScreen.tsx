import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { buildCalendarMonth, calendarToday, isValidCalendarDate, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import { isMaskedForSupervisor, resolveCalendarSupervisor } from '@/domain/calendarEvent/engine';
import { resolveDeptId } from '@/domain/department/engine';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { useCalendarEvents, useTeamCalendarEvents } from '@/features/calendar/useCalendarEvents';
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

/** 부서 필터의 "전체" 값. 실제 부서명과 충돌하지 않는 형태로 둔다. */
const ALL_DEPTS = '__ALL__';

function LocalCalendarScreen() {
  const { user: authenticatedUser, loading: authLoading } = useAuth();
  const today = calendarToday();
  const [searchParams, setSearchParams] = useSearchParams();
  /*
    알림(`/gw/calendar?date=2026-08-26`)에서 들어온 진입점. 있으면 그 달을 열고 목록
    모달도 바로 띄운다 — 없으면(직접 메뉴로 들어온 보통 경우) 오늘 달을 그대로 연다.
    쿼리는 한 번 읽은 뒤 지운다 — 남아 있으면 "오늘" 버튼을 눌러도 계속 그 날짜로
    돌아오는 것처럼 보인다.
  */
  const linkedDate = searchParams.get('date');
  const initialDate = linkedDate && isValidCalendarDate(linkedDate) ? linkedDate : null;
  const [month, setMonth] = useState((initialDate ?? today).slice(0, 7));
  /** 목록 모달을 띄운 날짜. 닫혀 있으면 null. */
  const [dayListDate, setDayListDate] = useState<string | null>(initialDate);

  /*
    읽고 나면 지운다 — 안 지우면 주소창에 남아 "오늘"을 눌러도 다시 이 날짜로 보인다.
    마운트 시 1회만 확인하면 된다 — 이후 달력 안 조작(달 이동·모달 열기)은 이 쿼리와 무관하다.
  */
  useEffect(() => {
    if (searchParams.has('date')) setSearchParams((prev) => { prev.delete('date'); return prev; }, { replace: true });
  }, [searchParams, setSearchParams]);
  const [demoUserId, setDemoUserId] = useState('U009');
  const [modalTarget, setModalTarget] = useState<{ date: string; event?: CalendarEvent } | null>(null);
  const [notice, setNotice] = useState('');
  /** 내 일정 / 팀 일정. 열람 범위가 없으면 아래에서 내 일정으로 고정된다. */
  const [tab, setTab] = useState<'me' | 'team'>('me');
  /** 팀 일정의 부서 필터. ALL_DEPTS면 범위 전체(관리자는 전 직원, 팀장은 맡은 부서 전부). */
  const [teamDeptSel, setTeamDeptSel] = useState(ALL_DEPTS);
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

  /*
    관리자 종합 조회(팀 일정) 범위.

    판정은 도메인 `resolveCalendarSupervisor` 한 곳이다 — 경영진·지정 인원은 전 직원,
    부서장(팀장)은 맡은 부서만, 그 외에는 탭 자체가 안 보인다. 화면은 범위를 부서 필터와
    소유자 목록으로 옮기기만 한다. 남의 '나만 보기' 일정은 repo가 제목·메모를 가려서 준다.
  */
  const supervisorScope = useMemo(
    () => (actor ? resolveCalendarSupervisor(actor, departmentsQuery.data ?? []) : null),
    [actor, departmentsQuery.data],
  );
  const activeTab = supervisorScope ? tab : 'me';
  const isTeam = activeTab === 'team';

  /** 팀 일정의 부서 필터 선택지. 관리자는 전 부서, 팀장은 맡은 부서만. */
  const teamDeptOptions = useMemo(() => {
    if (!supervisorScope) return [];
    if (supervisorScope.kind === 'depts') return supervisorScope.deptNames;
    return (departmentsQuery.data ?? []).map((dept) => dept.name);
  }, [supervisorScope, departmentsQuery.data]);

  /** 팀 일정의 소유자 목록. null = 전 직원(관리자가 '전체 부서'를 본 경우). */
  const teamOwners = useMemo<string[] | null>(() => {
    if (!supervisorScope) return [];
    const deptNames = teamDeptSel === ALL_DEPTS
      ? (supervisorScope.kind === 'depts' ? supervisorScope.deptNames : null)
      : [teamDeptSel];
    if (deptNames === null) return null;
    return users.filter((user) => deptNames.includes(user.dept)).map((user) => user.id);
  }, [supervisorScope, teamDeptSel, users]);

  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);
  const eventsQuery = useCalendarEvents(access, range);
  const teamViewer = useMemo(
    () => ({ userId: actor?.id ?? '__anonymous__', active: actor?.status === '사용' }),
    [actor],
  );
  const teamQuery = useTeamCalendarEvents(teamViewer, teamOwners, range, isTeam && actor !== null);
  const events = eventsQuery.data ?? [];
  /** 지금 탭이 그리는 일정. 달력 격자·날짜 모달이 같은 원천을 쓴다. */
  const visibleEvents = isTeam ? (teamQuery.data ?? []) : events;
  const dayEvents = dayListDate ? visibleEvents.filter((event) => event.date === dayListDate) : [];
  const loading = authLoading || usersQuery.isLoading || eventsQuery.isLoading;
  const queryError = usersQuery.error ?? eventsQuery.error ?? (isTeam ? teamQuery.error : undefined);

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
        right={(
          <div className="flex items-center gap-2">
            {!authenticatedUser && (
              <select value={actor.id} onChange={(event) => { setDemoUserId(event.target.value); setModalTarget(null); setTab('me'); }} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
                {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            )}
            {/* 팀 일정 탭은 볼 수 있는 사람에게만 보인다 — 없는 권한을 눌러 보게 두지 않는다. */}
            {supervisorScope && (
              <div className="flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5">
                {([['me', '내 일정'], ['team', '팀 일정']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${activeTab === key ? 'bg-teal text-white' : 'text-ink3 hover:text-ink2'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-sm">
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
        <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
        <h2 className="ml-1 text-[16px] font-extrabold text-ink">{monthLabel(month)}{isTeam ? ' · 팀 일정' : ''}</h2>
        {isTeam && (
          <>
            {/* 부서 필터. 팀장이 맡은 부서가 하나면 고를 게 없어 라벨만 보여 준다. */}
            {supervisorScope?.kind === 'depts' && supervisorScope.deptNames.length === 1 ? (
              <span className="rounded-lg border border-teal/25 bg-teal-soft/25 px-2.5 py-1.5 text-[10.5px] font-bold text-teal">{supervisorScope.deptNames[0]}</span>
            ) : (
              <select
                value={teamDeptSel}
                onChange={(event) => setTeamDeptSel(event.target.value)}
                title="부서 선택"
                className="h-8 rounded-lg border border-border bg-panel px-2.5 text-[10.5px] font-bold text-ink outline-none"
              >
                <option value={ALL_DEPTS}>{supervisorScope?.kind === 'all' ? '전체 부서' : '내 부서 전체'}</option>
                {teamDeptOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <span className="text-[10px] font-semibold text-ink3">
              열람 범위 · {supervisorScope?.kind === 'all' ? '전 직원' : supervisorScope?.deptNames.join(' · ')}
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] font-semibold text-ink3">
          {isTeam
            ? <>남의 <span className="font-bold text-ink2">나만 보기</span> 일정은 시간만 보이고 내용은 가려집니다</>
            : <>날짜를 누르면 그 날 일정을 봅니다 · 칸 위에 마우스를 올리면 <span className="font-bold text-ink2">+</span> 로 바로 등록</>}
        </span>
      </div>

      <div className="mt-4">
        <MonthCalendar
          month={month}
          today={today}
          events={visibleEvents}
          onOpenDay={(date) => setDayListDate(date)}
          onAddOn={(date) => openEventModal({ date })}
          onSelectEvent={(event) => {
            // 가린 일정은 열 것이 없다 — 제목·메모가 이미 비워져 있어 모달이 빈 껍데기가 된다.
            if (isTeam && isMaskedForSupervisor(actor.id, event)) return;
            openEventModal({ date: event.date, event });
          }}
          ownerNameOf={isTeam ? (event) => ownerNameOf(event) : undefined}
          isMutedChip={isTeam ? (event) => isMaskedForSupervisor(actor.id, event) : undefined}
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
                const masked = isTeam && isMaskedForSupervisor(actor.id, event);
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-3"><div className={`truncate text-[11.5px] font-bold ${masked ? 'text-ink3' : 'text-ink'}`}>{event.title}</div><span className="shrink-0 text-[10px] font-semibold text-teal">{scheduleTime(event)}</span></div>
                    {/* 팀 일정은 소유자를, 내 일정은 공유받은 것만 누구 것인지 밝힌다. */}
                    {owner && <div className="mt-1 text-[10px] font-semibold text-ink3">{isTeam ? owner : `공유 · ${owner}`}</div>}
                    {event.memo && <p className="mt-1 line-clamp-2 text-[10px] text-ink3">{event.memo}</p>}
                  </>
                );
                /* 가린 일정은 열어도 빈 껍데기라 클릭 대상에서 뺀다. */
                if (masked) {
                  return <div key={event.id} className="block w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-left">{body}</div>;
                }
                return (
                  <button type="button" key={event.id} onClick={() => openEventModal({ date: event.date, event })} className="block w-full rounded-lg border border-border px-3 py-2.5 text-left hover:border-teal/35 hover:bg-teal-soft/15 focus:outline-none focus:ring-2 focus:ring-teal/30">
                    {body}
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
