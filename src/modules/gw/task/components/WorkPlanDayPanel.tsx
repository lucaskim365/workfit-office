import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { PERSON_TONES } from '@/shared/theme/statusColors';
import { dateLabel } from '../event/eventShared';
import { chipLook, timeRangeOf } from './entryChipLook';
import { ENTRY_KIND_LABEL, type EntryKind } from './entryKind';
import { collectDayRows, countRows, peopleLabel, type AgendaRow } from './dayAgenda';

/** 갈래 점 색 — 일반 업무는 태그 색 점(chipLook)을 쓴다 */
export const KIND_DOT_CLASS: Record<EntryKind, string> = {
  meeting: PERSON_TONES.meeting.dot,
  outside: PERSON_TONES.outside.dot,
  trip: PERSON_TONES.trip.dot,
  leave: PERSON_TONES.leave.dot,
  item: 'bg-slate-400',
};

/** 요약 줄에 보일 순서 */
export const KIND_ORDER: EntryKind[] = ['meeting', 'outside', 'trip', 'leave', 'item'];

/** 'YYYY-MM-DD' 에 일수를 더한다(UTC 날짜 계산) */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 하루 목록 한 줄 — 시각 · 점 · 제목 · 사람. 누르면 칸 칩과 같은 상세(결재 휴가는 상세 없음) */
export function AgendaRowItem({ row, onOpen, showPeople = true }: { row: AgendaRow; onOpen: (entry: DayEntry) => void; showPeople?: boolean }) {
  const { entry, kind, people } = row;
  const { label, dotClass } = chipLook(entry);
  const time = timeRangeOf(entry);
  const openable = !(entry.source === 'APPROVAL' && !entry.outside);
  const body = (
    <>
      <span className="w-[5.6em] shrink-0 pt-px text-[11px] tabular-nums text-ink3">{time}</span>
      <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${dotClass ?? KIND_DOT_CLASS[kind]}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-ink">{label}</span>
        {showPeople && (
          <span className="block truncate text-[11px] text-ink3" title={people.map((p) => p.name).join(', ')}>
            {peopleLabel(people)}
          </span>
        )}
      </span>
    </>
  );
  const rowClass = 'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left';
  if (!openable) return <div className={rowClass}>{body}</div>;
  return (
    <button type="button" onClick={() => onOpen(entry)} className={`${rowClass} hover:bg-panel-alt`}>
      {body}
    </button>
  );
}

/** 요약·걸러 보기 칩 — 누르면 그 갈래만, 다시 누르면 전체 */
export function KindFilterChips({
  counts,
  value,
  onChange,
}: {
  counts: Record<EntryKind, number>;
  value: EntryKind | null;
  onChange: (kind: EntryKind | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="일정 갈래">
      {KIND_ORDER.map((kind) => {
        const active = value === kind;
        const empty = counts[kind] === 0;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            disabled={empty && !active}
            onClick={() => onChange(active ? null : kind)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
              active ? 'border-teal/50 bg-teal-soft/40 text-teal' : 'border-border text-ink2 hover:bg-panel-alt'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT_CLASS[kind]}`} aria-hidden />
            {ENTRY_KIND_LABEL[kind]}
            <span className="tabular-nums">{counts[kind]}</span>
          </button>
        );
      })}
    </div>
  );
}

interface WorkPlanDayPanelProps {
  date: string;
  today: string;
  actor: User;
  /** 보고 있는 사람(부서 필터·검색 반영) */
  members: User[];
  cellOf: (userId: string, date: string) => DayCell;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onOpenEntry: (entry: DayEntry) => void;
  /** 내 일정 추가 — 없으면(사용 중이 아닌 계정) 버튼도 없다 */
  onCreate?: (date: string, member: User) => void;
}

/**
 * 하루 상세 옆 패널 — 날짜 머리를 누르면 오른쪽에 그날 모든 사람의 일정을 시간순으로 펼친다.
 * 표를 가리지 않게 화면 오른쪽에 붙고, 위 요약 칩으로 갈래(회의·외근·출장·휴가·업무)를 걸러 본다.
 */
export function WorkPlanDayPanel({ date, today, actor, members, cellOf, onDateChange, onClose, onOpenEntry, onCreate }: WorkPlanDayPanelProps) {
  const [kind, setKind] = useState<EntryKind | null>(null);
  const rows = useMemo(() => collectDayRows(members, date, cellOf), [members, date, cellOf]);
  const counts = useMemo(() => countRows(rows), [rows]);
  const shown = kind ? rows.filter((r) => r.kind === kind) : rows;
  const untimed = shown.filter((r) => r.entry.allDay || !r.entry.startTime);
  const timed = shown.filter((r) => !r.entry.allDay && r.entry.startTime);
  const memos = members
    .map((m) => ({ member: m, memo: cellOf(m.id, date).memo }))
    .filter((m): m is { member: User; memo: string } => Boolean(m.memo));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={`${dateLabel(date)} 일정`}
      className="fixed bottom-0 right-0 top-[var(--shell-top)] z-40 flex w-[min(380px,100vw)] flex-col border-l border-border bg-panel shadow-xl"
    >
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button type="button" aria-label="전날" onClick={() => onDateChange(shiftDate(date, -1))} className="rounded p-1 text-ink2 hover:bg-panel-alt">
          <ChevronLeft size={16} />
        </button>
        <h3 className="flex-1 text-center text-[14px] font-extrabold text-ink">
          {dateLabel(date)}
          {date === today && <span className="ml-1.5 rounded bg-sky-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">오늘</span>}
        </h3>
        <button type="button" aria-label="다음날" onClick={() => onDateChange(shiftDate(date, 1))} className="rounded p-1 text-ink2 hover:bg-panel-alt">
          <ChevronRight size={16} />
        </button>
        <button type="button" aria-label="닫기" onClick={onClose} className="ml-1 rounded p-1 text-ink2 hover:bg-panel-alt">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2 border-b border-border px-3 py-2">
        <KindFilterChips counts={counts} value={kind} onChange={setKind} />
        {onCreate && (
          <button
            type="button"
            onClick={() => onCreate(date, actor)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal/50 hover:text-teal"
          >
            <Plus size={13} />
            내 일정 추가
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {shown.length === 0 && <p className="py-8 text-center text-[12px] text-ink3">일정이 없습니다.</p>}
        {untimed.length > 0 && (
          <section>
            <h4 className="px-2 pb-0.5 text-[11px] font-bold text-ink3">종일 · 미정</h4>
            {untimed.map((row) => <AgendaRowItem key={row.key} row={row} onOpen={onOpenEntry} />)}
          </section>
        )}
        {timed.length > 0 && (
          <section>
            <h4 className="px-2 pb-0.5 text-[11px] font-bold text-ink3">시간 일정</h4>
            {timed.map((row) => <AgendaRowItem key={row.key} row={row} onOpen={onOpenEntry} />)}
          </section>
        )}
        {!kind && memos.length > 0 && (
          <section>
            <h4 className="px-2 pb-0.5 text-[11px] font-bold text-ink3">메모</h4>
            {memos.map(({ member, memo }) => (
              <div key={member.id} className="px-2 py-1.5">
                <div className="text-[11px] font-semibold text-ink2">{member.name}</div>
                <div className="whitespace-pre-line break-words text-[11.5px] leading-relaxed text-ink3">{memo}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
