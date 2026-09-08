import { useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveWorkPlanScope, canViewWorkPlan, isLeaderPosition } from '@/features/auth/scopeHelper';
import { buildCalendarMonth, calendarToday, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { WorkPlan } from '@/domain/workPlan/schema';
import type { User } from '@/domain/user/schema';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree } from '@/features/gw/useOrgTree';
import {
  useAllWorkPlans,
  useCreateWorkPlan,
  useMyWorkPlans,
  useRemoveWorkPlan,
  useUpdateWorkPlan,
} from '@/features/workPlan/useWorkPlans';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { USER_PRESENCE_META } from '@/domain/userPresence/schema';
import {
  parseWorkPlanItems,
  calculatePlanProgress,
  toggleWorkPlanItem,
  removeWorkPlanItem,
  addWorkPlanItem,
  getWorkPlanTagMeta,
} from '@/domain/workPlan/engine';
import { useWorkPlanConfig } from '@/features/workPlan/useWorkPlanConfig';
import { WorkPlanEditorModal } from './components/WorkPlanEditorModal';
import { WorkPlanWeeklyView } from './components/WorkPlanWeeklyView';
import { WorkPlanConfigModal } from './components/WorkPlanConfigModal';
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { CheckCircle2, ListTodo, Calendar, Edit3, X, Plus, Settings } from 'lucide-react';

/**
 * 업무계획 — 이사진 등이 구글시트로 적던 개인 영업/업무 예정을 옮겨오는 화면.
 *
 * 처음엔 그룹웨어 일정관리처럼 달력 칩으로 전원을 표시하려 했으나, 실제로 만들어보니
 * 한 칸에 여러 명의 항목이 겹쳐 한눈에 안 들어왔다(피드백 2026-08-26). 그래서 구조를
 * 바꾼다 — **달력은 보조**(내 항목이 어느 날 있는지만 훑어보는 용도, 접어둘 수 있음),
 * **로스터가 주역**(선택한 날짜에 재직 중인 전 직원을 한 줄씩 나열, 카드에 자유 텍스트
 * 한 덩어리). 대표·상무·이사급은 로스터에 안 올린다 — 실무 인원 현황판이 목적이라
 * 경영진까지 줄 세우면 목적과 안 맞는다.
 */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_NAMES_SUN0 = ['일', '월', '화', '수', '목', '금', '토'];

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

  // 테스트 시연 모드: 테스트 부서 계정들 상호 노출
  if (isActorTest && isUserTest) return false;

  return user.position.includes('대표') || isUserTest;
};

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}년 ${m}월`;
}

function dayTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAY_NAMES_SUN0[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

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

  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'roster' | 'weekly'>('roster');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddTag, setQuickAddTag] = useState('');
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [notice, setNotice] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const { tags, tagMap } = useWorkPlanConfig();

  // ── 다차원 필터 상태 ──
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'written' | 'unwritten'>('all');

  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);

  const workActor = useMemo(() => ({ userId: actor?.id ?? '__anonymous__', active: actor?.status === '사용' }), [actor]);
  // 로스터는 항상 전원 보기라 늘 켜져 있다. 내 달력 칩은 별도 쿼리(month 범위, 가벼움)로 뺀다.
  const mineQuery = useMyWorkPlans(workActor, range);
  const allDayQuery = useAllWorkPlans({ from: selectedDate, to: selectedDate }, true);
  const loading = usersQuery.isLoading || mineQuery.isLoading || allDayQuery.isLoading;

  const create = useCreateWorkPlan();
  const update = useUpdateWorkPlan();
  const remove = useRemoveWorkPlan();

  const myPlansByDate = useMemo(() => {
    const rows = new Map<string, WorkPlan[]>();
    (mineQuery.data ?? []).forEach((plan) => rows.set(plan.date, [...(rows.get(plan.date) ?? []), plan]));
    return rows;
  }, [mineQuery.data]);

  /** 부서별 조직도 정렬 순서 맵 */
  const deptOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    org.depts.forEach((d, idx) => {
      map.set(d.name, d.order ?? (1000 + idx));
    });
    return map;
  }, [org.depts]);

  /** 로스터 대상 — 권한 스코프(개인/팀장/전사) 적용 + 재직 + 대표/테스트 제외, 부서(조직도순) ➔ 인원(직급순 ➔ 이름순). */
  const roster = useMemo(() => {
    if (!actor) return [];
    return users
      .filter((user) => user.status === '사용' && !isExcludedFromRoster(user, actor))
      .filter((user) => canViewWorkPlan(actor, user, actorScope, org))
      .sort((a, b) => {
        // 1. 부서 조직도 순 정렬
        const orderA = deptOrderMap.get(a.dept) ?? 9999;
        const orderB = deptOrderMap.get(b.dept) ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        if (a.dept !== b.dept) return a.dept.localeCompare(b.dept, 'ko');

        // 2. 인원 직급 서열 순 정렬 (rank 낮을수록 고위직)
        const rankA = org.rankOf(a.position);
        const rankB = org.rankOf(b.position);
        if (rankA !== rankB) return rankA - rankB;

        // 3. 동일 직급 시 이름 가나다순
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [users, actor, actorScope, deptOrderMap, org]);

  /** 고유 부서 목록 (조직도 순서 유지 동적 추출) */
  const departments = useMemo(() => {
    const list = Array.from(new Set(roster.map((u) => u.dept))).filter(Boolean);
    return list.sort((a, b) => {
      const orderA = deptOrderMap.get(a) ?? 9999;
      const orderB = deptOrderMap.get(b) ?? 9999;
      return orderA - orderB || a.localeCompare(b, 'ko');
    });
  }, [roster, deptOrderMap]);

  /** 부서별로 묶어서 보여준다 — roster가 이미 부서(조직도순)+인원(직급순) 정렬이라 등장 순서 그대로 묶으면 된다. */
  const rosterGroups = useMemo(() => {
    const groups: Array<{ dept: string; members: User[] }> = [];
    for (const user of roster) {
      const last = groups[groups.length - 1];
      if (last && last.dept === user.dept) last.members.push(user);
      else groups.push({ dept: user.dept, members: [user] });
    }
    return groups;
  }, [roster]);

  const dayPlanByOwner = useMemo(() => {
    const rows = new Map<string, WorkPlan>();
    (allDayQuery.data ?? []).forEach((plan) => rows.set(plan.ownerUserId, plan));
    return rows;
  }, [allDayQuery.data]);

  /** 현재 부서 및 검색어 필터가 적용된 스코프 내 인원 (상태 뱃지 카운트용) */
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
  }, [roster, deptFilter, searchKeyword, actor?.dept]);

  /** 필터 칩에 표시될 실시간 인원수 집계 */
  const statusCounts = useMemo(() => {
    let written = 0;
    let unwritten = 0;
    for (const user of scopedMembers) {
      const hasPlan = Boolean(dayPlanByOwner.get(user.id)?.content?.trim());
      if (hasPlan) written++;
      else unwritten++;
    }
    return {
      all: scopedMembers.length,
      written,
      unwritten,
    };
  }, [scopedMembers, dayPlanByOwner]);

  /** 필터가 적용된 최종 로스터 그룹 */
  const filteredRosterGroups = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    const groups: Array<{ dept: string; members: User[] }> = [];

    for (const group of rosterGroups) {
      if (deptFilter !== 'all' && deptFilter !== 'leaders' && group.dept !== deptFilter) continue;

      const matchedMembers = group.members.filter((user) => {
        if (deptFilter === 'leaders' && (user.dept === actor?.dept || !isLeaderPosition(user.position, user.jobTitle, user.id, org))) {
          return false;
        }
        const matchesName = !kw || user.name.toLowerCase().includes(kw) || user.dept.toLowerCase().includes(kw);
        if (!matchesName) return false;

        const hasPlan = Boolean(dayPlanByOwner.get(user.id)?.content?.trim());
        if (statusFilter === 'written' && !hasPlan) return false;
        if (statusFilter === 'unwritten' && hasPlan) return false;

        return true;
      });

      if (matchedMembers.length > 0) {
        groups.push({ dept: group.dept, members: matchedMembers });
      }
    }
    return groups;
  }, [rosterGroups, deptFilter, searchKeyword, statusFilter, dayPlanByOwner, actor?.dept]);

  const totalVisibleCount = useMemo(
    () => filteredRosterGroups.reduce((acc, g) => acc + g.members.length, 0),
    [filteredRosterGroups],
  );

  const myDayPlan = actor ? dayPlanByOwner.get(actor.id) : undefined;
  const myDayParsed = useMemo(() => (myDayPlan ? parseWorkPlanItems(myDayPlan.content) : []), [myDayPlan]);
  const myDayProgress = useMemo(() => (myDayPlan ? calculatePlanProgress(myDayPlan.content) : null), [myDayPlan]);

  const savePlan = useCallback(async (date: string, content: string, existingPlanId?: string) => {
    if (!actor) return;
    const actorParam = { userId: actor.id, active: actor.status === '사용' };
    if (existingPlanId) {
      await update.mutateAsync({ actor: actorParam, id: existingPlanId, draft: { date, content } });
    } else {
      await create.mutateAsync({ actor: actorParam, draft: { date, content } });
    }
    setNotice('업무계획을 저장했습니다.');
  }, [actor, create, update]);

  const removePlan = useCallback(async (planId: string) => {
    if (!actor) return;
    await remove.mutateAsync({ actor: { userId: actor.id, active: actor.status === '사용' }, id: planId });
    setNotice('업무계획을 삭제했습니다.');
  }, [actor, remove]);

  const handleToggleMyItem = useCallback(async (plan: WorkPlan, idx: number) => {
    const nextContent = toggleWorkPlanItem(plan.content, idx);
    await savePlan(plan.date, nextContent, plan.id);
  }, [savePlan]);

  const handleRemoveMyItem = useCallback(async (plan: WorkPlan, idx: number) => {
    const nextContent = removeWorkPlanItem(plan.content, idx);
    if (!nextContent.trim()) {
      await removePlan(plan.id);
    } else {
      await savePlan(plan.date, nextContent, plan.id);
    }
  }, [removePlan, savePlan]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAddText.trim() || !actor) return;
    const currentContent = myDayPlan?.content ?? '';
    const nextContent = addWorkPlanItem(currentContent, quickAddText.trim(), quickAddTag || undefined);
    await savePlan(selectedDate, nextContent, myDayPlan?.id);
    setQuickAddText('');
  }, [quickAddText, quickAddTag, myDayPlan, selectedDate, savePlan, actor]);

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="🗓️"
        name="업무계획"
        desc="개인 업무 계획 & 실무 로스터: 직원별 일일 업무 계획(To-Do)을 작성하고, 전사/부서별 일일 실무 진행 계획을 한눈에 공유·확인합니다."
        right={
          <div className="flex items-center gap-2">
            {!authenticatedUser && (
              <select value={actor.id} onChange={(event) => setDemoUserId(event.target.value)} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
                {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            )}

            {/* 뷰 모드 탭: 일일 실무 로스터 vs 내 주간 계획 */}
            <div className="flex items-center rounded-lg border border-border bg-panel p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('roster')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                  viewMode === 'roster' ? 'bg-teal text-white shadow-2xs' : 'text-ink3 hover:text-ink hover:bg-panel-alt/60'
                }`}
              >
                <ListTodo size={13} />
                <span>일일 실무 로스터</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                  viewMode === 'weekly' ? 'bg-teal text-white shadow-2xs' : 'text-ink3 hover:text-ink hover:bg-panel-alt/60'
                }`}
              >
                <Calendar size={13} />
                <span>내 주간 계획</span>
              </button>
            </div>
          </div>
        }
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      {/* 뷰 모드가 주간 계획일 때 */}
      {viewMode === 'weekly' && (
        <div className="mt-5">
          <WorkPlanWeeklyView
            actor={actor}
            todayStr={today}
            myPlans={mineQuery.data ?? []}
            onSavePlan={savePlan}
            onDeletePlan={removePlan}
          />
        </div>
      )}

      {/* 뷰 모드가 일일 실무 로스터일 때 */}
      {viewMode === 'roster' && (
        <>
          {/* 내 카드 — To-Do 체크리스트 & 진행률 바 지원 */}
          <section className="mt-5 rounded-xl border border-teal/30 bg-teal-soft/10 shadow-sm transition-all hover:border-teal/50">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-extrabold text-ink">{dayTitle(selectedDate)} · 내 계획</h3>
                  <button
                    type="button"
                    onClick={() => setDatePickerOpen(true)}
                    className="rounded-md border border-border bg-panel px-2 py-0.5 text-[10.5px] font-semibold text-ink3 hover:border-teal/40 hover:text-teal transition-colors"
                  >
                    📅 날짜 변경
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen((prev) => !prev)}
                    className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition-all shadow-2xs ${
                      quickAddOpen
                        ? 'border-teal bg-teal text-white'
                        : 'border-teal/30 bg-teal-soft/40 text-teal hover:bg-teal-soft/70'
                    }`}
                  >
                    <Plus size={13} />
                    <span>업무 추가</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(true)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
                  >
                    <Edit3 size={12} className="text-ink3" />
                    <span>편집</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[11.5px] font-bold text-ink3 hover:text-teal hover:border-teal/40 transition-colors shadow-2xs"
                    title="루틴 템플릿 및 업무 태그 설정"
                  >
                    <Settings size={12} />
                    <span>설정</span>
                  </button>
                </div>
              </div>

              {/* 빠른 인라인 업무 추가 바 */}
              {quickAddOpen && (
                <div className="mb-3.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-teal/40 bg-white dark:bg-panel p-2 shadow-xs transition-all">
                  <select
                    value={quickAddTag}
                    onChange={(e) => setQuickAddTag(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-panel-alt/50 px-2 text-[11px] font-bold text-ink outline-none focus:border-teal"
                  >
                    <option value="">태그 없음</option>
                    {tags.map((t) => (
                      <option key={t.tag} value={t.tag}>
                        {t.tag}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={quickAddText}
                    onChange={(e) => setQuickAddText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleQuickAdd();
                    }}
                    placeholder="추가할 업무 내용을 입력하세요 (Enter 키로 바로 등록)"
                    className="h-8 min-w-[220px] flex-1 bg-transparent px-2.5 text-[12px] text-ink outline-none placeholder:text-ink3"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleQuickAdd()}
                    disabled={!quickAddText.trim()}
                    className="h-8 rounded-lg bg-teal px-3.5 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity shadow-2xs"
                  >
                    추가
                  </button>
                </div>
              )}

              {/* 내 계획 To-Do 체크리스트 항목들 */}
              {myDayParsed.length === 0 ? (
                <div
                  onClick={() => setQuickAddOpen(true)}
                  className="cursor-pointer py-3 text-[11.5px] text-ink3 hover:text-ink2"
                >
                  작성된 계획이 없습니다. <span className="font-semibold text-teal underline">+ 업무 추가</span>를 눌러 오늘의 To-Do를 등록해보세요.
                </div>
              ) : (
                <div className="space-y-1">
                  {myDayParsed.map((item, idx) => {
                    if (!item.text && !item.tag && !item.isChecklist) return null;
                    const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;

                    return (
                      <div
                        key={idx}
                        className="group flex items-center justify-between gap-2 rounded-lg py-1 px-1.5 hover:bg-panel-alt/50 transition-colors"
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {item.isChecklist ? (
                            <button
                              type="button"
                              onClick={() => myDayPlan && handleToggleMyItem(myDayPlan, idx)}
                              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                                item.completed ? 'border-teal bg-teal text-white' : 'border-border bg-panel hover:border-teal'
                              }`}
                              title={item.completed ? '완료 취소' : '완료 체크'}
                            >
                              {item.completed && <CheckCircle2 size={12} />}
                            </button>
                          ) : (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink3" />
                          )}

                          <div className="min-w-0 flex-1 leading-snug">
                            {tagMeta && (
                              <span className={`mr-1.5 inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${tagMeta.badgeClass}`}>
                                {tagMeta.tag}
                              </span>
                            )}
                            <span className={`text-[12px] ${item.completed ? 'line-through text-ink3' : 'font-medium text-ink'}`}>
                              {item.text}
                            </span>
                          </div>
                        </div>

                        {/* 행별 개별 삭제 버튼 (✕) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (myDayPlan) void handleRemoveMyItem(myDayPlan, idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-ink3 hover:bg-rose-500/10 hover:text-rose-500 transition-all shrink-0"
                          title="이 업무 삭제"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 내 카드 진행률 게이지 바 */}
              {myDayProgress && (
                <div className="mt-3.5 pt-2.5 border-t border-teal/20 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink2">진행률:</span>
                    <span className="text-ink3">{myDayProgress.completed}/{myDayProgress.total}건 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-border/80 overflow-hidden">
                      <div
                        className="h-full bg-teal transition-all duration-500 rounded-full"
                        style={{ width: `${myDayProgress.percent}%` }}
                      />
                    </div>
                    <span className="font-bold text-teal">{myDayProgress.percent}%</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 에디터 모달 */}
          {isEditorOpen && (
            <WorkPlanEditorModal
              isOpen={isEditorOpen}
              onClose={() => setIsEditorOpen(false)}
              date={selectedDate}
              dateTitle={dayTitle(selectedDate)}
              initialContent={myDayPlan?.content ?? ''}
              onSave={async (content) => {
                await savePlan(selectedDate, content, myDayPlan?.id);
              }}
              onDelete={
                myDayPlan
                  ? async () => {
                      await removePlan(myDayPlan.id);
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
          {/* 날짜 선택 팝업 */}
          <Modal open={datePickerOpen} onClose={() => setDatePickerOpen(false)} title="날짜 선택" width={320}>
            <div className="flex items-center gap-1.5 pb-2">
              <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-7 w-7 place-items-center rounded-md border border-border text-ink2 hover:bg-panel-alt">‹</button>
              <span className="min-w-[64px] text-center text-[11.5px] font-bold text-ink">{monthLabel(month)}</span>
              <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-7 w-7 place-items-center rounded-md border border-border text-ink2 hover:bg-panel-alt">›</button>
              <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
            </div>
            <div className="grid grid-cols-7 border-b border-border bg-panel-alt/65">
              {WEEKDAYS.map((day, index) => (
                <div key={day} className={`py-1 text-center text-[9.5px] font-bold ${index === 5 ? 'text-blue' : index === 6 ? 'text-danger' : 'text-ink3'}`}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell, index) => {
                const mine = myPlansByDate.get(cell.date) ?? [];
                const isToday = cell.date === today;
                const selected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => { setSelectedDate(cell.date); setDatePickerOpen(false); }}
                    className={`flex h-9 cursor-pointer flex-col items-center justify-center border-b border-r border-border text-left transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
                  >
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</span>
                    {mine.length > 0 && <span className="mt-0.5 block h-1 w-1 rounded-full bg-teal" title={`내 계획 ${mine.length}건`} />}
                  </button>
                );
              })}
            </div>
          </Modal>

      {/* 남의 계획 열람 — 로스터 행은 미리보기 2줄만 보여주고, 전체 내용은 여기서 본다. */}
      <Modal
        open={viewingUser !== null}
        onClose={() => setViewingUser(null)}
        title={viewingUser ? `${viewingUser.name} · ${viewingUser.dept}` : ''}
        footer={<Button size="sm" onClick={() => setViewingUser(null)}>닫기</Button>}
      >
        <p className="whitespace-pre-wrap text-[11.5px] text-ink">{viewingUser && dayPlanByOwner.get(viewingUser.id)?.content}</p>
      </Modal>

      {/* ── 다차원 필터링 툴바 ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-panel px-3.5 py-2.5 shadow-xs">
        {/* 좌측: 부서 선택 & 상태 필터 칩 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 부서 필터 드롭다운 */}
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

          {/* 작성 상태 칩 필터 (선택 부서/검색어 기준 동적 카운트) */}
          <div className="flex rounded-lg border border-border bg-panel-alt/40 p-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-panel text-teal shadow-xs'
                  : 'text-ink3 hover:text-ink2'
              }`}
            >
              전체 ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('written')}
              className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                statusFilter === 'written'
                  ? 'bg-panel text-teal shadow-xs'
                  : 'text-ink3 hover:text-ink2'
              }`}
            >
              작성완료 ({statusCounts.written})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unwritten')}
              className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                statusFilter === 'unwritten'
                  ? 'bg-panel text-danger shadow-xs'
                  : 'text-ink3 hover:text-ink2'
              }`}
            >
              미작성 ({statusCounts.unwritten})
            </button>
          </div>
        </div>

        {/* 우측: 이름/부서 실시간 검색창 */}
        <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
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

      {/* 로스터 — 재직 전원(경영진 제외), 부서별로 묶어서. 본인 행도 포함하되 수정은 위 팝업에서만. */}
      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">
            전체 현황 <span className="text-[11px] font-normal text-ink3">({totalVisibleCount}명 표시 중)</span>
          </h3>
          {(deptFilter !== 'all' || searchKeyword || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setDeptFilter('all');
                setSearchKeyword('');
                setStatusFilter('all');
              }}
              className="text-[10px] font-semibold text-teal hover:underline"
            >
              필터 초기화
            </button>
          )}
        </div>

        {filteredRosterGroups.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-[11.5px] text-ink3">
            조건에 일치하는 직원이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRosterGroups.map((group) => (
              <div key={group.dept}>
                <div className="flex items-center justify-between bg-panel-alt/60 px-4 py-1.5 text-[10px] font-bold text-ink3">
                  <span>{group.dept}</span>
                  <span>{group.members.length}명</span>
                </div>
                {group.members.map((user) => {
                  const isSelf = user.id === actor.id;
                  const plan = dayPlanByOwner.get(user.id);
                  const presence = presences[user.id];
                  const presenceMeta = presence ? USER_PRESENCE_META[presence.status] : USER_PRESENCE_META.ONLINE;
                  const parsed = plan ? parseWorkPlanItems(plan.content) : [];
                  const progress = plan ? calculatePlanProgress(plan.content) : null;
                  const onOpen = isSelf ? () => setIsEditorOpen(true) : plan ? () => setViewingUser(user) : undefined;

                  return (
                    <div
                      key={user.id}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        isSelf ? 'bg-teal-soft/10' : 'hover:bg-panel-alt/40'
                      }`}
                    >
                      {/* 좌측: 사원 정보 + Teams/Discord 실시간 상태 뱃지 */}
                      <div className="w-48 shrink-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-extrabold text-ink">{user.name}</span>
                          {user.position && (
                            <span className="text-[10px] text-ink3 font-medium">{user.position}</span>
                          )}
                          {isSelf && (
                            <span className="rounded bg-teal-soft px-1 text-[9.5px] font-bold text-teal">
                              나
                            </span>
                          )}
                        </div>

                        {/* 실시간 근무 상태 뱃지 */}
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${presenceMeta.bgTone}`}
                            title={presence?.message ? `${presenceMeta.label}: ${presence.message}` : presenceMeta.desc}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${presenceMeta.dotColor}`} />
                            <span>{presenceMeta.label}</span>
                          </span>

                          {presence?.message && (
                            <span
                              className="text-[9.5px] text-ink3 truncate max-w-[110px]"
                              title={presence.message}
                            >
                              "{presence.message}"
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 우측: 계획 본문 (체크리스트 or 텍스트) + 진행률 */}
                      <div className="min-w-0 flex-1">
                        {parsed.length === 0 ? (
                          <div
                            onClick={onOpen}
                            className={`text-[11.5px] ${onOpen ? 'cursor-pointer' : ''} text-ink3 italic py-0.5`}
                          >
                            {isSelf ? '+ 클릭하여 오늘의 계획 작성' : '작성 없음'}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {parsed.map((item, idx) => {
                              if (!item.text && !item.tag && !item.isChecklist) return null;
                              const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;

                              return (
                                <div key={idx} className="flex items-start gap-2">
                                  {item.isChecklist ? (
                                    <button
                                      type="button"
                                      disabled={!isSelf}
                                      onClick={() => isSelf && plan && handleToggleMyItem(plan, idx)}
                                      className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded border transition-colors ${
                                        item.completed ? 'border-teal bg-teal text-white' : 'border-border bg-panel'
                                      } ${isSelf ? 'hover:border-teal cursor-pointer' : 'cursor-default'}`}
                                      title={isSelf ? (item.completed ? '완료 취소' : '완료 체크') : undefined}
                                    >
                                      {item.completed && <CheckCircle2 size={11} />}
                                    </button>
                                  ) : (
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink3" />
                                  )}

                                  <div className="min-w-0 flex-1 leading-snug">
                                    {tagMeta && (
                                      <span className={`mr-1.5 inline-block rounded px-1.5 py-0.2 text-[9.5px] font-bold ${tagMeta.badgeClass}`}>
                                        {tagMeta.tag}
                                      </span>
                                    )}
                                    <span className={`text-[11.5px] ${item.completed ? 'line-through text-ink3' : 'text-ink font-medium'}`}>
                                      {item.text}
                                    </span>
                                  </div>

                                  {isSelf && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (plan) void handleRemoveMyItem(plan, idx);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-ink3 hover:text-rose-500 transition-all shrink-0"
                                      title="이 업무 삭제"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {/* 진행률 게이지 바 */}
                            {progress && (
                              <div className="mt-2 flex items-center gap-2 text-[10.5px] text-ink3 pt-1 border-t border-border/40">
                                <span>{progress.completed}/{progress.total}건 완료 ({progress.percent}%)</span>
                                <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                                  <div
                                    className="h-full bg-teal rounded-full transition-all"
                                    style={{ width: `${progress.percent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      {isSelf ? (
                        <button
                          type="button"
                          onClick={() => setIsEditorOpen(true)}
                          className="shrink-0 rounded-md p-1.5 text-ink3 hover:bg-panel-alt hover:text-teal transition-colors"
                          title="계획 수정"
                        >
                          <Edit3 size={13} />
                        </button>
                      ) : (
                        plan && (
                          <button
                            type="button"
                            onClick={() => setViewingUser(user)}
                            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-ink3 hover:bg-panel-alt hover:text-ink transition-colors"
                          >
                            상세
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
