import type { MatRequisition } from '@/domain/matRequisition/schema';

/**
 * 자재 청구 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-2.jsx 의 인라인 ROWS 이관)
 */
export const MAT_REQUISITION_SEED: MatRequisition[] = [
  { no: 'MR-260611-21', wo: 'WO-260611-021', code: 'WF-300-B', line: 'M-Line', qty: '2,500', status: '승인', urgent: true },
  { no: 'MR-260611-22', wo: 'WO-260611-021', code: 'CHM-SL-05', line: 'M-Line', qty: '40', status: '승인' },
  { no: 'MR-260611-18', wo: 'WO-260611-018', code: 'WF-200-A', line: 'M-Line', qty: '3,200', status: '대기' },
  { no: 'MR-260611-15', wo: 'WO-260611-015', code: 'PKG-BGA-14', line: 'P-Line', qty: '2,500', status: '대기' },
];
