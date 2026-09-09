import { workProjectSchema, type WorkProject } from '@/domain/workProject/schema';

// 프로젝트 모듈 초기 시드 (목업 데이터 제거됨 - 빈 배열)
const rows: WorkProject[] = [];

export const WORK_PROJECT_SEED = rows.map((row) => workProjectSchema.parse(row));
