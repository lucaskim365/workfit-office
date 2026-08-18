import { useState, type FormEvent } from 'react';
import type { CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import type { CalendarEvent, CalendarEventDraft } from '@/domain/calendarEvent/schema';
import {
  useCreateCalendarEvent,
  useRemoveCalendarEvent,
  useUpdateCalendarEvent,
} from '@/features/calendar/useCalendarEvents';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';

interface CalendarEventModalProps {
  actor: CalendarEventActor;
  initialDate: string;
  event?: CalendarEvent;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onRemoved: (event: CalendarEvent) => void;
}

export default function CalendarEventModal({ actor, initialDate, event, onClose, onSaved, onRemoved }: CalendarEventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:00');
  const [memo, setMemo] = useState(event?.memo ?? '');
  const [error, setError] = useState('');
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const removeEvent = useRemoveCalendarEvent();
  const pending = createEvent.isPending || updateEvent.isPending || removeEvent.isPending;

  const draft = (): CalendarEventDraft => ({
    title,
    date,
    allDay,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    memo,
  });

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setError('');
    try {
      const saved = event
        ? await updateEvent.mutateAsync({ actor, id: event.id, draft: draft() })
        : await createEvent.mutateAsync({ actor, draft: draft() });
      onSaved(saved as CalendarEvent);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '일정을 저장하지 못했습니다.');
    }
  };

  const remove = async () => {
    if (!event || !window.confirm(`‘${event.title}’ 일정을 삭제하시겠습니까?`)) return;
    setError('');
    try {
      const removed = await removeEvent.mutateAsync({ actor, id: event.id });
      onRemoved(removed as CalendarEvent);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '일정을 삭제하지 못했습니다.');
    }
  };

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title={event ? '일정 수정' : '새 일정'}
      width={Math.min(620, window.innerWidth - 32)}
      footer={(
        <>
          {event && (
            <span className="mr-auto">
              <Button variant="danger" onClick={() => void remove()} disabled={pending}>삭제</Button>
            </span>
          )}
          <Button onClick={onClose} disabled={pending}>취소</Button>
          <Button variant="primary" type="submit" form="calendar-event-form" disabled={pending}>
            {pending ? '처리 중…' : '저장'}
          </Button>
        </>
      )}
    >
      <form id="calendar-event-form" onSubmit={submit} className="space-y-4">
        <Field label="제목" required>
          <TextField aria-label="일정 제목" value={title} onChange={(input) => setTitle(input.target.value)} maxLength={100} autoFocus className="w-full" placeholder="일정 제목" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="날짜" required>
            <TextField aria-label="일정 날짜" type="date" value={date} onChange={(input) => setDate(input.target.value)} className="w-full" />
          </Field>
          <Field label="구분">
            <label className="flex h-9 items-center gap-2 rounded-md border border-border-hi px-3 text-[11px] font-semibold text-ink2">
              <input type="checkbox" checked={allDay} onChange={(input) => setAllDay(input.target.checked)} className="accent-teal" />
              종일 일정
            </label>
          </Field>
        </div>
        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="시작 시각" required><TextField aria-label="시작 시각" type="time" value={startTime} onChange={(input) => setStartTime(input.target.value)} className="w-full" /></Field>
            <Field label="종료 시각" required><TextField aria-label="종료 시각" type="time" value={endTime} onChange={(input) => setEndTime(input.target.value)} min={startTime || undefined} className="w-full" /></Field>
          </div>
        )}
        <Field label="메모">
          <textarea aria-label="일정 메모" value={memo} onChange={(input) => setMemo(input.target.value)} maxLength={2000} rows={5} className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal" placeholder="필요한 내용을 기록하세요" />
        </Field>
        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
    </Modal>
  );
}
