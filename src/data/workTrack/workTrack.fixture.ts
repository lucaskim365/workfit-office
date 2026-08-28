import { workTrackSchema, type WorkTrack } from '@/domain/workTrack/schema';

const AT = '2026-07-01T00:00:00.000Z';

/**
 * 데모 트랙 — 수주사업(PRJ-0003)만 트랙을 쓴다.
 *
 * PRJ-0001·PRJ-0002는 일부러 트랙이 없다. 트랙 미사용 프로젝트에서 대과업이 최상위로
 * 뜨는 경로를 데모에서도 밟아 보려는 것이다([[프로젝트관리_고도화_계획서.md]] §2).
 */
const rows: WorkTrack[] = [
  { id: 'TRK-0001', projectId: 'PRJ-0003', name: '영업', sortOrder: 0, color: '#f59e0b', createdBy: 'U011', createdAt: AT, updatedBy: 'U011', updatedAt: AT },
  { id: 'TRK-0002', projectId: 'PRJ-0003', name: '사업관리', sortOrder: 1, color: '#3b82f6', createdBy: 'U011', createdAt: AT, updatedBy: 'U011', updatedAt: AT },
  { id: 'TRK-0003', projectId: 'PRJ-0003', name: '개발', sortOrder: 2, color: '#10b981', createdBy: 'U011', createdAt: AT, updatedBy: 'U011', updatedAt: AT },
];

export const WORK_TRACK_FIXTURE = rows.map((row) => workTrackSchema.parse(row));
