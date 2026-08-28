import { workTaskSchema, type WorkTask } from '@/domain/workTask/schema';

const CREATED_AT = '2026-08-11T00:00:00.000Z';

type FixtureTask = Omit<WorkTask, 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt' | 'version'>
  & Partial<Pick<WorkTask, 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt' | 'version'>>;

const stamp = (task: FixtureTask, by: string): WorkTask => workTaskSchema.parse({
  version: 1,
  createdBy: by,
  createdAt: CREATED_AT,
  updatedBy: by,
  updatedAt: CREATED_AT,
  ...task,
});

/**
 * 데모 과업 — 두 가지 모양을 모두 담는다.
 *
 * - PRJ-0001·PRJ-0002: **트랙 없음.** 대과업이 최상위(`trackId: null`).
 * - PRJ-0003: **트랙 3개.** 영업(완료)·사업관리(미착수)·개발(진행 중)이 동시에 돈다 —
 *   "개발 80%인데 정산 0%"를 숫자 하나로 뭉개면 안 된다는 상황을 그대로 재현한다.
 *
 * 진행률은 **리프에만** 넣는다. 상위는 0으로 두고 화면·리포트가 접어 올린다
 * ([[프로젝트관리_고도화_계획서.md]] §4).
 */
const tasks: WorkTask[] = [
  // ── PRJ-0001 (트랙 없음) ──
  stamp({
    id: 'TASK-20260811-0001', projectId: 'PRJ-0001', trackId: null, parentId: null, level: 1, path: '0000',
    title: '그룹웨어 요구사항 정리',
    description: '사용자별 핵심 요구사항과 1차 범위를 정리합니다.', assigneeUserId: 'U009',
    startAt: '2026-08-11T00:00:00.000Z', dueAt: '2026-08-13T14:59:59.999Z', status: 'DONE', progress: 100,
    sortOrder: 0, completedAt: '2026-08-12T05:00:00.000Z',
    updatedBy: 'U009', updatedAt: '2026-08-12T05:00:00.000Z',
  }, 'U011'),
  stamp({
    id: 'TASK-20260811-0002', projectId: 'PRJ-0001', trackId: null, parentId: null, level: 1, path: '0001',
    title: '그룹웨어 화면 개발',
    description: '확정된 그룹웨어 화면을 기능별로 구현합니다.', assigneeUserId: 'U011',
    startAt: '2026-08-12T00:00:00.000Z', dueAt: '2026-08-25T14:59:59.999Z', status: 'TODO', progress: 0,
    sortOrder: 1, completedAt: null,
    updatedBy: 'U011', updatedAt: '2026-08-12T06:00:00.000Z',
  }, 'U011'),
  stamp({
    id: 'TASK-20260811-0005', projectId: 'PRJ-0001', trackId: null, parentId: 'TASK-20260811-0002', level: 2, path: '0001.0000',
    title: '일정관리 화면',
    description: '', assigneeUserId: 'U011',
    startAt: '2026-08-12T00:00:00.000Z', dueAt: '2026-08-18T14:59:59.999Z', status: 'DONE', progress: 100,
    sortOrder: 0, completedAt: '2026-08-18T09:00:00.000Z',
  }, 'U011'),
  stamp({
    id: 'TASK-20260811-0006', projectId: 'PRJ-0001', trackId: null, parentId: 'TASK-20260811-0002', level: 2, path: '0001.0001',
    title: '업무관리 화면',
    description: '', assigneeUserId: 'U011',
    startAt: '2026-08-19T00:00:00.000Z', dueAt: '2026-08-25T14:59:59.999Z', status: 'IN_PROGRESS', progress: 40,
    sortOrder: 1, completedAt: null,
  }, 'U011'),
  stamp({
    id: 'TASK-20260811-0003', projectId: 'PRJ-0001', trackId: null, parentId: null, level: 1, path: '0002',
    title: '통합 시나리오 검증',
    description: '주요 사용자 흐름과 빌드 결과를 확인합니다.', assigneeUserId: 'U012',
    startAt: '2026-08-26T00:00:00.000Z', dueAt: '2026-08-29T14:59:59.999Z', status: 'TODO', progress: 0,
    sortOrder: 2, completedAt: null,
  }, 'U011'),

  // ── PRJ-0002 (트랙 없음) ──
  stamp({
    id: 'TASK-20260811-0004', projectId: 'PRJ-0002', trackId: null, parentId: null, level: 1, path: '0000',
    title: '품질 문서 목록 작성',
    description: '', assigneeUserId: 'U012', startAt: '2026-08-18T00:00:00.000Z', dueAt: '2026-08-21T14:59:59.999Z',
    status: 'IN_PROGRESS', progress: 30, sortOrder: 0, completedAt: null,
    updatedBy: 'U012', updatedAt: '2026-08-12T06:00:00.000Z',
  }, 'U009'),

  // ── PRJ-0003 (트랙 3개) ──
  stamp({
    id: 'TASK-20260801-0001', projectId: 'PRJ-0003', trackId: 'TRK-0001', parentId: null, level: 1, path: '0000',
    title: '제안·수주',
    description: '과제 제안서 작성부터 협약까지.', assigneeUserId: 'U009',
    startAt: '2026-07-01T00:00:00.000Z', dueAt: '2026-07-31T14:59:59.999Z', status: 'DONE', progress: 100,
    sortOrder: 0, completedAt: '2026-07-30T09:00:00.000Z',
  }, 'U011'),
  stamp({
    id: 'TASK-20260801-0002', projectId: 'PRJ-0003', trackId: 'TRK-0002', parentId: null, level: 1, path: '0000',
    title: '중간정산',
    description: '1차년도 중간 정산 서류 제출.', assigneeUserId: 'U012',
    startAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-09-30T14:59:59.999Z', status: 'TODO', progress: 0,
    sortOrder: 0, completedAt: null,
  }, 'U011'),
  stamp({
    id: 'TASK-20260801-0003', projectId: 'PRJ-0003', trackId: 'TRK-0003', parentId: null, level: 1, path: '0000',
    title: '추론엔진 구현',
    description: '', assigneeUserId: 'U011',
    startAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-10-31T14:59:59.999Z', status: 'TODO', progress: 0,
    sortOrder: 0, completedAt: null,
  }, 'U011'),
  stamp({
    id: 'TASK-20260801-0004', projectId: 'PRJ-0003', trackId: 'TRK-0003', parentId: 'TASK-20260801-0003', level: 2, path: '0000.0000',
    title: '모델 경량화',
    description: '', assigneeUserId: 'U011',
    startAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-08-31T14:59:59.999Z', status: 'IN_PROGRESS', progress: 70,
    sortOrder: 0, completedAt: null,
  }, 'U011'),
  stamp({
    id: 'TASK-20260801-0005', projectId: 'PRJ-0003', trackId: 'TRK-0003', parentId: 'TASK-20260801-0003', level: 2, path: '0000.0001',
    title: '추론 API',
    description: '', assigneeUserId: 'U009',
    startAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-10-31T14:59:59.999Z', status: 'IN_PROGRESS', progress: 20,
    sortOrder: 1, completedAt: null,
  }, 'U011'),
  stamp({
    id: 'TASK-20260801-0006', projectId: 'PRJ-0003', trackId: 'TRK-0003', parentId: null, level: 1, path: '0001',
    title: '데이터 파이프라인',
    description: '', assigneeUserId: 'U012',
    startAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-09-15T14:59:59.999Z', status: 'IN_PROGRESS', progress: 75,
    sortOrder: 1, completedAt: null,
  }, 'U011'),
];

export const WORK_TASK_FIXTURE = tasks;
