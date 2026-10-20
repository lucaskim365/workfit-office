import { useMemo, useState, useEffect } from 'react';
import { useRosterOrder } from '@/features/user/useRosterOrder';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveWorkPlanScope, canViewWorkPlan } from '@/features/auth/scopeHelper';
import { calendarToday, isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import type { User } from '@/domain/user/schema';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree } from '@/features/gw/useOrgTree';
import {
  useCreateWorkPlan,
  useRemoveWorkPlan,
  useUpdateWorkPlan,
} from '@/features/workPlan/useWorkPlans';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import { monthGridDates, useDayEntryIndex } from '@/features/workPlan/useDayEntryIndex';
import CalendarEventModal from '@/modules/gw/calendar/CalendarEventModal';
import { WorkPlanEventModal } from './event/WorkPlanEventModal';
import type { EventTarget } from './event/eventFormMapping';
import { createTarget, routeEntry } from './event/entryRouting';
import { WorkPlanTeamMonthlyMatrix } from './components/WorkPlanTeamMonthlyMatrix';
import { WorkPlanConfigModal } from './components/WorkPlanConfigModal';
import { RosterOrderModal } from './components/RosterOrderModal';
import { WorkPlanCompanyScheduleModal } from './components/WorkPlanCompanyScheduleModal';
import { GwHead } from '@/modules/gw/_gw';
import { OutsideWorkDetailModal } from '@/modules/gw/outsideWork/OutsideWorkDetailModal';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import { resolveDeptId } from '@/domain/department/engine';
import { useDepartments } from '@/features/department/useDepartments';
import { useDepartmentMembers } from '@/features/departmentMember/useDepartmentMembers';
import type { DepartmentMember } from '@/domain/departmentMember/schema';

/** 조회 전 빈 값 — 매 렌더 새 배열이 되어 아래 memo(인원 목록 → 칸 조립)를 깨지 않게 한 개만 둔다 */
const NO_DEPARTMENT_MEMBERS: DepartmentMember[] = [];

export default function WorkPlanScreen() {
  const { user: authenticatedUser } = useAuth();
  const { userRoles, isSuperAdmin, canAction } = usePermission();
  // 전 직원 정렬 순서 편집 — 최고관리자·'팀·전사 업무 종합 현황' 수정 권한자 전용(전사 공통 설정)
  const canEditRosterOrder = isSuperAdmin || canAction('S_GW_WORK_PLAN_ADMIN', 'update');
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const org = useOrgTree();
  const usersQuery = useUsers();
  // 실제 회사 운영 원칙: 퇴사자(status === '미사용' 또는 resignedAt)는 업무계획 로스터/부서원/일정에서 100% 원천 배제
  const users = useMemo(() => {
    return (usersQuery.data ?? []).filter((u) => u.status === '사용' && !u.resignedAt);
  }, [usersQuery.data]);
  const [demoUserId, setDemoUserId] = useState('U009');
  const actor = authenticatedUser
    ?? users.find((user) => user.id === demoUserId)
    ?? users.find((user) => user.status === '사용')
    ?? null;

  const actorScope = useMemo(() => resolveWorkPlanScope(actor, userRoles, org), [actor, userRoles, org]);

  const [searchParams, setSearchParams] = useSearchParams();
  const today = calendarToday();
  const linkedDate = searchParams.get('date');
  const initialDate = linkedDate && isValidCalendarDate(linkedDate) ? linkedDate : null;

  useEffect(() => {
    if (searchParams.has('date')) {
      setSearchParams((prev) => { prev.delete('date'); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /** 업무계획 일정 창 — 새 일정·수정·보기 공용. key는 대상이 바뀔 때마다 새로 띄우기 위한 것. */
  const [eventModal, setEventModal] = useState<{ key: number; target: EventTarget } | null>(null);
  /** 회의 외 캘린더 일정(사내행사 등) 상세 */
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  /** 결재 완료 외근·출장과 동행 외근 상세 — 수정은 등록 본인이 일정 창으로 */
  const [outsideDetail, setOutsideDetail] = useState<{ view: OutsideScheduleView; entry: DayEntry } | null>(null);
  const [notice, setNotice] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // 전사 공통 중요 일정 모달 상태
  const [companyScheduleModal, setCompanyScheduleModal] = useState<{
    isOpen: boolean;
    date: string;
    content?: string;
    planId?: string;
  }>({ isOpen: false, date: '' });

  const departmentsQuery = useDepartments();
  const deptId = useMemo(
    () => resolveDeptId(departmentsQuery.data ?? [], actor?.dept),
    [departmentsQuery.data, actor],
  );

  const calendarActor = useMemo(
    () => ({ userId: actor?.id ?? '__anonymous__', deptId, active: actor?.status === '사용' }),
    [actor, deptId],
  );

  // ── 부서 및 검색 필터 ──
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const create = useCreateWorkPlan();
  const update = useUpdateWorkPlan();
  const remove = useRemoveWorkPlan();

  /** 인원 정렬 — 관리자가 정한 순서 → 임원(권한그룹) → 부서 → 직책 → 직급 → 이름([[rosterOrder]]) */
  const { compare: compareRoster } = useRosterOrder();

  /** 부서별 조직도 정렬 순서 맵 */
  const deptOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    org.depts.forEach((d, idx) => {
      map.set(d.name, d.order ?? (1000 + idx));
    });
    return map;
  }, [org.depts]);

  /** 권한 스코프(개인/팀장/전사) 적용 + 재직 인원 정렬 (1:부서순, 2:직책순, 3:직급순) */
  const roster = useMemo(() => {
    if (!actor) return [];
    return users
      .filter((user) => user.status === '사용')
      .filter((user) => canViewWorkPlan(actor, user, actorScope, org))
      .sort(compareRoster);
  }, [users, actor, actorScope, org, compareRoster]);

  const departmentMembers = useDepartmentMembers().data ?? NO_DEPARTMENT_MEMBERS;

  /** 고유 부서 목록 (소속 인원이 1명 이상 있는 부서만 자동 표시 & 조직도 배치순 정렬) */
  const departments = useMemo(() => {
    const memberCountByDept = new Map<string, number>();

    // A. 본직 인원 카운트
    roster.forEach((u) => {
      memberCountByDept.set(u.dept, (memberCountByDept.get(u.dept) ?? 0) + 1);
    });

    // B. 겸직 인원 카운트
    departmentMembers.forEach((dm) => {
      if (dm.deptName) {
        const baseUser = users.find((u) => u.id === dm.userId && u.status === '사용');
        if (baseUser) {
          memberCountByDept.set(dm.deptName, (memberCountByDept.get(dm.deptName) ?? 0) + 1);
        }
      }
    });

    // 소속 인원이 없는(0명) 부서는 자동으로 숨김처리
    const activeDepts = Array.from(memberCountByDept.keys()).filter((deptName) => {
      return (memberCountByDept.get(deptName) ?? 0) > 0;
    });

    return activeDepts.sort((a, b) => {
      const orderA = deptOrderMap.get(a) ?? 9999;
      const orderB = deptOrderMap.get(b) ?? 9999;
      return orderA - orderB || a.localeCompare(b, 'ko');
    });
  }, [roster, departmentMembers, users, deptOrderMap, actor]);

  /** 부서 및 검색어 필터가 적용된 최종 열람 인원 (본직 + 겸직 부서 동시 지원) */
  const scopedMembers = useMemo(() => {
    if (!actor) return [];

    const kw = searchKeyword.trim().toLowerCase();

    // 1. 특정 부서 필터 선택 시 (본직 소속자 + 해당 부서 겸직자 모두 취합)
    if (deptFilter !== 'all') {
      const matchedUsers: User[] = [];
      const seenUserIds = new Set<string>();

      // A. 해당 부서가 본직인 사용자
      // (기술경영전략위원회 등 위원회 부서 선택 시에는 대표이사도 위원장으로서 To-Do 집계에 포함!)
      users
        .filter((u) => u.status === '사용')
        .filter((u) => u.dept === deptFilter)
        .forEach((u) => {
          matchedUsers.push(u);
          seenUserIds.add(u.id);
        });

      // B. 해당 부서에 '겸직(departmentMembers)'으로 소속된 사용자 (손승원 상무, 대표이사 등)
      departmentMembers
        .filter(
          (dm) =>
            !dm.isPrimary &&
            (dm.deptName === deptFilter || org.depts.find((d) => d.id === dm.deptId)?.name === deptFilter),
        )
        .forEach((dm) => {
          if (seenUserIds.has(dm.userId)) return;
          const baseUser = users.find((u) => u.id === dm.userId);
          if (!baseUser || baseUser.status !== '사용') return;

          // 겸직 소속 인원 추가 (겸직 플래그 및 해당 부서 직책 반영)
          matchedUsers.push({
            ...baseUser,
            dept: deptFilter,
            jobTitle: dm.jobTitle || baseUser.jobTitle,
            isConcurrent: true,
          } as User & { isConcurrent: boolean });
          seenUserIds.add(dm.userId);
        });

      const sorted = matchedUsers.sort(compareRoster);

      return sorted.filter((u) => {
        if (!kw) return true;
        return u.name.toLowerCase().includes(kw) || u.dept.toLowerCase().includes(kw);
      });
    }

    // 2. 전체(all) 필터
    return roster.filter((user) => !kw || user.name.toLowerCase().includes(kw) || user.dept.toLowerCase().includes(kw));
  }, [users, roster, deptFilter, searchKeyword, departmentMembers, org, actor, compareRoster]);

  /** 보고 있는 달 — 칸 조립(표·일정 창 시간표 공용)을 여기서 한 번 하고 표에 내려 준다 */
  const [month, setMonth] = useState(() => (initialDate ?? today).slice(0, 7));
  const monthDates = useMemo(() => monthGridDates(month), [month]);
  const { cellOf, workPlans } = useDayEntryIndex({ actor, deptId, members: scopedMembers, dates: monthDates });

  const actorActive = actor?.status === '사용';

  const openEventModal = (target: EventTarget) => {
    setEventModal((prev) => ({ key: (prev?.key ?? 0) + 1, target }));
  };

  /** 칸 더블클릭·[+] — 오늘이면 지금 다음 30분, 아니면 09:00~09:30 */
  const handleCreate = (date: string, member: User) => {
    if (!actor) return;
    openEventModal(createTarget(date, member, actor, today, new Date()));
  };

  /** 칩 클릭 — 수정·보기 일정 창, 결재·동행 외근 상세, 회의 외 캘린더 일정 창([[entryRouting]]) */
  const handleOpenEntry = (entry: DayEntry) => {
    if (!actor) return;
    const route = routeEntry(entry, actor, actorActive);
    if (!route) return;
    if ('sheet' in route) openEventModal(route.sheet);
    else if ('calendar' in route) setCalendarEvent(route.calendar);
    else setOutsideDetail(route.outside);
  };

  const loading = usersQuery.isLoading;

  if (loading) return <div className="grid min-h-[calc(60vh/var(--font-scale,1))] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[calc(60vh/var(--font-scale,1))] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 space-y-4">
      <GwHead
        icon="🗓️"
        name="업무계획"
        desc="팀원의 업무·회의·외근 일정을 날짜별로 함께 봅니다."
        right={
          <div className="flex items-center gap-2">
            {!authenticatedUser && (
              <select
                value={actor.id}
                onChange={(event) => setDemoUserId(event.target.value)}
                title="사용자 선택"
                className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none"
              >
                {users.filter((user) => user.status === '사용').map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {notice && (
        <div aria-live="polite" className="rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">
          {notice}
        </div>
      )}

      {/* ── 메인 뷰: 월간 종합 뷰 ── */}
      <WorkPlanTeamMonthlyMatrix
        actor={actor}
        todayStr={initialDate ?? today}
        members={scopedMembers}
        month={month}
        onMonthChange={setMonth}
        cellOf={cellOf}
        workPlans={workPlans}
        onCreate={actorActive ? handleCreate : undefined}
        onOpenEntry={handleOpenEntry}
        onOpenConfig={() => setIsConfigOpen(true)}
        // 부서 필터·검색 — 상단 고정 바에 함께 놓인다
        filters={(
          <>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              title="부서 필터"
              className="h-8 rounded-lg border border-border bg-panel-alt/50 px-2.5 text-[11px] font-bold text-ink outline-none focus:border-teal/50"
            >
              <option value="all">전체 부서 ({roster.length}명)</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d} ({roster.filter((u) => u.dept === d).length}명)
                </option>
              ))}
            </select>
            <div className="relative w-[180px]">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="이름 또는 부서 검색..."
                className="h-8 w-full rounded-lg border border-border bg-panel-alt/40 pl-7 pr-7 text-[11px] text-ink placeholder:text-ink3 outline-none focus:border-teal/50 focus:bg-panel"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink3">🔍</span>
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink3 hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
            {canEditRosterOrder && (
              <button
                type="button"
                onClick={() => setIsOrderOpen(true)}
                title="인원 정렬 순서 편집 (관리자 전용, 전사 적용)"
                className="h-8 rounded-lg border border-border bg-panel-alt/50 px-2.5 text-[11px] font-bold text-ink hover:border-teal/50"
              >
                ↕ 정렬 순서
              </button>
            )}
          </>
        )}
        onOpenCompanySchedule={(date, content, planId) =>
          setCompanyScheduleModal({ isOpen: true, date, content, planId })
        }
      />

      {/* 업무계획 일정 창 — 일반·회의·외근·출장 */}
      {eventModal && (
        <WorkPlanEventModal
          key={eventModal.key}
          target={eventModal.target}
          actor={actor}
          deptId={deptId}
          users={users}
          cellOf={cellOf}
          onClose={() => setEventModal(null)}
          onSaved={setNotice}
        />
      )}

      {/* 회의 외 캘린더 일정(사내행사 등) — 캘린더 일정 창 그대로 */}
      {calendarEvent && (
        <CalendarEventModal
          actor={calendarActor}
          initialDate={calendarEvent.date}
          event={calendarEvent}
          myProjects={[]}
          deptName={actor.dept || null}
          ownerName={
            calendarEvent.ownerUserId !== actor.id
              ? users.find((u) => u.id === calendarEvent.ownerUserId)?.name ?? null
              : null
          }
          onClose={() => setCalendarEvent(null)}
          onSaved={() => {
            setCalendarEvent(null);
            setNotice('일정을 저장했습니다.');
          }}
          onRemoved={() => {
            setCalendarEvent(null);
            setNotice('일정을 삭제했습니다.');
          }}
        />
      )}

      {outsideDetail && (
        <OutsideWorkDetailModal
          view={outsideDetail.view}
          viewer={{ userId: actor.id, active: actorActive, dept: actor.dept }}
          users={users}
          onClose={() => setOutsideDetail(null)}
          // 등록 본인만 수정 버튼이 보인다 — 동행 칸에서 열었어도 본인 칸 기준으로 일정 창을 연다
          onEdit={() => openEventModal({ mode: 'edit', entry: { ...outsideDetail.entry, companionOf: undefined } })}
        />
      )}

      {/* 전 직원 정렬 순서 편집(관리자 전용) */}
      <RosterOrderModal open={isOrderOpen} onClose={() => setIsOrderOpen(false)} />

      {/* 업무계획 태그 관리 모달 */}
      <WorkPlanConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        canEdit={canEditRosterOrder}
      />

      {/* 전사 공통 중요 일정 등록/수정 모달 */}
      <WorkPlanCompanyScheduleModal
        isOpen={companyScheduleModal.isOpen}
        date={companyScheduleModal.date}
        initialContent={companyScheduleModal.content}
        planId={companyScheduleModal.planId}
        onClose={() => setCompanyScheduleModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={async (date, content, planId) => {
          if (!actor) return;
          const actorParam = { userId: actor.id, active: actor.status === '사용' };
          if (!content.trim()) {
            if (planId) {
              await remove.mutateAsync({ actor: actorParam, id: planId });
              setNotice('전사 주요 일정을 삭제했습니다.');
            }
            return;
          }
          if (planId) {
            await update.mutateAsync({ actor: actorParam, id: planId, draft: { date, content } });
          } else {
            await create.mutateAsync({ actor: actorParam, draft: { date, content, ownerUserId: '__COMPANY__' } });
          }
          setNotice('전사 주요 일정을 저장했습니다.');
        }}
        onDelete={async (planId, _date) => {
          if (!actor) return;
          await remove.mutateAsync({ actor: { userId: actor.id, active: actor.status === '사용' }, id: planId });
          setNotice('전사 주요 일정을 삭제했습니다.');
        }}
      />
    </div>
  );
}
