import type { JobTitle } from '@/domain/jobTitle/schema';

/**
 * 직책 초기 시드 데이터.
 * 직책은 대표, 임원, 팀장, 팀원으로 분류됩니다.
 */
export const JOB_TITLE_SEED: JobTitle[] = [
  { id: 'J01', name: '대표' },
  { id: 'J02', name: '임원' },
  { id: 'J03', name: '팀장' },
  { id: 'J04', name: '팀원' },
  { id: 'J05', name: '본부장' },
  { id: 'J06', name: '재경이사' },
];
