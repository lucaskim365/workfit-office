import type { Adjustment } from '@/domain/adjustment/schema';

/**
 * 재고 조정 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 ROWS 이관)
 */
export const ADJUSTMENT_SEED: Adjustment[] = [
  { no: 'ADJ-260611-03', code: 'WF-200-A', loc: 'A-1-2-1', qty: '-15', reason: '자연 감실', status: '승인완료', urgent: true },
  { no: 'ADJ-260611-02', code: 'RES-PR-22', loc: 'A-3-2-2', qty: '+2', reason: '실사 증가', status: '승인완료' },
  { no: 'ADJ-260611-01', code: 'CHM-GAS-02', loc: 'B-1-1-1', qty: '-8', reason: '파손', status: '승인대기' },
  { no: 'ADJ-260610-05', code: 'WF-300-B', loc: 'A-1-1-3', qty: '-3', reason: '분실', status: '승인완료' },
];
