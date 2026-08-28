import { useMemo, useState } from 'react';
import { canManageProject, type ProjectAccessContext } from '@/domain/workProject/engine';
import { rollupTasks, rollupTrack } from '@/domain/workProject/rollup';
import {
  WORK_PROJECT_STATUS_LABELS,
  projectTypeLabel,
  type WorkProject,
} from '@/domain/workProject/schema';
import type { WorkTask } from '@/domain/workTask/schema';
import type { User } from '@/domain/user/schema';
import { useProjectTracks } from '@/features/project/useProjectTracks';
import { useWorkTasks } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import ProjectCalendar from './ProjectCalendar';
import ProjectFiles from './ProjectFiles';
import ProjectSettingsModal from './ProjectSettingsModal';
import ProjectWbs from './ProjectWbs';
import TaskDetailModal from './TaskDetailModal';

interface ProjectDetailProps {
  project: WorkProject;
  actor: User;
  access: ProjectAccessContext;
  users: User[];
  onBack: () => void;
}

const VISIBILITY_LABELS: Record<WorkProject['visibility'], string> = {
  PRIVATE: '참여자만',
  TEAM: '만든 부서',
  COMPANY: '전사',
};

function formatDate(iso: string | null): string {
  if (!iso) return '미정';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

/**
 * 프로젝트 상세 — 한 장으로 내려쓴다.
 * ([[프로젝트관리_고도화_계획서.md]])
 *
 * 요약 → 일정·파일 → 과업 트리 순서. 회의 중에 스크롤 한 번으로 전체를 훑을 수 있어야
 * 해서 탭으로 나누지 않았다.
 *
 * **과업·트랙 조회를 여기서 한 번만 한다.** 달력·파일·트리가 전부 같은 목록을 쓰는데
 * 각자 부르면 같은 데이터를 세 번 읽고, 한쪽만 갱신돼 화면끼리 어긋난다.
 */
export default function ProjectDetail({ project, actor, access, users, onBack }: ProjectDetailProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const tracksQuery = useProjectTracks(access, project.id);
  const tasksQuery = useWorkTasks(access, project.id);
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const rolled = useMemo(() => rollupTasks(tasks), [tasks]);
  const rootTasks = useMemo(() => tasks.filter((task) => task.parentId === null), [tasks]);
  const progress = rollupTrack(rootTasks, rolled);

  const canEdit = canManageProject(access, project) && project.status !== 'COMPLETED';
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" onClick={onBack}>← 프로젝트 목록</Button>
        {canEdit && <Button size="sm" variant="primary" onClick={() => setSettingsOpen(true)}>프로젝트 설정</Button>}
      </div>
      {notice && <div aria-live="polite" className="rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      {/* ── 요약 ── 참여자는 카드 하나를 먹지 않고 칩 한 줄로 접어 둔다. */}
      <Card bodyClassName="p-0">
        <div className="h-1.5" style={{ backgroundColor: project.color }} />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-ink3">{project.code}</div>
              <h2 className="mt-1 break-words text-xl font-extrabold text-ink">{project.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                <span className="rounded-full bg-teal-soft px-2 py-0.5 text-teal">{projectTypeLabel(project)}</span>
                <span className="rounded-full bg-panel-alt px-2 py-0.5 text-ink2">{WORK_PROJECT_STATUS_LABELS[project.status]}</span>
                <span className="rounded-full bg-panel-alt px-2 py-0.5 text-ink3">{VISIBILITY_LABELS[project.visibility]}</span>
                {project.clientName && <span className="rounded-full bg-panel-alt px-2 py-0.5 text-ink3">{project.clientName}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-lg border border-border bg-panel-alt/60 px-4 py-2 text-right">
                <div className="text-[9px] font-semibold text-ink3">프로젝트 일정</div>
                <div className="mt-0.5 text-[11px] font-extrabold text-ink2">{formatDate(project.startAt)} ~ {formatDate(project.dueAt)}</div>
              </div>
              <div className="w-44">
                <div className="mb-1 flex items-center justify-between text-[9.5px] font-bold text-ink2"><span>전체 진행률</span><span>{progress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-panel-alt" role="progressbar" aria-label="프로젝트 전체 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {project.description && (
            <p className="whitespace-pre-wrap border-t border-border pt-3 text-[11px] leading-6 text-ink2">{project.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="text-[9.5px] font-bold text-ink3">참여자 {project.memberUserIds.length}명</span>
            {(membersOpen ? project.memberUserIds : project.memberUserIds.slice(0, 5)).map((id) => (
              <span key={id} className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${id === project.ownerUserId ? 'bg-teal-soft text-teal' : 'bg-panel-alt text-ink2'}`}>
                {userById.get(id)?.name ?? id}{id === project.ownerUserId ? ' · 소유자' : ''}
              </span>
            ))}
            {project.memberUserIds.length > 5 && (
              <button type="button" onClick={() => setMembersOpen((v) => !v)} className="rounded-full border border-border px-2 py-0.5 text-[9.5px] font-bold text-ink3 hover:bg-panel-alt">
                {membersOpen ? '접기' : `+${project.memberUserIds.length - 5}`}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ── 일정 · 파일 ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
        <ProjectCalendar
          project={project}
          tasks={tasks}
          tracks={tracks}
          onSelectTask={(task) => setSelectedTaskId(task.id)}
        />
        <ProjectFiles
          project={project}
          access={access}
          tasks={tasks}
          users={users}
          onSelectTask={(task) => setSelectedTaskId(task.id)}
        />
      </div>

      {/* ── 과업 트리 ── */}
      <ProjectWbs
        project={project}
        access={access}
        users={users}
        tracks={tracks}
        tasks={tasks}
        rolled={rolled}
        isLoading={tracksQuery.isLoading || tasksQuery.isLoading}
        error={tracksQuery.error ?? tasksQuery.error}
        openTaskId={editingTaskId}
        onOpenTaskChange={setEditingTaskId}
        onSelectTask={(task) => setSelectedTaskId(task.id)}
      />

      {selectedTask && (
        <TaskDetailModal
          project={project}
          access={access}
          task={selectedTask}
          tracks={tracks}
          tasks={tasks}
          users={users}
          view={rolled.get(selectedTask.id) ?? { progress: selectedTask.progress, status: selectedTask.status, isLeaf: true }}
          onClose={() => setSelectedTaskId(null)}
          onEdit={() => { setEditingTaskId(selectedTask.id); setSelectedTaskId(null); }}
        />
      )}

      {settingsOpen && (
        <ProjectSettingsModal
          key={project.updatedAt}
          open
          project={project}
          actor={actor}
          access={access}
          users={users}
          onClose={() => setSettingsOpen(false)}
          onSaved={(saved) => {
            setSettingsOpen(false);
            setNotice(`‘${saved.name}’ 프로젝트 설정을 저장했습니다.`);
          }}
        />
      )}
    </div>
  );
}

export type { WorkTask };
