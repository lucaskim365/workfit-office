import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ExternalLink,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useProjects } from '@/features/project/useProjects';
import { CALENDAR_EVENT_TYPE_LABELS, type CalendarEvent } from '@/domain/calendarEvent/schema';
import { isOfficialCalendarEvent } from '@/domain/calendarEvent/engine';
import MobileCommonHeader from './MobileCommonHeader';
import CalendarEventModal from '@/modules/gw/calendar/CalendarEventModal';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useUsers } from '@/features/user/useUsers';
import { useOutsideWorks } from '@/features/outsideWork/useOutsideWorks';
import { useDepartments } from '@/features/department/useDepartments';
import { resolveDeptId } from '@/domain/department/engine';
import { usePermission } from '@/features/auth/usePermission';
import { buildScheduleEvents } from '@/domain/calendarEvent/scheduleEvents';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import type { OutsideWork } from '@/domain/outsideWork/schema';
import { OutsideWorkDetailModal } from '@/modules/gw/outsideWork/OutsideWorkDetailModal';
import { OutsideWorkFormModal } from '@/modules/gw/outsideWork/OutsideWorkFormModal';
import { buildCalendarMonth, calendarToday, moveCalendarMonth, isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import { useHolidays } from '@/features/holiday/useHolidays';
import { useCompanyImportantByDate } from '@/features/workPlan/useCompanyImportant';
import { useMyWorkPlans, useUpdateWorkPlan } from '@/features/workPlan/useWorkPlans';
import { useWorkPlanConfig } from '@/features/workPlan/useWorkPlanConfig';
import { calculatePlanProgress, getWorkPlanTagMeta, parseWorkPlanItems, toggleWorkPlanItem } from '@/domain/workPlan/engine';
import { WorkPlanInlineText } from '@/modules/gw/task/components/WorkPlanInlineText';
import { PERSON_TONES } from '@/shared/theme/statusColors';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function MobileCalendarScreen() {
  const { user } = useAuth();
  const me = user?.id || '';

  const todayStr = useMemo(() => calendarToday(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedDate = searchParams.get('date');
  const initialDate = linkedDate && isValidCalendarDate(linkedDate) ? linkedDate : todayStr;
  const [selectedDateStr, setSelectedDateStr] = useState<string>(initialDate);
  const [currentMonth, setCurrentMonth] = useState<string>(() => initialDate.slice(0, 7));

  // 처음 진입할 때뿐 아니라 이미 열린 달력의 알림도 해당 날짜로 이동한다.
  useEffect(() => {
    if (!searchParams.has('date')) return;
    if (linkedDate && isValidCalendarDate(linkedDate)) {
      setSelectedDateStr(linkedDate);
      setCurrentMonth(linkedDate.slice(0, 7));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('date');
    setSearchParams(next, { replace: true });
  }, [linkedDate, searchParams, setSearchParams]);

  // 일정 등록 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>(undefined);

  /** 사내행사 등록 권한 — 웹과 같이 캘린더에서 직접 등록하는 건 사내행사뿐이다. 회의는 업무계획에서 등록한다. */
  const { isOperator, isExecutive } = usePermission();
  const canManageCompanyEvent = isOperator || isExecutive;

  const usersQuery = useUsers();
  const users = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.status === '사용' && !u.resignedAt),
    [usersQuery.data],
  );
  const activeUserIdSet = useMemo(() => new Set(users.map((u) => u.id)), [users]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  /*
    공유 판정에 쓸 소속 정보 (웹 캘린더와 같다).
    user.dept는 부서 이름이라 부서 ID로 옮기고, 프로젝트는 참여 중인 것만 모은다.
  */
  const departmentsQuery = useDepartments();
  const deptId = useMemo(() => resolveDeptId(departmentsQuery.data ?? [], user?.dept), [departmentsQuery.data, user?.dept]);
  const projectsQuery = useProjects({ userId: me, deptId, active: user?.status === '사용' });
  const myProjects = useMemo(
    () => (projectsQuery.data ?? []).filter((p) => p.ownerUserId === me || p.memberUserIds.includes(me)),
    [projectsQuery.data, me],
  );
  const access = useMemo<CalendarEventActor>(() => ({
    userId: me || '__anonymous__',
    deptId,
    projectIds: myProjects.map((p) => p.id),
    active: user?.status === '사용',
  }), [me, deptId, myProjects, user?.status]);

  // 1. 캘린더 일정
  const eventsQuery = useCalendarEvents(access);
  const baseEvents = eventsQuery.data ?? [];

  // 2. 전자결재 승인 일정(휴가·외근·출장) + 결재 없이 직접 등록한 외근·출장
  const approvalsQuery = useAllApprovals();
  const outsideWorksQuery = useOutsideWorks();
  const { scheduleEvents, outsideViewByEventId } = useMemo(
    () => buildScheduleEvents(approvalsQuery.data ?? [], outsideWorksQuery.data ?? [], userMap, activeUserIdSet),
    [approvalsQuery.data, outsideWorksQuery.data, userMap, activeUserIdSet],
  );
  const [outsideDetail, setOutsideDetail] = useState<OutsideScheduleView | null>(null);
  const [outsideEdit, setOutsideEdit] = useState<OutsideWork | null>(null);

  const allEvents = useMemo(() => {
    return [...baseEvents, ...scheduleEvents]
      .filter(isOfficialCalendarEvent)
      .filter((event) => {
        if (event.eventType === 'COMPANY_EVENT' || event.visibility === 'COMPANY') return true;
        return activeUserIdSet.has(event.ownerUserId);
      });
  }, [baseEvents, scheduleEvents, activeUserIdSet]);

  /** 일정을 누르면: 외근·출장은 상세 창, 나머지는 일정 창(결재 일정·남의 일정은 보기 전용) */
  const openEvent = (evt: CalendarEvent) => {
    const outside = outsideViewByEventId.get(evt.id);
    if (outside) {
      setOutsideDetail(outside);
      return;
    }
    setSelectedEvent(evt);
    setIsModalOpen(true);
  };

  /** 공유받은 일정의 주인 이름과 직급. 내 일정이면 null. */
  const ownerNameOf = (event?: CalendarEvent): string | null => {
    if (!event || event.ownerUserId === me) return null;
    const owner = userMap.get(event.ownerUserId);
    if (!owner) return '다른 사용자';
    return owner.position ? `${owner.name} ${owner.position}` : owner.name;
  };

  // 날짜별 이벤트 맵 (캘린더 셀 Dot 표기용)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of allEvents) {
      const list = map.get(evt.date) ?? [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return map;
  }, [allEvents]);

  // 42개 월간 달력 셀 생성
  const monthCells = useMemo(() => {
    try {
      return buildCalendarMonth(currentMonth);
    } catch {
      return [];
    }
  }, [currentMonth]);

  // 업무계획의 전사 공통 중요 일정 — 화면에 보이는 42칸 범위 (웹과 같은 원천)
  const monthRange = useMemo(
    () => (monthCells.length ? { from: monthCells[0].date, to: monthCells[monthCells.length - 1].date } : undefined),
    [monthCells],
  );
  const importantByDate = useCompanyImportantByDate(monthRange);

  // 공휴일 데이터 (현재 월 기준 연도)
  const holidaysQuery = useHolidays(currentMonth.slice(0, 4));
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    (holidaysQuery.data ?? []).forEach((h) => map.set(h.date, h.name));
    return map;
  }, [holidaysQuery.data]);

  // 선택한 날의 내 업무계획(할 일) — 웹 캘린더와 같이 여기서 바로 완료 체크
  const workActor = useMemo(() => ({ userId: me || '__anonymous__', active: user?.status === '사용' }), [me, user?.status]);
  const myWorkPlansQuery = useMyWorkPlans(workActor, monthRange);
  const updateWorkPlan = useUpdateWorkPlan();
  const { tagMap } = useWorkPlanConfig();
  const selectedPlan = useMemo(
    () => (myWorkPlansQuery.data ?? []).find((plan) => plan.date === selectedDateStr),
    [myWorkPlansQuery.data, selectedDateStr],
  );
  const selectedTodos = useMemo(() => (selectedPlan ? parseWorkPlanItems(selectedPlan.content) : []), [selectedPlan]);
  const selectedProgress = useMemo(() => (selectedPlan ? calculatePlanProgress(selectedPlan.content) : null), [selectedPlan]);
  const handleToggleTodo = async (idx: number) => {
    if (!selectedPlan || updateWorkPlan.isPending) return;
    await updateWorkPlan.mutateAsync({
      actor: workActor,
      id: selectedPlan.id,
      draft: { date: selectedPlan.date, content: toggleWorkPlanItem(selectedPlan.content, idx) },
    });
  };

  const selectedHoliday = holidayMap.get(selectedDateStr);
  const selectedImportant = importantByDate.get(selectedDateStr);

  // 선택된 날짜의 이벤트 목록 (시간순 정렬)
  const dayEvents = useMemo(() => {
    return allEvents
      .filter((e) => e.date === selectedDateStr)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
      });
  }, [allEvents, selectedDateStr]);

  // 월 이동 핸들러
  const handlePrevMonth = () => setCurrentMonth((prev) => moveCalendarMonth(prev, -1));
  const handleNextMonth = () => setCurrentMonth((prev) => moveCalendarMonth(prev, 1));
  const handleToday = () => {
    setSelectedDateStr(todayStr);
    setCurrentMonth(todayStr.slice(0, 7));
  };

  // 선택된 날짜 레이블 (예: 2026년 9월 17일 (목))
  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const parts = selectedDateStr.split('-');
    if (parts.length < 3) return selectedDateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일 (${dayName})`;
  }, [selectedDateStr]);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader
        title="캘린더"
        subtitle={selectedDateLabel}
        rightAction={canManageCompanyEvent && (
          <button
            type="button"
            onClick={() => {
              setSelectedEvent(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 rounded-xl bg-teal px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={13} />
            <span>사내행사</span>
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5">
        {/* 1. 월간 캘린더 카드 */}
        <div className="rounded-2xl border border-border/80 bg-white p-3 shadow-xs space-y-2">
          {/* 달력 헤더: 월 이동 및 오늘 버튼 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-ink">
                {currentMonth.slice(0, 4)}년 {parseInt(currentMonth.slice(5, 7), 10)}월
              </span>
              <button
                type="button"
                onClick={handleToday}
                className="rounded-lg bg-panel-alt px-2 py-0.5 text-[10.5px] font-bold text-teal hover:bg-teal hover:text-white transition-colors"
              >
                오늘
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="grid h-7 w-7 place-items-center rounded-lg hover:bg-panel-alt text-ink2 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="grid h-7 w-7 place-items-center rounded-lg hover:bg-panel-alt text-ink2 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-ink3 border-b border-border/40 pb-1.5 pt-0.5">
            {WEEKDAYS.map((day, idx) => (
              <span
                key={day}
                className={idx === 5 ? 'text-blue-500' : idx === 6 ? 'text-rose-500' : 'text-ink3'}
              >
                {day}
              </span>
            ))}
          </div>

          {/* 42개 일자 그리드 */}
          <div className="grid grid-cols-7 gap-y-1">
            {monthCells.map((cell) => {
              const dayNum = parseInt(cell.date.slice(8), 10);
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDateStr;
              const cellEvents = eventsByDate.get(cell.date) ?? [];
              const holidayName = holidayMap.get(cell.date);
              const isHoliday = Boolean(holidayName) && cell.inCurrentMonth;
              const important = cell.inCurrentMonth ? importantByDate.get(cell.date) : undefined;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDateStr(cell.date)}
                  className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-teal text-white font-bold shadow-xs'
                      : isToday
                      ? 'bg-teal-soft/30 font-bold text-teal'
                      : cell.inCurrentMonth
                      ? 'text-ink hover:bg-panel-alt'
                      : 'text-ink3/35'
                  }`}
                >
                  <span className={`text-[12.5px] leading-none ${
                    !isSelected && !isToday && isHoliday ? 'text-danger font-extrabold' : ''
                  }`}>{dayNum}</span>

                  {/* 공휴일 이름 */}
                  {isHoliday && !isSelected && (
                    <span className="mt-0.5 block max-w-[36px] truncate text-[7px] font-bold leading-tight text-danger/80 text-center" title={holidayName}>
                      {holidayName}
                    </span>
                  )}

                  {/* 전사 중요 일정 — 칸이 좁아 첫 줄만, 전체 내용은 아래 선택 날짜 영역에 보인다 */}
                  {important && !isHoliday && !isSelected && (
                    <span className="mt-0.5 block max-w-[38px] truncate text-[7px] font-bold leading-tight text-rose-600 text-center">
                      {important.split(/\r?\n/)[0]}
                    </span>
                  )}

                  {/* 일정 Dot 인디케이터 */}
                  <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                    {cellEvents.slice(0, 3).map((e, idx) => {
                      let dotColor = 'bg-teal';
                      // 웹·근태와 같은 색([[statusColors]]): 휴가 노랑, 외근 파랑, 출장 남색
                      if (e.eventType === 'VACATION') dotColor = PERSON_TONES.leave.dot;
                      else if (e.eventType === 'OUTSIDE') dotColor = e.title.startsWith('[출장]') ? PERSON_TONES.trip.dot : PERSON_TONES.outside.dot;

                      return (
                        <span
                          key={`${e.id}-${idx}`}
                          className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : dotColor}`}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 선택된 날짜 아젠다 리스트 헤더 */}
        <div className="flex items-center justify-between px-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <CalendarIcon size={14} className="text-teal" />
            <span className="text-[13px] font-bold text-ink">
              {selectedDateLabel}
            </span>
            {selectedHoliday && <span className="text-[11px] font-bold text-danger">{selectedHoliday}</span>}
          </div>
          <span className="text-[11px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded-full">
            {dayEvents.length}건
          </span>
        </div>

        {/* 선택한 날의 전사 중요 일정 (업무계획) */}
        {selectedImportant && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
            <p className="text-[10.5px] font-bold text-rose-500">전사 중요 일정</p>
            <p className="mt-0.5 whitespace-pre-line break-keep text-[12.5px] font-bold leading-snug text-rose-700">{selectedImportant}</p>
          </div>
        )}

        {/* 3. 아젠다 목록 */}
        <div className="space-y-2 pb-6">
          {dayEvents.length === 0 ? (
            <div className="py-12 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/60">
              <CalendarIcon size={28} className="mx-auto mb-1.5 text-ink3/40" />
              <p className="text-[12px] font-bold text-ink">이 날짜에 등록된 일정이 없습니다.</p>
              <p className="text-[10.5px] text-ink3 mt-0.5">회의는 업무계획에서 등록할 수 있습니다.</p>
            </div>
          ) : (
            dayEvents.map((evt) => {
              const meta = CALENDAR_EVENT_TYPE_LABELS[evt.eventType] || {
                label: '일반',
                icon: '📌',
                badgeClass: 'bg-panel-alt text-ink2',
              };
              // 휴가·외근·출장은 업무계획·웹과 같은 이름·색([[statusColors]]) — '외근·출장' 하나로 묶지 않는다
              const tone =
                evt.eventType === 'VACATION'
                  ? { label: '휴가', badgeClass: PERSON_TONES.leave.chip }
                  : evt.eventType === 'OUTSIDE'
                    ? evt.title.startsWith('[출장]')
                      ? { label: '출장', badgeClass: PERSON_TONES.trip.chip }
                      : { label: '외근', badgeClass: PERSON_TONES.outside.chip }
                    : { label: meta.label, badgeClass: meta.badgeClass };

              return (
                <div
                  key={evt.id}
                  onClick={() => openEvent(evt)}
                  className="rounded-2xl border border-border/80 bg-white p-3.5 shadow-2xs hover:border-teal/40 transition-all cursor-pointer active:scale-98 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px]">{meta.icon}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${tone.badgeClass}`}
                      >
                        {tone.label}
                      </span>
                      <h4 className="text-[13px] font-bold text-ink truncate max-w-[200px]">
                        {/* 제목의 [휴가]/[출장]/[외근] 접두어는 옆 배지와 겹치므로 뗀다 (웹과 동일) */}
                        {evt.title.replace(/^\[(휴가|출장|외근)\]\s*/, '')}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink3 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-teal" />
                      <span>{evt.allDay ? '종일' : `${evt.startTime || '—'} ~ ${evt.endTime || '—'}`}</span>
                    </div>

                    {evt.memo && (
                      <span className="truncate max-w-[140px] text-ink3 text-[10.5px]">
                        {evt.memo}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* 4. 내 업무계획 할 일 */}
          <div className="rounded-2xl border border-teal/30 bg-white p-3.5 shadow-2xs">
            <div className="mb-2 flex items-center justify-between border-b border-teal/20 pb-2">
              <div className="flex items-center gap-1.5">
                <ListTodo size={14} className="text-teal" />
                <span className="text-[13px] font-bold text-ink">내 업무계획</span>
                {selectedProgress && (
                  <span className="text-[11px] font-semibold text-ink3">
                    {selectedProgress.completed}/{selectedProgress.total} · <span className="font-bold text-teal">{selectedProgress.percent}%</span>
                  </span>
                )}
              </div>
              <Link to={`/m/task?date=${selectedDateStr}`} className="flex items-center gap-0.5 text-[11px] font-bold text-teal">
                <span>업무계획</span>
                <ExternalLink size={11} />
              </Link>
            </div>
            {selectedTodos.length === 0 ? (
              <div className="py-3 text-center text-[11.5px] text-ink3">
                작성된 업무계획이 없습니다.
                <Link to={`/m/task?date=${selectedDateStr}`} className="mt-1 block text-[11px] font-bold text-teal">업무계획에서 작성하기</Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {selectedTodos.map((item, idx) => {
                  if (!item.text && !item.tag && !item.isChecklist) return null;
                  const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;
                  const body = (
                    <span className="min-w-0 flex-1 leading-snug">
                      {tagMeta && (
                        <span className={`mr-1 inline-block rounded px-1 text-[9.5px] font-bold ${tagMeta.badgeClass}`}>{tagMeta.tag}</span>
                      )}
                      <span className={`break-words text-[12px] ${item.completed ? 'text-ink3 line-through' : 'font-medium text-ink'}`}>
                        <WorkPlanInlineText text={item.text} />
                      </span>
                    </span>
                  );
                  // 체크 항목은 줄 전체를 눌러 완료 표시 (손가락으로 누르기 쉽게)
                  return item.isChecklist ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleToggleTodo(idx)}
                      disabled={updateWorkPlan.isPending}
                      className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left active:bg-panel-alt"
                    >
                      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${item.completed ? 'border-teal bg-teal text-white' : 'border-border bg-white'}`}>
                        {item.completed && <CheckCircle2 size={12} />}
                      </span>
                      {body}
                    </button>
                  ) : (
                    <div key={idx} className="flex items-start gap-2 px-1 py-1.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink3" />
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 일정 등록/수정 모달 */}
      {isModalOpen && (
        <CalendarEventModal
          key={selectedEvent?.id ?? `new-${selectedDateStr}`}
          actor={access}
          initialDate={selectedDateStr}
          event={selectedEvent}
          companyEventOnly={!selectedEvent}
          myProjects={myProjects}
          deptName={selectedEvent ? (userMap.get(selectedEvent.ownerUserId)?.dept ?? user?.dept ?? null) : (user?.dept || null)}
          ownerName={ownerNameOf(selectedEvent)}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            eventsQuery.refetch();
          }}
          onRemoved={() => {
            setIsModalOpen(false);
            eventsQuery.refetch();
          }}
        />
      )}

      {outsideDetail && user && (
        <OutsideWorkDetailModal
          view={outsideDetail}
          viewer={{ userId: me, active: user.status === '사용', dept: user.dept }}
          users={users}
          onClose={() => setOutsideDetail(null)}
          onEdit={(view) => {
            if (!view.self) return;
            setOutsideDetail(null);
            setOutsideEdit(view.self);
          }}
        />
      )}
      {outsideEdit && user && (
        <OutsideWorkFormModal
          key={outsideEdit.id}
          actor={{ userId: me, active: user.status === '사용' }}
          initialDate={outsideEdit.startDate}
          work={outsideEdit}
          users={users}
          onClose={() => setOutsideEdit(null)}
        />
      )}
    </div>
  );
}
