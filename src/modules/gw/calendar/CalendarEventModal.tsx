import { useState, type FormEvent } from 'react';
import { CalendarEventError, type CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import {
  CALENDAR_VISIBILITIES,
  CALENDAR_VISIBILITY_LABELS,
  type CalendarEvent,
  type CalendarEventDraft,
  type CalendarVisibility,
} from '@/domain/calendarEvent/schema';
import type { WorkProject } from '@/domain/workProject/schema';
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
  /** 내가 참여 중인 프로젝트. 프로젝트 공유 대상으로 고를 수 있다. */
  myProjects: WorkProject[];
  /** 내 부서 이름. 부서 공유가 어디로 가는지 화면에 밝히는 데 쓴다. */
  deptName: string | null;
  /** 공유받은 일정의 주인 이름. 내 일정이면 넘기지 않는다. */
  ownerName?: string | null;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onRemoved: (event: CalendarEvent) => void;
}

/** 범위별 한 줄 설명. 고르기 전에 누가 보게 되는지 알려준다. */
const VISIBILITY_HINTS: Record<CalendarVisibility, string> = {
  PRIVATE: '나만 볼 수 있습니다.',
  TEAM: '같은 부서 구성원이 볼 수 있습니다.',
  COMPANY: '전 직원이 볼 수 있습니다.',
  PROJECT: '고른 프로젝트의 참여자가 볼 수 있습니다.',
};

export default function CalendarEventModal({
  actor, initialDate, event, myProjects, deptName, ownerName, onClose, onSaved, onRemoved,
}: CalendarEventModalProps) {
  /*
    공유는 보여주기까지다. 남의 일정은 열어서 볼 수만 있다 — 저장을 눌러도 저장소가
    소유자가 아니라며 막으므로, 고칠 수 있는 것처럼 보이게 두면 안 된다.
  */
  const canEdit = !event || event.ownerUserId === actor.userId;
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:00');
  const [memo, setMemo] = useState(event?.memo ?? '');
  const [visibility, setVisibility] = useState<CalendarVisibility>(event?.visibility ?? 'PRIVATE');
  const [projectId, setProjectId] = useState(event?.projectId ?? myProjects[0]?.id ?? '');
  const [error, setError] = useState('');
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const removeEvent = useRemoveCalendarEvent();
  const pending = createEvent.isPending || updateEvent.isPending || removeEvent.isPending;

  /* 소속이 없으면 부서 공유가 아무에게도 안 닿는다. 고르게 두지 않고 이유를 밝힌다. */
  const canShareToTeam = Boolean(actor.deptId);
  const canShareToProject = myProjects.length > 0;
  const disabledReason = (option: CalendarVisibility): string | null => {
    if (option === 'TEAM' && !canShareToTeam) return '소속 부서가 없어 부서 공유를 쓸 수 없습니다.';
    if (option === 'PROJECT' && !canShareToProject) return '참여 중인 프로젝트가 없습니다.';
    return null;
  };

  /**
   * 화면에 띄울 오류 문구.
   *
   * 도메인 오류(`CalendarEventError`)만 그대로 보여준다 — 입력 검증 문구라 사용자가 고칠
   * 수 있다. 그 밖의 것(저장소·네트워크 예외)은 원문을 숨긴다. 서버 메시지는 영어이거나
   * 내부 구조를 드러내고, 사용자가 할 수 있는 일도 없다. 원인은 콘솔에 남겨 둔다.
   */
  const errorText = (caught: unknown, fallback: string): string => {
    if (caught instanceof CalendarEventError) return caught.message;
    console.error(caught);
    return fallback;
  };

  const draft = (): CalendarEventDraft => ({
    title,
    date,
    allDay,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    memo,
    visibility,
    // 고른 범위에 해당하는 값만 남긴다. 범위를 바꿨을 때 예전 대상이 따라다니지 않게.
    deptId: visibility === 'TEAM' ? actor.deptId ?? null : null,
    projectId: visibility === 'PROJECT' ? projectId || null : null,
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
      setError(errorText(caught, '일정을 저장하지 못했습니다.'));
    }
  };

  const remove = async () => {
    if (!event || !window.confirm(`‘${event.title}’ 일정을 삭제하시겠습니까?`)) return;
    setError('');
    try {
      const removed = await removeEvent.mutateAsync({ actor, id: event.id });
      onRemoved(removed as CalendarEvent);
    } catch (caught) {
      setError(errorText(caught, '일정을 삭제하지 못했습니다.'));
    }
  };

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title={!canEdit ? '공유받은 일정' : event ? '일정 수정' : '새 일정'}
      width={Math.min(620, window.innerWidth - 32)}
      footer={canEdit ? (
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
      ) : (
        <Button onClick={onClose}>닫기</Button>
      )}
    >
      <fieldset disabled={!canEdit} className="contents">
      {!canEdit && (
        <div className="mb-4 rounded-lg border border-border bg-ink3/5 px-3 py-2 text-[10.5px] leading-relaxed text-ink2">
          {ownerName ? <strong className="font-bold">{ownerName}</strong> : '다른 사용자'}님이 공유한 일정입니다.
          <span className="text-ink3"> 내용은 볼 수 있고 고치는 것은 등록한 사람만 할 수 있습니다.</span>
        </div>
      )}
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
            <Field label="시작 시각" required>
              <TextField
                aria-label="시작 시각"
                type="time"
                step={300}
                value={startTime}
                // 종료 시각은 시작 시각을 따라간다 — 그대로 두면 예전 시작보다 앞선 채로 남아
                // 매번 둘 다 고쳐야 했다(2026-08-27 피드백). 저장하려면 어차피 시작 이후로
                // 다시 골라야 하니, 일단 시작과 같게 맞춰 놓고 사용자가 그 뒤로 조정하게 한다.
                onChange={(input) => { setStartTime(input.target.value); setEndTime(input.target.value); }}
                className="w-full"
              />
            </Field>
            {/*
              step을 안 준다 — `min`(시작 시각)과 `step`을 같이 주면 브라우저가 유효값을
              "min 기준 step배수"로 좁혀서, 시작이 10:52면 10:52·10:57·11:02…만 되고 22:00
              같은 멀쩡한 시각이 "유효하지 않음"으로 튕긴다(2026-08-27 실사용 버그). step
              기본값(60=1분)은 어떤 min과 합쳐도 전체 분 단위를 다 허용해 이 문제가 없다.
            */}
            <Field label="종료 시각" required><TextField aria-label="종료 시각" type="time" value={endTime} onChange={(input) => setEndTime(input.target.value)} min={startTime || undefined} className="w-full" /></Field>
          </div>
        )}
        <Field label="공개 범위" required>
          <div className="space-y-1.5">
            <select
              aria-label="공개 범위"
              value={visibility}
              onChange={(input) => setVisibility(input.target.value as CalendarVisibility)}
              className="h-9 w-full rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none focus:border-teal"
            >
              {CALENDAR_VISIBILITIES.map((option) => {
                const blocked = disabledReason(option);
                return (
                  <option key={option} value={option} disabled={Boolean(blocked)}>
                    {CALENDAR_VISIBILITY_LABELS[option]}{blocked ? ` — ${blocked}` : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] leading-snug text-ink3">
              {VISIBILITY_HINTS[visibility]}
              {visibility === 'TEAM' && deptName && <span className="ml-1 font-semibold text-ink2">({deptName})</span>}
            </p>
          </div>
        </Field>

        {visibility === 'PROJECT' && (
          <Field label="공유할 프로젝트" required>
            <select
              aria-label="공유할 프로젝트"
              value={projectId}
              onChange={(input) => setProjectId(input.target.value)}
              className="h-9 w-full rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none focus:border-teal"
            >
              {myProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="메모">
          <textarea aria-label="일정 메모" value={memo} onChange={(input) => setMemo(input.target.value)} maxLength={2000} rows={5} className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal" placeholder="필요한 내용을 기록하세요" />
        </Field>
        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
      </fieldset>
    </Modal>
  );
}
