import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, ChevronDown, MapPin, Plane, Repeat, Users, type LucideIcon } from 'lucide-react';
import { reservationRepo } from '@/data/reservation/reservation.repo';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import { OUTSIDE_WORK_SUBTYPES } from '@/domain/outsideWork/schema';
import type { Reservation } from '@/domain/reservation/schema';
import { RESOURCE_UTC_OFFSET } from '@/domain/reservation/time';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { resolveTag, selectableGeneralTags } from '@/domain/workPlan/tag';
import { DAY_END } from '@/domain/workPlan/timeGrid';
import { RESERVATION_KEY } from '@/features/resource/useReservations';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';
import { useWorkPlanTags } from '@/features/workPlan/useWorkPlanItems';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { EventFields, applyDate, applyRange, type EventForm } from './EventFields';
import { TimeGrid, entriesToBlocks, type TimeGridBlock } from './TimeGrid';
import { useWorkPlanEventForm, type EventKind, type EventTarget } from './useWorkPlanEventForm';

interface WorkPlanEventModalProps {
  target: EventTarget;
  actor: User;
  deptId: string | null;
  users: User[];
  /** 부모가 만든 칸 조회(indexDayEntries) — 시간표에 겹쳐 보일 그날 일정 */
  cellOf: (userId: string, date: string) => DayCell;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 24 * 60 * 60 * 1000;
const OCCUPYING: Reservation['status'][] = ['PENDING', 'CONFIRMED'];

const SAVED_MESSAGE: Record<EventKind, string> = {
  ITEM: '업무를 저장했습니다.',
  MEETING: '회의를 저장했습니다.',
  OUTSIDE: '외근·출장을 저장했습니다.',
  TRIP: '외근·출장을 저장했습니다.',
};

const FIXED_KINDS: Array<{ kind: Exclude<EventKind, 'ITEM'>; label: string; Icon: LucideIcon }> = [
  { kind: 'MEETING', label: '회의', Icon: Users },
  { kind: 'OUTSIDE', label: '외근', Icon: MapPin },
  { kind: 'TRIP', label: '출장', Icon: Plane },
];

const isOutsideKind = (kind: EventKind) => kind === 'OUTSIDE' || kind === 'TRIP';

function dateLabel(date: string): string {
  if (!isValidCalendarDate(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

const dotClassOf = (colorId: string) => TAG_COLOR_PRESETS.find((p) => p.id === colorId)?.dotColor ?? 'bg-slate-500';

/** 같은 일정이 여러 사람 칸에 나와도 한 번만 — 원본 id 기준 */
function sourceIdOf(entry: DayEntry): string {
  return entry.item?.id ?? entry.event?.id ?? entry.outside?.self?.id ?? entry.outside?.approval?.docId ?? entry.key;
}

/** 일정 주인 — 새 일정은 칸 주인, 기존 일정은 등록한 사람 */
function ownerOf(target: EventTarget, users: User[]): { id: string; name: string } {
  if (target.mode === 'create') return { id: target.owner.id, name: target.owner.name };
  const entry = target.entry;
  const id = entry.item?.ownerUserId ?? entry.event?.ownerUserId ?? entry.outside?.ownerUserId ?? entry.schedule?.drafterId ?? '';
  const name = users.find((u) => u.id === id)?.name ?? entry.outside?.ownerName ?? entry.schedule?.drafterName ?? '';
  return { id, name };
}

/** 고른 회의실의 그날 예약 → 시간표 블록(회의실 시간대 기준, 날을 넘으면 잘라서) */
function roomBlocksOf(reservations: Reservation[], roomId: string, date: string, ignoreId: string | null): TimeGridBlock[] {
  const dayStart = new Date(`${date}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
  if (Number.isNaN(dayStart)) return [];
  const blocks: TimeGridBlock[] = [];
  for (const row of reservations) {
    if (row.resourceId !== roomId || row.id === ignoreId || !OCCUPYING.includes(row.status)) continue;
    const start = Math.max((new Date(row.startAt).getTime() - dayStart) / 60000, 0);
    const end = Math.min((new Date(row.endAt).getTime() - dayStart) / 60000, DAY_END);
    if (end <= start) continue;
    blocks.push({ key: `room-${row.id}`, start, end, label: `회의실 예약 · ${row.title}`, tone: 'room' });
  }
  return blocks;
}

/**
 * 업무계획 일정 창(PC) — 팀즈 일정 창을 우리 양식에 맞춘 것.
 * 위 도구 막대에서 종류(회의·외근·출장·일반 태그)를 고르고, 왼쪽에 입력, 오른쪽 세로 시간표로 시간을 고른다.
 * 다른 칸·일정을 열 때는 호출부가 `key`를 바꿔 다시 마운트한다(훅 규칙).
 */
export function WorkPlanEventModal({ target, actor, deptId, users, cellOf, onClose, onSaved }: WorkPlanEventModalProps) {
  const form = useWorkPlanEventForm(target, actor, deptId);
  const { state, readOnly } = form;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const owner = useMemo(() => ownerOf(target, users), [target, users]);
  const entry = target.mode === 'create' ? null : target.entry;

  // 고른 회의실의 그날 예약 — 훅과 같은 조회 범위(같은 캐시)
  const roomId = state.kind === 'MEETING' && state.locationMode === 'room' ? state.roomId : null;
  const dayRange = useMemo(() => {
    if (!isValidCalendarDate(state.date)) return null;
    const start = new Date(`${state.date}T00:00:00${RESOURCE_UTC_OFFSET}`).getTime();
    const end = new Date(`${state.date}T23:59:00${RESOURCE_UTC_OFFSET}`).getTime();
    return { from: new Date(start - DAY_MS).toISOString(), to: new Date(end + DAY_MS).toISOString() };
  }, [state.date]);
  const reservationsQuery = useQuery({
    queryKey: [RESERVATION_KEY, dayRange],
    queryFn: () => reservationRepo.list(dayRange ?? undefined),
    enabled: Boolean(roomId) && dayRange !== null,
  });

  const editingSourceId = entry ? sourceIdOf(entry) : null;
  const linkedReservationId = entry?.event?.reservationId ?? null;
  const blocks = useMemo(() => {
    const people = [owner.id, ...(state.kind === 'MEETING' ? [actor.id, ...state.attendeeIds] : [])].filter(Boolean);
    const seen = new Set<string>(editingSourceId ? [editingSourceId] : []);
    const result: TimeGridBlock[] = [];
    for (const id of [...new Set(people)]) {
      const name = users.find((u) => u.id === id)?.name ?? (id === owner.id ? owner.name : '');
      const entries = cellOf(id, state.date).entries.filter((e) => {
        const sourceId = sourceIdOf(e);
        if (seen.has(sourceId)) return false;
        seen.add(sourceId);
        return true;
      });
      result.push(...entriesToBlocks(entries, name || undefined));
    }
    if (roomId) result.push(...roomBlocksOf(reservationsQuery.data ?? [], roomId, state.date, linkedReservationId));
    return result;
  }, [owner, actor.id, state.kind, state.attendeeIds, state.date, users, cellOf, editingSourceId, roomId, reservationsQuery.data, linkedReservationId]);

  const save = async () => {
    const kind = state.kind;
    if (await form.save()) {
      onSaved(SAVED_MESSAGE[kind]);
      onClose();
    }
  };

  const join = async (meeting: CalendarEvent) => {
    if (await form.join(meeting)) {
      onSaved('회의에 참석자로 합류했습니다.');
      onClose();
    }
  };

  const remove = async () => {
    if (!form.remove) return;
    if (await form.remove()) {
      onSaved('일정을 삭제했습니다.');
      onClose();
    } else {
      setConfirmingDelete(false);
    }
  };

  const heading = target.mode === 'create' ? '새 일정' : target.mode === 'edit' ? '일정 수정' : '일정 보기';
  const when = isOutsideKind(state.kind) && state.endDate > state.date
    ? `${dateLabel(state.date)} ~ ${dateLabel(state.endDate)}`
    : dateLabel(state.date);
  const subtitle = [owner.name, when].filter(Boolean).join(' · ');

  const footer = readOnly ? (
    <Button onClick={onClose}>닫기</Button>
  ) : (
    <>
      {form.remove && (
        <div className="mr-auto">
          {confirmingDelete ? (
            <Button variant="dangerSolid" disabled={form.saving} onClick={() => void remove()}>삭제 확인</Button>
          ) : (
            <Button variant="danger" disabled={form.saving} onClick={() => setConfirmingDelete(true)}>삭제</Button>
          )}
        </div>
      )}
      <Button disabled={form.saving} onClick={onClose}>취소</Button>
      <Button variant="primary" disabled={form.saving} onClick={() => void save()}>
        {form.saving ? '저장 중…' : '저장'}
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      flush
      title={(
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{heading}</span>
          {subtitle && <span className="text-[12px] font-medium text-ink3">{subtitle}</span>}
          {entry?.roomStatus === 'PENDING' && (
            <span className="self-center rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber">회의실 승인 대기</span>
          )}
          {entry?.roomStatus === 'REJECTED' && (
            <span className="self-center rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">회의실 반려</span>
          )}
        </span>
      )}
      footer={footer}
    >
      <div className="flex flex-col">
        <KindToolbar form={form} target={target} />

        {isOutsideKind(state.kind) && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-5 py-2" role="radiogroup" aria-label="세부 구분">
            {OUTSIDE_WORK_SUBTYPES[state.kind as 'OUTSIDE' | 'TRIP'].map((subType) => {
              const active = state.subType === subType;
              return (
                <button
                  key={subType}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={readOnly}
                  onClick={() => form.setSubType(subType)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                    active ? 'border-blue/40 bg-blue-soft text-blue' : 'border-border text-ink2 hover:bg-panel-alt'
                  }`}
                >
                  {subType}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_240px]">
          {/* 시간표 높이에 맞추고 넘치는 입력은 왼쪽 안에서 스크롤 */}
          <div className="relative min-h-[24rem]">
            <div className="absolute inset-0 overflow-y-auto px-5 py-4">
              <fieldset disabled={readOnly} className="min-w-0">
                <EventFields
                  form={form}
                  actor={actor}
                  users={users}
                  ownerId={owner.id}
                  ownerName={owner.name}
                  outsideSelfId={entry?.outside?.self?.id ?? null}
                  onJoin={(meeting) => void join(meeting)}
                />
              </fieldset>
              {form.error && (
                <p role="alert" className="mt-3 text-[11px] font-semibold text-danger">{form.error}</p>
              )}
            </div>
          </div>

          <div className="border-l border-border bg-panel-alt p-3">
            <TimeGrid
              mode="desktop"
              date={state.date}
              onDateChange={(date) => applyDate(form, date)}
              blocks={blocks}
              value={state.range}
              allDay={state.allDay}
              onChange={(range) => applyRange(form, range)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** 위 도구 막대 — [회의|외근|출장|일반 ▾] 분할 버튼 + 오른쪽 리마인드·루틴 자리(나중 기능) */
function KindToolbar({ form, target }: { form: EventForm; target: EventTarget }) {
  const { state, readOnly } = form;
  const tagsQuery = useWorkPlanTags();
  const tags = tagsQuery.data ?? [];
  const generalTags = selectableGeneralTags(tags);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  /** 새 일정은 허용 목록 안, 수정은 같은 출처 안(외근↔출장, 일반 태그끼리)만 */
  const enabled = (kind: EventKind): boolean => {
    if (readOnly) return false;
    if (target.mode === 'create') return target.allowed.includes(kind);
    return kind === state.kind || (isOutsideKind(kind) && isOutsideKind(state.kind));
  };

  const segClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-[11.5px] font-semibold transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-45 ${
      active ? 'bg-blue-soft text-blue' : 'text-ink2 hover:bg-panel-alt'
    }`;

  const currentTag = state.kind === 'ITEM' && state.tagId ? resolveTag(tags, state.tagId) : null;

  const pickTag = (tagId: string) => {
    form.set('tagId', tagId);
    form.setKind('ITEM');
    setMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-panel-alt px-5 py-2">
      <div ref={menuRef} className="relative">
        <div className="inline-flex overflow-hidden rounded-md border border-border bg-panel" role="radiogroup" aria-label="일정 종류">
          {FIXED_KINDS.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={state.kind === kind}
              disabled={!enabled(kind)}
              className={segClass(state.kind === kind)}
              onClick={() => form.setKind(kind)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={state.kind === 'ITEM'}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            disabled={!enabled('ITEM')}
            className={segClass(state.kind === 'ITEM')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {currentTag && <span className={`h-2 w-2 rounded-full ${dotClassOf(currentTag.colorId)}`} />}
            {currentTag?.name ?? '일반'}
            <ChevronDown size={13} />
          </button>
        </div>

        {menuOpen && (
          <div
            role="listbox"
            aria-label="일반 태그"
            className="absolute right-0 top-full z-30 mt-1 max-h-64 w-44 overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg"
          >
            {generalTags.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-ink3">고를 수 있는 태그가 없습니다.</div>
            ) : (
              generalTags.map((tag) => {
                const active = state.kind === 'ITEM' && state.tagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pickTag(tag.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] font-semibold ${
                      active ? 'bg-blue-soft text-blue' : 'text-ink2 hover:bg-panel-alt'
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassOf(tag.colorId)}`} />
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    {active && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <span className="flex-1" />
      <Button variant="ghost" size="sm" disabled>
        <Bell size={12} />
        리마인드
      </Button>
      <Button variant="ghost" size="sm" disabled>
        <Repeat size={12} />
        루틴
      </Button>
    </div>
  );
}
