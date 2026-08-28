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
import { useSeedDefaultTracks } from '@/features/project/useProjectTracks';
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
  // 유형과 트랙은 직교한다 — 자체사업도 영업 트랙을 쓸 수 있다.
  const [projectType, setProjectType] = useState<WorkProjectType>('INTERNAL');
  const [fundingType, setFundingType] = useState<WorkFundingType>('GOVERNMENT');
  const [clientName, setClientName] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [withDefaultTracks, setWithDefaultTracks] = useState(true);
  const [error, setError] = useState('');
  const createProject = useCreateProject();
  const seedTracks = useSeedDefaultTracks();
  const isContract = projectType === 'CONTRACT';

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
    setProjectType('INTERNAL');
    setFundingType('GOVERNMENT');
    setClientName('');
    setContractNo('');
    setWithDefaultTracks(true);
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
      projectType,
      // 자체사업에 계약 정보가 남으면 리포트의 유형별 소계가 어긋난다. 여기서 잘라 낸다.
      fundingType: isContract ? fundingType : null,
      clientName: isContract && clientName.trim() ? clientName.trim() : null,
      contractNo: isContract && contractNo.trim() ? contractNo.trim() : null,
      contractStartAt: null,
      contractEndAt: null,
      startAt: dateToIso(startAt),
      dueAt: dateToIso(dueAt, true),
      color,
      chatRoomId: null,
    };
    try {
      const created = await createProject.mutateAsync({ actor: access, draft }) as WorkProject;
      if (withDefaultTracks) {
        // 트랙 생성이 실패해도 프로젝트는 이미 만들어졌다 — 여기서 막으면 사용자가
        // 프로젝트가 안 생긴 줄 알고 다시 만든다. 트랙은 나중에 손으로 추가할 수 있다.
        try {
          await seedTracks.mutateAsync({ actor: access, projectId: created.id });
        } catch {
          /* noop — 트랙은 프로젝트 설정에서 추가할 수 있다 */
        }
      }
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
              <TextField value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} placeholder="한국산업기술진흥원" className="w-full" />
            </Field>
            <Field label="계약번호">
              <TextField value={contractNo} onChange={(event) => setContractNo(event.target.value)} maxLength={60} placeholder="KIAT-2026-0417" className="w-full" />
            </Field>
          </div>
        )}
        <Field label="트랙" hint="영업·사업관리·개발을 미리 만들어 둡니다. 나중에 지우거나 이름을 바꿀 수 있습니다.">
          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] text-ink2">
            <input type="checkbox" checked={withDefaultTracks} onChange={(event) => setWithDefaultTracks(event.target.checked)} className="accent-teal" />
            기본 트랙 만들기
          </label>
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
