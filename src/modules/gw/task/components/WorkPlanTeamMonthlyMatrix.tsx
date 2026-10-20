import { useState, useMemo, useRef, useEffect, useLayoutEffect, Fragment, type ReactNode } from 'react';
import type { User } from '@/domain/user/schema';
import type { WorkPlan } from '@/domain/workPlan/schema';
import {
  buildCalendarMonth,
  moveCalendarMonth,
} from '@/domain/calendarEvent/calendarDate';
import { useAllWorkPlans } from '@/features/workPlan/useWorkPlans';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { extractApprovedSchedules } from '@/domain/approvalDoc/scheduleEngine';
import { scheduleChip, STATUS_TONES } from '@/domain/commute/statusDisplay';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import type { CalendarEventType } from '@/domain/calendarEvent/schema';
import { useOutsideWorks } from '@/features/outsideWork/useOutsideWorks';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import { layoutWeekBars, type WeekBar } from '@/domain/outsideWork/weekBars';
import { indexDayEntries, type DayCell, type DayEntry, type DayEntryInput } from '@/domain/workPlan/dayEntries';
import { RESOURCE_UTC_OFFSET } from '@/domain/reservation/time';
import { useWorkPlanItems, useWorkPlanTags } from '@/features/workPlan/useWorkPlanItems';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';
import { useReservations } from '@/features/resource/useReservations';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Calendar as CalendarIcon,
  Settings,
  LocateFixed,
} from 'lucide-react';

import { useHolidays } from '@/features/holiday/useHolidays';
import { KOREA_STANDARD_HOLIDAYS } from '@/domain/holiday/koreaHolidays';
import { BirthdayMark } from '@/features/birthday/BirthdayProvider';

const WEEKDAYS_KO_MON = ['월', '화', '수', '목', '금', '토', '일'];

interface DayInfo {
  dateStr: string;
  dayNum: number;
  monthNum: number;
  weekdayKo: string;
  dayOfWeek: number;
  isSat: boolean;
  isSun: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
  holidayName?: string;
  isRedDay: boolean;
}

interface WeekBlock {
  weekNum: number;
  label: string;
  hasToday: boolean;
  days: DayInfo[];
}

/** 오늘 열은 하늘색 세로선으로 위아래를 이어서, 아래쪽 행에서도 오늘 칸을 바로 찾게 한다 */
const dayColBorderClass = (isToday: boolean) =>
  isToday ? 'border-x-2 border-sky-200/80 dark:border-sky-800/70' : 'border-r border-border last:border-r-0';

/** 본표와 상단 고정 날짜 머리행이 같은 열 너비를 쓰도록 공유한다 */
const MATRIX_COLGROUP = (
  <colgroup>
    <col style={{ width: '95px' }} />
    {Array.from({ length: 7 }, (_, i) => (
      <col key={i} style={{ width: 'calc((100% - 95px) / 7)' }} />
    ))}
  </colgroup>
);

interface WorkPlanTeamMonthlyMatrixProps {
  actor: User;
  todayStr: string;
  members: User[];
  deptId?: string | null;
  /** 칸 더블클릭·[+] → 그 날짜·그 사람으로 새 일정. 없으면(사용 중이 아닌 계정) 진입점도 없다. */
  onCreate?: (date: string, member: User) => void;
  /** 칩·여러 날 막대 클릭 */
  onOpenEntry: (entry: DayEntry) => void;
  /** 칸 조회 함수가 바뀔 때마다 알린다 — 일정 창 시간표가 같은 결과를 쓴다 */
  onCellIndexChange?: (cellOf: (userId: string, date: string) => DayCell) => void;
  onOpenCompanySchedule?: (date: string, existingText?: string, planId?: string) => void;
  onOpenConfig?: () => void;
  /** 상단 고정 바 우측에 놓일 부서 필터·검색 */
  filters?: ReactNode;
}

export function WorkPlanTeamMonthlyMatrix({
  actor,
  todayStr,
  members,
  deptId,
  onCreate,
  onOpenEntry,
  onCellIndexChange,
  onOpenCompanySchedule,
  onOpenConfig,
  filters,
}: WorkPlanTeamMonthlyMatrixProps) {
  // 현재 조회 중인 월 (YYYY-MM)
  const [currentMonth, setCurrentMonth] = useState<string>(() => todayStr.slice(0, 7));
  const currentWeekRef = useRef<HTMLTableRowElement | null>(null);
  /** 이번 주차에서 로그인한 사용자의 행. 업무계획 대상이 아니면 비어 있다. */
  const myCurrentWeekRowRef = useRef<HTMLTableRowElement>(null);
  /** 고정 상단 바와 주차 머리행 — 스크롤 위치의 주차를 상단 바에 표시하는 데 쓴다 */
  const stickyBarRef = useRef<HTMLDivElement>(null);
  const weekHeaderRefs = useRef(new Map<number, HTMLTableRowElement>());
  const [visibleWeekNum, setVisibleWeekNum] = useState<number | null>(null);
  /** 본표 가로 스크롤 영역 — 상단 고정 날짜 머리행의 가로 위치를 맞추는 데 쓴다 */
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const stickyWeekScrollRef = useRef<HTMLDivElement | null>(null);

  // 공휴일 데이터 조회 및 날짜별 매핑
  const holidaysQuery = useHolidays();
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    const dbHolidays = holidaysQuery.data ?? [];
    if (dbHolidays.length > 0) {
      // DB에 공휴일이 등록되어 있으면 DB만 사용 (삭제/수정이 반영되도록)
      dbHolidays.forEach((h) => {
        map.set(h.date, h.name);
      });
    } else {
      // DB가 완전히 비어있을 때만 하드코딩 fallback 사용
      Object.values(KOREA_STANDARD_HOLIDAYS).flat().forEach((h) => {
        map.set(h.date, h.name);
      });
    }
    return map;
  }, [holidaysQuery.data]);

  // 1. 달력 월간 셀을 바탕으로 일주일(월~일 7일) 단위 주차(WeekBlock) 목록 생성
  const weeks = useMemo(() => {
    let cells: { date: string; inCurrentMonth: boolean }[] = [];
    try {
      cells = buildCalendarMonth(currentMonth);
    } catch {
      cells = [];
    }

    const list: WeekBlock[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const chunk = cells.slice(i, i + 7);
      // 이번 달 날짜가 하루라도 포함된 주차만 포함
      const hasCurrentMonth = chunk.some((c) => c.inCurrentMonth);
      if (!hasCurrentMonth) continue;

      const first = chunk[0];
      const last = chunk[6];
      const weekNum = Math.floor(i / 7) + 1;
      const fM = Number(first.date.slice(5, 7));
      const fD = Number(first.date.slice(8));
      const lM = Number(last.date.slice(5, 7));
      const lD = Number(last.date.slice(8));
      const label = `${weekNum}주차 (${fM}월 ${fD}일 ~ ${lM}월 ${lD}일)`;
      const hasToday = chunk.some((c) => c.date === todayStr);

      const days: DayInfo[] = chunk.map((c, colIdx) => {
        const [y, m, d] = c.date.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0(일) ~ 6(토)
        const holidayName = holidayMap.get(c.date);
        const isRedDay = dow === 0 || Boolean(holidayName);

        return {
          dateStr: c.date,
          dayNum: d,
          monthNum: m,
          weekdayKo: WEEKDAYS_KO_MON[colIdx],
          dayOfWeek: dow,
          isSat: dow === 6,
          isSun: dow === 0,
          isToday: c.date === todayStr,
          inCurrentMonth: c.inCurrentMonth,
          holidayName,
          isRedDay,
        };
      });

      list.push({
        weekNum,
        label,
        hasToday,
        days,
      });
    }

    return list;
  }, [currentMonth, todayStr, holidayMap]);

  // 전체 날짜 목록 (데이터 쿼리용)
  const allDays = useMemo(() => weeks.flatMap((w) => w.days), [weeks]);
  const monthStartDate = allDays[0]?.dateStr ?? `${currentMonth}-01`;
  const monthEndDate = allDays[allDays.length - 1]?.dateStr ?? `${currentMonth}-31`;

  // 2. 월간 전체 사용자 업무계획 조회 — 전사 공통 일정 줄과 이전 메모에 쓴다
  const monthlyPlansQuery = useAllWorkPlans({ from: monthStartDate, to: monthEndDate }, true);

  // 전사 공통 중요 일정 맵 (__COMPANY__)
  const companyPlansMap = useMemo(() => {
    const map = new Map<string, WorkPlan>();
    for (const plan of monthlyPlansQuery.data ?? []) {
      if (plan.ownerUserId === '__COMPANY__') map.set(plan.date, plan);
    }
    return map;
  }, [monthlyPlansQuery.data]);

  // 3. 칸에 모을 원본 — 일반 항목·회의/공인 일정·외근출장·결재 일정·이전 글·연결 예약
  const itemsQuery = useWorkPlanItems({ from: monthStartDate, to: monthEndDate });
  const tagsQuery = useWorkPlanTags();
  const approvalsQuery = useAllApprovals();
  const calendarActor = useMemo(
    () => ({ userId: actor.id, active: actor.status === '사용', deptId }),
    [actor.id, actor.status, deptId],
  );
  const calendarEventsQuery = useCalendarEvents(calendarActor, { from: monthStartDate, to: monthEndDate });
  // 결재 없이 직접 등록한 외근·출장 (전사 공개)
  const outsideWorksQuery = useOutsideWorks({ from: monthStartDate, to: monthEndDate });
  // 회의의 연결 예약 상태(대기·반려) — 예약 시각은 ISO(UTC)라 앞뒤 하루씩 넉넉히 읽는다
  const reservationRange = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const from = new Date(`${monthStartDate}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
    const to = new Date(`${monthEndDate}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
    return { from: new Date(from - DAY_MS).toISOString(), to: new Date(to + 2 * DAY_MS).toISOString() };
  }, [monthStartDate, monthEndDate]);
  const reservationsQuery = useReservations(reservationRange);

  const dayStrings = useMemo(() => allDays.map((d) => d.dateStr), [allDays]);
  /** (사람, 날짜) → 칸 목록. 한 번 훑어 만들고 칸마다 조회만 한다. */
  const cellOf = useMemo(() => {
    const input: DayEntryInput = {
      items: itemsQuery.data ?? [],
      tags: tagsQuery.data ?? [],
      events: calendarEventsQuery.data ?? [],
      outsideWorks: outsideWorksQuery.data ?? [],
      approvedSchedules: extractApprovedSchedules(approvalsQuery.data ?? []),
      legacyPlans: monthlyPlansQuery.data ?? [],
      reservations: reservationsQuery.data ?? [],
      members: members.map((m) => ({ id: m.id, name: m.name })),
    };
    return indexDayEntries(input, dayStrings);
  }, [
    itemsQuery.data,
    tagsQuery.data,
    calendarEventsQuery.data,
    outsideWorksQuery.data,
    approvalsQuery.data,
    monthlyPlansQuery.data,
    reservationsQuery.data,
    members,
    dayStrings,
  ]);

  useEffect(() => {
    onCellIndexChange?.(cellOf);
  }, [cellOf, onCellIndexChange]);

  /**
   * 한 사람의 한 주에서 여러 날에 걸친 외근·출장 — 칸을 가로지르는 막대로 그린다.
   * 하루짜리는 칸 안의 칩으로 둔다.
   */
  const weekBarsOf = (userId: string, weekDates: string[]) => {
    const views = new Map<string, OutsideScheduleView>();
    const sample = new Map<string, DayEntry>();
    for (const date of weekDates) {
      for (const entry of cellOf(userId, date).entries) {
        const view = entry.outside;
        if (view && view.startDate < view.endDate && !views.has(view.key)) {
          views.set(view.key, view);
          sample.set(view.key, entry);
        }
      }
    }
    const bars = layoutWeekBars([...views.values()], weekDates);
    return { bars, entryOf: (key: string) => sample.get(key)!, keys: new Set(views.keys()) };
  };

  // 이번 주차로 부드럽게 스크롤 — 내 행이 있으면 내 입력칸, 없으면 주차 머리행
  const scrollToCurrentWeek = () => {
    if (myCurrentWeekRowRef.current) {
      myCurrentWeekRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (currentWeekRef.current) {
      currentWeekRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const hasMembers = members.length > 0;
  useEffect(() => {
    if (currentMonth === todayStr.slice(0, 7)) {
      const timer = setTimeout(scrollToCurrentWeek, 250);
      return () => clearTimeout(timer);
    }
  }, [currentMonth, todayStr, hasMembers]);

  useEffect(() => {
    const update = () => {
      const barBottom = stickyBarRef.current?.getBoundingClientRect().bottom ?? 0;
      let current: number | null = null;
      weekHeaderRefs.current.forEach((row, weekNum) => {
        if (row.getBoundingClientRect().top <= barBottom + 8 && (current === null || weekNum > current)) current = weekNum;
      });
      // 표 끝을 지나 스크롤했으면 고정 날짜 머리행을 내린다
      const tableBottom = tableScrollRef.current?.getBoundingClientRect().bottom ?? Infinity;
      if (tableBottom <= barBottom + 48) current = null;
      setVisibleWeekNum(current);
    };
    update();
    // 스크롤 컨테이너가 화면 레이아웃에 따라 달라서 캡처 단계에서 모든 스크롤을 받는다
    document.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => moveCalendarMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => moveCalendarMonth(prev, 1));
  };

  const handleThisMonth = () => {
    setCurrentMonth(todayStr.slice(0, 7));
  };

  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const stickyWeek = visibleWeekNum !== null ? weeks.find((w) => w.weekNum === visibleWeekNum) : undefined;

  /** 주차 날짜 머리행의 칸들 (주차 이름 + 월~일) — 본표와 상단 고정 머리행이 함께 쓴다 */
  const renderWeekHeaderCells = (week: WeekBlock) => (
    <>
      {/* 주차 성명 열 헤더 */}
      <th className="border-r border-border p-2 text-center text-[11px] font-bold text-ink bg-panel-alt/80">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className="text-[11.5px] font-extrabold text-ink flex items-center gap-1">
            <span>{week.weekNum}주차</span>
          </span>
          {week.hasToday ? (
            <span className="rounded bg-teal px-1.5 py-0.2 text-[8px] font-bold text-white shadow-2xs">
              이번 주
            </span>
          ) : (
            <span className="text-[9px] text-ink3 font-medium">
              {week.days[0].monthNum}/{week.days[0].dayNum}~{week.days[6].monthNum}/{week.days[6].dayNum}
            </span>
          )}
        </div>
      </th>

      {/* 월 ~ 일 (7개 요일 열 헤더) */}
      {week.days.map((d) => {
        const isOtherMonth = !d.inCurrentMonth;
        const targetMonth = d.dateStr.slice(0, 7);

        // 빨간날(일요일 또는 공휴일): 연한 살구/장미톤, 토요일: 연한 파랑
        const headerBg = d.isRedDay
          ? 'bg-rose-100/75 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-extrabold'
          : d.isSat
          ? 'bg-blue-100/75 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
          : d.isToday
          ? 'bg-teal-50 dark:bg-teal-950/30 text-teal font-extrabold'
          : 'bg-panel-alt/60 text-ink';

        return (
          <th
            key={d.dateStr}
            onClick={() => {
              if (isOtherMonth) {
                setCurrentMonth(targetMonth);
              }
            }}
            className={`${dayColBorderClass(d.isToday)} p-1.5 text-center transition-all ${headerBg} ${
              isOtherMonth
                ? 'opacity-40 hover:opacity-100 hover:bg-teal-soft/30 hover:text-teal cursor-pointer'
                : ''
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <div className="flex items-center justify-center gap-1">
                <span className="text-[12px] font-extrabold">{d.dayNum}</span>
                <span className="text-[10px] opacity-80">({d.weekdayKo})</span>
                {isOtherMonth && (
                  <span className="text-[8.5px] font-semibold text-teal opacity-90">
                    ({d.monthNum}월)
                  </span>
                )}
                {d.isToday && (
                  <span className="rounded bg-teal px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                    오늘
                  </span>
                )}
              </div>
            </div>
          </th>
        );
      })}
    </>
  );

  const weekHeaderRowClass = (week: WeekBlock) => (week.hasToday ? 'bg-teal-soft/20' : 'bg-panel-alt/75');

  return (
    <div className="space-y-4">
      {/* ── 월간 상단 툴바 (스크롤해도 상단 고정) ── */}
      <div ref={stickyBarRef} className="sticky top-[var(--shell-top)] z-40">
      <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="이전 달"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs cursor-pointer"
            >
              이번 달
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="다음 달"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="ml-1 text-[14px] font-extrabold text-ink flex items-center gap-1.5">
            <CalendarIcon size={16} className="text-teal" />
            <span>{yearNum}년 {monthNum}월 업무계획</span>
            {visibleWeekNum !== null && (
              <span className="rounded-md bg-teal-soft/40 px-1.5 py-0.5 text-[11.5px] font-extrabold text-teal">
                {visibleWeekNum}주차
              </span>
            )}
          </h2>

          {currentMonth === todayStr.slice(0, 7) && (
            <button
              type="button"
              onClick={scrollToCurrentWeek}
              className="ml-2 flex items-center gap-1 rounded-lg border border-teal/40 bg-teal-soft/20 px-2.5 py-1 text-[11px] font-bold text-teal hover:bg-teal-soft/40 transition-colors shadow-2xs cursor-pointer"
            >
              <LocateFixed size={12} />
              <span>이번 주차로 이동</span>
            </button>
          )}
        </div>

        {/* 필터·검색 및 액션 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filters}
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="flex items-center gap-1 rounded-xl border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs cursor-pointer"
            >
              <Settings size={12} className="text-ink3" />
              <span>태그 관리</span>
            </button>
          )}
        </div>
      </div>

      </div>

      {/* 스크롤 중인 주차의 날짜·요일 머리행 — 아래쪽 사람 행에서도 날짜가 보이도록 상단 바 아래에 붙인다.
          본표는 가로 스크롤 래퍼 안에 있어 머리행에 sticky를 걸 수 없으므로 같은 열 구성으로 따로 그린다. */}
      {stickyWeek && (
        <div
          ref={(el) => {
            stickyWeekScrollRef.current = el;
            if (el && tableScrollRef.current) el.scrollLeft = tableScrollRef.current.scrollLeft;
          }}
          className="absolute inset-x-0 top-full mt-1.5 overflow-hidden rounded-lg border border-border bg-panel shadow-md"
        >
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-[11px]">
            {MATRIX_COLGROUP}
            <thead>
              <tr className={weekHeaderRowClass(stickyWeek)}>{renderWeekHeaderCells(stickyWeek)}</tr>
            </thead>
          </table>
        </div>
      )}
      </div>

      {/* ── 일주일 단위로 끊어서 아래로 이어지는 단일 통합 매트릭스 표 (가로너비 일치 & 일체형 엑셀 뷰) ── */}
      <div
        ref={tableScrollRef}
        onScroll={(e) => {
          if (stickyWeekScrollRef.current) stickyWeekScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
        className="overflow-x-auto rounded-xl border border-border bg-panel shadow-xs scrollbar-thin"
      >
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-[11px] select-text">
          {MATRIX_COLGROUP}

          <tbody>
            {weeks.map((week, wIdx) => {
              return (
                <Fragment key={week.weekNum}>
                  {/* 주차 구분 날짜 헤더 행 (주차 정보 + 7개 요일 날짜) */}
                  <tr
                    ref={(row) => {
                      if (row) weekHeaderRefs.current.set(week.weekNum, row);
                      else weekHeaderRefs.current.delete(week.weekNum);
                      if (week.hasToday) currentWeekRef.current = row;
                    }}
                    className={`border-b border-border ${wIdx > 0 ? 'border-t-2 border-t-border' : ''} ${weekHeaderRowClass(week)}`}
                  >
                    {renderWeekHeaderCells(week)}
                  </tr>

                  {/* ── 전사 공통 중요 일정 행 (사용자 요청: 모든 임직원이 작성 및 공유) ── */}
                  <tr className="border-b border-border bg-amber-50/20 dark:bg-amber-950/10">
                    <th className="border-r border-border p-1.5 text-center bg-amber-100/60 dark:bg-amber-950/40 select-none">
                      <span className="text-[10.5px] font-black text-amber-800 dark:text-amber-300 tracking-tight">
                        중요 일정
                      </span>
                    </th>

                    {week.days.map((d) => {
                      const dayStr = d.dateStr;
                      const cPlan = companyPlansMap.get(dayStr);
                      const content = cPlan?.content?.trim() || '';
                      const holidayName = d.holidayName;
                      const isRedDay = d.isRedDay;

                      return (
                        <td
                          key={dayStr}
                          onClick={() => onOpenCompanySchedule?.(dayStr, content, cPlan?.id)}
                          className={`p-1.5 align-top ${dayColBorderClass(d.isToday)} cursor-pointer transition-colors group relative ${
                            isRedDay
                              ? 'bg-rose-50/40 dark:bg-rose-950/15 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                              : d.isSat
                              ? 'bg-blue-50/30 dark:bg-blue-950/10 hover:bg-blue-50/60 dark:hover:bg-blue-950/25'
                              : 'bg-white/60 dark:bg-panel/40 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          }`}
                          title="클릭하여 전사 주요 일정을 작성/수정합니다"
                        >
                          <div className="flex flex-col gap-0.5 min-h-[26px] justify-center">
                            {/* 공휴일: 심플한 빨간 텍스트 */}
                            {holidayName && (
                              <span className="text-[9px] font-medium text-rose-400 dark:text-rose-300 truncate" title={holidayName}>
                                {holidayName}
                              </span>
                            )}
                            {/* 전사 주요 일정 내용 */}
                            {content ? (
                              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 break-words leading-tight line-clamp-2">
                                {content}
                              </div>
                            ) : !holidayName ? (
                              <div className="text-[9px] text-ink3 opacity-0 group-hover:opacity-70 transition-opacity flex items-center gap-0.5 italic">
                                <Plus size={10} className="text-ink3" />
                                <span>일정 등록</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* 해당 주차의 임직원 업무 행 목록 */}
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-ink3">
                        조회된 임직원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => {
                      const isMe = member.id === actor.id;
                      const weekDates = week.days.map((day) => day.dateStr);
                      const { bars: weekBars, entryOf, keys: barKeys } = weekBarsOf(member.id, weekDates);
                      const barLanes = weekBars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0);
                      return (
                        <Fragment key={`${week.weekNum}-${member.id}`}>
                        <tr
                          ref={week.hasToday && isMe ? myCurrentWeekRowRef : undefined}
                          className="border-b border-border/60 hover:bg-panel-alt/10 transition-colors last:border-b-0"
                        >
                          {/* 좌측 성명 열 */}
                          <td className="border-r border-border bg-panel p-2.5 align-top text-center shadow-2xs">
                            <div className="flex flex-col items-center justify-center py-1">
                              <div className="flex items-center gap-1">
                                <span className={`text-[12px] font-bold ${isMe ? 'text-teal' : 'text-ink'}`}>
                                  {/* 업무계획 한정: 대표이사 이름/직책은 '위원장'으로 표시 */}
                                  {member.name === '대표이사' || member.position === '대표이사' || member.jobTitle === '대표이사'
                                    ? '위원장'
                                    : member.name}
                                </span>
                                <BirthdayMark userId={member.id} />
                                {isMe && (
                                  <span className="rounded bg-teal-soft/50 px-1 py-0.2 text-[8px] font-bold text-teal">
                                    나
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-ink3 truncate max-w-[80px] mt-0.5">
                                {/* 업무계획 한정: 대표이사 서브라벨을 '위원회'로 표시 */}
                                {member.name === '대표이사' || member.position === '대표이사' || member.jobTitle === '대표이사'
                                  ? '위원회'
                                  : (member.position || member.jobTitle || member.dept)}
                              </span>
                            </div>
                          </td>

                          {/* 7일치 셀 (월~일) */}
                          {week.days.map((d, dayIndex) => {
                            const dayStr = d.dateStr;
                            const cell = cellOf(member.id, dayStr);
                            // 여러 날 외근·출장은 막대로 그리므로 칸 칩에서 뺀다
                            const entries = cell.entries.filter((entry) => !(entry.outside && barKeys.has(entry.outside.key)));

                            // 3단계 시각적 위계:
                            // tier 1: 오늘 내 일정 (흰색 배경 + 잉크 글씨)
                            // tier 2: 다른 날 내 일정 (기본 연한 톤)
                            // tier 3: 다른 사람들의 일정 (연하고 은은한 톤)
                            const editTier = isMe && d.isToday ? 1 : isMe ? 2 : 3;

                            // 토요일: 연파랑, 일요일/공휴일(빨간날): 연살구/장미, 오늘: 깨끗한 흰색
                            const cellBgClass = editTier === 1
                              ? 'bg-white dark:bg-panel shadow-2xs'
                              : d.isRedDay
                              ? 'bg-rose-50/30 dark:bg-rose-950/15'
                              : d.isSat
                              ? 'bg-blue-50/40 dark:bg-blue-950/20'
                              : editTier === 2
                              ? 'bg-panel/10 hover:bg-panel/40'
                              : d.isToday
                              ? 'bg-teal-50/20 dark:bg-teal-950/15'
                              : 'bg-transparent hover:bg-panel-alt/20';

                            // 내가 오늘 작성할 칸은 하늘색으로 네 변을 모두 둘러 가장 눈에 띄게 한다
                            const cellBorderClass =
                              editTier === 1 ? 'border-2 border-sky-300 dark:border-sky-600' : dayColBorderClass(d.isToday);

                            return (
                              <td
                                key={dayStr}
                                onDoubleClick={onCreate ? () => onCreate(dayStr, member) : undefined}
                                className={`group/day p-2 align-top ${cellBorderClass} transition-colors min-h-[85px] relative ${cellBgClass} ${
                                  !d.inCurrentMonth ? 'opacity-50' : ''
                                }`}
                              >
                                {onCreate && (
                                  <button
                                    type="button"
                                    aria-label={`${member.name} ${d.monthNum}월 ${d.dayNum}일 일정 추가`}
                                    title="일정 추가"
                                    onClick={() => onCreate(dayStr, member)}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                    className="absolute right-1 top-1 z-20 grid h-5 w-5 place-items-center rounded border border-border bg-panel text-ink2 opacity-0 shadow-2xs transition-opacity hover:border-teal/50 hover:text-teal focus:opacity-100 group-hover/day:opacity-100"
                                  >
                                    <Plus size={12} />
                                  </button>
                                )}
                                {/* 0) 여러 날 외근·출장 막대 — 시작 칸에서 그려 옆 칸으로 가로지른다. 모든 칸이 같은 높이를 비워 둔다 */}
                                {weekBars.filter((bar) => bar.startIndex === dayIndex).map((bar) => (
                                  <OutsideSpanBar
                                    key={bar.key}
                                    bar={bar}
                                    entry={entryOf(bar.key)}
                                    onOpen={onOpenEntry}
                                  />
                                ))}
                                {barLanes > 0 && <div style={{ height: barLanes * SPAN_LANE_HEIGHT }} aria-hidden />}
                                {/* 1) 칸 항목 칩 — 종일 먼저, 시작 시각 순 */}
                                {entries.length > 0 && (
                                  <div className="space-y-1">
                                    {entries.map((entry) => (
                                      <EntryChip key={entry.key} entry={entry} onOpen={onOpenEntry} />
                                    ))}
                                  </div>
                                )}
                                {/* 2) 이전 메모 — 예전 글(서식 제거, 읽기 전용) */}
                                {cell.legacyMemo && <LegacyMemo text={cell.legacyMemo} divided={entries.length > 0} />}
                                {entries.length === 0 && !cell.legacyMemo && <div className="min-h-[50px] w-full" />}
                              </td>
                            );
                          })}
                        </tr>
                        </Fragment>
                      );
                    })
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 여러 날 막대 한 줄의 높이(px) — 칸마다 이만큼 위를 비워 막대가 글과 겹치지 않게 한다 */
const SPAN_LANE_HEIGHT = 20;
/** 칸 안쪽 여백(p-2)과 같은 값 */
const CELL_PADDING = 8;

/** 회의(및 회의 외 캘린더 일정) 칩 색 — 기존 보라 그대로 */
const MEETING_CHIP_CLASS = 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400';
/** 모르는·지운 태그 */
const FALLBACK_TAG_CHIP_CLASS = 'bg-slate-500/10 text-slate-600 border border-slate-500/30 dark:text-slate-400';
const CALENDAR_CHIP_TAG: Record<CalendarEventType, string> = {
  GENERAL: '회의',
  MEETING: '회의',
  COMPANY_EVENT: '사내행사',
  OUTSIDE: '외근',
  VACATION: '휴가',
};

/** 칩 글(`[태그] 제목`)과 색 — 일반은 태그 색, 회의는 보라, 외근·결재는 근태와 같은 표준 정의([[statusDisplay]]) */
function chipLook(entry: DayEntry): { label: string; badgeClass: string } {
  switch (entry.source) {
    case 'ITEM': {
      const tag = entry.tag;
      const preset = tag && !tag.unknown ? TAG_COLOR_PRESETS.find((p) => p.id === tag.colorId) : undefined;
      return { label: `[${tag?.name ?? '일반'}] ${entry.title}`, badgeClass: preset?.badgeClass ?? FALLBACK_TAG_CHIP_CLASS };
    }
    case 'MEETING':
      return { label: `[회의] ${entry.title}`, badgeClass: MEETING_CHIP_CLASS };
    case 'CALENDAR':
      return {
        label: `[${entry.event ? CALENDAR_CHIP_TAG[entry.event.eventType] : '회의'}] ${entry.title}`,
        badgeClass: MEETING_CHIP_CLASS,
      };
    case 'OUTSIDE': {
      const view = entry.outside;
      const chip = scheduleChip({ category: view?.category ?? 'OUTSIDE', subType: view?.subType });
      // 동행자 칸은 '동행 · 등록자' 표시(근태에는 반영하지 않는다)
      const label = entry.companionOf
        ? `[동행] ${chip.label} · ${view?.ownerName ?? ''} (${entry.title})`
        : `[${chip.short}] ${chip.label} (${entry.title})`;
      return { label, badgeClass: STATUS_TONES[chip.kind].badge };
    }
    case 'APPROVAL': {
      const s = entry.schedule;
      if (!s) return { label: entry.title, badgeClass: FALLBACK_TAG_CHIP_CLASS };
      const chip = scheduleChip(s);
      const tag = s.category === 'LEAVE' ? '휴가' : chip.short;
      return {
        label: `[${tag}] ${chip.label}${s.category !== 'LEAVE' && s.destination ? ` (${s.destination})` : ''}`,
        badgeClass: STATUS_TONES[chip.kind].badge,
      };
    }
  }
}

const timeOf = (entry: DayEntry) => (entry.allDay || !entry.startTime ? '종일' : entry.startTime);
const timeRangeOf = (entry: DayEntry) =>
  entry.allDay || !entry.startTime ? '종일' : entry.endTime ? `${entry.startTime}~${entry.endTime}` : entry.startTime;

/** 칸 항목 칩 — `종일`/`HH:mm` + `[태그]` + 제목. 누르면 일정 창(또는 결재 상세). 결재 휴가는 상세가 없어 누르지 않는다. */
function EntryChip({ entry, onOpen }: { entry: DayEntry; onOpen: (entry: DayEntry) => void }) {
  const { label, badgeClass } = chipLook(entry);
  const openable = !(entry.source === 'APPROVAL' && !entry.outside);
  const body = (
    <>
      <span className="shrink-0 text-[8px] font-normal opacity-80">{timeOf(entry)}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {entry.roomStatus === 'PENDING' && (
        <span className="shrink-0 rounded bg-amber-soft px-1 text-[8px] font-bold text-amber">대기</span>
      )}
      {entry.roomStatus === 'REJECTED' && (
        <span className="shrink-0 rounded bg-danger/10 px-1 text-[8px] font-bold text-danger">회의실 반려</span>
      )}
      {entry.outside?.source === 'APPROVAL' && (
        <Check size={8} strokeWidth={3} className="shrink-0 opacity-40" aria-label="결재 완료" />
      )}
    </>
  );
  const chipClass = `flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[9px] font-bold shadow-2xs ${badgeClass}`;
  if (!openable) {
    return (
      <div title={`${label} (${timeRangeOf(entry)})`} className={chipClass}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(entry);
      }}
      // 칩을 두 번 눌러도 새 일정 창이 뜨지 않게
      onDoubleClick={(e) => e.stopPropagation()}
      title={`${label} (${timeRangeOf(entry)})`}
      className={`${chipClass} cursor-pointer hover:brightness-95`}
    >
      {body}
    </button>
  );
}

/** 이전 메모 — 예전 자유 글(서식 제거). 읽기 전용, 3줄 넘으면 접어 둔다. */
function LegacyMemo({ text, divided }: { text: string; divided: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className={divided ? 'mt-1.5 border-t border-border/40 pt-1' : ''}>
      <div
        ref={ref}
        className={`whitespace-pre-line break-words text-[10px] leading-relaxed text-ink3 ${expanded ? '' : 'line-clamp-3'}`}
      >
        {text}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold text-ink3 hover:text-ink2"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  );
}

/** 여러 날 외근·출장 막대 — 결재 완료 건은 끝에 옅은 체크, 누르면 상세. */
function OutsideSpanBar({ bar, entry, onOpen }: { bar: WeekBar; entry: DayEntry; onOpen: (entry: DayEntry) => void }) {
  const { label, badgeClass } = chipLook(entry);
  const view = entry.outside;
  const range = view ? `${view.startDate.slice(5).replace('-', '/')}~${view.endDate.slice(5).replace('-', '/')}` : '';
  const time = !entry.allDay && entry.startTime && entry.endTime ? `${entry.startTime}~${entry.endTime}` : '';
  return (
    <div
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(entry);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={`${label} (${range}${time ? ` · ${time}` : ''})`}
      className={`absolute z-10 flex items-center justify-between gap-1 border px-1.5 text-[9px] font-bold shadow-2xs cursor-pointer hover:brightness-95 ${badgeClass} ${
        bar.continuesBefore ? 'rounded-l-none border-l-0' : 'rounded-l'
      } ${bar.continuesAfter ? 'rounded-r-none border-r-0' : 'rounded-r'}`}
      style={{
        top: CELL_PADDING + bar.lane * SPAN_LANE_HEIGHT,
        left: bar.continuesBefore ? 0 : CELL_PADDING / 2,
        width: `calc(${bar.span * 100}% + ${bar.span - 1}px - ${(bar.continuesBefore ? 0 : CELL_PADDING / 2) + (bar.continuesAfter ? 0 : CELL_PADDING / 2)}px)`,
        height: SPAN_LANE_HEIGHT - 3,
      }}
    >
      <span className="truncate">{bar.continuesBefore ? '◂ ' : ''}{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-[8px] font-normal opacity-80">{range}{bar.continuesAfter ? ' ▸' : ''}</span>
        {view?.source === 'APPROVAL' && <Check size={8} strokeWidth={3} className="opacity-40" aria-label="결재 완료" />}
      </span>
    </div>
  );
}
