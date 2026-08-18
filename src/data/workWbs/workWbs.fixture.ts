import { workPhaseSchema, type WorkPhase } from '@/domain/workPhase/schema';
import { workTaskSchema, type WorkTask } from '@/domain/workTask/schema';

const CREATED_AT = '2026-08-11T00:00:00.000Z';

const phases: WorkPhase[] = [
  { id: 'PHASE-0001', projectId: 'PRJ-0001', name: '기획', sortOrder: 10, createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U011', updatedAt: CREATED_AT },
  { id: 'PHASE-0002', projectId: 'PRJ-0001', name: '개발', sortOrder: 20, createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U011', updatedAt: CREATED_AT },
  { id: 'PHASE-0003', projectId: 'PRJ-0001', name: '검증', sortOrder: 30, createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U011', updatedAt: CREATED_AT },
  { id: 'PHASE-0004', projectId: 'PRJ-0002', name: '현황 정리', sortOrder: 10, createdBy: 'U009', createdAt: CREATED_AT, updatedBy: 'U009', updatedAt: CREATED_AT },
  { id: 'PHASE-0005', projectId: 'PRJ-0002', name: '문서 정비', sortOrder: 20, createdBy: 'U009', createdAt: CREATED_AT, updatedBy: 'U009', updatedAt: CREATED_AT },
];

const tasks: WorkTask[] = [
  {
    id: 'TASK-20260811-0001', projectId: 'PRJ-0001', phaseId: 'PHASE-0001', title: '그룹웨어 요구사항 정리',
    description: '사용자별 핵심 요구사항과 1차 범위를 정리합니다.', assigneeUserId: 'U009',
    startAt: '2026-08-11T00:00:00.000Z', dueAt: '2026-08-13T14:59:59.999Z', status: 'DONE', progress: 100,
    sortOrder: 10, completedAt: '2026-08-12T05:00:00.000Z', version: 1,
    createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U009', updatedAt: '2026-08-12T05:00:00.000Z',
  },
  {
    id: 'TASK-20260811-0002', projectId: 'PRJ-0001', phaseId: 'PHASE-0002', title: '그룹웨어 화면 개발',
    description: '확정된 그룹웨어 화면을 기능별로 구현합니다.', assigneeUserId: 'U011',
    startAt: '2026-08-12T00:00:00.000Z', dueAt: '2026-08-25T14:59:59.999Z', status: 'IN_PROGRESS', progress: 60,
    sortOrder: 10, completedAt: null, version: 1,
    createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U011', updatedAt: '2026-08-12T06:00:00.000Z',
  },
  {
    id: 'TASK-20260811-0003', projectId: 'PRJ-0001', phaseId: 'PHASE-0003', title: '통합 시나리오 검증',
    description: '주요 사용자 흐름과 빌드 결과를 확인합니다.', assigneeUserId: 'U012',
    startAt: '2026-08-26T00:00:00.000Z', dueAt: '2026-08-29T14:59:59.999Z', status: 'TODO', progress: 0,
    sortOrder: 10, completedAt: null, version: 1,
    createdBy: 'U011', createdAt: CREATED_AT, updatedBy: 'U011', updatedAt: CREATED_AT,
  },
  {
    id: 'TASK-20260811-0004', projectId: 'PRJ-0002', phaseId: 'PHASE-0004', title: '품질 문서 목록 작성',
    description: '', assigneeUserId: 'U012', startAt: '2026-08-18T00:00:00.000Z', dueAt: '2026-08-21T14:59:59.999Z',
    status: 'IN_PROGRESS', progress: 30, sortOrder: 10, completedAt: null, version: 1,
    createdBy: 'U009', createdAt: CREATED_AT, updatedBy: 'U012', updatedAt: '2026-08-12T06:00:00.000Z',
  },
];

export const WORK_PHASE_FIXTURE = phases.map((phase) => workPhaseSchema.parse(phase));
export const WORK_TASK_FIXTURE = tasks.map((task) => workTaskSchema.parse(task));
