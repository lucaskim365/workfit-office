import { useMemo, useState } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { rollupTasks, rollupTrack } from '@/domain/workProject/rollup';
import type { WorkProject } from '@/domain/workProject/schema';
import { canCreateWbsTask, canEditWbsTask, canUpdateWbsTaskProgress } from '@/domain/workTask/engine';
import { WORK_TASK_MAX_LEVEL, WORK_TASK_STATUS_LABELS, type WorkTask, type WorkTaskStatus } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
import type { User } from '@/domain/user/schema';
import { useProjectTracks } from '@/features/project/useProjectTracks';
import { useRemoveWorkTask, useSetWorkTaskProgress, useWorkTasks } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import WorkTaskFormModal from './WorkTaskFormModal';

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

/** 대·중·소 그 아래는 숫자로 표기한다. */
const LEVEL_LABELS = ['대', '중', '소', '4단', '5단'];

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
  const [editingTask, setEditingTask] = useState<WorkTask | 'new' | null>(null);
  const [preset, setPreset] = useState<{ trackId: string | null; parentId: string | null } | undefined>();
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null);
  const tracksQuery = useProjectTracks(access, project.id);
  const tasksQuery = useWorkTasks(access, project.id);
  const removeTask = useRemoveWorkTask();
  const setTaskProgress = useSetWorkTaskProgress();
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  /**
   * 표시용 진행률·상태 — **리프의 저장값에서 접어 올린 값**이다.
   * 상위 과업의 저장된 progress 는 쓰지 않는다([[프로젝트관리_고도화_계획서.md]] §4).
   */
  const rolled = useMemo(() => rollupTasks(tasks), [tasks]);
  const rootTasks = useMemo(() => tasks.filter((task) => task.parentId === null), [tasks]);
  const progress = rollupTrack(rootTasks, rolled);

  const error = tracksQuery.error ?? tasksQuery.error;
  const canCreateTask = canCreateWbsTask(access, project);

  /** 트랙이 없는 프로젝트는 `null` 그룹 하나로 그린다 — 대과업이 최상위. */
  const groups: Array<{ track: WorkTrack | null; roots: WorkTask[] }> = useMemo(() => {
    if (tracks.length === 0) {
      return [{ track: null, roots: rootTasks }];
    }
    const grouped = tracks.map((track) => ({
      track,
      roots: rootTasks.filter((task) => task.trackId === track.id),
    }));
    // 트랙이 지워졌는데 과업이 남은 경우를 화면에서 숨기지 않는다 — 안 보이면 못 고친다.
    const orphans = rootTasks.filter((task) => !tracks.some((track) => track.id === task.trackId));
    return orphans.length > 0 ? [...grouped, { track: null, roots: orphans }] : grouped;
  }, [rootTasks, tracks]);

  /** 한 대과업 아래를 `path` 순으로 펼친다. 정렬은 저장소가 이미 해 뒀다. */
  const subtreeOf = (root: WorkTask): WorkTask[] => tasks.filter(
    (task) => task.trackId === root.trackId && (task.id === root.id || task.path.startsWith(`${root.path}.`)),
  );

  const deleteTask = async (task: WorkTask) => {
    if (!window.confirm(`‘${task.title}’ 과업을 삭제하시겠습니까?`)) return;
    setNotice('');
    setActionError('');
    try {
      await removeTask.mutateAsync({ actor: access, id: task.id, expectedVersion: task.version });
      setNotice(`‘${task.title}’ 과업을 삭제했습니다.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '과업을 삭제하지 못했습니다.');
    }
  };

  const changeProgress = async (task: WorkTask, next: number) => {
    if (next === task.progress) return;
    setNotice('');
    setActionError('');
    setProgressTaskId(task.id);
    try {
      const saved = await setTaskProgress.mutateAsync({
        actor: access,
        id: task.id,
        progress: next,
        expectedVersion: task.version,
      }) as WorkTask;
      setNotice(`‘${saved.title}’ 진척률을 ${saved.progress}%로 변경했습니다.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '진척률을 변경하지 못했습니다.');
    } finally {
      setProgressTaskId(null);
    }
  };

  const openNewTask = (trackId: string | null, parentId: string | null) => {
    setPreset({ trackId, parentId });
    setEditingTask('new');
  };

  if (tracksQuery.isLoading || tasksQuery.isLoading) {
    return <Card title="세부 항목"><div className="py-8 text-center text-[11px] font-semibold text-ink3">과업을 불러오는 중…</div></Card>;
  }

  if (error) {
    return <Card title="세부 항목"><div role="alert" className="py-8 text-center text-[11px] font-semibold text-danger">과업을 불러오지 못했습니다.<br />{error instanceof Error ? error.message : ''}</div></Card>;
  }

  return (
    <section aria-labelledby="project-wbs-title" className="space-y-3">
      <Card bodyClassName="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="project-wbs-title" className="text-sm font-extrabold text-ink">세부 항목</h3>
            <p className="mt-1 text-[10px] text-ink3">
              {tracks.length > 0 ? `${tracks.length}개 트랙 · ` : ''}{tasks.length}개 과업
            </p>
          </div>
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-56">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-ink2"><span>전체 진척률</span><span>{progress}%</span></div>
              <ProgressBar value={progress} label="프로젝트 전체 진척률" />
            </div>
            {canCreateTask && (
              <span className="shrink-0">
                <Button size="sm" variant="primary" onClick={() => openNewTask(tracks[0]?.id ?? null, null)}>+ 대과업 추가</Button>
              </span>
            )}
          </div>
        </div>
        {notice && <div aria-live="polite" className="mt-3 rounded-md bg-teal-soft/30 px-3 py-2 text-[10px] font-semibold text-teal">{notice}</div>}
        {actionError && <div role="alert" className="mt-3 rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{actionError}</div>}
      </Card>

      {tasks.length === 0 && (
        <Card><div className="py-8 text-center text-[11px] text-ink3">등록된 과업이 없습니다.</div></Card>
      )}

      {groups.map((group) => {
        const trackProgress = rollupTrack(group.roots, rolled);
        if (group.roots.length === 0 && group.track === null) return null;
        return (
          <Card key={group.track?.id ?? '__none__'} bodyClassName="p-0">
            {group.track && (
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3.5 w-1 shrink-0 rounded-sm" style={{ background: group.track.color }} />
                  <h4 className="min-w-0 truncate text-sm font-bold tracking-tight text-ink">{group.track.name}</h4>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="w-24"><ProgressBar value={trackProgress} label={`${group.track.name} 진척률`} /></span>
                  <span className="text-[10px] font-extrabold text-teal">{trackProgress}%</span>
                  {canCreateTask && (
                    <button type="button" onClick={() => openNewTask(group.track!.id, null)} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">+ 대과업</button>
                  )}
                </div>
              </div>
            )}

            {group.roots.length === 0 ? (
              <div className="px-4 py-6 text-center text-[10.5px] text-ink3">이 트랙에 등록된 과업이 없습니다.</div>
            ) : (
              <ul className="divide-y divide-border">
                {group.roots.flatMap(subtreeOf).map((task) => {
                  const view = rolled.get(task.id) ?? { progress: task.progress, status: task.status, isLeaf: true };
                  return (
                    <li key={task.id} className="p-4" style={{ paddingLeft: `${16 + (task.level - 1) * 20}px` }}>
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 rounded bg-panel-alt px-1.5 py-0.5 text-[8.5px] font-extrabold text-ink3">
                              {LEVEL_LABELS[task.level - 1] ?? task.level}
                            </span>
                            <span className="min-w-0 break-words text-[11px] font-extrabold text-ink">{task.title}</span>
                          </div>
                          <div className="mt-1 text-[9.5px] font-semibold text-ink3">
                            {userById.get(task.assigneeUserId)?.name ?? task.assigneeUserId} · {formatDate(task.startAt)} ~ {formatDate(task.dueAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Pill tone={STATUS_TONES[view.status]}>{WORK_TASK_STATUS_LABELS[view.status]}</Pill>
                          {canCreateTask && task.level < WORK_TASK_MAX_LEVEL && (
                            <button type="button" onClick={() => openNewTask(task.trackId, task.id)} aria-label={`${task.title} 하위 추가`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">+ 하위</button>
                          )}
                          {canEditWbsTask(access, project, task) && (
                            <>
                              <button type="button" onClick={() => { setPreset(undefined); setEditingTask(task); }} aria-label={`${task.title} 과업 수정`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">수정</button>
                              <button type="button" onClick={() => deleteTask(task)} disabled={removeTask.isPending} aria-label={`${task.title} 과업 삭제`} className="rounded border border-danger/20 px-2 py-1 text-[9px] font-bold text-danger hover:bg-danger/5 disabled:opacity-50">삭제</button>
                            </>
                          )}
                        </div>
                      </div>
                      {task.description && <p className="mt-2 line-clamp-2 break-words text-[10px] leading-5 text-ink2">{task.description}</p>}
                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2">
                        <ProgressBar value={view.progress} label={`${task.title} 진척률`} />
                        {/* 진행률은 리프에서만 입력한다. 상위는 하위에서 접어 올린 값이라 고칠 수 없다. */}
                        {view.isLeaf && canUpdateWbsTaskProgress(access, project, task) ? (
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
                          <span className="text-right text-[9.5px] font-bold text-ink3" title={view.isLeaf ? undefined : '하위 과업에서 자동 집계됩니다'}>
                            {view.progress}%{view.isLeaf ? '' : ' 자동'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}

      {editingTask && (
        <WorkTaskFormModal
          key={editingTask === 'new' ? `new-${preset?.parentId ?? preset?.trackId ?? 'root'}` : `${editingTask.id}-${editingTask.version}`}
          actor={access}
          project={project}
          tracks={tracks}
          tasks={tasks}
          users={users}
          task={editingTask === 'new' ? undefined : editingTask}
          preset={editingTask === 'new' ? preset : undefined}
          onClose={() => { setEditingTask(null); setPreset(undefined); }}
          onSaved={(saved) => {
            setEditingTask(null);
            setPreset(undefined);
            setActionError('');
            setNotice(`‘${saved.title}’ 과업을 저장했습니다.`);
          }}
        />
      )}
    </section>
  );
}
