import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveWorkPlanScope, canViewWorkPlan, isLeaderPosition } from '@/features/auth/scopeHelper';
import { calendarToday, isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import type { WorkPlan } from '@/domain/workPlan/schema';
import type { User } from '@/domain/user/schema';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree } from '@/features/gw/useOrgTree';
import {
  useCreateWorkPlan,
  useRemoveWorkPlan,
  useUpdateWorkPlan,
} from '@/features/workPlan/useWorkPlans';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { syncWorkPlanToCalendar, cleanupWorkPlanCalendarEvents } from '@/domain/workPlan/workPlanCalendarBridge';
import { WorkPlanEditorModal } from './components/WorkPlanEditorModal';
import { WorkPlanTeamWeeklyMatrix } from './components/WorkPlanTeamWeeklyMatrix';
import { WorkPlanConfigModal } from './components/WorkPlanConfigModal';
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { resolveDeptId } from '@/domain/department/engine';
import { useDepartments } from '@/features/department/useDepartments';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';

const WEEKDAY_NAMES_SUN0 = ['일', '월', '화', '수', '목', '금', '토'];

function dayTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAY_NAMES_SUN0[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/**
 * 로스터 제외 대상 — 대표(대표이사) 및 일반 운영 모드에서의 테스트 계정 처리.
 * - 본인 계정은 테스터라도 항상 표시됩니다.
 * - 테스트 계정/부서로 로그인하여 시연 중일 때는 테스트 부서 인원들이 정상 표시됩니다.
 */
const isExcludedFromRoster = (user: User, actor?: User | null) => {
  if (actor && user.id === actor.id) return false;

  const isActorTest = Boolean(
    actor?.dept?.includes('테스트') ||
    actor?.name?.includes('테스트') ||
    actor?.name?.includes('테스터') ||
    actor?.id?.toLowerCase().includes('test') ||
    actor?.name?.toLowerCase().includes('test')
  );
  const isUserTest = Boolean(
    user.dept?.includes('테스트') ||
    user.name?.includes('테스트') ||
    user.name?.includes('테스터') ||
    user.id?.toLowerCase().includes('test') ||
    user.name?.toLowerCase().includes('test')
  );

  if (isActorTest && isUserTest) return false;
  return user.position.includes('대표') || isUserTest;
};

export default function WorkPlanScreen() {
  const { user: authenticatedUser } = useAuth();
  const { userRoles } = usePermission();
  const org = useOrgTree();
  const usersQuery = useUsers();
  const users = usersQuery.data ?? [];
  const [demoUserId, setDemoUserId] = useState('U009');
  const actor = authenticatedUser
    ?? users.find((user) => user.id === demoUserId)
    ?? users.find((user) => user.status === '사용')
    ?? null;

  const actorScope = useMemo(() => resolveWorkPlanScope(actor, userRoles, org), [actor, userRoles, org]);
  const presences = useAllUserPresences();

  const [searchParams, setSearchParams] = useSearchParams();
  const today = calendarToday();
  const linkedDate = searchParams.get('date');
  const initialDate = linkedDate && isValidCalendarDate(linkedDate) ? linkedDate : null;

  useEffect(() => {
    if (searchParams.has('date')) {
      setSearchParams((prev) => { prev.delete('date'); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [editingTarget, setEditingTarget] = useState<{ date: string; plan?: WorkPlan } | null>(null);
  const [viewingDetail, setViewingDetail] = useState<{ user: User; plan: WorkPlan } | null>(null);
  const [notice, setNotice] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const departmentsQuery = useDepartments();
  const deptId = useMemo(
    () => resolveDeptId(departmentsQuery.data ?? [], actor?.dept),
    [departmentsQuery.data, actor],
  );

  const calendarActor = useMemo(
    () => ({ userId: actor?.id ?? '__anonymous__', deptId, active: actor?.status === '사용' }),
    [actor, deptId],
  );
  const userEventsQuery = useCalendarEvents(calendarActor, undefined, Boolean(actor));
  const userEvents = userEventsQuery.data ?? [];

  const editingDateEvents = useMemo(() => {
    if (!editingTarget) return [];
    return userEvents.filter((ev) => ev.date === editingTarget.date);
  }, [userEvents, editingTarget]);

  // ── 부서 및 검색 필터 ──
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const create = useCreateWorkPlan();
  const update = useUpdateWorkPlan();
  const remove = useRemoveWorkPlan();

  /** 부서별 조직도 정렬 순서 맵 */
  const deptOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    org.depts.forEach((d, idx) => {
      map.set(d.name, d.order ?? (1000 + idx));
    });
    return map;
  }, [org.depts]);

  /** 권한 스코프(개인/팀장/전사) 적용 + 재직 + 대표/테스트 제외 인원 정렬 */
  const roster = useMemo(() => {
    if (!actor) return [];
    return users
      .filter((user) => user.status === '사용' && !isExcludedFromRoster(user, actor))
      .filter((user) => canViewWorkPlan(actor, user, actorScope, org))
      .sort((a, b) => {
        const orderA = deptOrderMap.get(a.dept) ?? 9999;
        const orderB = deptOrderMap.get(b.dept) ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        if (a.dept !== b.dept) return a.dept.localeCompare(b.dept, 'ko');

        const rankA = org.rankOf(a.position);
        const rankB = org.rankOf(b.position);
        if (rankA !== rankB) return rankA - rankB;

        return a.name.localeCompare(b.name, 'ko');
      });
  }, [users, actor, actorScope, deptOrderMap, org]);

  /** 고유 부서 목록 */
  const departments = useMemo(() => {
    const list = Array.from(new Set(roster.map((u) => u.dept))).filter(Boolean);
    return list.sort((a, b) => {
      const orderA = deptOrderMap.get(a) ?? 9999;
      const orderB = deptOrderMap.get(b) ?? 9999;
      return orderA - orderB || a.localeCompare(b, 'ko');
    });
  }, [roster, deptOrderMap]);

  /** 부서 및 검색어 필터가 적용된 최종 열람 인원 */
  const scopedMembers = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return roster.filter((user) => {
      let matchesDept = true;
      if (deptFilter === 'all') {
        matchesDept = true;
      } else if (deptFilter === 'leaders') {
        matchesDept = user.dept !== actor?.dept && isLeaderPosition(user.position, user.jobTitle, user.id, org);
      } else {
        matchesDept = user.dept === deptFilter;
      }
      const matchesName = !kw || user.name.toLowerCase().includes(kw) || user.dept.toLowerCase().includes(kw);
      return matchesDept && matchesName;
    });
  }, [roster, deptFilter, searchKeyword, actor?.dept, org]);

  const savePlan = useCallback(
    async (date: string, content: string, existingPlanId?: string, shareToCalendar = true) => {
      if (!actor) return;
      const actorParam = { userId: actor.id, active: actor.status === '사용' };
      const saved = existingPlanId
        ? await update.mutateAsync({ actor: actorParam, id: existingPlanId, draft: { date, content } })
        : await create.mutateAsync({ actor: actorParam, draft: { date, content } });

      if (saved) {
        await syncWorkPlanToCalendar(
          { userId: actor.id, active: actor.status === '사용', deptId },
          saved,
          shareToCalendar,
        );
      }
      setNotice('업무계획을 저장했습니다.');
    },
    [actor, create, update, deptId],
  );

  const removePlan = useCallback(
    async (planId: string, date?: string) => {
      if (!actor) return;
      await cleanupWorkPlanCalendarEvents(
        { userId: actor.id, active: actor.status === '사용', deptId },
        planId,
        date,
      );
      await remove.mutateAsync({ actor: { userId: actor.id, active: actor.status === '사용' }, id: planId });
      setNotice('업무계획을 삭제했습니다.');
    },
    [actor, remove, deptId],
  );

  const loading = usersQuery.isLoading;

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 space-y-4">
      <GwHead
        icon="🗓️"
        name="업무계획"
        desc="팀 주간 종합 계획: 전 팀원의 한 주간 업무 계획(To-Do)을 종합 조회하고, 요일별 업무 등록 및 진행 상황을 공유합니다."
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

      {/* ── 다차원 필터링 툴바 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-panel px-3.5 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 부서 필터 드롭다운 (권한 스코프별 제어) */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-panel-alt/50 px-2.5 text-[11px] font-bold text-ink outline-none focus:border-teal/50"
          >
            {actorScope === 'TEAM' ? (
              <option value="all">우리 팀 · {actor?.dept || '소속 부서'} ({roster.length}명)</option>
            ) : actorScope === 'TEAM_AND_LEADERS' ? (
              <>
                <option value="all">전체 ({roster.length}명)</option>
                {actor?.dept && (
                  <option value={actor.dept}>
                    우리 팀 · {actor.dept} ({roster.filter((u) => u.dept === actor.dept).length}명)
                  </option>
                )}
                <option value="leaders">
                  타 부서 팀장 모아보기 ({roster.filter((u) => u.dept !== actor?.dept && isLeaderPosition(u.position, u.jobTitle, u.id, org)).length}명)
                </option>
              </>
            ) : (
              <>
                <option value="all">전체 부서 ({roster.length}명)</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d} ({roster.filter((u) => u.dept === d).length}명)
                  </option>
                ))}
              </>
            )}
          </select>

          {/* 권한 스코프 뱃지 안내 */}
          <div className="text-[10.5px] font-semibold text-ink3 rounded-md bg-panel-alt/50 px-2 py-1 border border-border">
            {actorScope === 'TEAM' && `열람 범위: ${actor.dept || '우리 팀'} (팀원 및 팀장)`}
            {actorScope === 'TEAM_AND_LEADERS' && `열람 범위: ${actor.dept || '우리 팀'} 및 타 부서 팀장`}
            {actorScope === 'ALL' && '열람 범위: 전사 임직원'}
          </div>
        </div>

        {/* 이름 또는 부서 실시간 검색창 */}
        <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
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
      </div>

      {/* ── 메인: 팀 주간 종합표 (WorkPlanTeamWeeklyMatrix) ── */}
      <WorkPlanTeamWeeklyMatrix
        actor={actor}
        todayStr={initialDate ?? today}
        members={scopedMembers}
        presences={presences}
        deptId={deptId}
        onOpenEditor={(date, plan) => setEditingTarget({ date, plan })}
        onOpenDetail={(user, plan) => setViewingDetail({ user, plan })}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* 스마트 에디터 모달 */}
      {editingTarget && (
        <WorkPlanEditorModal
          isOpen={Boolean(editingTarget)}
          onClose={() => setEditingTarget(null)}
          date={editingTarget.date}
          dateTitle={dayTitle(editingTarget.date)}
          initialContent={editingTarget.plan?.content ?? ''}
          todayEvents={editingDateEvents}
          onSave={async (content, shareToCal) => {
            await savePlan(editingTarget.date, content, editingTarget.plan?.id, shareToCal);
            setEditingTarget(null);
          }}
          onDelete={
            editingTarget.plan
              ? async () => {
                  await removePlan(editingTarget.plan!.id, editingTarget.date);
                  setEditingTarget(null);
                }
              : undefined
          }
        />
      )}

      {/* 루틴 템플릿 및 태그 관리 모달 */}
      <WorkPlanConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* 타인 계획 상세 열람 모달 */}
      <Modal
        open={viewingDetail !== null}
        onClose={() => setViewingDetail(null)}
        title={viewingDetail ? `${viewingDetail.user.name} (${viewingDetail.user.position || '팀원'}) · ${viewingDetail.plan.date} 계획` : ''}
        footer={<Button size="sm" onClick={() => setViewingDetail(null)}>닫기</Button>}
      >
        <div className="space-y-3">
          <div className="text-[11px] text-ink3">
            부서: <span className="font-semibold text-ink">{viewingDetail?.user.dept}</span>
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-panel-alt/50 p-3 text-[12px] text-ink border border-border">
            {viewingDetail?.plan.content}
          </p>
        </div>
      </Modal>
    </div>
  );
}
