import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import {
  DAY_END,
  durationLabel,
  layoutColumns,
  moveRange,
  rangeFromDrag,
  resizeEnd,
  toHHmm,
  toMinutes,
  type MinuteRange,
} from '@/domain/workPlan/timeGrid';

export interface TimeGridBlock {
  key: string;
  start: number;
  end: number;
  label: string;
  tone: 'meeting' | 'outside' | 'item' | 'room';
}

interface TimeGridProps {
  date: string;
  onDateChange: (date: string) => void;
  /** 남의 일정(흐리게), 'room' = 고른 회의실 예약 */
  blocks: TimeGridBlock[];
  value: MinuteRange | null;
  allDay: boolean;
  onChange: (range: MinuteRange) => void;
  mode: 'desktop' | 'touch';
}

/** 한 시간 높이(rem). 좌표 계산은 비율만 쓰므로 body zoom 과 무관하다 */
const HOUR_REM = 2;
/** 기본으로 보이는 시간 수(08:00~19:00) */
const VISIBLE_HOURS = 11;
/** 마운트 시 맨 위에 올 시각(분) */
const INITIAL_TOP = 8 * 60;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const TONE_CLASS: Record<TimeGridBlock['tone'], string> = {
  meeting: 'border-blue/40 bg-blue-soft text-blue',
  outside: 'border-amber/40 bg-amber-soft text-amber',
  item: 'border-border-hi bg-bg-deep text-ink3',
  room: 'border-dashed border-blue bg-transparent text-blue',
};

/** 시간 있는 항목만 시간표 블록으로. 남의 시간표면 ownerName 을 앞에 붙인다 */
export function entriesToBlocks(entries: DayEntry[], ownerName?: string): TimeGridBlock[] {
  const blocks: TimeGridBlock[] = [];
  for (const entry of entries) {
    if (entry.allDay || !entry.startTime || !entry.endTime) continue;
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);
    if (end <= start) continue;
    const tone: TimeGridBlock['tone'] =
      entry.source === 'MEETING' ? 'meeting' : entry.source === 'OUTSIDE' || entry.source === 'APPROVAL' ? 'outside' : 'item';
    blocks.push({
      key: ownerName ? `${ownerName}:${entry.key}` : entry.key,
      start,
      end,
      label: (ownerName ? `${ownerName} · ` : '') + entry.title,
      tone,
    });
  }
  return blocks;
}

/** 'YYYY-MM-DD' 에 일수를 더한다(시간대 이동 없이 UTC 날짜 계산) */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

type Drag = { kind: 'new' | 'move' | 'resize'; startMinute: number; base: MinuteRange | null };

export function TimeGrid({ date, onDateChange, blocks, value, allDay, onChange, mode }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [, setTick] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    // 시각 글자는 줄 가운데에 걸쳐 있으므로 조금 위에서 시작해야 08:00 글자가 잘리지 않음
    if (el) el.scrollTop = (INITIAL_TOP / DAY_END) * el.scrollHeight - 12;
  }, []);

  const laid = useMemo(() => layoutColumns(blocks), [blocks]);
  const pct = (minutes: number) => `${(minutes / DAY_END) * 100}%`;

  /** 포인터 세로 위치 → 분 (비율 계산: zoom 영향 없음) */
  const minuteAt = (clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    const ratio = (clientY - rect.top) / rect.height;
    return Math.min(Math.max(ratio * DAY_END, 0), DAY_END - 1);
  };

  const begin = (e: ReactPointerEvent, kind: Drag['kind']) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const minute = minuteAt(e.clientY);
    dragRef.current = { kind, startMinute: minute, base: value };
    if (kind === 'new' && mode === 'desktop') {
      onChange(rangeFromDrag(minute, minute));
    }
  };

  const onMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const minute = minuteAt(e.clientY);
    if (drag.kind === 'new') {
      if (mode === 'desktop') onChange(rangeFromDrag(drag.startMinute, minute));
    } else if (drag.kind === 'move' && drag.base) {
      onChange(moveRange(drag.base, minute - drag.startMinute));
    } else if (drag.kind === 'resize' && drag.base) {
      onChange(resizeEnd(drag.base, minute));
    }
    setTick((t) => t + 1);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onGridUp = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    // 터치: 스크롤로 취소되지 않고 끝난 탭만 30분 칸으로 받는다
    if (drag && drag.kind === 'new' && mode === 'touch') {
      const minute = minuteAt(e.clientY);
      onChange(rangeFromDrag(minute, minute));
    }
  };

  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border bg-panel-alt px-2 py-1.5">
        <button
          type="button"
          aria-label="전날"
          className="rounded p-1 text-ink2 hover:bg-bg-deep"
          onClick={() => onDateChange(shiftDate(date, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-ink">{dateLabel(date)}</span>
        <button
          type="button"
          aria-label="다음날"
          className="rounded p-1 text-ink2 hover:bg-bg-deep"
          onClick={() => onDateChange(shiftDate(date, 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <span className="w-10 shrink-0 text-right text-[11px] text-ink3">종일</span>
        <div className={`h-4 flex-1 rounded ${allDay ? 'bg-blue' : 'bg-panel-alt'}`} />
      </div>

      <div ref={scrollRef} className="relative overflow-y-auto"
        style={{ height: `${VISIBLE_HOURS * HOUR_REM}rem` }}>
        <div className="relative flex" style={{ height: `${24 * HOUR_REM}rem` }}>
          <div className="relative w-12 shrink-0">
            {hours.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[11px] text-ink3"
                style={{ top: pct(h * 60) }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            className="relative flex-1 select-none border-l border-border"
            onPointerDown={(e) => begin(e, 'new')}
            onPointerMove={onMove}
            onPointerUp={onGridUp}
            onPointerCancel={endDrag}
          >
            {hours.map((h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0">
                <div className="absolute inset-x-0 border-t border-border" style={{ top: pct(h * 60) }} />
                <div className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: pct(h * 60 + 30) }} />
              </div>
            ))}

            {laid.map((b) => (
              <div
                key={b.key}
                className={`pointer-events-none absolute overflow-hidden rounded border px-1 text-[11px] leading-tight opacity-80 ${TONE_CLASS[b.tone]}`}
                style={{
                  top: pct(b.start),
                  height: pct(b.end - b.start),
                  left: `${(b.col / b.cols) * 100}%`,
                  width: `${100 / b.cols}%`,
                }}
              >
                <span className="block truncate">{b.label}</span>
              </div>
            ))}

            {value && !allDay && (
              <div
                className="absolute inset-x-1 z-10 flex flex-col rounded border border-blue bg-blue px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
                style={{
                  top: pct(value.start),
                  height: pct(value.end - value.start),
                  cursor: mode === 'desktop' ? 'grab' : undefined,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (mode === 'desktop') begin(e, 'move');
                }}
              >
                <span className="truncate">
                  {toHHmm(value.start)}~{value.end >= DAY_END ? '24:00' : toHHmm(value.end)} · {durationLabel(value)}
                </span>
                <div
                  className={`absolute inset-x-0 flex cursor-ns-resize items-end justify-center ${mode === 'touch' ? '-bottom-2 h-5' : 'bottom-0 h-3'}`}
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    begin(e, 'resize');
                  }}
                >
                  <span className="mb-0.5 h-0.5 w-6 rounded bg-white/80" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
