import { useMemo, useState } from 'react';
import type { WorkPhase } from '@/domain/workPhase/schema';
import { canCreateWbsTask, canEditWbsTask, canManageWbsPhases, canUpdateWbsTaskProgress, derivePhaseProgress, deriveProjectWbsProgress } from '@/domain/workTask/engine';
import { WORK_TASK_STATUS_LABELS, type WorkTask, type WorkTaskStatus } from '@/domain/workTask/schema';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { User } from '@/domain/user/schema';
import { useRemoveWorkPhase, useRemoveWorkTask, useSetWorkTaskProgress, useWorkPhases, useWorkTasks } from '@/features/project/useProjectWbs';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import WorkPhaseFormModal from './WorkPhaseFormModal';
import WorkTaskFormModal from './WorkTaskFormModal';
import { Button } from '@/shared/ui/Button';

interface ProjectWbsProps {
  project: WorkProject;
  access: ProjectAccessContext;
  users: User[];
}

const STATUS_TONES: Record<WorkTaskStatus, Tone> = {
  TODO: 'mute',
  IN_PROGRESS: 'info',
  DONE: 'ok',
};

function formatDate(iso: string | null): string {
  if (!iso) return '미정';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="min-w-0"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-alt">
        <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function ProjectWbs({ project, access, users }: ProjectWbsProps) {
  const [editingPhase, setEditingPhase] = useState<WorkPhase | 'new' | null>(null);
  const [editingTask, setEditingTask] = useState<WorkTask | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null);
  const phasesQuery = useWorkPhases(access, project.id);
  const tasksQuery = useWorkTasks(access, project.id);
  const removePhase = useRemoveWorkPhase();
  const removeTask = useRemoveWorkTask();
  const setTaskProgress = useSetWorkTaskProgress();
  const phases = phasesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const progress = deriveProjectWbsProgress(tasks, project.id);
  const error = phasesQuery.error ?? tasksQuery.error;
  const canManagePhases = canManageWbsPhases(access, project);
  const canCreateTask = canCreateWbsTask(access, project);

  const deletePhase = async (phase: WorkPhase) => {
    if (!window.confirm(`‘${phase.name}’ 단계를 삭제하시겠습니까? 작업이 있는 단계는 삭제할 수 없습니다.`)) return;
    setNotice('');
    setActionError('');
    try {
      await removePhase.mutateAsync({ actor: access, id: phase.id });
      setNotice(`‘${phase.name}’ 단계를 삭제했습니다.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'WBS 단계를 삭제하지 못했습니다.');
    }
  };

  const deleteTask = async (task: WorkTask) => {
    if (!window.confirm(`‘${task.title}’ 작업을 삭제하시겠습니까?`)) return;
    setNotice('');
    setActionError('');
    try {
      await removeTask.mutateAsync({ actor: access, id: task.id, expectedVersion: task.version });
      setNotice(`‘${task.title}’ 작업을 삭제했습니다.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'WBS 작업을 삭제하지 못했습니다.');
    }
  };

  const changeProgress = async (task: WorkTask, progress: number) => {
    if (progress === task.progress) return;
    setNotice('');
    setActionError('');
    setProgressTaskId(task.id);
    try {
      const saved = await setTaskProgress.mutateAsync({
        actor: access,
        id: task.id,
        progress,
        expectedVersion: task.version,
      }) as WorkTask;
      setNotice(`‘${saved.title}’ 진척률을 ${saved.progress}%로 변경했습니다.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '작업 진척률을 변경하지 못했습니다.');
    } finally {
      setProgressTaskId(null);
    }
  };

  if (phasesQuery.isLoading || tasksQuery.isLoading) {
    return <Card title="세부 항목"><div className="py-8 text-center text-[11px] font-semibold text-ink3">WBS를 불러오는 중…</div></Card>;
  }

  if (error) {
    return <Card title="세부 항목"><div role="alert" className="py-8 text-center text-[11px] font-semibold text-danger">WBS를 불러오지 못했습니다.<br />{error instanceof Error ? error.message : ''}</div></Card>;
  }

  return (
    <section aria-labelledby="project-wbs-title" className="space-y-3">
      <Card bodyClassName="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="project-wbs-title" className="text-sm font-extrabold text-ink">세부 항목</h3>
            <p className="mt-1 text-[10px] text-ink3">{phases.length}개 단계 · {tasks.length}개 작업</p>
          </div>
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-56">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-ink2"><span>전체 진척률</span><span>{progress}%</span></div>
            <ProgressBar value={progress} label="프로젝트 전체 진척률" />
            </div>
            {canManagePhases && (
              <span className="shrink-0">
                <Button size="sm" variant="primary" onClick={() => setEditingPhase('new')}>+ 단계 추가</Button>
              </span>
            )}
            {canCreateTask && phases.length > 0 && (
              <span className="shrink-0">
                <Button size="sm" onClick={() => setEditingTask('new')}>+ 작업 추가</Button>
              </span>
            )}
          </div>
        </div>
        {notice && <div aria-live="polite" className="mt-3 rounded-md bg-teal-soft/30 px-3 py-2 text-[10px] font-semibold text-teal">{notice}</div>}
        {actionError && <div role="alert" className="mt-3 rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{actionError}</div>}
      </Card>

      {phases.length === 0 && (
        <Card><div className="py-8 text-center text-[11px] text-ink3">등록된 WBS 단계가 없습니다.</div></Card>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {phases.map((phase) => {
          const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
          const phaseProgress = derivePhaseProgress(phaseTasks, phase.id);
          return (
            <Card
              key={phase.id}
              bodyClassName="p-0"
            >
              <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
                <h4 className="min-w-0 break-all text-sm font-bold tracking-tight text-ink">{phase.name}</h4>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] font-extrabold text-teal">{phaseProgress}%</span>
                  {canManagePhases && (
                    <>
                      <button type="button" onClick={() => setEditingPhase(phase)} aria-label={`${phase.name} 단계 수정`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">수정</button>
                      <button type="button" onClick={() => deletePhase(phase)} disabled={removePhase.isPending} aria-label={`${phase.name} 단계 삭제`} className="rounded border border-danger/20 px-2 py-1 text-[9px] font-bold text-danger hover:bg-danger/5 disabled:opacity-50">삭제</button>
                    </>
                  )}
                </div>
              </div>
              <div className="border-b border-border px-4 py-2.5">
                <ProgressBar value={phaseProgress} label={`${phase.name} 단계 진척률`} />
              </div>
              {phaseTasks.length === 0 ? (
                <div className="px-4 py-6 text-center text-[10.5px] text-ink3">이 단계에 등록된 작업이 없습니다.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {phaseTasks.map((task) => (
                    <li key={task.id} className="p-4">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="break-words text-[11px] font-extrabold text-ink">{task.title}</div>
                          <div className="mt-1 text-[9.5px] font-semibold text-ink3">
                            {userById.get(task.assigneeUserId)?.name ?? task.assigneeUserId} · {formatDate(task.startAt)} ~ {formatDate(task.dueAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Pill tone={STATUS_TONES[task.status]}>{WORK_TASK_STATUS_LABELS[task.status]}</Pill>
                          {canEditWbsTask(access, project, task) && (
                            <>
                              <button type="button" onClick={() => setEditingTask(task)} aria-label={`${task.title} 작업 수정`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">수정</button>
                              <button type="button" onClick={() => deleteTask(task)} disabled={removeTask.isPending} aria-label={`${task.title} 작업 삭제`} className="rounded border border-danger/20 px-2 py-1 text-[9px] font-bold text-danger hover:bg-danger/5 disabled:opacity-50">삭제</button>
                            </>
                          )}
                        </div>
                      </div>
                      {task.description && <p className="mt-2 line-clamp-2 break-words text-[10px] leading-5 text-ink2">{task.description}</p>}
                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2">
                        <ProgressBar value={task.progress} label={`${task.title} 진척률`} />
                        {canUpdateWbsTaskProgress(access, project, task) ? (
                          <select
                            value={task.progress}
                            disabled={progressTaskId !== null}
                            aria-label={`${task.title} 진척률 변경`}
                            onChange={(event) => changeProgress(task, Number(event.target.value))}
                            className="h-7 rounded border border-border bg-panel px-1 text-[9.5px] font-bold text-ink2 outline-none focus:border-teal disabled:cursor-wait disabled:opacity-50"
                          >
                            {Array.from(new Set([task.progress, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]))
                              .sort((a, b) => a - b)
                              .map((value) => <option key={value} value={value}>{value}%</option>)}
                          </select>
                        ) : (
                          <span className="text-right text-[9.5px] font-bold text-ink3">{task.progress}%</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {editingPhase && (
        <WorkPhaseFormModal
          key={editingPhase === 'new' ? 'new' : editingPhase.id}
          actor={access}
          projectId={project.id}
          phase={editingPhase === 'new' ? undefined : editingPhase}
          onClose={() => setEditingPhase(null)}
          onSaved={(saved) => {
            setEditingPhase(null);
            setActionError('');
            setNotice(`‘${saved.name}’ 단계를 저장했습니다.`);
          }}
        />
      )}

      {editingTask && (
        <WorkTaskFormModal
          key={editingTask === 'new' ? 'new' : `${editingTask.id}-${editingTask.version}`}
          actor={access}
          project={project}
          phases={phases}
          users={users}
          task={editingTask === 'new' ? undefined : editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={(saved) => {
            setEditingTask(null);
            setActionError('');
            setNotice(`‘${saved.title}’ 작업을 저장했습니다.`);
          }}
        />
      )}
    </section>
  );
}
