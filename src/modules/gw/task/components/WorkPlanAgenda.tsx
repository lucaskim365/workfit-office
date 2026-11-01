import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { dateLabel } from '../event/eventShared';
import { collectDayRows, countRows } from './dayAgenda';
import type { EntryKind } from './entryKind';
import { AgendaRowItem, KindFilterChips, shiftDate } from './WorkPlanDayPanel';

interface WorkPlanAgendaProps {
  /** 상단 바 맨 앞에 놓일 보기 전환 */
  viewSwitch?: ReactNode;
  actor: User;
  today: string;
  /** 보고 있는 달(YYYY-MM) */
  month: string;
  onMonthChange: (month: string) => void;
  /** 보고 있는 사람(부서 필터·검색 반영) */
  members: User[];
  cellOf: (userId: string, date: string) => DayCell;
  onOpenEntry: (entry: DayEntry) => void;
  /** 날짜 줄 누르기 → 하루 상세 패널 */
  onOpenDay: (date: string) => void;
  /** 부서 필터·검색 */
  filters?: ReactNode;
}

/** 목록 — 한 달 일정을 날짜순으로(일정 있는 날만). 같은 회의·동행 외근은 한 줄, 갈래·나만 보기로 거른다. */
export function WorkPlanAgenda({ viewSwitch, actor, today, month, onMonthChange, members, cellOf, onOpenEntry, onOpenDay, filters }: WorkPlanAgendaProps) {
  const [kind, setKind] = useState<EntryKind | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const todayRef = useRef<HTMLElement | null>(null);

  const people = useMemo(() => (mineOnly ? [actor] : members), [mineOnly, actor, members]);
  const days = useMemo(() => {
    const list: Array<{ date: string; rows: ReturnType<typeof collectDayRows> }> = [];
    for (let date = `${month}-01`; date.startsWith(month); date = shiftDate(date, 1)) {
      list.push({ date, rows: collectDayRows(people, date, cellOf) });
    }
    return list;
  }, [month, people, cellOf]);
  const counts = useMemo(() => countRows(days.flatMap((d) => d.rows)), [days]);
  const shown = days
    .map((d) => ({ ...d, rows: kind ? d.rows.filter((r) => r.kind === kind) : d.rows }))
    .filter((d) => d.rows.length > 0);

  // 이번 달이면 오늘(없으면 오늘 다음 날) 묶음으로
  const anchor = shown.find((d) => d.date >= today)?.date;
  useEffect(() => {
    if (month === today.slice(0, 7)) todayRef.current?.scrollIntoView({ block: 'start' });
  }, [month, today, Boolean(anchor)]);

  const [y, m] = month.split('-').map(Number);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {viewSwitch}
          <button type="button" aria-label="이전 달" onClick={() => onMonthChange(moveCalendarMonth(month, -1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => onMonthChange(today.slice(0, 7))} className="rounded-lg border border-border px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt">
            이번 달
          </button>
          <button type="button" aria-label="다음 달" onClick={() => onMonthChange(moveCalendarMonth(month, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">
            <ChevronRight size={16} />
          </button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{y}년 {m}월 일정</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1 text-[11.5px] font-semibold text-ink2">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-teal" />
            내 일정만
          </label>
          {!mineOnly && filters}
        </div>
      </div>
      <div className="border-b border-border px-3 py-2">
        <KindFilterChips counts={counts} value={kind} onChange={setKind} />
      </div>

      <div className="divide-y divide-border">
        {shown.length === 0 && <p className="py-10 text-center text-[12px] text-ink3">일정이 없습니다.</p>}
        {shown.map((d) => {
          const isToday = d.date === today;
          return (
            <section
              key={d.date}
              ref={d.date === anchor ? (el) => { todayRef.current = el; } : undefined}
              className="grid scroll-mt-[calc(var(--shell-top)+1rem)] grid-cols-[8.5rem_minmax(0,1fr)] gap-2 px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => onOpenDay(d.date)}
                title="하루 상세 보기"
                className={`self-start rounded-md px-2 py-1.5 text-left text-[12.5px] font-extrabold hover:bg-panel-alt ${isToday ? 'text-sky-700 dark:text-sky-300' : 'text-ink'}`}
              >
                {dateLabel(d.date)}
                {isToday && <span className="ml-1 rounded bg-sky-600 px-1 py-px align-middle text-[9.5px] font-bold text-white">오늘</span>}
              </button>
              <div className="min-w-0">
                {d.rows.map((row) => <AgendaRowItem key={row.key} row={row} onOpen={onOpenEntry} showPeople={!mineOnly} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
