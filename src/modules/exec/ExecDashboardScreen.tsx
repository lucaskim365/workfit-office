import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { useBoardPosts } from '@/features/board/useBoardPosts';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import {
  useCommuteBootstrap,
  useCommuteDay,
  useCommuteEmployees,
  useCommuteMonth,
  useCommuteViewer,
} from '@/features/commute/useCommute';
import { useCommuteEvaluation } from '@/features/commute/useCommuteEvaluation';
import { useDepartments } from '@/features/department/useDepartments';
import { useProjects } from '@/features/project/useProjects';
import { useUsers } from '@/features/user/useUsers';
import { useDayEntryIndex } from '@/features/workPlan/useDayEntryIndex';
import { COMPANY_PLAN_OWNER } from '@/features/workPlan/useCompanyImportant';
import { sortPostsForList } from '@/domain/board/rules';
import { canSeeOthers } from '@/domain/commute/schema';
import { resolveDeptId } from '@/domain/department/engine';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import type { Post } from '@/domain/board/schema';
import { WORK_PROJECT_STATUS_LABELS } from '@/domain/workProject/schema';
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_LABELS,
  bucketOf,
  companyEventsOn,
  elapsedPercent,
  firstWeekday,
  monthDates,
  shiftMonth,
  todayKst,
  type AttendanceBucket,
} from './dashboard';

/**
 * 경영 현황 — 로그인 후 첫 화면. 회사 주요 일정·내 금일 일정·공지·경조사·근태·프로젝트를 한 화면에.
 * 데이터는 모두 기존 화면과 같은 곳에서 읽기만 한다(캘린더·업무계획·게시판·근태·업무관리).
 * 근태는 남의 근태를 볼 수 있는 사람(관리자·부서장)과 경영진에게 '전사 현황' 보기를 준다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const BUCKET_TONE: Record<AttendanceBucket, { chip: string; dot: string; cell: string; bar: string }> = {
  work: { chip: 'bg-[#e3f4fb] dark:bg-sky-500/15', dot: 'bg-[#49b1e1]', cell: 'bg-[#bee7f6] dark:bg-sky-500/25', bar: 'bg-[#b9e6f5] dark:bg-sky-400/50' },
  pending: { chip: 'bg-[#eff0f1] dark:bg-white/5', dot: 'bg-[#b8babd]', cell: 'bg-[#e7e8ea] dark:bg-white/10', bar: 'bg-[#e0e2e3] dark:bg-white/20' },
  late: { chip: 'bg-[#ffede5] dark:bg-orange-500/15', dot: 'bg-[#f8c7ae]', cell: 'bg-[#fce3d8] dark:bg-orange-500/25', bar: 'bg-[#fbe1d4] dark:bg-orange-400/50' },
  leave: { chip: 'bg-[#f7f9db] dark:bg-yellow-500/15', dot: 'bg-[#ecefb7]', cell: 'bg-[#f2f5c4] dark:bg-yellow-500/25', bar: 'bg-[#f0f2be] dark:bg-yellow-400/50' },
};

function korDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function timeLabel(allDay: boolean, start: string | null): string {
  return allDay || !start ? '종일' : start.slice(0, 5);
}

/** 카드 틀 — 왼쪽 파란 줄 제목, 오른쪽 부가 버튼 */
function Card({ title, subtitle, count, right, className = '', children }: {
  title: ReactNode;
  subtitle?: string;
  count?: number;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-panel p-5 shadow-[0_6px_24px_rgba(43,68,103,.045)] ${className}`}>
      <div className="mb-3.5 flex min-h-[30px] items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 text-[16px] font-extrabold tracking-tight text-ink">
            <i className="h-5 w-[5px] shrink-0 rounded-[1px] bg-[#0876c8]" />
            {title}
            {count !== undefined && (
              <span className="min-w-[26px] rounded-md bg-[#e0efff] px-2 py-0.5 text-center text-[12px] font-extrabold text-[#1478bc] dark:bg-sky-500/15 dark:text-sky-300">
                {count}
              </span>
            )}
          </div>
          {subtitle && <span className="mt-1 block text-[11px] text-ink3">{subtitle}</span>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer text-[12px] font-bold text-[#4b99c8] hover:underline">
      더보기 ›
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-1 py-6 text-[12px] text-ink3">{children}</div>;
}

const KIND_TONE: Record<string, string> = {
  회의: 'bg-[#e3f2fd] text-[#2687bd] dark:bg-sky-500/15 dark:text-sky-300',
  일정: 'bg-[#eaf1ff] text-[#4f85bf] dark:bg-blue-500/15 dark:text-blue-300',
  외근: 'bg-[#def5e9] text-[#39876c] dark:bg-emerald-500/15 dark:text-emerald-300',
  결재: 'bg-[#f0eafa] text-[#806bb8] dark:bg-violet-500/15 dark:text-violet-300',
  업무: 'bg-[#eaf1ff] text-[#4f85bf] dark:bg-blue-500/15 dark:text-blue-300',
  행사: 'bg-[#fff1db] text-[#bc8743] dark:bg-amber-500/15 dark:text-amber-300',
  전사: 'bg-[#fff1db] text-[#bc8743] dark:bg-amber-500/15 dark:text-amber-300',
};

function ScheduleRow({ time, kind, title, sub, onClick }: { time: string; kind: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid min-h-[58px] w-full cursor-pointer grid-cols-[64px_minmax(0,1fr)_14px] items-center gap-3 border-b border-border/70 py-2.5 text-left last:border-b-0"
    >
      <span className="text-[12px] font-extrabold tabular-nums text-ink3">{time}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-ink">
          <span className={`shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold ${KIND_TONE[kind] ?? KIND_TONE.일정}`}>{kind}</span>
          <span className="truncate group-hover:underline">{title}</span>
        </span>
        {sub && <span className="mt-1 block truncate text-[11px] text-ink3">{sub}</span>}
      </span>
      <ChevronRight size={14} className="text-ink3/60" />
    </button>
  );
}

function entryKind(e: DayEntry): string {
  switch (e.source) {
    case 'MEETING': return '회의';
    case 'CALENDAR': return '일정';
    case 'OUTSIDE': return '외근';
    case 'APPROVAL': return '결재';
    default: return e.tag?.name || '업무';
  }
}

function NoticeList({ posts, onOpen }: { posts: Post[]; onOpen: (p: Post) => void }) {
  if (posts.length === 0) return <Empty>등록된 글이 없습니다.</Empty>;
  return (
    <ul className="m-0 list-none p-0">
      {posts.map((p) => (
        <li key={p.id} className="border-b border-border/70 last:border-b-0">
          <button type="button" onClick={() => onOpen(p)} className="group flex min-h-[46px] w-full cursor-pointer items-center gap-2 py-2 text-left">
            {p.isPinned && (
              <span className="shrink-0 rounded-[5px] bg-[#fce3d6] px-1.5 py-0.5 text-[10px] font-extrabold text-[#d9513c] dark:bg-red-500/15 dark:text-red-300">필독</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink group-hover:underline">{p.title}</span>
            <time className="shrink-0 text-[11px] tabular-nums text-ink3">{p.date.slice(5, 10).replace('-', '.')}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ExecDashboardScreen() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { isExecutive } = usePermission();
  const today = todayKst();

  const usersQuery = useUsers();
  const users = useMemo(() => (usersQuery.data ?? []).filter((u) => u.status === '사용' && !u.resignedAt), [usersQuery.data]);
  const departmentsQuery = useDepartments();
  const deptId = useMemo(() => resolveDeptId(departmentsQuery.data ?? [], me?.dept), [departmentsQuery.data, me?.dept]);

  /* ── 일정 ── */
  const todayDates = useMemo(() => [today], [today]);
  const members = useMemo(() => (me ? [me] : []), [me]);
  const { cellOf, workPlans } = useDayEntryIndex({ actor: me, deptId, members, dates: todayDates });
  const myEntries = me ? cellOf(me.id, today).entries : [];
  const calendarActor = useMemo(
    () => ({ userId: me?.id ?? '__anonymous__', active: me?.status === '사용', deptId }),
    [me?.id, me?.status, deptId],
  );
  const todayRange = useMemo(() => ({ from: today, to: today }), [today]);
  const eventsQuery = useCalendarEvents(calendarActor, todayRange, Boolean(me));
  const companyEvents = companyEventsOn(eventsQuery.data ?? [], today);
  const companyImportant = workPlans.find((p) => p.ownerUserId === COMPANY_PLAN_OWNER && p.date === today && p.content?.trim())?.content?.trim();

  /* ── 게시판 ── */
  const postsQuery = useBoardPosts();
  const posts = postsQuery.data ?? [];
  const notices = useMemo(() => sortPostsForList(posts.filter((p) => p.boardId === 'notice')).slice(0, 5), [posts]);
  const events = useMemo(() => sortPostsForList(posts.filter((p) => p.boardId === 'event')).slice(0, 5), [posts]);
  const openPost = (p: Post) => navigate(`/gw/board?board=${p.boardId}&postId=${encodeURIComponent(p.id)}`);

  /* ── 근태 ── */
  const [month, setMonth] = useState(today.slice(0, 7));
  const boot = useCommuteBootstrap(month, false);
  const viewer = useCommuteViewer({ enabled: boot.isSettled }).data;
  const employees = useCommuteEmployees({ enabled: boot.isSettled }).data ?? [];
  const canSeeCompany = isExecutive || canSeeOthers(viewer);
  const [view, setView] = useState<'mine' | 'company' | null>(null);
  const activeView = view ?? (canSeeCompany ? 'company' : 'mine');

  const normName = (s?: string | null) => (s ?? '').replace(/\s+/g, '');
  const myEmpId = useMemo(() => {
    if (!viewer) return null;
    if (viewer.empId) return viewer.empId;
    const found = employees.find((e) => (me?.name && normName(e.name) === normName(me.name)) || (me?.empNo && e.empId === Number(me.empNo)));
    return found?.empId ?? null;
  }, [viewer, employees, me]);
  const { evaluate, approvalDaysOf } = useCommuteEvaluation();
  const myMonthQuery = useCommuteMonth(myEmpId, month, { enabled: boot.isSettled });
  const myDays = useMemo(() => {
    const approvalDays = approvalDaysOf({ id: me?.id, name: me?.name });
    const rows = new Map((myMonthQuery.data ?? []).map((r) => [r.date, r]));
    return monthDates(month).map((date) => {
      const raw = rows.get(date);
      const rec = evaluate({ empId: myEmpId ?? 0, date, inAt: raw?.inAt ?? null, outAt: raw?.outAt ?? null }, approvalDays);
      let bucket = bucketOf(rec.status);
      if (date > today && bucket !== 'leave') bucket = 'pending';
      return { date, bucket, rec };
    });
  }, [month, myMonthQuery.data, evaluate, approvalDaysOf, me?.id, me?.name, myEmpId, today]);

  const dayQuery = useCommuteDay(canSeeCompany && activeView === 'company' ? today : null);
  const [filter, setFilter] = useState<AttendanceBucket | 'all'>('all');
  const staff = useMemo(() => {
    const rows = new Map((dayQuery.data ?? []).map((r) => [r.empId, r]));
    return employees
      .filter((e) => e.active)
      .map((e) => {
        const u = users.find((x) => normName(x.name) === normName(e.name)) ?? users.find((x) => Number(x.empNo) === e.empId);
        const raw = rows.get(e.empId);
        const rec = evaluate({ empId: e.empId, date: today, inAt: raw?.inAt ?? null, outAt: raw?.outAt ?? null }, approvalDaysOf({ id: u?.id, name: e.name }));
        return { empId: e.empId, name: e.name, title: u?.jobTitle || u?.position || '', dept: u?.dept ?? '', bucket: bucketOf(rec.status), rec };
      });
  }, [dayQuery.data, employees, users, evaluate, approvalDaysOf, today]);

  /* ── 프로젝트 ── */
  const projectAccess = useMemo(() => ({ userId: me?.id ?? '__anonymous__', deptId, active: me?.status === '사용' }), [me?.id, me?.status, deptId]);
  const projectsQuery = useProjects(projectAccess);
  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((p) => p.status === 'ACTIVE').slice(0, 5),
    [projectsQuery.data],
  );

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 pb-10">
      {/* 머리 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-extrabold tracking-[.07em] text-[#1880c6]">WORKFIT INTRANET · MAIN DASHBOARD</div>
          <h1 className="text-[26px] font-extrabold tracking-[-.05em] text-ink">
            {activeView === 'company' ? '오늘의 전사 운영 현황' : '오늘의 워크핏을 한눈에'}
          </h1>
          <p className="mt-1.5 text-[13px] text-ink3">{korDateLabel(today)} · 주요 일정, 공지사항, 근태 및 프로젝트 현황</p>
        </div>
        {canSeeCompany && (
          <div className="flex gap-1 rounded-xl bg-panel-alt p-1" role="group" aria-label="보기 전환">
            {(['mine', 'company'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setView(v); setFilter('all'); }}
                aria-pressed={activeView === v}
                className={`cursor-pointer rounded-lg px-3.5 py-2 text-[12px] font-bold ${activeView === v ? 'bg-panel text-[#0d76c4] shadow-sm' : 'text-ink3'}`}
              >
                {v === 'mine' ? '내 현황' : '전사 현황'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* 회사 주요 일정 */}
        <Card className="col-span-12 lg:col-span-6" title="회사 주요 일정" subtitle="전사 공개 일정 · 회사 행사" right={<MoreButton onClick={() => navigate('/gw/calendar')} />}>
          {companyImportant && (
            <ScheduleRow time="종일" kind="전사" title={companyImportant} onClick={() => navigate('/gw/work-plan')} />
          )}
          {companyEvents.map((e) => (
            <ScheduleRow
              key={e.id}
              time={timeLabel(e.allDay, e.startTime)}
              kind={e.eventType === 'COMPANY_EVENT' ? '행사' : e.eventType === 'MEETING' ? '회의' : '일정'}
              title={e.title}
              sub={e.location ?? undefined}
              onClick={() => navigate('/gw/calendar')}
            />
          ))}
          {!companyImportant && companyEvents.length === 0 && <Empty>오늘 등록된 회사 일정이 없습니다.</Empty>}
        </Card>

        {/* 내 금일 일정 */}
        <Card className="col-span-12 lg:col-span-6" title="내 금일 일정" subtitle="나에게 배정된 회의 및 업무" right={<MoreButton onClick={() => navigate('/gw/work-plan')} />}>
          {myEntries.length === 0 ? (
            <Empty>오늘 일정이 없습니다.</Empty>
          ) : (
            myEntries.map((e) => (
              <ScheduleRow
                key={e.key}
                time={timeLabel(e.allDay, e.startTime)}
                kind={entryKind(e)}
                title={e.title}
                sub={e.event?.location ?? undefined}
                onClick={() => navigate('/gw/work-plan')}
              />
            ))
          )}
        </Card>

        {/* 공지사항 */}
        <Card className="col-span-12 lg:col-span-6" title="공지사항" count={notices.length} right={<MoreButton onClick={() => navigate('/gw/board?board=notice')} />}>
          <NoticeList posts={notices} onOpen={openPost} />
        </Card>

        {/* 경조사 */}
        <Card className="col-span-12 lg:col-span-6" title="경조사" count={events.length} right={<MoreButton onClick={() => navigate('/gw/board?board=event')} />}>
          <NoticeList posts={events} onOpen={openPost} />
        </Card>

        {/* 근태 */}
        <Card
          className="col-span-12 xl:col-span-8"
          title={activeView === 'company' ? '금일 직원 근태' : '개인 근태 요약'}
          subtitle={activeView === 'company' ? '근태 유형을 누르면 해당 직원만 표시' : '날짜를 누르면 근태 화면으로 이동'}
          right={<MoreButton onClick={() => navigate('/gw/commute')} />}
        >
          {activeView === 'company' ? (
            <>
              <div className="mb-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['work', 'pending', 'late', 'leave'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setFilter((f) => (f === b ? 'all' : b))}
                    aria-pressed={filter === b}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${BUCKET_TONE[b].chip} ${filter === b ? 'outline-2 -outline-offset-2 outline-[#117cce]' : ''}`}
                  >
                    <i className={`h-6 w-6 shrink-0 rounded-full ${BUCKET_TONE[b].dot}`} />
                    <div className="text-[11px] leading-tight text-ink2">
                      {b === 'pending' ? '출근 전/기타' : ATTENDANCE_LABELS[b]}
                      <strong className="mt-0.5 block text-[19px] tracking-tight text-ink">{staff.filter((s) => s.bucket === b).length}명</strong>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mb-2.5 flex items-center justify-between text-[11px] text-ink3">
                <span>{korDateLabel(today)} · 직원 {staff.filter((s) => filter === 'all' || s.bucket === filter).length}명</span>
                {filter !== 'all' && (
                  <button type="button" onClick={() => setFilter('all')} className="cursor-pointer rounded-md border border-border px-2 py-1 text-[#137dbe]">전체 보기 ×</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {staff.filter((s) => filter === 'all' || s.bucket === filter).map((s) => (
                  <button
                    key={s.empId}
                    type="button"
                    onClick={() => navigate('/gw/commute')}
                    className="flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl border border-border px-2 py-2.5 hover:border-[#9ac8e8]"
                  >
                    <span className={`h-[7px] w-4/5 max-w-[82px] rounded-sm ${BUCKET_TONE[s.bucket].bar}`} />
                    <span className="max-w-full truncate text-[12px] font-bold text-ink">{s.name} {s.title}</span>
                    <span className="text-[10px] text-ink3">{s.bucket === 'pending' ? (s.rec.status === 'off' ? '휴무' : '출근 전') : ATTENDANCE_LABELS[s.bucket]}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ATTENDANCE_BUCKETS.map((b) => (
                  <div key={b} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${BUCKET_TONE[b].chip}`}>
                    <i className={`h-6 w-6 shrink-0 rounded-full ${BUCKET_TONE[b].dot}`} />
                    <div className="text-[11px] leading-tight text-ink2">
                      {ATTENDANCE_LABELS[b]}
                      <strong className="mt-0.5 block text-[19px] tracking-tight text-ink">{myDays.filter((d) => d.date <= today && d.bucket === b).length}일</strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[13px] font-extrabold text-ink">
                  <button type="button" aria-label="지난달" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border text-ink3"><ChevronLeft size={14} /></button>
                  <span>{Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월</span>
                  <button type="button" aria-label="다음달" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border text-ink3"><ChevronRight size={14} /></button>
                </div>
                <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-[11px] text-[#187fc3]">이번 달</button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <span key={w} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-[#db8d8d]' : i === 6 ? 'text-[#77a1c4]' : 'text-ink3'}`}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday(month) }, (_, i) => <div key={`e${i}`} />)}
                {myDays.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => navigate('/gw/commute')}
                    className={`relative h-[46px] cursor-pointer rounded-lg px-1.5 py-1 text-left text-[11px] font-bold text-ink2 ${BUCKET_TONE[d.bucket].cell} ${d.date === today ? 'outline-2 -outline-offset-2 outline-[#0879cd]' : ''}`}
                  >
                    {Number(d.date.slice(8))}
                    <small className="block truncate text-[9px] font-medium">
                      {d.date === today ? 'TODAY' : d.date > today && d.bucket === 'pending' ? '' : ATTENDANCE_LABELS[d.bucket]}
                    </small>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-ink3">
                {ATTENDANCE_BUCKETS.map((b) => (
                  <span key={b} className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${BUCKET_TONE[b].cell}`} />{ATTENDANCE_LABELS[b]}</span>
                ))}
              </div>
              {myEmpId === null && boot.isSettled && <Empty>근태 기록과 연결된 사번이 없어 근태를 불러오지 못했습니다.</Empty>}
            </>
          )}
        </Card>

        {/* 프로젝트 현황 */}
        <Card className="col-span-12 xl:col-span-4" title="프로젝트 현황" subtitle="진행 중 프로젝트 · 기간 경과율" right={<MoreButton onClick={() => navigate('/gw/task')} />}>
          {projects.length === 0 ? (
            <Empty>진행 중인 프로젝트가 없습니다.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {projects.map((p) => {
                const pct = elapsedPercent(p);
                return (
                  <button key={p.id} type="button" onClick={() => navigate('/gw/task')} className="group block w-full cursor-pointer text-left">
                    <div className="mb-1 flex items-center justify-between gap-2.5">
                      <span className="truncate text-[12px] font-bold text-ink group-hover:underline">{p.name}</span>
                      <span className="shrink-0 text-[12px] font-extrabold text-[#1380c1]">{pct === null ? '—' : `${pct}%`}</span>
                    </div>
                    <div className="mb-1.5 truncate text-[10px] text-ink3">
                      {[p.clientName, WORK_PROJECT_STATUS_LABELS[p.status]].filter(Boolean).join(' · ')}
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-panel-alt">
                      <i className="block h-full rounded-full bg-gradient-to-r from-[#57bfe9] to-[#1186d1]" style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
