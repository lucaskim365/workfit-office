import { useState, type FormEvent } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkPhase } from '@/domain/workPhase/schema';
import { useCreateWorkPhase, useUpdateWorkPhase } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';

interface WorkPhaseFormModalProps {
  actor: ProjectAccessContext;
  projectId: string;
  phase?: WorkPhase;
  onClose: () => void;
  onSaved: (phase: WorkPhase) => void;
}

export default function WorkPhaseFormModal({ actor, projectId, phase, onClose, onSaved }: WorkPhaseFormModalProps) {
  const [name, setName] = useState(phase?.name ?? '');
  const [error, setError] = useState('');
  const createPhase = useCreateWorkPhase();
  const updatePhase = useUpdateWorkPhase();
  const pending = createPhase.isPending || updatePhase.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const saved = phase
        ? await updatePhase.mutateAsync({ actor, id: phase.id, name })
        : await createPhase.mutateAsync({ actor, draft: { projectId, name } });
      onSaved(saved as WorkPhase);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'WBS 단계를 저장하지 못했습니다.');
    }
  };

  return (
    <Modal
      open
      onClose={() => { if (!pending) onClose(); }}
      title={phase ? 'WBS 단계 수정' : 'WBS 단계 추가'}
      width={Math.min(420, window.innerWidth - 32)}
      footer={(
        <>
          <Button onClick={onClose} disabled={pending}>취소</Button>
          <Button variant="primary" type="submit" form="work-phase-form" disabled={pending}>{pending ? '저장 중…' : '저장'}</Button>
        </>
      )}
    >
      <form id="work-phase-form" onSubmit={submit}>
        <Field label="단계명" required hint="예: 기획, 개발, 검증">
          <TextField
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="단계명"
            maxLength={80}
            autoFocus
            className="w-full"
          />
        </Field>
        {error && <div role="alert" className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </form>
    </Modal>
  );
}
