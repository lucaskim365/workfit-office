import { useMemo, useState } from 'react';
import { canManageProject, type ProjectAccessContext } from '@/domain/workProject/engine';
import { WORK_PROJECT_STATUS_LABELS, type WorkProject } from '@/domain/workProject/schema';
import type { User } from '@/domain/user/schema';
import { Card } from '@/shared/ui/Card';
import ProjectSettingsModal from './ProjectSettingsModal';
import ProjectWbs from './ProjectWbs';
import { Button } from '@/shared/ui/Button';

interface ProjectDetailProps {
  project: WorkProject;
  actor: User;
  access: ProjectAccessContext;
  users: User[];
  onBack: () => void;
}

const VISIBILITY_LABELS: Record<WorkProject['visibility'], string> = {
  PRIVATE: '참여자만',
  TEAM: '같은 부서',
  COMPANY: '전사',
};

function formatDate(iso: string | null): string {
  if (!iso) return '미정';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export default function ProjectDetail({ project, actor, access, users, onBack }: ProjectDetailProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const canEdit = canManageProject(access, project) && project.status !== 'COMPLETED';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" onClick={onBack}>← 프로젝트 목록</Button>
        {canEdit && <Button size="sm" variant="primary" onClick={() => setSettingsOpen(true)}>프로젝트 설정</Button>}
      </div>
      {notice && <div aria-live="polite" className="rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      <Card bodyClassName="p-0">
        <div className="h-1.5" style={{ backgroundColor: project.color }} />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold text-ink3">{project.code}</div>
              <h2 className="mt-1 text-xl font-extrabold text-ink">{project.name}</h2>
              <div className="mt-2 text-[10.5px] font-semibold text-ink3">{WORK_PROJECT_STATUS_LABELS[project.status]} · {VISIBILITY_LABELS[project.visibility]}</div>
            </div>
            <div className="rounded-lg border border-border bg-panel-alt/60 px-4 py-3 text-right">
              <div className="text-[9.5px] font-semibold text-ink3">프로젝트 일정</div>
              <div className="mt-1 text-[11px] font-extrabold text-ink2">{formatDate(project.startAt)} ~ {formatDate(project.dueAt)}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <Card title="프로젝트 개요">
          <p className="whitespace-pre-wrap text-[11px] leading-6 text-ink2">{project.description || '등록된 프로젝트 설명이 없습니다.'}</p>
        </Card>
        <Card title={`참여자 ${project.memberUserIds.length}명`}>
          <div className="space-y-2">
            {project.memberUserIds.map((id) => {
              const user = userById.get(id);
              return (
                <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0"><div className="truncate text-[10.5px] font-bold text-ink">{user?.name ?? id}</div><div className="mt-0.5 truncate text-[9px] text-ink3">{user?.dept ?? '사용자 정보 없음'}</div></div>
                  {id === project.ownerUserId && <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 text-[9px] font-bold text-teal">소유자</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <ProjectWbs project={project} access={access} users={users} />

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
