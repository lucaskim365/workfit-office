import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calendarEventRepo,
  type CalendarEventActor,
  type CalendarEventFilter,
} from '@/data/calendarEvent/calendarEvent.repo';
import type { CalendarEventDraft } from '@/domain/calendarEvent/schema';

export const CALENDAR_EVENTS_KEY = 'calendarEvents';

function actorKey(actor: CalendarEventActor) {
  return [actor.userId, actor.active] as const;
}

export function useCalendarEvents(actor: CalendarEventActor, filter?: CalendarEventFilter) {
  return useQuery({
    queryKey: [CALENDAR_EVENTS_KEY, 'list', ...actorKey(actor), filter ?? null],
    queryFn: () => calendarEventRepo.list(actor, filter),
  });
}

export function useCalendarEvent(actor: CalendarEventActor, id?: string) {
  return useQuery({
    queryKey: [CALENDAR_EVENTS_KEY, 'detail', ...actorKey(actor), id ?? null],
    queryFn: () => calendarEventRepo.get(actor, id ?? ''),
    enabled: Boolean(id),
  });
}

function useCalendarEventMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CALENDAR_EVENTS_KEY] }),
  });
}

export function useCreateCalendarEvent() {
  return useCalendarEventMutation(({
    actor,
    draft,
  }: {
    actor: CalendarEventActor;
    draft: CalendarEventDraft;
  }) => calendarEventRepo.create(actor, draft));
}

export function useUpdateCalendarEvent() {
  return useCalendarEventMutation(({
    actor,
    id,
    draft,
  }: {
    actor: CalendarEventActor;
    id: string;
    draft: CalendarEventDraft;
  }) => calendarEventRepo.update(actor, id, draft));
}

export function useRemoveCalendarEvent() {
  return useCalendarEventMutation(({
    actor,
    id,
  }: {
    actor: CalendarEventActor;
    id: string;
  }) => calendarEventRepo.remove(actor, id));
}
