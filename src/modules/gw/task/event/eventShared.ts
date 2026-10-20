import { useMemo, useState } from 'react';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';
import type { EventForm } from './EventFields';
import { entriesToBlocks, type TimeGridBlock } from './TimeGrid';
import type { EventKind, EventTarget } from './useWorkPlanEventForm';

/* 일정 창(PC 창·모바일 시트) 공용 — 주인 찾기, 시간표 블록, 저장·삭제·합류 버튼 동작. */

export const SAVED_MESSAGE: Record<EventKind, string> = {
  ITEM: '업무를 저장했습니다.',
  MEETING: '회의를 저장했습니다.',
  OUTSIDE: '외근·출장을 저장했습니다.',
  TRIP: '외근·출장을 저장했습니다.',
};

export const isOutsideKind = (kind: EventKind) => kind === 'OUTSIDE' || kind === 'TRIP';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → 'M월 D일 (요일)' */
export function dateLabel(date: string): string {
  if (!isValidCalendarDate(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** 일반 태그 색 점 */
export const dotClassOf = (colorId: string) => TAG_COLOR_PRESETS.find((p) => p.id === colorId)?.dotColor ?? 'bg-slate-500';

/** 같은 일정이 여러 사람 칸에 나와도 한 번만 — 원본 id 기준 */
export function sourceIdOf(entry: DayEntry): string {
  return entry.item?.id ?? entry.event?.id ?? entry.outside?.self?.id ?? entry.outside?.approval?.docId ?? entry.key;
}

/** 일정 주인 — 새 일정은 칸 주인, 기존 일정은 등록한 사람 */
export function ownerOf(target: EventTarget, users: User[]): { id: string; name: string } {
  if (target.mode === 'create') return { id: target.owner.id, name: target.owner.name };
  const entry = target.entry;
  const id = entry.item?.ownerUserId ?? entry.event?.ownerUserId ?? entry.outside?.ownerUserId ?? entry.schedule?.drafterId ?? '';
  const name = users.find((u) => u.id === id)?.name ?? entry.outside?.ownerName ?? entry.schedule?.drafterName ?? '';
  return { id, name };
}

/** 시간표에 겹쳐 보일 그날 일정 — 주인 + (회의면) 참석자, 고른 회의실 예약. 고치는 일정 자신은 뺀다. */
export function useEventBlocks(
  form: EventForm,
  target: EventTarget,
  actor: User,
  users: User[],
  cellOf: (userId: string, date: string) => DayCell,
  owner: { id: string; name: string },
): TimeGridBlock[] {
  const { state } = form;
  const editingSourceId = target.mode === 'create' ? null : sourceIdOf(target.entry);
  return useMemo(() => {
    // 회의면 참석자도 — 새 회의는 주최자(나)가 칸 주인과 다를 수 있어 나도 넣는다
    const people = [
      owner.id,
      ...(state.kind === 'MEETING' ? [...(target.mode === 'create' ? [actor.id] : []), ...state.attendeeIds] : []),
    ].filter(Boolean);
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
    result.push(...form.roomBlocks);
    return result;
  }, [owner, target.mode, actor.id, state.kind, state.attendeeIds, state.date, users, cellOf, editingSourceId, form.roomBlocks]);
}

/** 저장·합류·참석 취소·삭제 — 성공하면 알림 문구를 넘기고 닫는다. 실패하면 창을 그대로 둔다(오류는 form.error). */
export function useEventActions(form: EventForm, onSaved: (message: string) => void, onClose: () => void) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async () => {
    const kind = form.state.kind;
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

  const leave = async () => {
    if (!form.leave) return;
    if (await form.leave()) {
      onSaved('회의 참석을 취소했습니다.');
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

  return { save, join, leave, remove, confirmingDelete, setConfirmingDelete };
}
