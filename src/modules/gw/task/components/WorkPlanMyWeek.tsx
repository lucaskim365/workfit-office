import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarToday } from '@/domain/calendarEvent/calendarDate';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { DAY_END, SLOT_MINUTES, layoutColumns, type MinuteRange } from '@/domain/workPlan/timeGrid';
import { weekOfMonth } from '@/domain/workPlan/weekOfMonth';
import { useHolidays } from '@/features/holiday/useHolidays';
import { TONE_CLASS, entriesToBlocks } from '../event/TimeGrid';
import { chipLook } from './entryChipLook';
import { shiftDate } from './WorkPlanDayPanel';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
/** 한 시간 높이(rem) */
const HOUR_REM = 3;
/** 처음 맨 위에 올 시각(분) — 오늘 주면 지금 1시간 전 */
const INITIAL_TOP = 8 * 60;

/** 그 날이 든 주의 월요일 */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0(일) ~ 6(토)
  return shiftDate(date, -((dow + 6) % 7));
}

interface WorkPlanMyWeekProps {
  actor: User;
  /** 보고 있는 주의 월요일 */
  weekStart: string;
  onWeekChange: (monday: string) => void;
  cellOf: (userId: string, date: string) => DayCell;
  onOpenEntry: (entry: DayEntry) => void;
  /** 빈 시간 누르기 → 그 시각으로 새 일정. 없으면(사용 중이 아닌 계정) 누를 수 없다 */
  onCreate?: (date: string, member: User, range?: MinuteRange) => void;
}

/**
 * 내 주간 — 7일 × 시간 세로 시간표(구글·아웃룩 주 보기). 맨 위 줄은 종일·시간 미정 일정,
 * 빈 시간을 누르면 그 30분 칸으로 새 일정, 블록을 누르면 상세.
 */
export function WorkPlanMyWeek({ actor, weekStart, onWeekChange, cellOf, onOpenEntry, onCreate }: WorkPlanMyWeekProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const today = calendarToday(now);
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const holidaysQuery = useHolidays();
  const holidayOf = (date: string) => holidaysQuery.data?.find((h) => h.date === date)?.name;

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = shiftDate(weekStart, i);
        const entries = cellOf(actor.id, date).entries;
        const blocks = entriesToBlocks(entries);
        const byKey = new Map(entries.map((e) => [e.key, e]));
        return {
          date,
          weekday: WEEKDAYS[i],
          untimed: entries.filter((e) => e.allDay || !e.startTime),
          laid: layoutColumns(blocks.filter((b) => !b.allDay)),
          entryOf: (key: string) => byKey.get(key),
        };
      }),
    [weekStart, cellOf, actor.id],
  );
  const hasToday = days.some((d) => d.date === today);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = hasToday ? Math.max(nowMinute - 60, 0) : INITIAL_TOP;
    el.scrollTop = (top / DAY_END) * el.scrollHeight - 8;
    // 주가 바뀔 때만 맞춘다(1분마다 움직이지 않게)
  }, [weekStart]);

  const pct = (minutes: number) => `${(minutes / DAY_END) * 100}%`;
  const end = shiftDate(weekStart, 6);
  const w = weekOfMonth(weekStart);
  const [, sm, sd] = weekStart.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);

  const createAt = (date: string) => (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onCreate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.height === 0) return;
    const minute = ((e.clientY - rect.top) / rect.height) * DAY_END;
    const start = Math.min(Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES, DAY_END - SLOT_MINUTES);
    onCreate(date, actor, { start, end: start + SLOT_MINUTES });
  };

  const gridCols = 'grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2.5 py-1.5">
        <button type="button" aria-label="지난주" onClick={() => onWeekChange(shiftDate(weekStart, -7))} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => onWeekChange(mondayOf(calendarToday()))} className="rounded-lg border border-border px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt">
          이번 주
        </button>
        <button type="button" aria-label="다음 주" onClick={() => onWeekChange(shiftDate(weekStart, 7))} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">
          <ChevronRight size={16} />
        </button>
        <h2 className="ml-1 text-[14px] font-extrabold text-ink">
          {w ? `${w.month}월 ${w.week}주차` : ''}
          <span className="ml-2 text-[12px] font-semibold text-ink3">{sm}/{sd} ~ {em}/{ed}</span>
        </h2>
      </div>

      {/* 요일 머리 */}
      <div className={`${gridCols} border-b border-border bg-panel-alt/60`}>
        <div />
        {days.map((d) => {
          const holiday = holidayOf(d.date);
          const red = d.weekday === '일' || Boolean(holiday);
          const tone = red ? 'text-rose-600 dark:text-rose-400' : d.weekday === '토' ? 'text-blue-600 dark:text-blue-400' : 'text-ink';
          const isToday = d.date === today;
          return (
            <div key={d.date} className={`flex min-w-0 items-center justify-center gap-1 border-l border-border px-1 py-1.5 ${tone}`}>
              <span className="text-[11px] font-semibold opacity-75">{d.weekday}</span>
              {isToday ? (
                <span className="grid h-[1.6em] min-w-[1.6em] place-items-center rounded-full bg-sky-600 px-1 text-[12px] font-extrabold tabular-nums text-white">{Number(d.date.slice(8))}</span>
              ) : (
                <span className="text-[13px] font-extrabold tabular-nums">{Number(d.date.slice(8))}</span>
              )}
              {holiday && <span className="min-w-0 truncate text-[10px] font-bold">{holiday}</span>}
            </div>
          );
        })}
      </div>

      {/* 종일·시간 미정 줄 */}
      <div className={`${gridCols} border-b border-border`}>
        <div className="px-1 py-1 text-right text-[11px] text-ink3">종일</div>
        {days.map((d) => (
          <div
            key={d.date}
            onClick={onCreate ? () => onCreate(d.date, actor) : undefined}
            className={`min-h-[1.75rem] min-w-0 space-y-0.5 border-l border-border p-0.5 ${onCreate ? 'cursor-pointer' : ''}`}
          >
            {d.untimed.map((entry) => {
              const { label, badgeClass, dotClass } = chipLook(entry);
              return (
                <button
                  key={entry.key}
                  type="button"
                  title={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEntry(entry);
                  }}
                  className={`flex w-full items-center gap-1 truncate rounded border px-1.5 py-px text-left text-[11px] font-semibold ${badgeClass}`}
                >
                  {dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 시간표 */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: 'max(24rem, calc(100vh / var(--font-scale, 1) - 22rem))' }}>
        <div className={`${gridCols} relative`} style={{ height: `${24 * HOUR_REM}rem` }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-ink3" style={{ top: pct(h * 60) }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((d) => {
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                onClick={createAt(d.date)}
                className={`relative border-l border-border ${isToday ? 'bg-sky-50/40 dark:bg-sky-950/15' : ''} ${onCreate ? 'cursor-pointer' : ''}`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: pct(h * 60) }}>
                    <div className="border-t border-border" />
                    <div className="border-t border-dashed border-border/50" style={{ marginTop: `${HOUR_REM / 2}rem` }} />
                  </div>
                ))}
                {d.laid.map((b) => {
                  const entry = d.entryOf(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      title={b.time ? `${b.label} (${b.time})` : b.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (entry) onOpenEntry(entry);
                      }}
                      className={`absolute overflow-hidden rounded border px-1 py-px text-left text-[11px] leading-tight shadow-2xs hover:brightness-95 ${TONE_CLASS[b.tone]}`}
                      style={{
                        top: pct(b.start),
                        height: pct(b.end - b.start),
                        left: `calc(${(b.col / b.cols) * 100}% + 1px)`,
                        width: `calc(${100 / b.cols}% - 2px)`,
                      }}
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        {b.dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${b.dotClass}`} aria-hidden />}
                        <span className="truncate">{b.label}</span>
                      </span>
                      {b.time && <span className="block truncate text-[10px] opacity-75">{b.time}</span>}
                    </button>
                  );
                })}
                {/* 지금 시각 선 */}
                {isToday && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: pct(nowMinute) }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
