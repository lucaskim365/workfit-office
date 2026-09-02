import { useMemo, useRef, useState } from 'react';
import { isProjectAdmin, type ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkTask } from '@/domain/workTask/schema';
import { formatFileSize } from '@/domain/workTaskNote/schema';
import type { User } from '@/domain/user/schema';
import { useProjectFiles, useRemoveFile, useUploadFile } from '@/features/project/useProjectNotes';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

interface ProjectFilesProps {
  project: WorkProject;
  access: ProjectAccessContext;
  tasks: WorkTask[];
  users: User[];
  onSelectTask: (task: WorkTask) => void;
}

/**
 * 프로젝트 파일 — **엮인 것 전부를 한자리에서** 본다.
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * 과업에 붙은 파일과 프로젝트 직속 파일을 함께 보여 준다. 여기서 올리면 과업에 묶이지
 * 않는 직속 파일이 된다 — 제안서·계약서처럼 어느 과업 것도 아닌 문서를 억지로 과업에
 * 매달면 그 과업이 지워질 때 같이 사라진다.
 */
export default function ProjectFiles({ project, access, tasks, users, onSelectTask }: ProjectFilesProps) {
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const filesQuery = useProjectFiles(access, project.id);
  const uploadFile = useUploadFile();
  const removeFile = useRemoveFile();

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const files = filesQuery.data ?? [];
  const isMember = project.memberUserIds.includes(access.userId) || isProjectAdmin(access);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      await uploadFile.mutateAsync({ actor: access, scope: { projectId: project.id, taskId: null }, file });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '파일을 올리지 못했습니다.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Card
      title={`파일 ${files.length}`}
      action={isMember ? (
        <>
          <input ref={fileInput} type="file" className="hidden" aria-label="프로젝트 파일 선택" onChange={(event) => pickFile(event.target.files?.[0])} />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploadFile.isPending}>
            {uploadFile.isPending ? '올리는 중…' : '+ 올리기'}
          </Button>
        </>
      ) : undefined}
      bodyClassName="p-0"
    >
      {error && <div role="alert" className="m-3 rounded-md bg-danger/5 px-3 py-2 text-[10px] font-semibold text-danger">{error}</div>}
      {filesQuery.isLoading && <div className="py-8 text-center text-[10.5px] text-ink3">불러오는 중…</div>}
      {!filesQuery.isLoading && files.length === 0 && (
        <div className="px-4 py-8 text-center text-[10.5px] text-ink3">
          등록된 파일이 없습니다.
          <div className="mt-1 text-[9.5px]">여기서 올리면 과업에 묶이지 않는 프로젝트 파일이 됩니다.</div>
        </div>
      )}
      <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
        {files.map((file) => {
          const task = file.taskId ? taskById.get(file.taskId) : null;
          return (
            <li key={file.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink hover:text-teal hover:underline">
                  {file.name}
                </a>
                {(file.uploadedBy === access.userId || project.ownerUserId === access.userId || isProjectAdmin(access)) && (
                  <button
                    type="button"
                    onClick={() => removeFile.mutate({ actor: access, id: file.id })}
                    className="shrink-0 text-[9px] font-bold text-ink3 hover:text-danger"
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-ink3">
                {/* 어느 과업 파일인지 보여야 목록에서 바로 그 과업으로 갈 수 있다. */}
                {task ? (
                  <button type="button" onClick={() => onSelectTask(task)} className="max-w-[160px] truncate rounded bg-panel-alt px-1.5 py-0.5 font-bold text-ink2 hover:text-teal">
                    {task.title}
                  </button>
                ) : (
                  <span className="rounded bg-panel-alt px-1.5 py-0.5 font-bold text-ink3">프로젝트 직속</span>
                )}
                <span>{formatFileSize(file.size)}</span>
                <span>· {userById.get(file.uploadedBy)?.name ?? file.uploadedBy}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
