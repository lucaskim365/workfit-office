import { useState, useMemo, useRef, useEffect, useLayoutEffect, Fragment, type ReactNode } from 'react';
import type { User } from '@/domain/user/schema';
import type { WorkPlan } from '@/domain/workPlan/schema';
import {
  buildCalendarMonth,
  moveCalendarMonth,
} from '@/domain/calendarEvent/calendarDate';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import { layoutWeekBars, type WeekBar } from '@/domain/outsideWork/weekBars';
import type { DayCell, DayEntry, MemoPlanRef } from '@/domain/workPlan/dayEntries';
import { WORK_PLAN_MEMO_MAX } from '@/domain/workPlan/memo';
import { chipLook, timeOf, timeRangeOf } from './entryChipLook';
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
  StickyNote,
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
  /** 칸 더블클릭·[+] → 그 날짜·그 사람으로 새 일정. 없으면(사용 중이 아닌 계정) 진입점도 없다. */
  onCreate?: (date: string, member: User) => void;
  /** 칩·여러 날 막대 클릭 */
  onOpenEntry: (entry: DayEntry) => void;
  /** 내 칸 메모 저장. 없으면(사용 중이 아닌 계정) 메모는 보기만. 실패하면 이유를 담아 throw */
  onSaveMemo?: (date: string, memoPlan: MemoPlanRef | null, text: string) => Promise<void>;
  /** 보고 있는 달(YYYY-MM) — 화면이 들고 칸 조립 범위로도 쓴다 */
  month: string;
  onMonthChange: (month: string) => void;
  /** 화면이 만든 칸 조회([[useDayEntryIndex]]) — 표는 받아서 그리기만 한다 */
  cellOf: (userId: string, date: string) => DayCell;
  /** 예전 글 원본 — 전사 공통 일정 줄에 쓴다 */
  workPlans: WorkPlan[];
  onOpenCompanySchedule?: (date: string, existingText?: string, planId?: string) => void;
  onOpenConfig?: () => void;
  /** 상단 고정 바 우측에 놓일 부서 필터·검색 */
  filters?: ReactNode;
}

export function WorkPlanTeamMonthlyMatrix({
  actor,
  todayStr,
  members,
  month,
  onMonthChange,
  cellOf,
  workPlans: monthlyPlans,
  onCreate,
  onOpenEntry,
  onSaveMemo,
  onOpenCompanySchedule,
  onOpenConfig,
  filters,
}: WorkPlanTeamMonthlyMatrixProps) {
  // 현재 조회 중인 월 (YYYY-MM)
  const currentMonth = month;
  const setCurrentMonth = (next: string | ((prev: string) => string)) =>
    onMonthChange(typeof next === 'function' ? next(month) : next);
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

  // 2. 칸 목록은 화면이 만들어 내려 준다(cellOf) — 같은 범위는 monthGridDates(month)
  // 전사 공통 중요 일정 맵 (__COMPANY__)
  const companyPlansMap = useMemo(() => {
    const map = new Map<string, WorkPlan>();
    for (const plan of monthlyPlans) {
      if (plan.ownerUserId === '__COMPANY__') map.set(plan.date, plan);
    }
    return map;
  }, [monthlyPlans]);

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

  /**
   * 주차 날짜 머리행의 칸들 (주차 이름 + 월~일) — 본표와 상단 고정 머리행이 함께 쓴다.
   * 한 줄: '요일 날짜'. 오늘은 날짜를 청록 원으로, 토요일 파랑·일요일·공휴일 빨강 글(공휴일 이름은 옆에), 다른 달은 'M/D' 흐리게.
   */
  const renderWeekHeaderCells = (week: WeekBlock) => (
    <>
      <th
        title={`${week.days[0].monthNum}/${week.days[0].dayNum}~${week.days[6].monthNum}/${week.days[6].dayNum}`}
        className={`border-r border-border px-2 py-1 text-center text-[11.5px] font-extrabold ${week.hasToday ? 'text-sky-700 dark:text-sky-300' : 'text-ink2'}`}
      >
        {week.weekNum}주차
      </th>

      {week.days.map((d) => {
        const isOtherMonth = !d.inCurrentMonth;
        const targetMonth = d.dateStr.slice(0, 7);
        const tone = d.isRedDay ? 'text-rose-600 dark:text-rose-400' : d.isSat ? 'text-blue-600 dark:text-blue-400' : 'text-ink';
        const tint = d.isToday
          ? 'bg-sky-50 dark:bg-sky-950/30'
          : d.isRedDay
          ? 'bg-rose-50/70 dark:bg-rose-950/20'
          : d.isSat
          ? 'bg-blue-50/70 dark:bg-blue-950/20'
          : '';

        return (
          <th
            key={d.dateStr}
            onClick={() => {
              if (isOtherMonth) {
                setCurrentMonth(targetMonth);
              }
            }}
            title={d.holidayName}
            className={`${dayColBorderClass(d.isToday)} px-1.5 py-1 transition-colors ${tint} ${tone} ${
              isOtherMonth ? 'opacity-45 hover:opacity-100 cursor-pointer' : ''
            }`}
          >
            <div className="flex min-w-0 items-center justify-center gap-1 leading-none">
              <span className={`text-[10.5px] ${d.isToday ? 'font-extrabold text-sky-700 dark:text-sky-300' : 'font-semibold opacity-75'}`}>{d.weekdayKo}</span>
              {d.isToday ? (
                <span className="grid h-[1.6em] min-w-[1.6em] place-items-center rounded-full bg-sky-600 px-1 text-[12px] font-extrabold tabular-nums text-white" aria-label="오늘">
                  {d.dayNum}
                </span>
              ) : (
                <span className="text-[12.5px] font-extrabold tabular-nums">
                  {isOtherMonth ? `${d.monthNum}/${d.dayNum}` : d.dayNum}
                </span>
              )}
              {d.holidayName && <span className="min-w-0 truncate text-[9.5px] font-bold">{d.holidayName}</span>}
            </div>
          </th>
        );
      })}
    </>
  );

  const weekHeaderRowClass = (week: WeekBlock) => (week.hasToday ? 'bg-teal-soft/15' : 'bg-panel-alt/60');

  return (
    <div className="space-y-4">
      {/* ── 월간 상단 툴바 (스크롤해도 상단 고정) ── */}
      <div ref={stickyBarRef} className="sticky top-[var(--shell-top)] z-40">
      <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel px-2.5 py-1.5 shadow-sm">
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
          className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-lg border border-border bg-panel shadow-md"
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
        className="overflow-x-auto rounded-xl border border-border bg-panel shadow-xs scrollbar-thin [contain:inline-size]"
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
                                {/* 2) 메모 — 서식 없는 글. 내 칸은 눌러서 바로 고친다 */}
                                <CellMemo
                                  key={`${cell.memoPlan?.id ?? 'new'}|${cell.memo ?? ''}`}
                                  text={cell.memo}
                                  label={`${member.name} ${d.monthNum}월 ${d.dayNum}일 메모`}
                                  divided={entries.length > 0}
                                  onSave={isMe && onSaveMemo ? (text) => onSaveMemo(dayStr, cell.memoPlan, text) : undefined}
                                />
                                {entries.length === 0 && !cell.memo && <div className="min-h-[50px] w-full" />}
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

/** 칸 항목 칩 — `종일`/`HH:mm` + `[태그]` + 제목. 누르면 일정 창(또는 결재 상세). 결재 휴가는 상세가 없어 누르지 않는다. */
function EntryChip({ entry, onOpen }: { entry: DayEntry; onOpen: (entry: DayEntry) => void }) {
  const { label, badgeClass, dotClass, hint } = chipLook(entry);
  const openable = !(entry.source === 'APPROVAL' && !entry.outside);
  const body = (
    <>
      {/* 시각 칸 폭·숫자 폭 고정 — 11:00 처럼 좁은 숫자도 점·제목 열이 맞게 */}
      <span className="w-[2.8em] shrink-0 text-[8px] font-normal tabular-nums opacity-80">{timeOf(entry)}</span>
      {/* 작은 원은 확대 배율에서 픽셀 반올림으로 찌그러진다 — 크게 그려 축소(변형은 반올림하지 않는다) */}
      {dotClass && <span className={`-mx-0.5 h-2 w-2 shrink-0 scale-50 rounded-full ${dotClass}`} aria-hidden />}
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
      <div title={timeRangeOf(entry) ? `${hint} (${timeRangeOf(entry)})` : hint} className={chipClass}>
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
      title={timeRangeOf(entry) ? `${hint} (${timeRangeOf(entry)})` : hint}
      className={`${chipClass} cursor-pointer hover:brightness-95`}
    >
      {body}
    </button>
  );
}

/**
 * 칸 메모 — 서식 없는 글, 3줄 넘으면 접어 둔다. `onSave`가 있으면(내 칸) 글을 누르거나
 * 칸 오른쪽 위 메모 버튼으로 그 자리에서 고친다. 칸 밖을 누르거나 Ctrl+Enter = 저장, Esc = 취소.
 */
function CellMemo({
  text,
  label,
  divided,
  onSave,
}: {
  text: string | null;
  label: string;
  divided: boolean;
  onSave?: (text: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  const startEdit = () => {
    if (!onSave) return;
    setError('');
    setDraft(text ?? '');
  };

  const finish = async () => {
    if (draft === null || saving || !onSave) return;
    if (draft.trim() === (text ?? '').trim()) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '메모를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  if (draft !== null) {
    return (
      <div className={divided ? 'mt-1.5 border-t border-border/40 pt-1' : ''} onDoubleClick={stop}>
        <textarea
          aria-label={label}
          autoFocus
          value={draft}
          maxLength={WORK_PLAN_MEMO_MAX}
          disabled={saving}
          rows={Math.min(8, Math.max(3, draft.split('\n').length + 1))}
          placeholder="메모"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void finish()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(null);
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void finish();
            }
          }}
          className="w-full resize-none rounded border border-sky-300 bg-panel px-1.5 py-1 text-[10px] leading-relaxed text-ink outline-none focus:border-sky-400 disabled:opacity-60 dark:border-sky-700"
        />
        {error && <div role="alert" className="mt-0.5 text-[9px] font-semibold text-danger">{error}</div>}
      </div>
    );
  }

  if (!text) {
    // 메모 없는 내 칸 — 마우스를 올리면 [+] 옆에 메모 버튼
    return onSave ? (
      <button
        type="button"
        aria-label={`${label} 쓰기`}
        title="메모"
        onClick={(e) => {
          e.stopPropagation();
          startEdit();
        }}
        onDoubleClick={stop}
        className="absolute right-7 top-1 z-20 grid h-5 w-5 place-items-center rounded border border-border bg-panel text-ink2 opacity-0 shadow-2xs transition-opacity hover:border-teal/50 hover:text-teal focus:opacity-100 group-hover/day:opacity-100"
      >
        <StickyNote size={11} />
      </button>
    ) : null;
  }

  return (
    <div className={divided ? 'mt-1.5 border-t border-border/40 pt-1' : ''}>
      <div
        ref={ref}
        role={onSave ? 'button' : undefined}
        tabIndex={onSave ? 0 : undefined}
        aria-label={onSave ? `${label} 고치기` : undefined}
        title={onSave ? '눌러서 메모 고치기' : undefined}
        onClick={
          onSave
            ? (e) => {
                e.stopPropagation();
                startEdit();
              }
            : undefined
        }
        onKeyDown={
          onSave
            ? (e) => {
                if (e.key === 'Enter') startEdit();
              }
            : undefined
        }
        onDoubleClick={onSave ? stop : undefined}
        className={`whitespace-pre-line break-words text-[10px] leading-relaxed text-ink3 ${expanded ? '' : 'line-clamp-3'} ${
          onSave ? 'cursor-text rounded hover:bg-panel-alt/60' : ''
        }`}
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
