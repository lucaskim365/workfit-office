import { useMemo, useState, type FormEvent } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import {
  WORK_FUNDING_TYPE_LABELS,
  WORK_PROJECT_TYPE_LABELS,
  type WorkFundingType,
  type WorkProject,
  type WorkProjectDraft,
  type WorkProjectStatus,
  type WorkProjectType,
  type WorkVisibility,
} from '@/domain/workProject/schema';
import type { User } from '@/domain/user/schema';
import { useUpdateProject } from '@/features/project/useProjects';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';

interface ProjectSettingsModalProps {
  open: boolean;
  project: WorkProject;
  actor: User;
  access: ProjectAccessContext;
  users: User[];
  onClose: () => void;
  onSaved: (project: WorkProject) => void;
}

function isoToDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function dateToIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999+09:00' : 'T00:00:00.000+09:00';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function ProjectSettingsModal({ open, project, actor, access, users, onClose, onSaved }: ProjectSettingsModalProps) {
  const activeUsers = useMemo(() => users.filter((user) => user.status === '사용' || project.memberUserIds.includes(user.id)), [project.memberUserIds, users]);
  const [code, setCode] = useState(project.code);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<Exclude<WorkProjectStatus, 'ARCHIVED'>>(project.status === 'ARCHIVED' ? 'ON_HOLD' : project.status);
  const [visibility, setVisibility] = useState<WorkVisibility>(project.visibility);
  const [memberUserIds, setMemberUserIds] = useState([...project.memberUserIds]);
  const [startAt, setStartAt] = useState(isoToDate(project.startAt));
  const [dueAt, setDueAt] = useState(isoToDate(project.dueAt));
  const [color, setColor] = useState(project.color);
  const [projectType, setProjectType] = useState<WorkProjectType>(project.projectType);
  const [fundingType, setFundingType] = useState<WorkFundingType>(project.fundingType ?? 'GOVERNMENT');
  const [clientName, setClientName] = useState(project.clientName ?? '');
  const [contractNo, setContractNo] = useState(project.contractNo ?? '');
  const [error, setError] = useState('');
  const updateProject = useUpdateProject();
  const isContract = projectType === 'CONTRACT';

  const toggleMember = (userId: string) => {
    if (userId === project.ownerUserId) return;
    setMemberUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const draft: WorkProjectDraft = {
      code,
      name,
      description,
      ownerUserId: project.ownerUserId,
      memberUserIds: Array.from(new Set([project.ownerUserId, ...memberUserIds])),
      deptId: project.deptId,
      visibility,
      status,
      projectType,
      // 수주 → 자체로 바꾸면 계약 정보를 함께 지운다. 남겨 두면 리포트 소계가 어긋난다.
      fundingType: isContract ? fundingType : null,
      clientName: isContract && clientName.trim() ? clientName.trim() : null,
      contractNo: isContract && contractNo.trim() ? contractNo.trim() : null,
      contractStartAt: isContract ? project.contractStartAt : null,
      contractEndAt: isContract ? project.contractEndAt : null,
      startAt: dateToIso(startAt),
      dueAt: dateToIso(dueAt, true),
      color,
      chatRoomId: project.chatRoomId,
    };
    try {
      const saved = await updateProject.mutateAsync({ actor: access, id: project.id, draft }) as WorkProject;
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '프로젝트를 수정하지 못했습니다.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !updateProject.isPending && onClose()}
      title="프로젝트 설정"
      width={Math.min(680, window.innerWidth - 32)}
      footer={(
        <>
          <Button onClick={onClose} disabled={updateProject.isPending}>취소</Button>
          <Button variant="primary" type="submit" form="project-settings-form" disabled={updateProject.isPending}>{updateProject.isPending ? '저장 중…' : '변경 저장'}</Button>
        </>
      )}
    >
      <form id="project-settings-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="프로젝트 코드" required><TextField value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={30} className="w-full" autoFocus /></Field>
          <Field label="프로젝트명" required><TextField value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="w-full" /></Field>
        </div>
        <Field label="설명"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-teal" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="사업 유형" required hint="외부 발주처·계약이 있으면 수주사업입니다.">
            <SelectField value={projectType} onChange={(event) => setProjectType(event.target.value as WorkProjectType)} options={[
              { value: 'INTERNAL', label: WORK_PROJECT_TYPE_LABELS.INTERNAL },
              { value: 'CONTRACT', label: WORK_PROJECT_TYPE_LABELS.CONTRACT },
            ]} />
          </Field>
          {isContract && (
            <Field label="재원" required>
              <SelectField value={fundingType} onChange={(event) => setFundingType(event.target.value as WorkFundingType)} options={[
                { value: 'GOVERNMENT', label: WORK_FUNDING_TYPE_LABELS.GOVERNMENT },
                { value: 'PRIVATE', label: WORK_FUNDING_TYPE_LABELS.PRIVATE },
              ]} />
            </Field>
          )}
        </div>
        {isContract && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="발주처">
              <TextField value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} className="w-full" />
            </Field>
            <Field label="계약번호">
              <TextField value={contractNo} onChange={(event) => setContractNo(event.target.value)} maxLength={60} className="w-full" />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="상태">
            <SelectField value={status} onChange={(event) => setStatus(event.target.value as typeof status)} options={[
              { value: 'PLANNING', label: '계획' },
              { value: 'ACTIVE', label: '진행' },
              { value: 'ON_HOLD', label: '보류' },
              { value: 'COMPLETED', label: '완료' },
            ]} />
          </Field>
          <Field label="공개 범위"><SelectField value={visibility} onChange={(event) => setVisibility(event.target.value as WorkVisibility)} options={[
            { value: 'PRIVATE', label: '참여자만' },
            { value: 'TEAM', label: '같은 부서' },
            { value: 'COMPANY', label: '전사' },
          ]} /></Field>
          <Field label="색상"><TextField type="color" value={color} onChange={(event) => setColor(event.target.value)} className="w-full p-1" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="시작일" hint="한국 표준시 기준"><TextField type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full" /></Field>
          <Field label="종료일" hint="한국 표준시 기준"><TextField type="date" value={dueAt} min={startAt || undefined} onChange={(event) => setDueAt(event.target.value)} className="w-full" /></Field>
        </div>
        <Field label={`참여자 ${memberUserIds.length}명`} hint="프로젝트 소유자는 참여자에서 제거할 수 없습니다.">
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
            <div className="grid gap-1 sm:grid-cols-2">
              {activeUsers.map((user) => (
                <label key={user.id} className={`flex items-center gap-2 rounded-md px-2 py-2 text-[10.5px] ${user.id === project.ownerUserId ? 'bg-teal-soft/30' : 'hover:bg-panel-alt'}`}>
                  <input type="checkbox" checked={memberUserIds.includes(user.id)} disabled={user.id === project.ownerUserId} onChange={() => toggleMember(user.id)} className="accent-teal" />
                  <span className="min-w-0 truncate font-semibold text-ink2">{user.name} · {user.dept}{user.id === project.ownerUserId ? ' · 소유자' : user.status !== '사용' ? ' · 비활성' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        </Field>
        <div className="rounded-lg border border-border bg-panel-alt/50 px-3 py-2 text-[9.5px] text-ink3">소유자: {actor.name}</div>
        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
    </Modal>
  );
}
