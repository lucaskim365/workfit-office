import { useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveUserScope, canViewWorkPlan, isLeaderPosition } from '@/features/auth/scopeHelper';
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
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

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
    actor?.name?.includes('테스터')
  );
  const isUserTest = Boolean(
    user.dept?.includes('테스트') ||
    user.name?.includes('테스트') ||
    user.name?.includes('테스터')
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

  const actorScope = useMemo(() => resolveUserScope(actor, userRoles), [actor, userRoles]);

  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [notice, setNotice] = useState('');

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
      .filter((user) => canViewWorkPlan(actor, user, actorScope))
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
        matchesDept = user.dept !== actor?.dept && isLeaderPosition(user.position, user.jobTitle);
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
        if (deptFilter === 'leaders' && (user.dept === actor?.dept || !isLeaderPosition(user.position, user.jobTitle))) {
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

  const save = async () => {
    if (draftText === null || !actor) return;
    const content = draftText.trim();
    if (content === '') return;
    try {
      if (myDayPlan) {
        await update.mutateAsync({ actor: workActor, id: myDayPlan.id, draft: { date: selectedDate, content } });
      } else {
        await create.mutateAsync({ actor: workActor, draft: { date: selectedDate, content } });
      }
      setDraftText(null);
      setNotice('저장했습니다.');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    }
  };

  const removeMine = async () => {
    if (!myDayPlan || !window.confirm('오늘 작성한 계획을 삭제하시겠습니까?')) return;
    await remove.mutateAsync({ actor: workActor, id: myDayPlan.id });
    setNotice('삭제했습니다.');
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="🗓️"
        name="업무계획"
        right={!authenticatedUser ? (
          <select value={actor.id} onChange={(event) => setDemoUserId(event.target.value)} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
            {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        ) : undefined}
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      {/* 내 카드 — 날짜 선택도 여기 붙는다(달력만 따로 떨어져 덩그러니 있던 걸 팝업으로 합침, 2026-08-27 피드백).
          요약만 여기, 실제 작성/수정도 팝업으로(항상 펼쳐진 입력칸이 화면을 잡아먹지 않게). */}
      <section className="mt-5 rounded-xl border border-teal/30 bg-teal-soft/10 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[12.5px] font-extrabold text-ink">{dayTitle(selectedDate)} · 내 계획</h3>
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                className="rounded-md border border-border bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-ink3 hover:border-teal/40 hover:text-teal"
              >
                📅 날짜 변경
              </button>
            </div>
            <p className={`mt-1 truncate text-[11px] ${myDayPlan ? 'text-ink2' : 'text-ink3'}`}>{myDayPlan?.content || '작성 없음'}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {myDayPlan && <Button size="sm" variant="danger" onClick={() => void removeMine()}>삭제</Button>}
            <Button size="sm" variant="primary" onClick={() => setDraftText(myDayPlan?.content ?? '')}>{myDayPlan ? '수정' : '작성'}</Button>
          </div>
        </div>
      </section>

      {/* 날짜 선택 팝업 — 달력은 이 용도 하나뿐이라 별도 상시 영역 대신 팝업으로. */}
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

      <Modal
        open={draftText !== null}
        onClose={() => setDraftText(null)}
        title={`${dayTitle(selectedDate)} · 내 계획`}
        width={640}
        footer={(
          <>
            <Button size="sm" onClick={() => setDraftText(null)}>취소</Button>
            <Button size="sm" variant="primary" disabled={(draftText ?? '').trim() === ''} onClick={() => void save()}>저장</Button>
          </>
        )}
      >
        <textarea
          value={draftText ?? ''}
          onChange={(event) => setDraftText(event.target.value)}
          maxLength={1000}
          rows={18}
          autoFocus
          placeholder="오늘 할 일을 자유롭게 적으세요"
          className="min-h-[50vh] w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
        />
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
            {actorScope === 'PERSONAL' ? (
              <option value="all">내 업무계획 (1명)</option>
            ) : actorScope === 'LEADER' ? (
              <>
                <option value="all">전체 ({roster.length}명)</option>
                {actor?.dept && (
                  <option value={actor.dept}>
                    우리 팀 · {actor.dept} ({roster.filter((u) => u.dept === actor.dept).length}명)
                  </option>
                )}
                <option value="leaders">
                  타 부서 팀장 모아보기 ({roster.filter((u) => u.dept !== actor?.dept && isLeaderPosition(u.position, u.jobTitle)).length}명)
                </option>
                {departments.filter((d) => d !== actor?.dept).map((d) => (
                  <option key={d} value={d}>
                    {d} ({roster.filter((u) => u.dept === d).length}명)
                  </option>
                ))}
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
                  const onOpen = isSelf ? () => setDraftText(myDayPlan?.content ?? '') : plan ? () => setViewingUser(user) : undefined;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={!onOpen}
                      onClick={onOpen}
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${isSelf ? 'bg-teal-soft/10' : ''} ${onOpen ? 'cursor-pointer hover:bg-panel-alt/45' : 'cursor-default'}`}
                    >
                      <div className="w-24 shrink-0 pt-0.5 text-[11px] font-bold text-ink2">
                        {user.name}
                        {user.position && <span className="ml-1 text-[9.5px] font-normal text-ink3">{user.position}</span>}
                        {isSelf && <span className="ml-1 font-semibold text-teal">(나)</span>}
                      </div>
                      <div className="min-w-0 flex-1 text-[11px] text-ink">
                        {plan ? (
                          <p className="line-clamp-2 whitespace-pre-wrap">{plan.content}</p>
                        ) : (
                          <span className="text-ink3 italic">작성 없음</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
