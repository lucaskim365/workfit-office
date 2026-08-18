import { workProjectSchema, type WorkProject } from '@/domain/workProject/schema';

const rows: WorkProject[] = [
  {
    id: 'PRJ-0001',
    code: 'GW-2026',
    name: '그룹웨어 고도화',
    description: '자원예약·업무관리·전자설문·일정관리 기능을 구축합니다.',
    ownerUserId: 'U011',
    memberUserIds: ['U011', 'U012', 'U009'],
    deptId: 'D240',
    visibility: 'TEAM',
    status: 'ACTIVE',
    startAt: '2026-08-11T00:00:00.000Z',
    dueAt: '2026-08-29T14:59:59.999Z',
    color: '#16a394',
    chatRoomId: null,
    createdBy: 'U011',
    createdAt: '2026-08-11T04:57:00.000Z',
    updatedBy: 'U011',
    updatedAt: '2026-08-11T04:57:00.000Z',
  },
  {
    id: 'PRJ-0002',
    code: 'QA-2026',
    name: '품질 문서 정비',
    description: '품질팀 내부 문서와 점검 업무를 정리합니다.',
    ownerUserId: 'U009',
    memberUserIds: ['U009', 'U012'],
    deptId: 'D230',
    visibility: 'PRIVATE',
    status: 'PLANNING',
    startAt: '2026-08-18T00:00:00.000Z',
    dueAt: '2026-09-11T14:59:59.999Z',
    color: '#5275d8',
    chatRoomId: null,
    createdBy: 'U009',
    createdAt: '2026-08-11T05:00:00.000Z',
    updatedBy: 'U009',
    updatedAt: '2026-08-11T05:00:00.000Z',
  },
];

export const WORK_PROJECT_SEED = rows.map((row) => workProjectSchema.parse(row));
