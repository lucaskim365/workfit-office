import type { CountRecord } from '@/domain/countRecord/schema';

/**
 * 재고 실사 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 ROWS 이관, id 결정적 부여 CNT-01~)
 */
export const COUNT_RECORD_SEED: CountRecord[] = [
  { id: 'CNT-01', code: 'WF-300-B', loc: 'A-1-1-1', book: '8,420', actual: '8,420', diff: '0', result: '일치' },
  { id: 'CNT-02', code: 'WF-200-A', loc: 'A-1-2-1', book: '3,100', actual: '3,085', diff: '-15', result: '차이' },
  { id: 'CNT-03', code: 'CHM-SL-05', loc: 'A-3-1-4', book: '142', actual: '142', diff: '0', result: '일치' },
  { id: 'CNT-04', code: 'RES-PR-22', loc: 'A-3-2-2', book: '38', actual: '40', diff: '+2', result: '차이' },
  { id: 'CNT-05', code: 'PKG-BGA-14', loc: 'C-2-1-1', book: '5,200', actual: '미실사', diff: '—', result: '대기' },
];
