import { useMemo, useRef, useState } from 'react';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import { WORK_TASK_STATUS_LABELS, type WorkTask } from '@/domain/workTask/schema';
import type { WorkTrack } from '@/domain/workTrack/schema';
import { formatFileSize } from '@/domain/workTaskNote/schema';
import type { User } from '@/domain/user/schema';
import {
  useAddComment,
  useRemoveComment,
  useRemoveFile,
  useTaskComments,
  useTaskFiles,
  useUploadFile,
} from '@/features/project/useProjectNotes';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Pill } from '@/shared/ui/Pill';

interface TaskDetailModalProps {
  project: WorkProject;
  access: ProjectAccessContext;
  task: WorkTask;
  tracks: WorkTrack[];
  tasks: WorkTask[];
  users: User[];
  /** 표시용 진행률·상태 — 상위는 하위에서 접어 올린 값이다. */
  view: { progress: number; status: WorkTask['status']; isLeaf: boolean };
  onClose: () => void;
  onEdit: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '미정';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * 과업 상세 — 댓글과 첨부를 한자리에서 본다(아사나 방식).
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * **"이 과업만 / 하위 포함" 전환**이 핵심이다. 실제 대화는 세부 과업에서 생기고 보고할
 * 때는 대과업에서 모아 봐야 한다. 리프에는 하위가 없으므로 토글을 감춘다.
 */
export default function TaskDetailModal({
  project, access, task, tracks, tasks, users, view, onClose, onEdit,
}: TaskDetailModalProps) {
  const [tab, setTab] = useState<'comments' | 'files'>('comments');
  const [includeSubtree, setIncludeSubtree] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const hasChildren = useMemo(() => tasks.some((row) => row.parentId === task.id), [task.id, tasks]);
  const scope = { projectId: project.id, taskId: task.id, includeSubtree: hasChildren && includeSubtree };
  const commentsQuery = useTaskComments(access, scope, tab === 'comments');
  const filesQuery = useTaskFiles(access, scope, tab === 'files');
  const addComment = useAddComment();
  const removeComment = useRemoveComment();
  const uploadFile = useUploadFile();
  const removeFile = useRemoveFile();

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const taskById = useMemo(() => new Map(tasks.map((row) => [row.id, row])), [tasks]);
  const trackName = tracks.find((track) => track.id === task.trackId)?.name;
  const isMember = project.memberUserIds.includes(access.userId);

  const breadcrumb = useMemo(() => {
    const chain: string[] = [];
    for (let cursor: WorkTask | undefined = task; cursor?.parentId; ) {
      const parent = taskById.get(cursor.parentId);
      if (!parent) break;
      chain.unshift(parent.title);
      cursor = parent;
    }
    return [trackName, ...chain].filter(Boolean) as string[];
  }, [task, taskById, trackName]);

  const submitComment = async () => {
    const text = body.trim();
    if (!text) return;
    setError('');
    try {
      await addComment.mutateAsync({
        actor: access,
        draft: { projectId: project.id, taskId: task.id, parentId: null, body: text },
      });
      setBody('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '댓글을 남기지 못했습니다.');
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      await uploadFile.mutateAsync({ actor: access, scope: { projectId: project.id, taskId: task.id }, file });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '파일을 올리지 못했습니다.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={(
        <span className="flex min-w-0 flex-col">
          {breadcrumb.length > 0 && (
            <span className="truncate text-[9.5px] font-semibold text-ink3">{breadcrumb.join(' › ')}</span>
          )}
          <span className="truncate">{task.title}</span>
        </span>
      )}
      width={Math.min(720, window.innerWidth - 32)}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel-alt/50 p-3 sm:grid-cols-4">
          <div>
            <div className="text-[9px] font-semibold text-ink3">담당</div>
            <div className="mt-0.5 truncate text-[11px] font-bold text-ink2">{userById.get(task.assigneeUserId)?.name ?? task.assigneeUserId}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-ink3">기간</div>
            <div className="mt-0.5 text-[11px] font-bold text-ink2">{formatDate(task.startAt)} ~ {formatDate(task.dueAt)}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-ink3">상태</div>
            <div className="mt-0.5"><Pill tone={view.status === 'DONE' ? 'ok' : view.status === 'IN_PROGRESS' ? 'info' : 'mute'}>{WORK_TASK_STATUS_LABELS[view.status]}</Pill></div>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-ink3">진행률</div>
            <div className="mt-0.5 text-[11px] font-extrabold text-teal">
              {view.progress}%{view.isLeaf ? '' : ' 자동'}
            </div>
          </div>
        </div>

        {task.description && (
          <p className="whitespace-pre-wrap rounded-lg border border-border px-3 py-2.5 text-[11px] leading-6 text-ink2">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
          <div className="flex gap-1">
            {(['comments', 'files'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-extrabold ${tab === key ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink2'}`}
              >
                {key === 'comments' ? '댓글' : '파일'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* 리프에는 하위가 없으니 토글 자체를 감춘다 — 눌러도 결과가 같은 스위치는 혼란만 준다. */}
            {hasChildren && (
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-ink3">
                <input type="checkbox" checked={includeSubtree} onChange={(event) => setIncludeSubtree(event.target.checked)} className="accent-teal" />
                하위 포함
              </label>
            )}
            <Button size="sm" onClick={onEdit}>과업 수정</Button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{error}</div>}

        {tab === 'comments' ? (
          <div className="space-y-3">
            {isMember && (
              <div className="space-y-2">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="진행 상황이나 결정 사항을 남기세요"
                  aria-label="댓글 입력"
                  className="w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[11.5px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" onClick={submitComment} disabled={!body.trim() || addComment.isPending}>
                    {addComment.isPending ? '남기는 중…' : '댓글 남기기'}
                  </Button>
                </div>
              </div>
            )}
            {commentsQuery.isLoading && <div className="py-6 text-center text-[10.5px] text-ink3">불러오는 중…</div>}
            {!commentsQuery.isLoading && (commentsQuery.data ?? []).length === 0 && (
              <div className="py-6 text-center text-[10.5px] text-ink3">아직 댓글이 없습니다.</div>
            )}
            <ul className="space-y-2">
              {(commentsQuery.data ?? []).map((comment) => (
                <li key={comment.id} className="rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 text-[10.5px] font-extrabold text-ink">
                      {userById.get(comment.authorUserId)?.name ?? comment.authorUserId}
                      {/* 하위 포함으로 볼 때 어느 과업 글인지 안 보이면 맥락이 사라진다. */}
                      {comment.taskId !== task.id && comment.taskId && (
                        <span className="ml-1.5 font-semibold text-ink3">· {taskById.get(comment.taskId)?.title ?? comment.taskId}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[9px] text-ink3">{formatStamp(comment.createdAt)}</span>
                      {comment.authorUserId === access.userId && (
                        <button
                          type="button"
                          onClick={() => removeComment.mutate({ actor: access, id: comment.id })}
                          className="text-[9px] font-bold text-ink3 hover:text-danger"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-6 text-ink2">{comment.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {isMember && (
              <div>
                <input
                  ref={fileInput}
                  type="file"
                  onChange={(event) => pickFile(event.target.files?.[0])}
                  className="hidden"
                  aria-label="파일 선택"
                />
                <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploadFile.isPending}>
                  {uploadFile.isPending ? '올리는 중…' : '+ 파일 올리기'}
                </Button>
              </div>
            )}
            {filesQuery.isLoading && <div className="py-6 text-center text-[10.5px] text-ink3">불러오는 중…</div>}
            {!filesQuery.isLoading && (filesQuery.data ?? []).length === 0 && (
              <div className="py-6 text-center text-[10.5px] text-ink3">첨부된 파일이 없습니다.</div>
            )}
            <ul className="space-y-1.5">
              {(filesQuery.data ?? []).map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink hover:text-teal hover:underline">
                    {file.name}
                  </a>
                  <span className="shrink-0 text-[9px] text-ink3">
                    {formatFileSize(file.size)} · {userById.get(file.uploadedBy)?.name ?? file.uploadedBy}
                  </span>
                  {(file.uploadedBy === access.userId || project.ownerUserId === access.userId) && (
                    <button
                      type="button"
                      onClick={() => removeFile.mutate({ actor: access, id: file.id })}
                      className="shrink-0 text-[9px] font-bold text-ink3 hover:text-danger"
                    >
                      삭제
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
