import { useMemo, useState } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import {
  WORK_PROJECT_STATUS_LABELS,
  type WorkProject,
  type WorkProjectStatus,
} from '@/domain/workProject/schema';
import type { User } from '@/domain/user/schema';
import { Card } from '@/shared/ui/Card';
import { FilterBar, FilterField, Select, TextInput } from '@/shared/ui/FilterBar';
import { Pill, type Tone } from '@/shared/ui/Pill';
import ProjectFormModal from './ProjectFormModal';
import { Button } from '@/shared/ui/Button';

export type ProjectTab = 'available' | 'owned' | 'completed' | 'archived';

interface ProjectListProps {
  actor: User;
  access: ProjectAccessContext;
  projects: WorkProject[];
  users: User[];
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  onSelectProject: (projectId: string) => void;
}

/** 좌측 세부 메뉴(TaskScreen)와 목록 필터가 함께 쓰는 프로젝트 구분. */
export const PROJECT_TABS: Array<{ id: ProjectTab; label: string; icon: string }> = [
  { id: 'available', label: '진행 프로젝트', icon: '📂' },
  { id: 'owned', label: '내가 소유', icon: '👤' },
  { id: 'completed', label: '완료', icon: '✅' },
  { id: 'archived', label: '보관', icon: '📦' },
];

const STATUS_TONE: Record<WorkProjectStatus, Tone> = {
  PLANNING: 'mute',
  ACTIVE: 'info',
  ON_HOLD: 'warn',
  COMPLETED: 'ok',
  ARCHIVED: 'mute',
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

function inTab(project: WorkProject, tab: ProjectTab, userId: string): boolean {
  if (tab === 'completed') return project.status === 'COMPLETED';
  if (tab === 'archived') return project.status === 'ARCHIVED';
  if (tab === 'owned') return project.ownerUserId === userId && project.status !== 'ARCHIVED';
  return !['COMPLETED', 'ARCHIVED'].includes(project.status);
}

export default function ProjectList({ actor, access, projects, users, tab, onTabChange, onSelectProject }: ProjectListProps) {
  const [status, setStatus] = useState<WorkProjectStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const keyword = query.trim().toLowerCase();
  const rows = projects
    .filter((project) => inTab(project, tab, actor.id))
    .filter((project) => status === 'ALL' || project.status === status)
    .filter((project) => !keyword || [project.code, project.name, project.description].some((value) => value.toLowerCase().includes(keyword)));

  return (
    <div className="space-y-4">
      {notice && <div aria-live="polite" className="rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      <FilterBar>
        <FilterField label="상태">
          <Select value={status} onChange={(value) => setStatus(value as WorkProjectStatus | 'ALL')} options={[
            { value: 'ALL', label: '전체' },
            ...Object.entries(WORK_PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={query} onChange={setQuery} placeholder="프로젝트명·코드" width={220} />
        </FilterField>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-semibold text-ink3">{rows.length}개 프로젝트</span>
          <Button variant="primary" onClick={() => setFormOpen(true)}>+ 프로젝트 생성</Button>
        </div>
      </FilterBar>

      {rows.length === 0 ? (
        <Card><div className="grid min-h-48 place-items-center text-center text-[11px] font-semibold text-ink3">조건에 해당하는 프로젝트가 없습니다.</div></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((project) => {
            const ownerName = userById.get(project.ownerUserId)?.name ?? project.ownerUserId;
            const memberNames = project.memberUserIds.map((id) => userById.get(id)?.name ?? id);
            return (
              <Card key={project.id} className="overflow-hidden" bodyClassName="p-0">
                <div className="h-1" style={{ backgroundColor: project.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[9.5px] font-bold text-ink3">{project.code}</div>
                      <div className="mt-1 truncate text-[13px] font-extrabold text-ink">{project.name}</div>
                    </div>
                    <Pill tone={STATUS_TONE[project.status]}>{WORK_PROJECT_STATUS_LABELS[project.status]}</Pill>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-8 text-[10.5px] leading-relaxed text-ink3">{project.description || '프로젝트 설명이 없습니다.'}</p>
                  <div className="mt-4 rounded-lg border border-border bg-panel-alt/55 px-3 py-2.5 text-[9.5px] font-semibold text-ink2">
                    {formatDate(project.startAt)} ~ {formatDate(project.dueAt)}
                  </div>
                  <div className="mt-3 border-t border-border pt-3 text-[9.5px] text-ink3">
                    <div><span className="font-bold text-ink2">소유자</span> · {ownerName}</div>
                    <div className="mt-1 truncate" title={memberNames.join(', ')}><span className="font-bold text-ink2">참여자 {memberNames.length}명</span> · {memberNames.join(', ')}</div>
                  </div>
                  <div className="mt-3">
                    <Button size="sm" block onClick={() => onSelectProject(project.id)}>상세 보기</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectFormModal
        key={`${formOpen}-${actor.id}`}
        open={formOpen}
        actor={actor}
        access={access}
        users={users}
        onClose={() => setFormOpen(false)}
        onCreated={(project) => {
          setFormOpen(false);
          onTabChange('owned');
          setStatus('ALL');
          setQuery('');
          setNotice(`‘${project.name}’ 프로젝트를 생성했습니다.`);
        }}
      />
    </div>
  );
}
