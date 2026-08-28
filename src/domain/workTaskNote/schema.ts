import { z } from 'zod';

/**
 * 과업 댓글·첨부.
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * **`taskId`가 `null`이면 프로젝트 직속**이다 — 어느 과업에도 안 묶인 제안서·계약서 같은
 * 것들이 갈 자리다. 억지로 과업에 매달면 나중에 그 과업이 지워질 때 같이 사라진다.
 *
 * 댓글은 대·중·소 어디에나 달린다. 실제 대화는 세부 작업에서 생기고, 보고할 때는 상위에서
 * 하위 것까지 모아 보는 쪽이 맞다(화면이 "이 과업만 / 하위 포함"을 전환한다).
 */

export const workTaskCommentSchema = z.object({
  id: z.string().regex(/^CMT-\d{8}-\d{4}$/, '댓글 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  /** null이면 프로젝트 직속 댓글. */
  taskId: z.string().regex(/^TASK-\d{8}-\d{4}$/, '과업 ID 형식이 올바르지 않습니다.').nullable(),
  /** 답글은 1단까지. 스레드를 무한 중첩하면 읽는 순서가 무너진다. */
  parentId: z.string().regex(/^CMT-\d{8}-\d{4}$/, '상위 댓글 ID 형식이 올바르지 않습니다.').nullable(),
  authorUserId: z.string().min(1),
  body: z.string().trim().min(1, '내용을 입력하세요.').max(2_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkTaskComment = z.infer<typeof workTaskCommentSchema>;
export type WorkTaskCommentDraft = Pick<WorkTaskComment, 'projectId' | 'taskId' | 'parentId' | 'body'>;

export const workTaskFileSchema = z.object({
  id: z.string().regex(/^FIL-\d{8}-\d{4}$/, '파일 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  /** null이면 프로젝트 직속 파일 — 과업에 묶이지 않는다. */
  taskId: z.string().regex(/^TASK-\d{8}-\d{4}$/, '과업 ID 형식이 올바르지 않습니다.').nullable(),
  name: z.string().trim().min(1).max(255),
  /** 저장소가 돌려준 접근 URL. 업로드는 `fileStorage`가 맡는다. */
  url: z.string().min(1).max(512),
  /** 저장소 경로 — 삭제할 때 쓴다. URL에서 되짚으면 드라이버마다 규칙이 달라 깨진다. */
  storagePath: z.string().max(512),
  size: z.number().int().min(0),
  contentType: z.string().max(100),
  uploadedBy: z.string().min(1),
  uploadedAt: z.string().datetime(),
});

export type WorkTaskFile = z.infer<typeof workTaskFileSchema>;

/** 사람이 읽는 크기 표기. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
