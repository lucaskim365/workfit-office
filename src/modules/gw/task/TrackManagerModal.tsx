import { useState } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkTask } from '@/domain/workTask/schema';
import { DEFAULT_TRACK_COLORS, type WorkTrack } from '@/domain/workTrack/schema';
import {
  useCreateTrack,
  useRemoveTrack,
  useRenameTrack,
  useReorderTracks,
} from '@/features/project/useProjectTracks';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { TextField } from '@/shared/ui/form/TextField';

interface TrackManagerModalProps {
  project: WorkProject;
  access: ProjectAccessContext;
  tracks: WorkTrack[];
  tasks: WorkTask[];
  onClose: () => void;
}

/**
 * 트랙 관리 — 추가·이름 변경·순서·삭제.
 * ([[프로젝트관리_고도화_계획서.md]] §2)
 *
 * 트랙 이름은 코드에 박힌 enum이 아니라 프로젝트마다 정하는 데이터다. 이 화면이 없으면
 * 생성 시 채워진 기본 3개를 영영 못 고쳐서, 자유 정의로 만든 의미가 절반만 실현된다.
 *
 * **과업이 걸린 트랙은 지울 수 없다.** 지우면서 과업을 트랙 없음으로 밀어내면 트랙이 있는
 * 프로젝트에서 최상위가 둘(트랙과 떠도는 대과업)이 되어 화면이 무너진다. 몇 건이 걸려
 * 있는지 먼저 보여 주고, 옮기거나 지우게 한다.
 */
export default function TrackManagerModal({ project, access, tracks, tasks, onClose }: TrackManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  const createTrack = useCreateTrack();
  const renameTrack = useRenameTrack();
  const removeTrack = useRemoveTrack();
  const reorderTracks = useReorderTracks();
  const pending = createTrack.isPending || renameTrack.isPending || removeTrack.isPending || reorderTracks.isPending;

  const taskCount = (trackId: string) => tasks.filter((task) => task.trackId === trackId).length;

  const run = async (job: () => Promise<unknown>) => {
    setError('');
    try {
      await job();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '트랙을 저장하지 못했습니다.');
    }
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await createTrack.mutateAsync({
        actor: access,
        draft: {
          projectId: project.id,
          name,
          // 이미 쓰는 색을 피해 돌려 쓴다 — 같은 색 트랙이 둘이면 달력에서 구분이 안 된다.
          color: DEFAULT_TRACK_COLORS[tracks.length % DEFAULT_TRACK_COLORS.length],
        },
      });
      setNewName('');
    });
  };

  const move = (index: number, delta: number) => {
    const next = [...tracks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderTracks.mutateAsync({
      actor: access,
      projectId: project.id,
      orderedIds: next.map((track) => track.id),
    }));
  };

  const submitRename = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    run(async () => {
      await renameTrack.mutateAsync({ actor: access, id: editing.id, name });
      setEditing(null);
    });
  };

  const drop = (track: WorkTrack) => {
    const count = taskCount(track.id);
    if (count > 0) {
      setError(`‘${track.name}’ 트랙에 과업 ${count}건이 걸려 있습니다. 먼저 옮기거나 삭제하세요.`);
      return;
    }
    if (!window.confirm(`‘${track.name}’ 트랙을 삭제하시겠습니까?`)) return;
    run(() => removeTrack.mutateAsync({ actor: access, id: track.id }));
  };

  return (
    <Modal
      open
      onClose={() => { if (!pending) onClose(); }}
      title="트랙 관리"
      width={Math.min(520, window.innerWidth - 32)}
      footer={<Button onClick={onClose} disabled={pending}>닫기</Button>}
    >
      <div className="space-y-3">
        <p className="text-[10.5px] leading-6 text-ink3">
          트랙은 동시에 도는 레인입니다. 이름은 프로젝트마다 자유롭게 정하고, 안 쓰면 0개로 두어도
          됩니다 — 그러면 대과업이 최상위가 됩니다.
        </p>

        {error && <div role="alert" className="rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{error}</div>}

        <ul className="divide-y divide-border rounded-lg border border-border">
          {tracks.length === 0 && (
            <li className="px-3 py-6 text-center text-[10.5px] text-ink3">트랙이 없습니다. 대과업이 최상위로 보입니다.</li>
          )}
          {tracks.map((track, index) => {
            const count = taskCount(track.id);
            const isEditing = editing?.id === track.id;
            return (
              <li key={track.id} className="flex items-center gap-2 px-3 py-2">
                <span className="h-4 w-1 shrink-0 rounded-sm" style={{ background: track.color }} />
                {isEditing ? (
                  <TextField
                    value={editing.name}
                    autoFocus
                    maxLength={40}
                    aria-label="트랙 이름"
                    onChange={(event) => setEditing({ id: track.id, name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitRename();
                      if (event.key === 'Escape') setEditing(null);
                    }}
                    className="min-w-0 flex-1"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">{track.name}</span>
                )}
                <span className="shrink-0 text-[9px] font-bold text-ink3">과업 {count}</span>

                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <button type="button" onClick={submitRename} disabled={pending} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-teal hover:bg-panel-alt disabled:opacity-50">저장</button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">취소</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || pending} aria-label={`${track.name} 위로`} className="rounded border border-border px-1.5 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt disabled:opacity-35">↑</button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === tracks.length - 1 || pending} aria-label={`${track.name} 아래로`} className="rounded border border-border px-1.5 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt disabled:opacity-35">↓</button>
                      <button type="button" onClick={() => setEditing({ id: track.id, name: track.name })} className="rounded border border-border px-2 py-1 text-[9px] font-bold text-ink3 hover:bg-panel-alt">이름</button>
                      <button
                        type="button"
                        onClick={() => drop(track)}
                        disabled={pending}
                        title={count > 0 ? `과업 ${count}건이 걸려 있어 삭제할 수 없습니다` : undefined}
                        className="rounded border border-danger/20 px-2 py-1 text-[9px] font-bold text-danger hover:bg-danger/5 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <TextField
            value={newName}
            maxLength={40}
            placeholder="새 트랙 이름 (예: 기획)"
            aria-label="새 트랙 이름"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="primary" onClick={add} disabled={!newName.trim() || pending}>추가</Button>
        </div>
      </div>
    </Modal>
  );
}
