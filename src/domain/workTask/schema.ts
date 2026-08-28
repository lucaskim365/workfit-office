import { z } from 'zod';

export const WORK_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

/** 과업 트리 최대 깊이. 화면 들여쓰기 가독성 때문에 여기서 막는다. */
export const WORK_TASK_MAX_LEVEL = 5;

/** `path` 한 마디 = 형제 순번 4자리 제로패딩. `"0002.0005.0001"` */
export const WORK_TASK_PATH_PATTERN = /^\d{4}(\.\d{4})*$/;

/**
 * 트리 도입 **전에 저장된 문서**를 읽을 수 있게 채워 준다.
 *
 * Appwrite에 속성을 추가해도 기존 문서에는 값이 없어 `null`로 내려온다. 그대로 두면
 * zod 파싱이 실패하고 `crudBackend`가 그 문서를 조용히 건너뛴다 — **에러 없이 과업이
 * 화면에서 사라진다.** 이관 스크립트가 돌기 전에도 목록이 멀쩡히 보여야 한다.
 *
 * `path`가 있으면 마디 수로 `level`을 되찾고, 둘 다 없으면 옛 `sortOrder`를 순번으로 써서
 * 대과업 한 층으로 눕힌다. 정확한 순서·유일성은 이관 스크립트가 다시 매긴다(계획서 §12).
 */
function fillLegacyTreeFields(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (row.trackId === undefined) row.trackId = null;
  if (row.parentId === undefined) row.parentId = null;
  if (row.phaseId === undefined) row.phaseId = null;

  const hasPath = typeof row.path === 'string' && WORK_TASK_PATH_PATTERN.test(row.path);
  if (!hasPath) {
    const order = typeof row.sortOrder === 'number' ? Math.min(Math.max(row.sortOrder, 0), 9999) : 0;
    row.path = String(order).padStart(4, '0');
    row.level = 1;
    row.parentId = null; // 경로가 없으면 계층을 알 수 없다. 대과업으로 눕힌다.
    return row;
  }
  if (typeof row.level !== 'number') row.level = (row.path as string).split('.').length;
  return row;
}

export const workTaskSchema = z.preprocess(fillLegacyTreeFields, z.object({
  id: z.string().regex(/^TASK-\d{8}-\d{4}$/, 'WBS 작업 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  /**
   * 소속 트랙. `null`이면 트랙을 안 쓰는 프로젝트이고 대과업이 최상위다.
   * ([[프로젝트관리_고도화_계획서.md]] §2)
   */
  trackId: z.string().regex(/^TRK-\d{4}$/, '트랙 ID 형식이 올바르지 않습니다.').nullable(),
  /** 상위 과업. `null`이면 트랙(또는 프로젝트) 직속 = level 1 = 대과업. */
  parentId: z.string().regex(/^TASK-\d{8}-\d{4}$/, '상위 작업 ID 형식이 올바르지 않습니다.').nullable(),
  /** 1=대과업 2=중과업 3=세부과업 4~5=그 아래. 트랙 유무와 무관하게 1이 항상 대과업이다. */
  level: z.number().int().min(1).max(WORK_TASK_MAX_LEVEL),
  /**
   * 조상 경로를 문자열로 굳혀 둔 값. `"0002.0005.0001"`
   *
   * Appwrite에는 재귀 쿼리도 조인도 없다. 이게 없으면 "이 대과업 밑 전부"를 단계마다
   * 쿼리해야 해서 N+1로 터진다. 하위 전체 조회는 `trackId` 일치 + `startsWith(path, ...)`
   * 한 번이고 트리 정렬도 `path` 오름차순 하나로 끝난다.
   *
   * ⚠ `parentId`가 진실의 원천이고 `path`는 파생값이다. 둘이 어긋나면 `parentId`로
   *   재계산한다([[path.ts]]의 `rebuildPaths`).
   */
  path: z.string().regex(WORK_TASK_PATH_PATTERN, '경로 형식이 올바르지 않습니다.'),
  /**
   * 옛 WBS 단계. 트리로 이관하는 동안만 남겨 둔다 — 이관 검증 후 제거한다.
   * ([[프로젝트관리_고도화_계획서.md]] §12)
   */
  phaseId: z.string().regex(/^PHASE-\d{4}$/, 'WBS 단계 ID 형식이 올바르지 않습니다.').nullable(),
  title: z.string().trim().min(1, '작업명을 입력하세요.').max(150),
  description: z.string().trim().max(2_000),
  assigneeUserId: z.string().min(1, '담당자를 선택하세요.'),
  startAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: z.enum(WORK_TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  sortOrder: z.number().int().min(0),
  completedAt: z.string().datetime().nullable(),
  version: z.number().int().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  // ── 트리 불변식 ── 셋이 서로를 검증한다. 하나만 어긋나도 트리 조회가 조용히 틀린다.
  if ((value.level === 1) !== (value.parentId === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['parentId'],
      message: value.level === 1
        ? '대과업(level 1)에는 상위 작업을 둘 수 없습니다.'
        : '하위 과업에는 상위 작업이 필요합니다.',
    });
  }
  if (value.path.split('.').length !== value.level) {
    ctx.addIssue({ code: 'custom', path: ['path'], message: '경로의 마디 수와 단계가 맞지 않습니다.' });
  }

  if (value.startAt && value.dueAt && value.startAt > value.dueAt) {
    ctx.addIssue({ code: 'custom', path: ['dueAt'], message: '작업 마감일은 시작일보다 빠를 수 없습니다.' });
  }
  if (value.status === 'TODO' && value.progress !== 0) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '할 일 상태의 진척률은 0%여야 합니다.' });
  }
  if (value.status === 'IN_PROGRESS' && (value.progress < 1 || value.progress > 99)) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '진행 중 상태의 진척률은 1~99%여야 합니다.' });
  }
  if (value.status === 'DONE' && value.progress !== 100) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '완료 상태의 진척률은 100%여야 합니다.' });
  }
  if (value.status === 'DONE' && !value.completedAt) {
    ctx.addIssue({ code: 'custom', path: ['completedAt'], message: '완료 작업에는 완료일시가 필요합니다.' });
  }
  if (value.status !== 'DONE' && value.completedAt) {
    ctx.addIssue({ code: 'custom', path: ['completedAt'], message: '미완료 작업에는 완료일시를 둘 수 없습니다.' });
  }
}));

export type WorkTask = z.infer<typeof workTaskSchema>;
export type WorkTaskStatus = (typeof WORK_TASK_STATUSES)[number];
/** `level`·`path`는 `parentId`에서 계산되는 파생값이라 입력받지 않는다. */
export type WorkTaskDraft = Omit<WorkTask,
  'id' | 'level' | 'path' | 'sortOrder' | 'completedAt' | 'version'
  | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
>;

export const WORK_TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
};
