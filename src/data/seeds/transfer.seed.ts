import type { Transfer } from '@/domain/transfer/schema';

/**
 * 재고 이송 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-2.jsx 의 인라인 ROWS 이관)
 */
export const TRANSFER_SEED: Transfer[] = [
  { no: 'TR-260611-05', code: 'WF-300-B', from: 'A-1-2-1', to: 'C-라인대기', qty: '500', status: '진행', urgent: true },
  { no: 'TR-260611-04', code: 'CHM-SL-05', from: 'A-3-1-4', to: 'C-라인대기', qty: '20', status: '완료' },
  { no: 'TR-260611-03', code: 'PKG-BGA-14', from: 'C-2-1-1', to: 'D-출하대기', qty: '300', status: '완료' },
  { no: 'TR-260611-02', code: 'RES-PR-22', from: 'A-3-2-1', to: 'C-라인대기', qty: '10', status: '취소' },
];
