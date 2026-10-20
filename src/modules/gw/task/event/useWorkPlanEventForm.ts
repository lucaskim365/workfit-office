import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { reservationRepo } from '@/data/reservation/reservation.repo';
import { resourceRepo } from '@/data/resource/resource.repo';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import { findSimilarMeetings } from '@/domain/calendarEvent/meeting';
import type { CalendarEvent, CalendarVisibility } from '@/domain/calendarEvent/schema';
import { DEFAULT_COMMUTE_POLICY } from '@/domain/commutePolicy/schema';
import type { Resource } from '@/domain/resource/schema';
import type { User } from '@/domain/user/schema';
import { selectableGeneralTags } from '@/domain/workPlan/tag';
import { toHHmm } from '@/domain/workPlan/timeGrid';
import { usePermission } from '@/features/auth/usePermission';
import { useCommutePolicy } from '@/features/commute/useCommutePolicy';
import { CALENDAR_EVENTS_KEY, useCalendarEvents, useJoinMeeting } from '@/features/calendar/useCalendarEvents';
import { useCreateOutsideWork, useRemoveOutsideWork, useUpdateOutsideWork } from '@/features/outsideWork/useOutsideWorks';
import { RESERVATION_KEY } from '@/features/resource/useReservations';
import { removeMeeting, roomAvailability, saveMeeting, toReservationWindow, type MeetingActors } from '@/features/workPlan/meetingWithRoom';
import {
  useCreateWorkPlanItem,
  useRemoveWorkPlanItem,
  useUpdateWorkPlanItem,
  useWorkPlanTags,
} from '@/features/workPlan/useWorkPlanItems';
import {
  applySubType,
  initialCreateState,
  initialStateFromEntry,
  meetingPurpose,
  switchKind,
  toItemDraft,
  toMeetingDraft,
  toOutsideDraft,
  validateItemDraft,
  validateMeetingDraft,
  validateOutsideDraft,
  type EventFormState,
  type EventKind,
  type EventTarget,
} from './eventFormMapping';

export type { EventFormState, EventKind, EventTarget } from './eventFormMapping';

export const ROOM_RELEASED_MESSAGE = '고른 시간에 이미 예약된 회의실이라 선택을 해제했습니다.';
const ROOM_LOADING_MESSAGE = '회의실 정보를 불러오는 중입니다. 잠시 후 다시 저장하세요.';
const ROOM_REQUIRED_MESSAGE = '회의실을 고르세요.';
const NOT_EDITABLE_MESSAGE = '고칠 수 없는 일정입니다.';
const MEETING_ROOM_FILTER = { typeCode: 'ROOM', status: 'ACTIVE' } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const errorMessage = (caught: unknown, fallback: string): string => {
  if (caught instanceof Error && caught.message) return caught.message;
  console.error(caught);
  return fallback;
};

/** 회의실 예약 조회 범위 — 그날 앞뒤 하루씩(앞뒤 여유시간이 날을 넘는 예약까지). */
function reservationRangeOf(date: string): { from: string; to: string } | null {
  if (!isValidCalendarDate(date)) return null;
  const day = toReservationWindow(date, '00:00', '23:59');
  return {
    from: new Date(new Date(day.startAt).getTime() - DAY_MS).toISOString(),
    to: new Date(new Date(day.endAt).getTime() + DAY_MS).toISOString(),
  };
}

/**
 * 업무계획 일정 창(PC 창·모바일 시트 공용)의 상태·검증·저장.
 * 종류별 저장소: 일반 = workPlanItems, 회의 = calendarEvents(+회의실 예약), 외근·출장 = outsideWorks.
 * save()/remove()는 던지지 않는다 — 실패하면 `error`를 채우고 false(창 유지).
 */
export function useWorkPlanEventForm(target: EventTarget, actor: User, deptId: string | null): {
  state: EventFormState;
  set: <K extends keyof EventFormState>(k: K, v: EventFormState[K]) => void;
  setKind: (kind: EventKind) => void;
  /** 외근·출장 세부 구분 — 고르면 시간을 맞춘다(오전·오후·시간·종일) */
  setSubType: (subType: string) => void;
  /** 고를 수 있는 공개 범위 — 이 창엔 프로젝트 고르기가 없어 프로젝트 공유는 기존 회의일 때만 */
  visibilityOptions: CalendarVisibility[];
  readOnly: boolean;
  similarMeetings: CalendarEvent[];
  join: (e: CalendarEvent) => Promise<boolean>;
  /** 회의실 고르기 목록 — 고른 시간에 비어 있는지 */
  rooms: Array<{ resource: Resource; available: boolean }>;
  error: string;
  saving: boolean;
  save: () => Promise<boolean>;
  remove: (() => Promise<boolean>) | null;
} {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermission();
  const { policy = DEFAULT_COMMUTE_POLICY } = useCommutePolicy();
  const readOnly = target.mode === 'view';
  const entry = target.mode === 'create' ? null : target.entry;
  const event = entry?.event ?? null;
  const item = entry?.item ?? null;
  const outsideSelf = entry?.outside?.self ?? null;
  // 호출부가 매번 새 배열을 줄 수 있어 내용이 같으면 같은 배열로 둔다
  const allowedKey = target.mode === 'create' ? target.allowed.join(',') : '';
  const allowed = useMemo(() => (allowedKey ? (allowedKey.split(',') as EventKind[]) : []), [allowedKey]);

  const tagsQuery = useWorkPlanTags();
  const firstTagId = selectableGeneralTags(tagsQuery.data ?? [])[0]?.id ?? '';

  const [state, setState] = useState<EventFormState>(() =>
    target.mode === 'create' ? initialCreateState(target, actor.id, firstTagId) : initialStateFromEntry(target.entry, null),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const calendarActor = useMemo<CalendarEventActor>(
    () => ({ userId: actor.id, active: actor.status === '사용', deptId }),
    [actor.id, actor.status, deptId],
  );
  const itemActor = useMemo(() => ({ userId: actor.id, active: actor.status === '사용' }), [actor.id, actor.status]);
  const meetingActors = useMemo<MeetingActors>(
    () => ({ calendar: calendarActor, user: actor, isAdmin: isSuperAdmin }),
    [calendarActor, actor, isSuperAdmin],
  );

  const createItem = useCreateWorkPlanItem();
  const updateItem = useUpdateWorkPlanItem();
  const removeItem = useRemoveWorkPlanItem();
  const createOutside = useCreateOutsideWork();
  const updateOutside = useUpdateOutsideWork();
  const removeOutside = useRemoveOutsideWork();
  const joinMeeting = useJoinMeeting();

  // 태그가 늦게 오면 새 일반 항목의 태그를 첫 일반 태그로 채운다
  useEffect(() => {
    if (target.mode !== 'create' || !firstTagId) return;
    setState((prev) => (prev.tagId ? prev : { ...prev, tagId: firstTagId }));
  }, [target.mode, firstTagId]);

  // 수정 중인 회의의 연결 예약 — 그 방을 처음 선택값으로
  const linkedId = event?.reservationId ?? null;
  const linkedQuery = useQuery({
    queryKey: [RESERVATION_KEY, 'get', linkedId],
    queryFn: () => reservationRepo.get(linkedId as string),
    enabled: Boolean(linkedId),
  });
  const linked = linkedQuery.data ?? null;
  const linkedPending = Boolean(linkedId) && linkedQuery.isPending;
  const linkedApplied = useRef(false);
  useEffect(() => {
    if (!linkedId || linkedApplied.current || linkedQuery.isPending) return;
    linkedApplied.current = true;
    setState((prev) => {
      if (prev.locationMode !== 'room' || prev.roomId) return prev;
      // 예약을 못 찾으면 적혀 있던 장소 글로 연다
      return linked ? { ...prev, roomId: linked.resourceId } : { ...prev, locationMode: 'text' };
    });
  }, [linkedId, linkedQuery.isPending, linked]);

  // 회의실 목록·그날 예약 — 회의일 때만
  const isMeetingKind = state.kind === 'MEETING';
  const roomsQuery = useQuery({
    queryKey: ['resources', MEETING_ROOM_FILTER],
    queryFn: () => resourceRepo.list(MEETING_ROOM_FILTER),
    enabled: isMeetingKind,
  });
  const reservationRange = reservationRangeOf(state.date);
  const reservationsQuery = useQuery({
    queryKey: [RESERVATION_KEY, reservationRange],
    queryFn: () => reservationRepo.list(reservationRange ?? undefined),
    enabled: isMeetingKind && reservationRange !== null,
  });

  const { range: formRange, date: formDate } = state;
  const availability = useMemo(() => {
    const rooms = roomsQuery.data ?? [];
    const range = formRange;
    const date = formDate;
    if (!range || !isValidCalendarDate(date)) return new Map(rooms.map((room) => [room.id, true]));
    const window = toReservationWindow(date, toHHmm(range.start), toHHmm(range.end));
    return roomAvailability(rooms, reservationsQuery.data ?? [], window, linkedId ?? undefined);
  }, [roomsQuery.data, reservationsQuery.data, formRange, formDate, linkedId]);

  const rooms = useMemo(
    () => (roomsQuery.data ?? []).map((resource) => ({ resource, available: availability.get(resource.id) ?? true })),
    [roomsQuery.data, availability],
  );

  // 고른 방이 바뀐 시간에 차 있으면 선택을 풀고 이유를 보여 준다
  useEffect(() => {
    if (readOnly || state.kind !== 'MEETING' || state.locationMode !== 'room' || !state.roomId) return;
    if (availability.get(state.roomId) !== false) return;
    setState((prev) => ({ ...prev, roomId: null }));
    setError(ROOM_RELEASED_MESSAGE);
  }, [availability, readOnly, state.kind, state.locationMode, state.roomId]);

  // 같은 회의 중복 방지 — 새 회의에서만 비슷한 회의를 찾아 합류를 제안한다
  const lookForSimilar = target.mode === 'create' && isMeetingKind && isValidCalendarDate(state.date);
  const dayEventsQuery = useCalendarEvents(
    calendarActor,
    lookForSimilar ? { from: state.date, to: state.date } : undefined,
    lookForSimilar,
  );
  const similarMeetings = useMemo(() => {
    if (!lookForSimilar || state.title.trim().length < 2) return [];
    return findSimilarMeetings(dayEventsQuery.data ?? [], {
      date: state.date,
      title: state.title,
      allDay: false,
      startTime: state.range ? toHHmm(state.range.start) : null,
      endTime: state.range ? toHHmm(state.range.end) : null,
    });
  }, [lookForSimilar, dayEventsQuery.data, state.date, state.title, state.range]);

  const setKind = useCallback(
    (kind: EventKind) => {
      if (readOnly) return;
      setState((prev) => switchKind(prev, kind, { mode: target.mode, allowed }, policy));
    },
    [readOnly, target.mode, allowed, policy],
  );

  const setSubType = useCallback(
    (subType: string) => {
      if (readOnly) return;
      setState((prev) => applySubType(prev, subType, policy));
    },
    [readOnly, policy],
  );

  const keepsProject = event?.visibility === 'PROJECT';
  const visibilityOptions = useMemo<CalendarVisibility[]>(
    () => [
      'COMPANY',
      ...(deptId ? (['TEAM'] as const) : []),
      'PRIVATE',
      ...(keepsProject ? (['PROJECT'] as const) : []),
    ],
    [deptId, keepsProject],
  );

  const set = useCallback(
    <K extends keyof EventFormState>(k: K, v: EventFormState[K]) => {
      if (readOnly) return;
      if (k === 'kind') {
        setKind(v as EventKind);
        return;
      }
      if (k === 'subType') {
        setSubType(v as string);
        return;
      }
      setState((prev) => ({ ...prev, [k]: v }));
    },
    [readOnly, setKind, setSubType],
  );

  const invalidate = (...keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const fail = (message: string): false => {
    setError(message);
    return false;
  };

  const join = async (meeting: CalendarEvent): Promise<boolean> => {
    setError('');
    setSaving(true);
    try {
      await joinMeeting.mutateAsync({ actor: calendarActor, id: meeting.id });
      return true;
    } catch (caught) {
      return fail(errorMessage(caught, '회의에 합류하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async (): Promise<boolean> => {
    const ownerId = target.mode === 'create' ? target.owner.id : item?.ownerUserId;
    if (!ownerId || (target.mode === 'edit' && !item)) return fail(NOT_EDITABLE_MESSAGE);
    const draft = toItemDraft(state);
    const invalid = validateItemDraft(draft, ownerId, actor.id);
    if (invalid) return fail(invalid);
    if (item) await updateItem.mutateAsync({ actor: itemActor, id: item.id, draft });
    else await createItem.mutateAsync({ actor: itemActor, ownerUserId: ownerId, draft });
    return true;
  };

  const saveMeetingForm = async (): Promise<boolean> => {
    if (target.mode === 'edit' && !event) return fail(NOT_EDITABLE_MESSAGE);
    const roomMode = state.locationMode === 'room';
    if (roomMode && linkedPending) return fail(ROOM_LOADING_MESSAGE);
    if (roomMode && !state.roomId) return fail(ROOM_REQUIRED_MESSAGE);
    const roomName = roomMode
      ? (roomsQuery.data ?? []).find((room) => room.id === state.roomId)?.name
        ?? (linked?.resourceId === state.roomId ? linked.resourceNameSnapshot : null)
      : null;
    const draft = toMeetingDraft(state, { organizerId: actor.id, deptId, roomName, projectId: event?.projectId ?? null });
    const invalid = validateMeetingDraft(draft, actor.id);
    if (invalid) return fail(invalid);
    try {
      await saveMeeting(meetingActors, {
        eventId: event?.id,
        draft,
        roomId: roomMode ? state.roomId : null,
        purpose: meetingPurpose(state),
      });
    } finally {
      // 실패해도 예약은 바뀌었을 수 있다(되돌리기 실패 등) — 목록을 다시 읽는다
      invalidate(CALENDAR_EVENTS_KEY, RESERVATION_KEY);
    }
    return true;
  };

  const saveOutside = async (): Promise<boolean> => {
    if (target.mode === 'edit' && !outsideSelf) return fail(NOT_EDITABLE_MESSAGE);
    const draft = toOutsideDraft(state, actor.id);
    const invalid = validateOutsideDraft(draft, outsideSelf?.ownerUserId ?? actor.id);
    if (invalid) return fail(invalid);
    if (outsideSelf) await updateOutside.mutateAsync({ actor: itemActor, id: outsideSelf.id, draft });
    else await createOutside.mutateAsync({ actor: itemActor, draft });
    return true;
  };

  const save = async (): Promise<boolean> => {
    if (readOnly || saving) return false;
    setError('');
    setSaving(true);
    try {
      if (state.kind === 'ITEM') return await saveItem();
      if (state.kind === 'MEETING') return await saveMeetingForm();
      return await saveOutside();
    } catch (caught) {
      return fail(errorMessage(caught, '저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (): Promise<boolean> => {
    if (saving) return false;
    setError('');
    setSaving(true);
    try {
      if (item) {
        await removeItem.mutateAsync({ actor: itemActor, id: item.id });
      } else if (event) {
        try {
          await removeMeeting(meetingActors, event);
        } finally {
          invalidate(CALENDAR_EVENTS_KEY, RESERVATION_KEY);
        }
      } else if (outsideSelf) {
        await removeOutside.mutateAsync({ actor: itemActor, id: outsideSelf.id });
      } else {
        return fail(NOT_EDITABLE_MESSAGE);
      }
      return true;
    } catch (caught) {
      return fail(errorMessage(caught, '삭제하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return {
    state,
    set,
    setKind,
    setSubType,
    visibilityOptions,
    readOnly,
    similarMeetings,
    join,
    rooms,
    error,
    saving,
    save,
    remove: target.mode === 'edit' ? removeEntry : null,
  };
}
