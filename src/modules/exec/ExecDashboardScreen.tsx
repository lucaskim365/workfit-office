import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useBoardPosts } from '@/features/board/useBoardPosts';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useCommuteBootstrap, useCommuteEmployees, useCommuteMonth, useCommuteViewer } from '@/features/commute/useCommute';
import { useCommuteEvaluation } from '@/features/commute/useCommuteEvaluation';
import { useDepartments } from '@/features/department/useDepartments';
import { useDayEntryIndex } from '@/features/workPlan/useDayEntryIndex';
import { COMPANY_PLAN_OWNER } from '@/features/workPlan/useCompanyImportant';
import { sortPostsForList } from '@/domain/board/rules';
import { resolveDeptId } from '@/domain/department/engine';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import type { Post } from '@/domain/board/schema';
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_LABELS,
  DAY_END_MIN,
  DAY_START_MIN,
  bucketOf,
  companyEventsOn,
  donutSlices,
  firstWeekday,
  monthDates,
  nowPercent,
  shiftMonth,
  timelineSpan,
  todayKst,
  type AttendanceBucket,
} from './dashboard';

/**
 * 경영 현황 — 로그인 후 첫 화면. 오늘 하루 타임라인(회사·나), 내 근태(달력·도넛·일별 근무시간),
 * 프로젝트, 공지사항·경조사. 데이터는 기존 화면과 같은 곳에서 읽기만 한다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 근태 4분류 색 — 시안 색을 따르고 다크 모드는 같은 계열 반투명 */
const BUCKET_FILL: Record<AttendanceBucket, string> = {
  work: 'bg-[#49b1e1]',
  pending: 'bg-[#c4c8ce] dark:bg-white/25',
  late: 'bg-[#f2a17e]',
  leave: 'bg-[#d9dd7a]',
};
const BUCKET_STROKE: Record<AttendanceBucket, string> = {
  work: '#49b1e1',
  pending: '#c4c8ce',
  late: '#f2a17e',
  leave: '#d9dd7a',
};
const BUCKET_CELL: Record<AttendanceBucket, string> = {
  work: 'bg-[#cdeefa] text-[#16658f] dark:bg-sky-500/25 dark:text-sky-200',
  pending: 'bg-panel-alt text-ink3',
  late: 'bg-[#fde2d6] text-[#a4492a] dark:bg-orange-500/25 dark:text-orange-200',
  leave: 'bg-[#f3f5c8] text-[#7a7d1f] dark:bg-yellow-500/20 dark:text-yellow-200',
};

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

/** 카드 머리 — 제목과 오른쪽 이동 버튼만. 설명은 필요한 곳에만 */
function Head({ title, note, to, toLabel = '전체 보기' }: { title: string; note?: ReactNode; to?: () => void; toLabel?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">{title}</h2>
        {note && <span className="truncate text-[11.5px] text-ink3">{note}</span>}
      </div>
      {to && (
        <button type="button" onClick={to} className="shrink-0 cursor-pointer text-[11.5px] font-bold text-[#2f86c4] hover:underline">
          {toLabel}
        </button>
      )}
    </div>
  );
}

function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`min-w-0 rounded-[20px] border border-border bg-panel p-5 ${className}`}>{children}</section>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-[12px] text-ink3">{children}</div>;
}

/* ───────────────────────── 오늘 타임라인 ───────────────────────── */

interface TimelineItem {
  key: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  onClick: () => void;
}

function entryLabel(e: DayEntry): string {
  switch (e.source) {
    case 'MEETING': return '회의';
    case 'OUTSIDE': return '외근';
    case 'APPROVAL': return '결재 일정';
    case 'CALENDAR': return '일정';
    default: return e.tag?.name || '업무';
  }
}

function Lane({ label, items, tone }: { label: string; items: TimelineItem[]; tone: 'company' | 'mine' }) {
  const timed = items.filter((i) => !i.allDay && timelineSpan(i.start, i.end));
  const untimed = items.filter((i) => i.allDay || !timelineSpan(i.start, i.end));
  const block = tone === 'company'
    ? 'bg-[#fff1db] text-[#8a5a17] border-[#f0c98a] dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30'
    : 'bg-[#e0f0fb] text-[#0c5c96] border-[#9fcfee] dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30';
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3">
      <div className="pt-2 text-[11.5px] font-bold text-ink2">{label}</div>
      <div className="min-w-0">
        {untimed.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {untimed.map((i) => (
              <button key={i.key} type="button" onClick={i.onClick} title={i.title}
                className={`max-w-[260px] cursor-pointer truncate rounded-md border px-2 py-1 text-[11px] font-bold ${block}`}>
                종일 {i.title}
              </button>
            ))}
          </div>
        )}
        <div className="relative h-[38px] rounded-lg bg-panel-alt">
          {timed.map((i) => {
            const s = timelineSpan(i.start, i.end)!;
            return (
              <button
                key={i.key}
                type="button"
                onClick={i.onClick}
                title={`${i.start?.slice(0, 5)}${i.end ? `~${i.end.slice(0, 5)}` : ''} ${i.title}`}
                className={`absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-bold leading-[28px] whitespace-nowrap ${block}`}
                style={{ left: `calc(${s.left}% + 1px)`, width: `calc(${s.width}% - 2px)` }}
              >
                {i.title}
              </button>
            );
          })}
          {timed.length === 0 && untimed.length === 0 && (
            <span className="absolute inset-0 grid place-items-center text-[11px] text-ink3">일정 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DayTimeline({ company, mine }: { company: TimelineItem[]; mine: TimelineItem[] }) {
  // 지금 시각 선 — 1분마다 옮긴다
  const [now, setNow] = useState(() => nowPercent());
  useEffect(() => {
    const t = setInterval(() => setNow(nowPercent()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hours = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => DAY_START_MIN / 60 + i);
  return (
    <div className="flex flex-col gap-2.5">
      {/* 시간 눈금 */}
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
        <span />
        <div className="relative h-4">
          {hours.map((h, i) => (
            <span key={h} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-ink3" style={{ left: `${(i / (hours.length - 1)) * 100}%` }}>
              {h}
            </span>
          ))}
        </div>
      </div>
      <div className="relative flex flex-col gap-2.5">
        <Lane label="회사" items={company} tone="company" />
        <Lane label="나" items={mine} tone="mine" />
        {now !== null && (
          <div className="pointer-events-none absolute inset-y-0 left-[64px] right-0">
            <div className="absolute inset-y-[-6px] w-0.5 rounded-full bg-[#e5484d]" style={{ left: `${now}%` }}>
              <span className="absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-[#e5484d]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 근태 그래프 ───────────────────────── */

function Donut({ counts, centerTop, centerBottom }: { counts: Record<AttendanceBucket, number>; centerTop: string; centerBottom: string }) {
  const slices = donutSlices(ATTENDANCE_BUCKETS.map((k) => ({ key: k, value: counts[k] })));
  const R = 52;
  const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 2 : 0; // 조각 사이 2px 틈
  return (
    <svg viewBox="0 0 132 132" className="h-[116px] w-[116px] shrink-0" role="img" aria-label={`이번 달 근태 ${ATTENDANCE_BUCKETS.map((k) => `${ATTENDANCE_LABELS[k]} ${counts[k]}일`).join(', ')}`}>
      <circle cx="66" cy="66" r={R} fill="none" strokeWidth="14" className="stroke-panel-alt" />
      {slices.map((s) => (
        <circle
          key={s.key}
          cx="66"
          cy="66"
          r={R}
          fill="none"
          stroke={BUCKET_STROKE[s.key]}
          strokeWidth="14"
          strokeDasharray={`${Math.max(0, (s.to - s.from) * C - GAP)} ${C}`}
          strokeDashoffset={-s.from * C}
          transform="rotate(-90 66 66)"
        >
          <title>{`${ATTENDANCE_LABELS[s.key]} ${s.value}일`}</title>
        </circle>
      ))}
      <text x="66" y="63" textAnchor="middle" className="fill-ink text-[20px] font-extrabold">{centerTop}</text>
      <text x="66" y="81" textAnchor="middle" className="fill-ink3 text-[10px]">{centerBottom}</text>
    </svg>
  );
}

/** 일별 근무시간 막대 — 8시간 기준선, 0~12시간 축 */
function HoursBars({ days, today }: { days: Array<{ date: string; minutes: number; bucket: AttendanceBucket }>; today: string }) {
  const MAX = 12 * 60;
  return (
    <div className="pl-[26px]">
      <div className="relative h-[120px]">
        {/* 기준선 — 눈금 글자는 왼쪽 26px 자리에 */}
        {[4, 8, 12].map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(h * 60 / MAX) * 100}%` }}>
            <span className="absolute -top-[7px] -left-[26px] w-[22px] text-right text-[9.5px] tabular-nums text-ink3">{h}h</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pl-0.5">
          {days.map((d) => {
            const h = Math.min(d.minutes, MAX) / MAX;
            const future = d.date > today;
            return (
              <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${Number(d.date.slice(8))}일 ${Math.floor(d.minutes / 60)}시간 ${d.minutes % 60}분`}>
                {!future && d.minutes > 0 && (
                  <div className={`w-full rounded-t-[4px] ${d.bucket === 'late' ? 'bg-[#f2a17e]' : 'bg-[#0876c8]'} ${d.date === today ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} style={{ height: `${h * 100}%` }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pl-0.5">
        {days.map((d) => {
          const n = Number(d.date.slice(8));
          return (
            <span key={d.date} className={`flex-1 text-center text-[9.5px] tabular-nums ${d.date === today ? 'font-extrabold text-[#0876c8]' : 'text-ink3'}`}>
              {n === 1 || n % 5 === 0 || d.date === today ? n : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── 게시판 ───────────────────────── */

function PostList({ posts, onOpen, empty }: { posts: Post[]; onOpen: (p: Post) => void; empty: string }) {
  if (posts.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="m-0 list-none p-0">
      {posts.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen(p)} className="group grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-lg py-2 text-left">
            <span className="text-[11px] tabular-nums text-ink3">{p.date.slice(5, 10).replace('-', '.')}</span>
            <span className="flex min-w-0 items-center gap-2">
              {p.isPinned && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold text-[#c4432f] ring-1 ring-[#f3b8a6] dark:text-red-300 dark:ring-red-400/40">필독</span>}
              <span className="truncate text-[13px] text-ink group-hover:text-[#0876c8]">{p.title}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── 화면 ───────────────────────── */

export default function ExecDashboardScreen() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const today = todayKst();
  const todayWeekday = WEEKDAYS[weekdayOf(today)];

  const departmentsQuery = useDepartments();
  const deptId = useMemo(() => resolveDeptId(departmentsQuery.data ?? [], me?.dept), [departmentsQuery.data, me?.dept]);

  /* 오늘 일정 */
  const todayDates = useMemo(() => [today], [today]);
  const members = useMemo(() => (me ? [me] : []), [me]);
  const { cellOf, workPlans } = useDayEntryIndex({ actor: me, deptId, members, dates: todayDates });
  const myEntries = me ? cellOf(me.id, today).entries : [];
  const calendarActor = useMemo(() => ({ userId: me?.id ?? '__anonymous__', active: me?.status === '사용', deptId }), [me?.id, me?.status, deptId]);
  const todayRange = useMemo(() => ({ from: today, to: today }), [today]);
  const eventsQuery = useCalendarEvents(calendarActor, todayRange, Boolean(me));
  const companyImportant = workPlans.find((p) => p.ownerUserId === COMPANY_PLAN_OWNER && p.date === today && p.content?.trim())?.content?.trim();

  const companyItems: TimelineItem[] = [
    ...(companyImportant ? [{ key: 'important', title: companyImportant, start: null, end: null, allDay: true, onClick: () => navigate('/gw/work-plan') }] : []),
    ...companyEventsOn(eventsQuery.data ?? [], today).map((e) => ({
      key: e.id, title: e.title, start: e.startTime, end: e.endTime, allDay: e.allDay, onClick: () => navigate('/gw/calendar'),
    })),
  ];
  const myItems: TimelineItem[] = myEntries.map((e) => ({
    key: e.key, title: `${entryLabel(e)} ${e.title}`, start: e.startTime, end: e.endTime, allDay: e.allDay, onClick: () => navigate('/gw/work-plan'),
  }));

  /* 게시판 */
  const posts = useBoardPosts().data ?? [];
  const notices = useMemo(() => sortPostsForList(posts.filter((p) => p.boardId === 'notice')).slice(0, 6), [posts]);
  const events = useMemo(() => sortPostsForList(posts.filter((p) => p.boardId === 'event')).slice(0, 4), [posts]);
  const openPost = (p: Post) => navigate(`/gw/board?board=${p.boardId}&postId=${encodeURIComponent(p.id)}`);

  /* 내 근태 */
  const [month, setMonth] = useState(today.slice(0, 7));
  const boot = useCommuteBootstrap(month, false);
  const viewer = useCommuteViewer({ enabled: boot.isSettled }).data;
  const employees = useCommuteEmployees({ enabled: boot.isSettled }).data ?? [];
  const myEmpId = useMemo(() => {
    if (!viewer) return null;
    if (viewer.empId) return viewer.empId;
    const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, '');
    const found = employees.find((e) => (me?.name && norm(e.name) === norm(me.name)) || (me?.empNo && e.empId === Number(me.empNo)));
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
      return { date, bucket, minutes: rec.totalMin ?? 0, inAt: rec.inAt };
    });
  }, [month, myMonthQuery.data, evaluate, approvalDaysOf, me?.id, me?.name, myEmpId, today]);
  const passed = myDays.filter((d) => d.date <= today);
  const counts = ATTENDANCE_BUCKETS.reduce((acc, k) => ({ ...acc, [k]: passed.filter((d) => d.bucket === k).length }), {} as Record<AttendanceBucket, number>);
  const workedDays = passed.filter((d) => d.minutes > 0);
  const avgMin = workedDays.length ? Math.round(workedDays.reduce((s, d) => s + d.minutes, 0) / workedDays.length) : 0;
  const todayRec = myDays.find((d) => d.date === today);

  const scheduleCount = companyItems.length + myItems.length;
  const isThisMonth = month === today.slice(0, 7);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 pb-10">
      {/* ── 오늘: 날짜와 하루 타임라인 ── */}
      <Panel className="p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="text-[52px] leading-[0.9] font-black tracking-[-.06em] text-[#0876c8] tabular-nums">{Number(today.slice(8))}</div>
            <div className="pb-0.5">
              <div className="text-[13px] font-bold text-ink2">{Number(today.slice(0, 4))}년 {Number(today.slice(5, 7))}월 {todayWeekday}요일</div>
              <h1 className="mt-0.5 text-[22px] font-extrabold tracking-[-.04em] text-ink">
                {me?.name ? `${me.name}님, 오늘 일정은 ${scheduleCount}건입니다` : `오늘 일정은 ${scheduleCount}건입니다`}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/gw/calendar')} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]">캘린더</button>
            <button type="button" onClick={() => navigate('/gw/work-plan')} className="cursor-pointer rounded-lg bg-[#0876c8] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#066aaf]">업무계획</button>
          </div>
        </div>
        <DayTimeline company={companyItems} mine={myItems} />
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        {/* ── 내 근태 ── */}
        <Panel className="col-span-12 xl:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-[15px] font-extrabold tracking-tight text-ink">내 근태</h2>
              {todayRec && isThisMonth && (
                <span className="text-[11.5px] text-ink3">
                  오늘 {todayRec.inAt ? `${new Date(todayRec.inAt).toTimeString().slice(0, 5)} 출근` : '출근 기록 없음'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="지난달" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt"><ChevronLeft size={15} /></button>
              <span className="min-w-[78px] text-center text-[13px] font-extrabold tabular-nums text-ink">{month.replace('-', '. ')}</span>
              <button type="button" aria-label="다음달" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt"><ChevronRight size={15} /></button>
              {!isThisMonth && (
                <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="ml-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-bold text-[#2f86c4] hover:bg-panel-alt">이번 달</button>
              )}
              <button type="button" onClick={() => navigate('/gw/commute')} className="ml-2 cursor-pointer text-[11.5px] font-bold text-[#2f86c4] hover:underline">근태 화면</button>
            </div>
          </div>

          {myEmpId === null && boot.isSettled ? (
            <Empty>근태 기록과 연결된 사번이 없어 근태를 불러오지 못했습니다. 인사 담당자에게 사번 연결을 요청하세요.</Empty>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* 왼쪽: 도넛 + 범례, 달력 */}
              <div>
                <div className="mb-4 flex items-center gap-4">
                  <Donut counts={counts} centerTop={`${counts.work + counts.late}일`} centerBottom="출근한 날" />
                  <ul className="m-0 flex shrink-0 list-none flex-col gap-2 p-0">
                    {ATTENDANCE_BUCKETS.map((k) => (
                      <li key={k} className="flex items-center gap-2 whitespace-nowrap text-[12px] text-ink2">
                        <i className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${BUCKET_FILL[k]}`} />
                        <span className="min-w-[52px]">{ATTENDANCE_LABELS[k]}</span>
                        <strong className="tabular-nums text-ink">{counts[k]}일</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w, i) => (
                    <span key={w} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-[#d97a7a]' : i === 6 ? 'text-[#6f9cc4]' : 'text-ink3'}`}>{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstWeekday(month) }, (_, i) => <div key={`e${i}`} />)}
                  {myDays.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => navigate('/gw/commute')}
                      title={`${Number(d.date.slice(8))}일 ${d.date > today && d.bucket === 'pending' ? '' : ATTENDANCE_LABELS[d.bucket]}`}
                      className={`h-8 cursor-pointer rounded-md text-[11px] font-bold tabular-nums ${BUCKET_CELL[d.bucket]} ${d.date === today ? 'ring-2 ring-[#0876c8] ring-offset-1 ring-offset-panel' : ''} ${d.date > today ? 'opacity-50' : ''}`}
                    >
                      {Number(d.date.slice(8))}
                    </button>
                  ))}
                </div>
              </div>

              {/* 오른쪽: 일별 근무시간 */}
              <div className="flex min-w-0 flex-col">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[12.5px] font-bold text-ink">일별 근무시간</span>
                  <span className="text-[11.5px] text-ink3">
                    하루 평균 <strong className="tabular-nums text-ink">{Math.floor(avgMin / 60)}시간 {avgMin % 60}분</strong>
                  </span>
                </div>
                <HoursBars days={myDays} today={today} />
                <div className="mt-3 flex gap-4 text-[10.5px] text-ink3">
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#0876c8]" />근무</span>
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#f2a17e]" />지각한 날</span>
                  <span className="flex items-center gap-1.5"><i className="w-3 border-t border-dashed border-ink3" />4·8·12시간</span>
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* ── 프로젝트 — 아직 연결할 실제 데이터가 없어 준비 중 ── */}
        <Panel className="col-span-12 flex flex-col xl:col-span-4">
          <Head title="프로젝트" />
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border bg-panel-alt/60 py-10" aria-disabled="true">
            <div className="text-center">
              <div className="text-[14px] font-bold text-ink3">준비 중</div>
            </div>
          </div>
        </Panel>

        {/* ── 공지사항 ── */}
        <Panel className="col-span-12 lg:col-span-7">
          <Head title="공지사항" to={() => navigate('/gw/board?board=notice')} />
          <PostList posts={notices} onOpen={openPost} empty="등록된 공지사항이 없습니다." />
        </Panel>

        {/* ── 경조사 ── */}
        <Panel className="col-span-12 lg:col-span-5">
          <Head title="경조사" to={() => navigate('/gw/board?board=event')} />
          <PostList posts={events} onOpen={openPost} empty="등록된 경조사가 없습니다." />
        </Panel>
      </div>
    </div>
  );
}
