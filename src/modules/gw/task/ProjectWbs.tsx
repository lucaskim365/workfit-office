import { useMemo, useState } from 'react';
import { type ProjectAccessContext } from '@/domain/workProject/engine';
import { rollupTrack, type RollupResult } from '@/domain/workProject/rollup';
import { WORK_PROJECT_STATUS_LABELS, type WorkProject } from '@/domain/workProject/schema';
import { canCreateWbsTask, canEditWbsTask, canManageWbsPhases, canUpdateWbsTaskProgress, isWbsProjectMutable } from '@/domain/workTask/engine';
import { WORK_TASK_MAX_LEVEL, WORK_TASK_STATUS_LABELS, type WorkTask, type WorkTaskStatus } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
import type { User } from '@/domain/user/schema';
import { useRemoveWorkTask, useSetWorkTaskProgress } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import TaskDetailPanel from './TaskDetailPanel';
import TaskMoveModal from './TaskMoveModal';
import TrackManagerModal from './TrackManagerModal';
import WorkTaskFormModal from './WorkTaskFormModal';

interface ProjectWbsProps {
  project: WorkProject;
  access: ProjectAccessContext;
  users: User[];
  /** 조회는 상세 화면이 한 번만 한다 — 달력·파일·트리가 같은 목록을 봐야 어긋나지 않는다. */
  tracks: WorkTrack[];
  tasks: WorkTask[];
  rolled: Map<string, RollupResult>;
  isLoading: boolean;
  error: unknown;
  /** 선택된 과업 — 오른쪽 상세 패널이 이걸 그린다. 달력·파일에서도 같은 상태를 쓴다. */
  selectedTaskId: string | null;
  onSelectTask: (task: WorkTask | null) => void;
  /** 수정 모달을 밖(상세 패널)에서도 열 수 있게 상태를 위로 올렸다. */
  openTaskId: string | null;
  onOpenTaskChange: (id: string | null) => void;
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

export default function ProjectWbs({
  project, access, users, tracks, tasks, rolled, isLoading, error,
  selectedTaskId, onSelectTask, openTaskId, onOpenTaskChange,
}: ProjectWbsProps) {
  const [creating, setCreating] = useState(false);
  const [preset, setPreset] = useState<{ trackId: string | null; parentId: string | null } | undefined>();
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null);
  /** 접힌 과업 id. **기본은 전부 펼침** — 처음 열었을 때 전체가 보여야 구조가 읽힌다. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tracksOpen, setTracksOpen] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const removeTask = useRemoveWorkTask();
  const setTaskProgress = useSetWorkTaskProgress();
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const rootTasks = useMemo(() => tasks.filter((task) => task.parentId === null), [tasks]);
  const progress = rollupTrack(rootTasks, rolled);
  const editingTask = openTaskId ? tasks.find((task) => task.id === openTaskId) ?? null : null;
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const movingTask = movingTaskId ? tasks.find((task) => task.id === movingTaskId) ?? null : null;

  const canCreateTask = canCreateWbsTask(access, project);
  const canManageTracks = canManageWbsPhases(access, project);

  /**
   * 편집이 막힌 이유 — **버튼만 조용히 사라지면 기능이 없는 것처럼 보인다.**
   * 실제로 "하위 추가가 안 된다"는 오해가 여기서 나왔다. 왜 못 하는지 말해 준다.
   */
  const readOnlyReason = useMemo(() => {
    if (canCreateTask) return null;
    if (!access.active) return '비활성 계정이라 과업을 편집할 수 없습니다.';
    if (!isWbsProjectMutable(project)) {
      return `${WORK_PROJECT_STATUS_LABELS[project.status]} 상태의 프로젝트는 읽기 전용입니다.`;
    }
    // 관리자면 여기 오지 않는다. 즉 이 문구가 보인다는 건 계정 권한그룹이 ADMIN 이 아니라는 뜻 —
    // 그걸 밝혀 줘야 "우회가 안 먹는다"와 "권한그룹이 다르다"를 구분할 수 있다.
    return '이 프로젝트의 참여자가 아니라 읽기 전용입니다. 소유자가 참여자로 추가해야 합니다. (현재 계정의 권한그룹이 ADMIN이면 자동으로 열립니다)';
  }, [access.active, canCreateTask, project]);

  const childCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.parentId) continue;
      map.set(task.parentId, (map.get(task.parentId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const toggleCollapse = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const collapseAll = () => setCollapsed(new Set([...childCount.keys()]));
  const expandAll = () => setCollapsed(new Set());

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

  /** 부모 → 직속 자식. 저장소가 `path` 순으로 정렬해 줬으므로 순서는 그대로 쓴다. */
  const childrenOf = useMemo(() => {
    const map = new Map<string, WorkTask[]>();
    for (const task of tasks) {
      if (!task.parentId) continue;
      const list = map.get(task.parentId);
      if (list) list.push(task);
      else map.set(task.parentId, [task]);
    }
    return map;
  }, [tasks]);

  const deleteTask = async (task: WorkTask) => {
    if (!window.confirm(`‘${task.title}’ 과업을 삭제하시겠습니까?`)) return;
    setNotice('');
    setActionError('');
    try {
      await removeTask.mutateAsync({ actor: access, id: task.id, expectedVersion: task.version });
      if (selectedTaskId === task.id) onSelectTask(null);
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

  /** 상세가 열리면 트리를 좁힌다 — 설명·진행률 조절기를 접어 폭을 양보한다. */
  const compact = selectedTask !== null;

  const openNewTask = (trackId: string | null, parentId: string | null) => {
    setPreset({ trackId, parentId });
    setCreating(true);
  };

  /**
   * 과업 한 마디를 그린다 — 자기 행 + (자식이 있으면) 자식 묶음.
   *
   * **평면 목록이 아니라 중첩으로 그리는 이유**: 자식을 부모 안에 넣어야 접기·펼치기를
   * 높이 전환으로 애니메이션할 수 있다. 평면 목록에서는 행이 통째로 사라졌다 나타나서
   * 무엇이 늘고 줄었는지 눈이 못 따라간다.
   *
   * 높이는 `grid-template-rows: 0fr ↔ 1fr` 로 전환한다. 내용 높이를 미리 재지 않아도
   * 되므로 하위가 몇 개든, 깊이가 얼마든 같은 코드로 부드럽게 접힌다.
   */
  const renderNode = (task: WorkTask): React.ReactNode => {
    const view = rolled.get(task.id) ?? { progress: task.progress, status: task.status, isLeaf: true };
    const kids = childrenOf.get(task.id) ?? [];
    const isCollapsed = collapsed.has(task.id);
    const isSelected = task.id === selectedTaskId;

    return (
      <div key={task.id}>
        <div
          // 카드(행) 어디를 눌러도 상세가 열린다. 제목만 눌러야 하면 표적이 너무 작다.
          // 안쪽 버튼·선택기는 각자 stopPropagation 으로 이 클릭을 막는다.
          onClick={() => onSelectTask(task)}
          className={`cursor-pointer border-b border-border py-2.5 pr-3 transition-colors ${isSelected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/60'}`}
          style={{ paddingLeft: `${10 + (task.level - 1) * 18}px` }}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-1">
              {/* 접기 손잡이는 자리를 항상 차지한다 — 없으면 들여쓰기가 들쭉날쭉해진다. */}
              {kids.length > 0 ? (
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); toggleCollapse(task.id); }}
                  aria-label={`${task.title} ${isCollapsed ? '펼치기' : '접기'}`}
                  aria-expanded={!isCollapsed}
                  className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded text-[8px] font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
                >
                  {/* 같은 글리프를 돌린다 — 모양이 바뀌면 회전이 안 보인다. */}
                  <span className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded bg-panel-alt px-1.5 py-0.5 text-[8.5px] font-extrabold text-ink3">
                    {LEVEL_LABELS[task.level - 1] ?? task.level}
                  </span>
                  <span className={`min-w-0 break-words text-[11px] font-extrabold ${isSelected ? 'text-teal' : 'text-ink'}`}>
                    {task.title}
                  </span>
                  {isCollapsed && kids.length > 0 && (
                    <span className="shrink-0 rounded-full bg-panel-alt px-1.5 py-px text-[8px] font-bold text-ink3">+{kids.length}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[9.5px] font-semibold text-ink3">
                  {userById.get(task.assigneeUserId)?.name ?? task.assigneeUserId} · {formatDate(task.startAt)} ~ {formatDate(task.dueAt)}
                </div>
                {!compact && task.description && (
                  <p className="mt-1.5 line-clamp-2 break-words text-[10px] leading-5 text-ink2">{task.description}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Pill tone={STATUS_TONES[view.status]}>{WORK_TASK_STATUS_LABELS[view.status]}</Pill>
              {!compact && canCreateTask && task.level < WORK_TASK_MAX_LEVEL && (
                <button type="button" onClick={(event) => { event.stopPropagation(); openNewTask(task.trackId, task.id); }} aria-label={`${task.title} 하위 추가`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">+ 하위</button>
              )}
              {!compact && canEditWbsTask(access, project, task) && (
                <>
                  <button type="button" onClick={(event) => { event.stopPropagation(); setMovingTaskId(task.id); }} aria-label={`${task.title} 옮기기`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">옮기기</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); setPreset(undefined); onOpenTaskChange(task.id); }} aria-label={`${task.title} 과업 수정`} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">수정</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); deleteTask(task); }} disabled={removeTask.isPending} aria-label={`${task.title} 과업 삭제`} className="rounded border border-danger/20 px-2 py-1 text-[9px] font-bold text-danger hover:bg-danger/5 disabled:opacity-50">삭제</button>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2 pl-5">
            <ProgressBar value={view.progress} label={`${task.title} 진척률`} />
            {/* 진행률은 리프에서만 입력한다. 상위는 하위에서 접어 올린 값이라 고칠 수 없다. */}
            {!compact && view.isLeaf && canUpdateWbsTaskProgress(access, project, task) ? (
              <select
                value={task.progress}
                disabled={progressTaskId !== null}
                aria-label={`${task.title} 진척률 변경`}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => changeProgress(task, Number(event.target.value))}
                className="h-6 rounded border border-border bg-panel px-1 text-[9.5px] font-bold text-ink2 outline-none focus:border-teal disabled:cursor-wait disabled:opacity-50"
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
        </div>

        {kids.length > 0 && (
          <div
            className={`tree-branch grid transition-[grid-template-rows] duration-200 ease-out ${isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
            aria-hidden={isCollapsed}
          >
            {/* 높이 0으로 접힐 때 내용이 삐져나오지 않게 잘라 낸다. */}
            <div className="overflow-hidden">
              {kids.map((child) => renderNode(child))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
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
            <div className="min-w-0 flex-1 sm:w-48">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-ink2"><span>전체 진척률</span><span>{progress}%</span></div>
              <ProgressBar value={progress} label="프로젝트 전체 진척률" />
            </div>
            {childCount.size > 0 && (
              <span className="flex shrink-0 gap-1">
                <Button size="sm" onClick={expandAll}>모두 펼치기</Button>
                <Button size="sm" onClick={collapseAll}>모두 접기</Button>
              </span>
            )}
            {canManageTracks && (
              <span className="shrink-0">
                <Button size="sm" onClick={() => setTracksOpen(true)}>트랙 관리</Button>
              </span>
            )}
            {canCreateTask && (
              <span className="shrink-0">
                <Button size="sm" variant="primary" onClick={() => openNewTask(tracks[0]?.id ?? null, null)}>+ 대과업 추가</Button>
              </span>
            )}
          </div>
        </div>
        {readOnlyReason && (
          <div className="mt-3 rounded-md border border-border bg-panel-alt px-3 py-2 text-[10px] font-semibold text-ink3">
            🔒 {readOnlyReason}
          </div>
        )}
        {notice && <div aria-live="polite" className="mt-3 rounded-md bg-teal-soft/30 px-3 py-2 text-[10px] font-semibold text-teal">{notice}</div>}
        {actionError && <div role="alert" className="mt-3 rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{actionError}</div>}
      </Card>

      {tasks.length === 0 && (
        <Card><div className="py-8 text-center text-[11px] text-ink3">등록된 과업이 없습니다.</div></Card>
      )}

      {/* 상세가 열리면 좌 트리 / 우 상세로 갈린다. 모달로 덮지 않아 위치를 잃지 않는다. */}
      <div className={compact ? 'grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]' : ''}>
        <div className="min-w-0 space-y-3">
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
                      <span className="w-20"><ProgressBar value={trackProgress} label={`${group.track.name} 진척률`} /></span>
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
                  <div>{group.roots.map((root) => renderNode(root))}</div>
                )}
              </Card>
            );
          })}
        </div>

        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            project={project}
            access={access}
            task={selectedTask}
            tracks={tracks}
            tasks={tasks}
            users={users}
            rolled={rolled}
            canEdit={canEditWbsTask(access, project, selectedTask)}
            canAddChild={canCreateTask && selectedTask.level < WORK_TASK_MAX_LEVEL}
            canSetProgress={canUpdateWbsTaskProgress(access, project, selectedTask)}
            progressPending={progressTaskId !== null}
            onSelectTask={(next) => onSelectTask(next)}
            onClose={() => onSelectTask(null)}
            onEdit={() => onOpenTaskChange(selectedTask.id)}
            onAddChild={() => openNewTask(selectedTask.trackId, selectedTask.id)}
            onMove={() => setMovingTaskId(selectedTask.id)}
            onDelete={() => deleteTask(selectedTask)}
            onChangeProgress={(next) => changeProgress(selectedTask, next)}
          />
        )}
      </div>

      {tracksOpen && (
        <TrackManagerModal
          project={project}
          access={access}
          tracks={tracks}
          tasks={tasks}
          onClose={() => setTracksOpen(false)}
        />
      )}

      {movingTask && (
        <TaskMoveModal
          key={`${movingTask.id}-${movingTask.version}`}
          access={access}
          task={movingTask}
          tracks={tracks}
          tasks={tasks}
          onClose={() => setMovingTaskId(null)}
          onMoved={(saved) => {
            setMovingTaskId(null);
            setActionError('');
            setNotice(`‘${saved.title}’ 과업을 옮겼습니다.`);
          }}
        />
      )}

      {(creating || editingTask) && (
        <WorkTaskFormModal
          key={creating ? `new-${preset?.parentId ?? preset?.trackId ?? 'root'}` : `${editingTask!.id}-${editingTask!.version}`}
          actor={access}
          project={project}
          tracks={tracks}
          tasks={tasks}
          users={users}
          task={creating ? undefined : editingTask ?? undefined}
          preset={creating ? preset : undefined}
          onClose={() => { setCreating(false); onOpenTaskChange(null); setPreset(undefined); }}
          onSaved={(saved) => {
            setCreating(false);
            onOpenTaskChange(null);
            setPreset(undefined);
            setActionError('');
            setNotice(`‘${saved.title}’ 과업을 저장했습니다.`);
          }}
        />
      )}
    </section>
  );
}
