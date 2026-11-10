import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useBoardPosts } from '@/features/board/useBoardPosts';
import { useCommuteBootstrap, useCommuteEmployees, useCommuteMonth, useCommuteViewer } from '@/features/commute/useCommute';
import { useCommuteEvaluation } from '@/features/commute/useCommuteEvaluation';
import { useDepartments } from '@/features/department/useDepartments';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import { useLeave } from '@/features/gw/useLeave';
import { useReservations } from '@/features/resource/useReservations';
import { useUsers } from '@/features/user/useUsers';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { useDayEntryIndex } from '@/features/workPlan/useDayEntryIndex';
import { COMPANY_PLAN_OWNER } from '@/features/workPlan/useCompanyImportant';
import { currentApproverIds } from '@/domain/approvalDoc/engine';
import { sortPostsForList } from '@/domain/board/rules';
import { resolveDeptId } from '@/domain/department/engine';
import { USER_PRESENCE_META, type UserPresenceStatus } from '@/domain/userPresence/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import type { Post } from '@/domain/board/schema';
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_LABELS,
  DAY_END_MIN,
  DAY_START_MIN,
  bucketOf,
  donutSlices,
  firstWeekday,
  monthDates,
  nowPercent,
  packLanes,
  shiftMonth,
  timelineSpan,
  todayKst,
  type AttendanceBucket,
} from './dashboard';

/**
 * 경영 현황 위젯들 — 각 위젯이 자기 데이터를 직접 읽는다(숨긴 위젯은 읽지 않는다).
 * 모두 읽기 전용이며, 누르면 원래 화면으로 이동한다.
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

/** ISO 시각 → 한국 시간 'HH:MM' */
function kstTime(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 16);
}
function kstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 카드 머리 — 제목과 오른쪽 이동 버튼만 */
export function Head({ title, note, to, toLabel = '전체 보기' }: { title: string; note?: ReactNode; to?: () => void; toLabel?: string }) {
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

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`h-full min-w-0 rounded-[20px] border border-border bg-panel p-5 ${className}`}>{children}</section>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-[12px] text-ink3">{children}</div>;
}

function useDeptId() {
  const { user: me } = useAuth();
  const departmentsQuery = useDepartments();
  return useMemo(() => resolveDeptId(departmentsQuery.data ?? [], me?.dept), [departmentsQuery.data, me?.dept]);
}

/* ───────────────────────── 오늘 일정 ───────────────────────── */

type Tone = 'company' | 'special' | 'general';
const BLOCK: Record<Tone, string> = {
  company: 'bg-panel-alt text-ink2 border-border',
  special: 'bg-[#fff1db] text-[#8a5a17] border-[#f0c98a] dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
  general: 'bg-[#e0f0fb] text-[#0c5c96] border-[#9fcfee] dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30',
};

interface TimelineItem {
  key: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  tone: Tone;
  onClick: () => void;
}

function entryLabel(e: DayEntry): string {
  switch (e.source) {
    case 'MEETING': return '회의';
    case 'OUTSIDE': return '외근';
    case 'APPROVAL': return e.schedule?.category === 'LEAVE' ? '휴가' : '출장';
    case 'CALENDAR': return '일정';
    default: return e.tag?.name || '업무';
  }
}

/** 회의·외근·출장·휴가는 위 줄, 업무·일정은 아래 줄 */
function isSpecial(e: DayEntry): boolean {
  return e.source === 'MEETING' || e.source === 'OUTSIDE' || e.source === 'APPROVAL';
}

const LANE_H = 30;
const LANE_GAP = 3;

/** 한 묶음(위 줄 또는 아래 줄) — 겹치면 칸을 늘려 아래로 내린다 */
function LaneGroup({ items }: { items: TimelineItem[] }) {
  const { lanes, count } = packLanes(items);
  return (
    <div className="relative rounded-lg bg-panel-alt" style={{ height: count * LANE_H + (count + 1) * LANE_GAP }}>
      {lanes.map(({ item: i, lane }) => {
        const sp = timelineSpan(i.start, i.end);
        if (!sp) return null;
        return (
          <button
            key={i.key}
            type="button"
            onClick={i.onClick}
            title={`${i.start?.slice(0, 5)}${i.end ? `~${i.end.slice(0, 5)}` : ''} ${i.title}`}
            className={`absolute cursor-pointer overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-bold whitespace-nowrap ${BLOCK[i.tone]}`}
            style={{
              left: `calc(${sp.left}% + 1px)`,
              width: `calc(${sp.width}% - 2px)`,
              top: LANE_GAP + lane * (LANE_H + LANE_GAP),
              height: LANE_H,
              lineHeight: `${LANE_H - 2}px`,
            }}
          >
            {i.title}
          </button>
        );
      })}
    </div>
  );
}

function DayTimeline({ items }: { items: TimelineItem[] }) {
  // 지금 시각 선 — 1분마다 옮긴다
  const [now, setNow] = useState(() => nowPercent());
  useEffect(() => {
    const t = setInterval(() => setNow(nowPercent()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hours = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => DAY_START_MIN / 60 + i);
  const timed = items.filter((i) => !i.allDay && timelineSpan(i.start, i.end));
  const untimed = items.filter((i) => i.allDay || !timelineSpan(i.start, i.end));
  const special = timed.filter((i) => i.tone === 'special');
  const general = timed.filter((i) => i.tone !== 'special');
  return (
    <div className="flex flex-col gap-2">
      {untimed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {untimed.map((i) => (
            <button key={i.key} type="button" onClick={i.onClick} title={i.title}
              className={`max-w-[320px] cursor-pointer truncate rounded-md border px-2 py-1 text-[11px] font-bold ${BLOCK[i.tone]}`}>
              {i.title}
            </button>
          ))}
        </div>
      )}
      <div className="relative h-4">
        {hours.map((h, i) => (
          <span key={h} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-ink3" style={{ left: `${(i / (hours.length - 1)) * 100}%` }}>
            {h}
          </span>
        ))}
      </div>
      <div className="relative flex flex-col gap-1.5">
        {special.length > 0 && <LaneGroup items={special} />}
        {(general.length > 0 || special.length === 0) && <LaneGroup items={general} />}
        {now !== null && (
          <div className="pointer-events-none absolute inset-y-[-6px] w-0.5 rounded-full bg-[#e5484d]" style={{ left: `${now}%` }}>
            <span className="absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-[#e5484d]" />
          </div>
        )}
      </div>
    </div>
  );
}

export function TodayWidget() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const deptId = useDeptId();
  const today = todayKst();
  const todayDates = useMemo(() => [today], [today]);
  const members = useMemo(() => (me ? [me] : []), [me]);
  const { cellOf, workPlans } = useDayEntryIndex({ actor: me, deptId, members, dates: todayDates });
  const myEntries = me ? cellOf(me.id, today).entries : [];
  const companyImportant = workPlans.find((p) => p.ownerUserId === COMPANY_PLAN_OWNER && p.date === today && p.content?.trim())?.content?.trim();

  const items: TimelineItem[] = [
    ...(companyImportant
      ? [{ key: 'important', title: companyImportant, start: null, end: null, allDay: true, tone: 'company' as const, onClick: () => navigate('/gw/work-plan') }]
      : []),
    ...myEntries.map((e) => ({
      key: e.key,
      title: `${entryLabel(e)} ${e.title}`,
      start: e.startTime,
      end: e.endTime,
      allDay: e.allDay,
      tone: (isSpecial(e) ? 'special' : 'general') as Tone,
      onClick: () => navigate('/gw/work-plan'),
    })),
  ];

  return (
    <Panel className="p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <div className="text-[52px] leading-[0.9] font-black tracking-[-.06em] text-[#0876c8] tabular-nums">{Number(today.slice(8))}</div>
          <div className="pb-0.5">
            <div className="text-[13px] font-bold text-ink2">{Number(today.slice(0, 4))}년 {Number(today.slice(5, 7))}월 {WEEKDAYS[weekdayOf(today)]}요일</div>
            <h1 className="mt-0.5 text-[22px] font-extrabold tracking-[-.04em] text-ink">
              {me?.name ? `${me.name}님, 오늘 일정은 ${items.length}건입니다` : `오늘 일정은 ${items.length}건입니다`}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/gw/calendar')} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]">캘린더</button>
          <button type="button" onClick={() => navigate('/gw/work-plan')} className="cursor-pointer rounded-lg bg-[#0876c8] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#066aaf]">업무계획</button>
        </div>
      </div>
      <DayTimeline items={items} />
    </Panel>
  );
}

/* ───────────────────────── 내 근태 ───────────────────────── */

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

/** 일별 근무시간 막대 — 4·8·12시간 기준선 */
function HoursBars({ days, today }: { days: Array<{ date: string; minutes: number; bucket: AttendanceBucket }>; today: string }) {
  const MAX = 12 * 60;
  return (
    <div className="pl-[26px]">
      <div className="relative h-[110px]">
        {[4, 8, 12].map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(h * 60 / MAX) * 100}%` }}>
            <span className="absolute -top-[7px] -left-[26px] w-[22px] text-right text-[9.5px] tabular-nums text-ink3">{h}h</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {days.map((d) => {
            const h = Math.min(d.minutes, MAX) / MAX;
            return (
              <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${Number(d.date.slice(8))}일 ${Math.floor(d.minutes / 60)}시간 ${d.minutes % 60}분`}>
                {d.date <= today && d.minutes > 0 && (
                  <div className={`w-full rounded-t-[4px] ${d.bucket === 'late' ? 'bg-[#f2a17e]' : 'bg-[#0876c8]'} ${d.date === today ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} style={{ height: `${h * 100}%` }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]">
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

/** 연차 막대 — 사용·신청 중·남음 */
function LeaveBar({ standalone = false }: { standalone?: boolean }) {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const leave = useLeave(me?.id);
  if (leave.isLoading) return null;
  const total = Math.max(leave.grant, leave.used + leave.pending, 0.5);
  const remain = Math.max(0, leave.grant - leave.used - leave.pending);
  const seg = [
    { key: 'used', label: '사용', value: leave.used, cls: 'bg-[#0876c8]' },
    { key: 'pending', label: '신청 중', value: leave.pending, cls: 'bg-[#7cc4ec]' },
    { key: 'remain', label: '남음', value: remain, cls: 'bg-[#dfe6ef] dark:bg-white/15' },
  ].filter((s) => s.value > 0);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <button type="button" onClick={() => navigate('/gw/leave')} className={`group block w-full cursor-pointer text-left ${standalone ? '' : 'mt-5 border-t border-border pt-4'}`}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className={`font-bold text-ink group-hover:text-[#0876c8] ${standalone ? 'text-[15px] font-extrabold' : 'text-[12.5px]'}`}>연차</span>
        <span className="text-[11.5px] text-ink3">
          남은 연차 <strong className={`text-[15px] tabular-nums ${leave.remaining < 0 ? 'text-[#c4432f] dark:text-red-300' : 'text-ink'}`}>{fmt(leave.remaining)}</strong>일 / {fmt(leave.grant)}일
        </span>
      </div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {seg.map((s) => (
          <div key={s.key} className={`${s.cls} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label} ${fmt(s.value)}일`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink2">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#0876c8]" />사용 <strong className="tabular-nums text-ink">{fmt(leave.used)}</strong></span>
        {leave.pending > 0 && <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7cc4ec]" />신청 중 <strong className="tabular-nums text-ink">{fmt(leave.pending)}</strong></span>}
        {leave.substituteHoliday.remaining > 0 && <span>대체휴무 <strong className="tabular-nums text-ink">{fmt(leave.substituteHoliday.remaining)}</strong></span>}
      </div>
    </button>
  );
}

export function AttendanceWidget() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const today = todayKst();
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
  const isThisMonth = month === today.slice(0, 7);

  return (
    <Panel>
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

          {/* 오른쪽: 일별 근무시간, 연차 */}
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
            </div>
            <LeaveBar />
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ───────────────────────── 전자결재 ───────────────────────── */

export function ApprovalWidget() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { byBox, counts } = useApprovalBoxes(me?.id);
  const pending = useMemo(
    () => (me ? (byBox['대기'] ?? []).filter((d) => currentApproverIds(d).includes(me.id)) : []),
    [byBox, me],
  );
  const mineInProgress = (byBox['상신'] ?? []).filter((d) => d.status === '진행중').length;
  const tiles = [
    { label: '결재 대기', value: pending.length, box: '대기', strong: true },
    { label: '진행 중', value: mineInProgress, box: '상신' },
    { label: '반려', value: counts['반려'] ?? 0, box: '반려' },
    { label: '수신', value: counts['수신'] ?? 0, box: '수신' },
  ];
  return (
    <Panel>
      <Head title="전자결재" to={() => navigate('/gw/approval')} />
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => navigate(`/gw/approval?box=${encodeURIComponent(t.box)}`)}
            className={`cursor-pointer rounded-xl px-2 py-2.5 text-center ${t.strong ? 'bg-[#0876c8] text-white hover:bg-[#066aaf]' : 'bg-panel-alt text-ink hover:bg-[#e6eef8] dark:hover:bg-white/10'}`}
          >
            <div className="text-[22px] leading-none font-black tabular-nums">{t.value}</div>
            <div className={`mt-1.5 text-[10.5px] font-bold whitespace-nowrap ${t.strong ? 'text-white/85' : 'text-ink3'}`}>{t.label}</div>
          </button>
        ))}
      </div>
      {pending.length === 0 ? (
        <Empty>결재할 문서가 없습니다.</Empty>
      ) : (
        <ul className="m-0 list-none p-0">
          {pending.slice(0, 4).map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => navigate(`/gw/approval?doc=${encodeURIComponent(d.id)}`)} className="group flex w-full cursor-pointer items-center gap-3 py-1.5 text-left">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink group-hover:text-[#0876c8]">{d.title}</span>
                <span className="shrink-0 text-[11px] text-ink3">{d.drafterName ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ───────────────────────── 자원예약 ───────────────────────── */

export function ResourceWidget() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const today = todayKst();
  const query = useReservations(me ? { requesterUserId: me.id } : undefined);
  const upcoming = useMemo(() => {
    const nowIso = new Date().toISOString();
    return (query.data ?? [])
      .filter((r) => (r.status === 'CONFIRMED' || r.status === 'PENDING') && r.endAt >= nowIso)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 4);
  }, [query.data]);
  return (
    <Panel>
      <Head title="내 자원예약" to={() => navigate('/gw/resource')} toLabel="예약하기" />
      {upcoming.length === 0 ? (
        <Empty>다가오는 예약이 없습니다.</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {upcoming.map((r) => {
            const date = kstDate(r.startAt);
            const isToday = date === today;
            return (
              <li key={r.id}>
                <button type="button" onClick={() => navigate('/gw/resource')} className="group grid w-full cursor-pointer grid-cols-[46px_minmax(0,1fr)] items-center gap-3 rounded-xl bg-panel-alt px-3 py-2 text-left hover:bg-[#e6eef8] dark:hover:bg-white/10">
                  <span className={`text-center leading-tight ${isToday ? 'text-[#0876c8]' : 'text-ink2'}`}>
                    <span className="block text-[10px] font-bold">{isToday ? '오늘' : `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`}</span>
                    <span className="block text-[13px] font-extrabold tabular-nums">{kstTime(r.startAt)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-ink group-hover:text-[#0876c8]">{r.resourceNameSnapshot}</span>
                    <span className="block truncate text-[11px] text-ink3">
                      {kstTime(r.startAt)}~{kstTime(r.endAt)} {r.title}{r.status === 'PENDING' ? ' (승인 대기)' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ───────────────────────── 우리 부서 ───────────────────────── */

const PRESENCE_ORDER: UserPresenceStatus[] = ['ONLINE', 'MEETING', 'FOCUS', 'OUTSIDE', 'AWAY', 'LEAVE', 'OFFLINE'];

export function TeamWidget() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const users = useUsers(me?.dept ? { dept: me.dept, status: '사용' } : undefined).data ?? [];
  const presences = useAllUserPresences();
  const members = useMemo(
    () => users
      .map((u) => ({ u, status: (presences[u.id]?.status ?? 'OFFLINE') as UserPresenceStatus }))
      .sort((a, b) => PRESENCE_ORDER.indexOf(a.status) - PRESENCE_ORDER.indexOf(b.status) || a.u.name.localeCompare(b.u.name, 'ko')),
    [users, presences],
  );
  const groups = PRESENCE_ORDER.map((s) => ({ s, n: members.filter((m) => m.status === s).length })).filter((g) => g.n > 0);
  return (
    <Panel>
      <Head title={me?.dept && me.dept !== '미지정' ? me.dept : '우리 부서'} note={members.length ? `${members.length}명` : undefined} to={() => navigate('/gw/orgchart')} toLabel="조직도" />
      {members.length === 0 ? (
        <Empty>부서원이 없습니다.</Empty>
      ) : (
        <>
          <div className="mb-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full">
            {groups.map((g) => (
              <div key={g.s} className={`${USER_PRESENCE_META[g.s].dotColor} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(g.n / members.length) * 100}%` }} title={`${USER_PRESENCE_META[g.s].label} ${g.n}명`} />
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink2">
            {groups.map((g) => (
              <span key={g.s} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${USER_PRESENCE_META[g.s].dotColor}`} />{USER_PRESENCE_META[g.s].label} <strong className="tabular-nums text-ink">{g.n}</strong></span>
            ))}
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0">
            {members.slice(0, 8).map(({ u, status }) => (
              <li key={u.id} className="flex min-w-0 items-center gap-2 py-1">
                <span className="relative shrink-0">
                  {u.photoThumbUrl || u.photoUrl ? (
                    <img src={u.photoThumbUrl || u.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-panel-alt text-[11px] font-bold text-ink2">{u.name.slice(0, 1)}</span>
                  )}
                  <i className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-panel ${USER_PRESENCE_META[status].dotColor}`} />
                </span>
                <span className="min-w-0 truncate text-[12px] text-ink">
                  {u.name}<span className="ml-1 text-[11px] text-ink3">{u.position}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ───────────────────────── 공지사항 ───────────────────────── */

export function NoticeWidget() {
  const navigate = useNavigate();
  const posts = useBoardPosts().data ?? [];
  const notices = useMemo(() => sortPostsForList(posts.filter((p) => p.boardId === 'notice')).slice(0, 6), [posts]);
  const openPost = (p: Post) => navigate(`/gw/board?board=${p.boardId}&postId=${encodeURIComponent(p.id)}`);
  return (
    <Panel>
      <Head title="공지사항" to={() => navigate('/gw/board?board=notice')} />
      {notices.length === 0 ? (
        <Empty>등록된 공지사항이 없습니다.</Empty>
      ) : (
        <ul className="m-0 list-none p-0">
          {notices.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => openPost(p)} className="group grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-lg py-2 text-left">
                <span className="text-[11px] tabular-nums text-ink3">{p.date.slice(5, 10).replace('-', '.')}</span>
                <span className="flex min-w-0 items-center gap-2">
                  {p.isPinned && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold text-[#c4432f] ring-1 ring-[#f3b8a6] dark:text-red-300 dark:ring-red-400/40">필독</span>}
                  <span className="truncate text-[13px] text-ink group-hover:text-[#0876c8]">{p.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ───────────────────────── 프로젝트(준비 중) ───────────────────────── */

export function ProjectWidget() {
  return (
    <Panel className="flex flex-col">
      <Head title="프로젝트" />
      <div className="grid min-h-[120px] flex-1 place-items-center rounded-2xl border border-dashed border-border bg-panel-alt/60" aria-disabled="true">
        <div className="text-[14px] font-bold text-ink3">준비 중</div>
      </div>
    </Panel>
  );
}

/* ───────────────────────── 연차(따로) ───────────────────────── */

export function LeaveWidget() {
  return (
    <Panel>
      <LeaveBar standalone />
    </Panel>
  );
}
