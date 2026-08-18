import { useMemo, useState, type FormEvent } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject, WorkProjectDraft, WorkProjectStatus, WorkVisibility } from '@/domain/workProject/schema';
import type { User } from '@/domain/user/schema';
import { useCreateProject } from '@/features/project/useProjects';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';

interface ProjectFormModalProps {
  open: boolean;
  actor: User;
  access: ProjectAccessContext;
  users: User[];
  onClose: () => void;
  onCreated: (project: WorkProject) => void;
}

function dateToIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999+09:00' : 'T00:00:00.000+09:00';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function ProjectFormModal({ open, actor, access, users, onClose, onCreated }: ProjectFormModalProps) {
  const activeUsers = useMemo(() => users.filter((user) => user.status === '사용'), [users]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Extract<WorkProjectStatus, 'PLANNING' | 'ACTIVE'>>('PLANNING');
  const [visibility, setVisibility] = useState<WorkVisibility>('TEAM');
  const [memberUserIds, setMemberUserIds] = useState<string[]>([actor.id]);
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [color, setColor] = useState('#16a394');
  const [error, setError] = useState('');
  const createProject = useCreateProject();

  const toggleMember = (userId: string) => {
    if (userId === actor.id) return;
    setMemberUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const resetAndClose = () => {
    if (createProject.isPending) return;
    setCode('');
    setName('');
    setDescription('');
    setStatus('PLANNING');
    setVisibility('TEAM');
    setMemberUserIds([actor.id]);
    setStartAt('');
    setDueAt('');
    setColor('#16a394');
    setError('');
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const draft: WorkProjectDraft = {
      code,
      name,
      description,
      ownerUserId: actor.id,
      memberUserIds: Array.from(new Set([actor.id, ...memberUserIds])),
      deptId: access.deptId,
      visibility,
      status,
      startAt: dateToIso(startAt),
      dueAt: dateToIso(dueAt, true),
      color,
      chatRoomId: null,
    };
    try {
      const created = await createProject.mutateAsync({ actor: access, draft }) as WorkProject;
      onCreated(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '프로젝트를 저장하지 못했습니다.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="새 프로젝트"
      width={Math.min(680, window.innerWidth - 32)}
      footer={(
        <>
          <Button onClick={resetAndClose} disabled={createProject.isPending}>취소</Button>
          <Button variant="primary" type="submit" form="project-create-form" disabled={createProject.isPending}>{createProject.isPending ? '저장 중…' : '프로젝트 생성'}</Button>
        </>
      )}
    >
      <form id="project-create-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="프로젝트 코드" required hint="중복되지 않는 영문·숫자 코드를 권장합니다.">
            <TextField value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={30} placeholder="GW-2026" className="w-full" autoFocus />
          </Field>
          <Field label="프로젝트명" required>
            <TextField value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="프로젝트명" className="w-full" />
          </Field>
        </div>
        <Field label="설명">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="목표와 범위를 입력하세요" className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="초기 상태">
            <SelectField value={status} onChange={(event) => setStatus(event.target.value as typeof status)} options={[
              { value: 'PLANNING', label: '계획' },
              { value: 'ACTIVE', label: '진행' },
            ]} />
          </Field>
          <Field label="공개 범위">
            <SelectField value={visibility} onChange={(event) => setVisibility(event.target.value as WorkVisibility)} options={[
              { value: 'PRIVATE', label: '참여자만' },
              { value: 'TEAM', label: '같은 부서' },
              { value: 'COMPANY', label: '전사' },
            ]} />
          </Field>
          <Field label="색상">
            <TextField type="color" value={color} onChange={(event) => setColor(event.target.value)} className="w-full p-1" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="시작일" hint="한국 표준시 기준">
            <TextField type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full" />
          </Field>
          <Field label="종료일" hint="한국 표준시 기준">
            <TextField type="date" value={dueAt} min={startAt || undefined} onChange={(event) => setDueAt(event.target.value)} className="w-full" />
          </Field>
        </div>
        <Field label={`참여자 ${memberUserIds.length}명`} hint="프로젝트 소유자인 본인은 항상 참여자입니다.">
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2">
            <div className="grid gap-1 sm:grid-cols-2">
              {activeUsers.map((user) => (
                <label key={user.id} className={`flex items-center gap-2 rounded-md px-2 py-2 text-[10.5px] ${user.id === actor.id ? 'bg-teal-soft/30' : 'hover:bg-panel-alt'}`}>
                  <input type="checkbox" checked={memberUserIds.includes(user.id)} disabled={user.id === actor.id} onChange={() => toggleMember(user.id)} className="accent-teal" />
                  <span className="min-w-0 truncate font-semibold text-ink2">{user.name} · {user.dept}{user.id === actor.id ? ' · 소유자' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        </Field>
        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
    </Modal>
  );
}
