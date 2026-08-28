import { useMemo, useState } from 'react';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkTask } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
import { Card } from '@/shared/ui/Card';

interface ProjectCalendarProps {
  project: WorkProject;
  tasks: WorkTask[];
  tracks: WorkTrack[];
  onSelectTask: (task: WorkTask) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 86_400_000;
/** 한 주에 보여 줄 막대 줄 수. 넘치면 "+N"으로 접는다. */
const MAX_LANES = 3;

/** 한국 시간 기준 `YYYY-MM-DD`. 저장값이 UTC ISO라 그대로 자르면 하루가 밀린다. */
function seoulDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

/** 날짜키 → UTC 밀리초. 날짜 계산 전용이라 시간대가 끼어들지 않는다. */
function keyToMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

interface Bar {
  task: WorkTask;
  from: string;
  to: string;
}

interface Segment extends Bar {
  colStart: number;
  span: number;
  /** 이 주 이전부터 이어지는가 / 이 주 이후로 이어지는가. 끝 모양을 다르게 그린다. */
  continuesLeft: boolean;
  continuesRight: boolean;
}

/**
 * 프로젝트 달력 — 대과업 기간을 **막대 한 줄**로 그린다(애플 일정 방식).
 * ([[프로젝트관리_고도화_계획서.md]] §7)
 *
 * **과업을 달력 일정으로 복사하지 않는다.** 복사하면 고칠 때마다 두 곳이 어긋나고 어느
 * 쪽이 진실인지 알 수 없게 된다. 여기서는 `workTasks`를 그대로 읽어 그린다.
 *
 * 두 가지를 일부러 줄였다.
 * - **날짜 칸마다 제목을 반복하지 않는다.** 기간이 긴 과업일수록 같은 글자가 도배돼
 *   달력이 글자 벽이 된다. 시작~종료를 잇는 막대 하나면 기간이 한눈에 들어온다.
 * - **대과업(level 1)만 올린다.** 중·소까지 얹으면 같은 기간에 막대가 겹겹이 쌓여
 *   아무것도 안 보인다. 굵은 줄기만 보이면 세부는 과업 트리에서 펴 보게 된다.
 */
export default function ProjectCalendar({ project, tasks, tracks, onSelectTask }: ProjectCalendarProps) {
  const initial = project.startAt ? new Date(project.startAt) : new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const trackColor = useMemo(() => new Map(tracks.map((track) => [track.id, track.color])), [tracks]);

  /** 달력에 올릴 대과업 — 기간이 있어야 놓을 자리가 생긴다. */
  const bars = useMemo<Bar[]>(() => tasks
    .filter((task) => task.level === 1)
    .map((task) => {
      const start = task.startAt ? seoulDateKey(task.startAt) : null;
      const due = task.dueAt ? seoulDateKey(task.dueAt) : null;
      const from = start ?? due;
      const to = due ?? start;
      return from && to ? { task, from: from <= to ? from : to, to: from <= to ? to : from } : null;
    })
    .filter((bar): bar is Bar => bar !== null)
    .sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to)), [tasks]);

  /** 주 단위 격자 — 각 주는 일요일 시작 7일. */
  const weeks = useMemo(() => {
    const first = Date.UTC(cursor.year, cursor.month, 1);
    const lead = new Date(first).getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    const out: Array<Array<{ key: string; inMonth: boolean; day: number }>> = [];
    for (let i = 0; i < total; i += 1) {
      const ms = first + (i - lead) * DAY_MS;
      const date = new Date(ms);
      const cell = { key: msToKey(ms), inMonth: date.getUTCMonth() === cursor.month, day: date.getUTCDate() };
      if (i % 7 === 0) out.push([cell]);
      else out[out.length - 1].push(cell);
    }
    return out;
  }, [cursor]);

  /**
   * 주별 막대 배치 — 겹치지 않게 레인에 눕힌다.
   *
   * 시작이 이른 것부터 첫 빈 레인에 넣는다(그리디). 같은 레인의 앞 막대가 끝난 뒤에만
   * 다음이 들어가므로 한 줄 안에서 막대끼리 겹치지 않는다.
   */
  const layout = useMemo(() => weeks.map((week) => {
    const weekStart = week[0].key;
    const weekEnd = week[6].key;
    const lanes: Segment[][] = [];
    let overflow = 0;

    for (const bar of bars) {
      if (bar.to < weekStart || bar.from > weekEnd) continue;
      const segFrom = bar.from > weekStart ? bar.from : weekStart;
      const segTo = bar.to < weekEnd ? bar.to : weekEnd;
      const colStart = Math.round((keyToMs(segFrom) - keyToMs(weekStart)) / DAY_MS);
      const span = Math.round((keyToMs(segTo) - keyToMs(segFrom)) / DAY_MS) + 1;
      const segment: Segment = {
        ...bar,
        colStart,
        span,
        continuesLeft: bar.from < weekStart,
        continuesRight: bar.to > weekEnd,
      };

      const lane = lanes.find((rows) => rows.every((placed) => (
        colStart >= placed.colStart + placed.span || colStart + span <= placed.colStart
      )));
      if (lane) lane.push(segment);
      else if (lanes.length < MAX_LANES) lanes.push([segment]);
      else overflow += 1;
    }
    return { lanes, overflow };
  }), [bars, weeks]);

  const shift = (delta: number) => setCursor((current) => {
    const next = new Date(current.year, current.month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });

  const todayKey = seoulDateKey(new Date().toISOString());

  return (
    <Card
      title="일정"
      action={(
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">‹</button>
          <span className="min-w-[68px] text-center text-[10.5px] font-extrabold text-ink2">{cursor.year}.{String(cursor.month + 1).padStart(2, '0')}</span>
          <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">›</button>
        </div>
      )}
      bodyClassName="p-3"
    >
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label) => (
          <div key={label} className="pb-1.5 text-center text-[9px] font-bold text-ink3">{label}</div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {weeks.map((week, weekIndex) => (
          <div key={week[0].key} className={weekIndex > 0 ? 'border-t border-border' : ''}>
            <div className="grid grid-cols-7">
              {week.map((cell) => (
                <div key={cell.key} className={`px-1.5 pt-1 text-[9px] font-bold ${cell.key === todayKey ? 'text-teal' : cell.inMonth ? 'text-ink3' : 'text-ink3/40'}`}>
                  {cell.day}
                </div>
              ))}
            </div>

            <div className="space-y-0.5 px-1 pb-1.5 pt-0.5">
              {layout[weekIndex].lanes.map((lane, laneIndex) => (
                <div key={laneIndex} className="grid grid-cols-7 gap-x-0.5">
                  {lane.map((segment) => {
                    const color = trackColor.get(segment.task.trackId ?? '') ?? project.color;
                    return (
                      <button
                        key={`${segment.task.id}-${segment.colStart}`}
                        type="button"
                        onClick={() => onSelectTask(segment.task)}
                        title={`${segment.task.title} · ${segment.from} ~ ${segment.to}`}
                        style={{
                          gridColumnStart: segment.colStart + 1,
                          gridColumnEnd: `span ${segment.span}`,
                          background: `${color}26`,
                          borderLeft: segment.continuesLeft ? 'none' : `3px solid ${color}`,
                        }}
                        className={`truncate px-1.5 py-[3px] text-left text-[9px] font-bold text-ink2 hover:brightness-95 ${segment.continuesLeft ? 'rounded-l-none' : 'rounded-l'} ${segment.continuesRight ? 'rounded-r-none' : 'rounded-r'}`}
                      >
                        {/* 이어지는 막대는 제목을 다시 쓰지 않는다 — 반복이 곧 글자 벽이다. */}
                        {segment.continuesLeft ? ' ' : segment.task.title}
                      </button>
                    );
                  })}
                </div>
              ))}
              {layout[weekIndex].overflow > 0 && (
                <div className="px-1 text-[8.5px] font-bold text-ink3">+{layout[weekIndex].overflow}건 더</div>
              )}
              {layout[weekIndex].lanes.length === 0 && <div className="h-[18px]" />}
            </div>
          </div>
        ))}
      </div>

      {bars.length === 0 && (
        <p className="mt-2 text-center text-[9.5px] text-ink3">기간이 지정된 대과업이 없습니다.</p>
      )}
    </Card>
  );
}
