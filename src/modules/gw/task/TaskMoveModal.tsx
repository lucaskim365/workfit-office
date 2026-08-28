import { useMemo, useState } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { collectDescendants } from '@/domain/workTask/path';
import { WORK_TASK_MAX_LEVEL, type WorkTask } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
import { useMoveWorkTask } from '@/features/project/useProjectWbs';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';

interface TaskMoveModalProps {
  access: ProjectAccessContext;
  task: WorkTask;
  tracks: WorkTrack[];
  tasks: WorkTask[];
  onClose: () => void;
  onMoved: (task: WorkTask) => void;
}

/**
 * 과업 옮기기 — 다른 상위(또는 다른 트랙) 밑으로.
 * ([[프로젝트관리_고도화_계획서.md]] §3)
 *
 * **수정 폼과 분리한 이유**: 옮기기는 하위 전체의 경로를 다시 쓴다. 수정 폼에서 부모만
 * 슬쩍 바뀌면 그 갱신이 빠져 경로가 어긋난다.
 *
 * 고를 수 없는 자리는 **아예 목록에 넣지 않는다** — 자기 자신, 자기 하위(순환), 그리고
 * 옮기면 5단을 넘기는 자리. 눌러 놓고 거부당하는 것보다 안 보이는 편이 낫다.
 */
export default function TaskMoveModal({ access, task, tracks, tasks, onClose, onMoved }: TaskMoveModalProps) {
  const [trackId, setTrackId] = useState<string | null>(task.trackId);
  const [parentId, setParentId] = useState<string | null>(task.parentId);
  const [error, setError] = useState('');
  const moveTask = useMoveWorkTask();

  /** 서브트리 깊이 — 옮긴 뒤 5단을 넘는 자리를 미리 걸러 내는 데 쓴다. */
  const subtreeDepth = useMemo(() => {
    const nodes = tasks.map((row) => ({
      id: row.id, trackId: row.trackId, parentId: row.parentId, sortOrder: row.sortOrder,
    }));
    const descendants = collectDescendants(nodes, task.id);
    const byId = new Map(tasks.map((row) => [row.id, row]));
    const deepest = descendants.reduce(
      (max, node) => Math.max(max, byId.get(node.id)?.level ?? task.level),
      task.level,
    );
    return deepest - task.level + 1; // 자기 포함 높이
  }, [task, tasks]);

  const blocked = useMemo(() => {
    const nodes = tasks.map((row) => ({
      id: row.id, trackId: row.trackId, parentId: row.parentId, sortOrder: row.sortOrder,
    }));
    return new Set([task.id, ...collectDescendants(nodes, task.id).map((node) => node.id)]);
  }, [task.id, tasks]);

  const parentOptions = useMemo(() => tasks
    .filter((row) => row.trackId === trackId)
    .filter((row) => !blocked.has(row.id))
    // 옮긴 뒤 가장 깊은 자손이 5단을 넘으면 거부되므로 미리 뺀다.
    .filter((row) => row.level + subtreeDepth <= WORK_TASK_MAX_LEVEL)
    .sort((a, b) => a.path.localeCompare(b.path)), [blocked, subtreeDepth, tasks, trackId]);

  const unchanged = trackId === task.trackId && parentId === task.parentId;

  const submit = async () => {
    setError('');
    try {
      const saved = await moveTask.mutateAsync({ actor: access, id: task.id, target: { trackId, parentId } }) as WorkTask;
      onMoved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '과업을 옮기지 못했습니다.');
    }
  };

  return (
    <Modal
      open
      onClose={() => { if (!moveTask.isPending) onClose(); }}
      title={`‘${task.title}’ 옮기기`}
      width={Math.min(520, window.innerWidth - 32)}
      footer={(
        <>
          <Button onClick={onClose} disabled={moveTask.isPending}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={unchanged || moveTask.isPending}>
            {moveTask.isPending ? '옮기는 중…' : '옮기기'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-panel-alt px-3 py-2 text-[10px] leading-6 text-ink3">
          하위 과업 전체가 함께 옮겨집니다{subtreeDepth > 1 ? ` (이 과업 아래 ${subtreeDepth - 1}단)` : ''}.
          자기 자신·자기 하위, 그리고 옮기면 {WORK_TASK_MAX_LEVEL}단을 넘는 자리는 목록에 나오지 않습니다.
        </p>

        {tracks.length > 0 && (
          <Field label="트랙" hint="트랙을 바꾸면 하위 전체의 트랙도 함께 바뀝니다.">
            <SelectField
              aria-label="트랙"
              value={trackId ?? ''}
              onChange={(event) => { setTrackId(event.target.value || null); setParentId(null); }}
              options={tracks.map((track) => ({ value: track.id, label: track.name }))}
            />
          </Field>
        )}

        <Field label="상위 과업" hint="비우면 대과업이 됩니다.">
          <SelectField
            aria-label="상위 과업"
            value={parentId ?? ''}
            onChange={(event) => setParentId(event.target.value || null)}
            options={[
              { value: '', label: '— 없음 (대과업) —' },
              ...parentOptions.map((row) => ({
                value: row.id,
                label: `${'　'.repeat(row.level - 1)}${row.title}`,
              })),
            ]}
          />
        </Field>

        {error && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[10.5px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  );
}
