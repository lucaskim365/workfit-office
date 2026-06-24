import type { Kit } from '@/domain/kit/schema';

/**
 * 키팅 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 KITS mock 이관)
 */
export const KIT_SEED: Kit[] = [
  { no: 'KIT-260611-04', wo: 'WO-260611-021', line: 'M-Line 조립1', count: 6, status: '준비중', done: 4 },
  { no: 'KIT-260611-05', wo: 'WO-260611-024', line: 'M-Line 조립2', count: 5, status: '대기', done: 0 },
  { no: 'KIT-260611-03', wo: 'WO-260611-018', line: 'A-Line 패키징', count: 8, status: '완료', done: 8 },
];
