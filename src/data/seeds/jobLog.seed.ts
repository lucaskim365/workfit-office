import type { JobLog } from '@/domain/jobLog/schema';

/**
 * 작업 시작/종료 로그 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (JobStartEndScreen.tsx 의 인라인 JOBS 이관)
 */
export const JOB_LOG_SEED: JobLog[] = [
  { no: 'WO-260611-021', code: 'WF-300-B', proc: 'OP-30 식각', status: '진행중', start: '08:12', end: '—' },
  { no: 'WO-260611-022', code: 'WF-300-B', proc: 'OP-50 CMP', status: '진행중', start: '09:40', end: '—' },
  { no: 'WO-260611-015', code: 'PKG-BGA-14', proc: 'OP-40 증착', status: '완료', start: '07:30', end: '11:05' },
  { no: 'WO-260611-018', code: 'WF-200-A', proc: 'OP-20 포토', status: '대기', start: '—', end: '—' },
];
