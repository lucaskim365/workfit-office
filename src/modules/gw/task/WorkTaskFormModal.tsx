import { useMemo, useState, type FormEvent } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import { isTaskOutsideProjectSchedule } from '@/domain/workTask/engine';
import { WORK_TASK_MAX_LEVEL, type WorkTask, type WorkTaskDraft } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
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
  /** 프로젝트의 트랙. 비어 있으면 트랙 레이어가 없는 프로젝트다. */
  tracks: WorkTrack[];
  /** 상위 과업 후보를 고르기 위해 프로젝트의 과업 전체를 받는다. */
  tasks: WorkTask[];
  users: User[];
  task?: WorkTask;
  /** 새 과업을 만들 때 미리 정해진 자리(트랙·상위). 목록의 "+ 하위 추가"에서 넘어온다. */
  preset?: { trackId: string | null; parentId: string | null };
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

export default function WorkTaskFormModal({ actor, project, tracks, tasks, users, task, preset, onClose, onSaved }: WorkTaskFormModalProps) {
  const assignees = useMemo(
    () => users.filter((user) => project.memberUserIds.includes(user.id)
      && (user.status === '사용' || user.id === task?.assigneeUserId)),
    [project.memberUserIds, task?.assigneeUserId, users],
  );

  // 트리 위치는 **만들 때만** 정한다. 옮기기는 하위 전체를 함께 갱신해야 해서 별도
  // 연산이다([[프로젝트관리_고도화_계획서.md]] §3) — 수정 폼에서 슬쩍 바꾸면 경로가 어긋난다.
  const [trackId, setTrackId] = useState<string | null>(
    task?.trackId ?? preset?.trackId ?? tracks[0]?.id ?? null,
  );
  const [parentId, setParentId] = useState<string | null>(task?.parentId ?? preset?.parentId ?? null);

  /** 같은 트랙에서 아직 한 단계 더 받을 수 있는 과업만 상위 후보다. */
  const parentOptions = useMemo(
    () => tasks
      .filter((row) => row.trackId === trackId && row.level < WORK_TASK_MAX_LEVEL && row.id !== task?.id)
      .sort((a, b) => a.path.localeCompare(b.path)),
    [task?.id, tasks, trackId],
  );
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

  /** 수정 화면에서 "지금 어디에 있는지"만 알려 준다. 바꾸는 건 목록의 옮기기다. */
  const positionLabel = task
    ? [
      tracks.find((track) => track.id === task.trackId)?.name,
      tasks.find((row) => row.id === task.parentId)?.title ?? '대과업',
    ].filter(Boolean).join(' › ')
    : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const draft: WorkTaskDraft = {
      projectId: project.id,
      trackId: task?.trackId ?? trackId,
      parentId: task?.parentId ?? parentId,
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
        {task ? (
          <div className="rounded-md border border-border bg-panel-alt px-3 py-2 text-[10px] font-semibold text-ink3">
            위치 {positionLabel} · 위치를 바꾸려면 목록에서 옮기기를 쓰세요
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tracks.length > 0 && (
              <Field label="트랙" required>
                <SelectField
                  aria-label="트랙"
                  value={trackId ?? ''}
                  onChange={(event) => { setTrackId(event.target.value || null); setParentId(null); }}
                  options={tracks.map((track) => ({ value: track.id, label: track.name }))}
                />
              </Field>
            )}
            <Field label="상위 과업" hint={`비우면 대과업이 됩니다. 최대 ${WORK_TASK_MAX_LEVEL}단.`}>
              <SelectField
                aria-label="상위 과업"
                value={parentId ?? ''}
                onChange={(event) => setParentId(event.target.value || null)}
                options={[
                  { value: '', label: '— 없음 (대과업) —' },
                  ...parentOptions.map((row) => ({
                    value: row.id,
                    label: `${'　'.repeat(row.level - 1)}${row.title}`,
                  })),
                ]}
              />
            </Field>
          </div>
        )}
        <Field label="담당자" required hint="프로젝트 참여자만 선택할 수 있습니다.">
          <SelectField aria-label="담당자" value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} options={assignees.map((user) => ({ value: user.id, label: `${user.name} · ${user.dept}${user.status === '사용' ? '' : ' · 비활성'}` }))} />
        </Field>
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
