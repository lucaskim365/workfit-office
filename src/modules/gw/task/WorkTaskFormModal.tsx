import { useMemo, useState, type FormEvent } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkPhase } from '@/domain/workPhase/schema';
import { isTaskOutsideProjectSchedule } from '@/domain/workTask/engine';
import type { WorkTask, WorkTaskDraft } from '@/domain/workTask/schema';
import type { User } from '@/domain/user/schema';
import { useCreateWorkTask, useUpdateWorkTask } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';

interface WorkTaskFormModalProps {
  actor: ProjectAccessContext;
  project: WorkProject;
  phases: WorkPhase[];
  users: User[];
  task?: WorkTask;
  onClose: () => void;
  onSaved: (task: WorkTask) => void;
}

function dateToIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999+09:00' : 'T00:00:00.000+09:00';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

export default function WorkTaskFormModal({ actor, project, phases, users, task, onClose, onSaved }: WorkTaskFormModalProps) {
  const assignees = useMemo(
    () => users.filter((user) => project.memberUserIds.includes(user.id)
      && (user.status === '사용' || user.id === task?.assigneeUserId)),
    [project.memberUserIds, task?.assigneeUserId, users],
  );
  const [phaseId, setPhaseId] = useState(task?.phaseId ?? phases[0]?.id ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [assigneeUserId, setAssigneeUserId] = useState(task?.assigneeUserId ?? assignees[0]?.id ?? '');
  const [startAt, setStartAt] = useState(isoToDate(task?.startAt ?? null));
  const [dueAt, setDueAt] = useState(isoToDate(task?.dueAt ?? null));
  const [error, setError] = useState('');
  const createTask = useCreateWorkTask();
  const updateTask = useUpdateWorkTask();
  const pending = createTask.isPending || updateTask.isPending;
  const schedule = { startAt: dateToIso(startAt), dueAt: dateToIso(dueAt, true) };
  const outsideSchedule = isTaskOutsideProjectSchedule(project, schedule);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const draft: WorkTaskDraft = {
      projectId: project.id,
      phaseId,
      title,
      description,
      assigneeUserId,
      startAt: schedule.startAt,
      dueAt: schedule.dueAt,
      status: task?.status ?? 'TODO',
      progress: task?.progress ?? 0,
    };
    try {
      const saved = task
        ? await updateTask.mutateAsync({ actor, id: task.id, draft, expectedVersion: task.version })
        : await createTask.mutateAsync({ actor, draft });
      onSaved(saved as WorkTask);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'WBS 작업을 저장하지 못했습니다.');
    }
  };

  return (
    <Modal
      open
      onClose={() => { if (!pending) onClose(); }}
      title={task ? '작업 수정' : '작업 추가'}
      width={Math.min(640, window.innerWidth - 32)}
      footer={(
        <>
          <Button onClick={onClose} disabled={pending}>취소</Button>
          <Button variant="primary" type="submit" form="work-task-form" disabled={pending}>{pending ? '저장 중…' : '저장'}</Button>
        </>
      )}
    >
      <form id="work-task-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="단계" required>
            <SelectField aria-label="단계" value={phaseId} onChange={(event) => setPhaseId(event.target.value)} options={phases.map((phase) => ({ value: phase.id, label: phase.name }))} />
          </Field>
          <Field label="담당자" required hint="프로젝트 참여자만 선택할 수 있습니다.">
            <SelectField aria-label="담당자" value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} options={assignees.map((user) => ({ value: user.id, label: `${user.name} · ${user.dept}${user.status === '사용' ? '' : ' · 비활성'}` }))} />
          </Field>
        </div>
        <Field label="작업명" required>
          <TextField aria-label="작업명" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} autoFocus className="w-full" />
        </Field>
        <Field label="설명">
          <textarea aria-label="작업 설명" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-teal" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="시작일" hint="한국 표준시 기준">
            <TextField aria-label="작업 시작일" type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full" />
          </Field>
          <Field label="마감일" hint="한국 표준시 기준">
            <TextField aria-label="작업 마감일" type="date" value={dueAt} min={startAt || undefined} onChange={(event) => setDueAt(event.target.value)} className="w-full" />
          </Field>
        </div>
        {outsideSchedule && <div role="status" className="rounded-lg border border-amber/20 bg-amber-soft/25 px-3 py-2 text-[10.5px] font-semibold text-amber">프로젝트 기간을 벗어난 일정입니다. 저장은 가능하지만 일정을 다시 확인하세요.</div>}
        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
    </Modal>
  );
}
