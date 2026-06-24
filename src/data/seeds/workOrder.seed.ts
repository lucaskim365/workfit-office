import type { WorkOrder } from '@/domain/workOrder/schema';

/** 작업지시 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 prod-screens.WorkOrderContent) */
export const WORK_ORDER_SEED: WorkOrder[] = [
  { no: 'WO-260611-021', code: 'WF-300-B', itemName: '300mm 웨이퍼', line: 'M-Line', qty: 4000, shift: '주간', status: '발행', plannedDate: '2026-06-11', start: '', end: '' },
  { no: 'WO-260611-022', code: 'WF-300-B', itemName: '300mm 웨이퍼', line: 'M-Line', qty: 2000, shift: '주간', status: '진행', plannedDate: '2026-06-11', start: '2026-06-11 09:05', end: '' },
  { no: 'WO-260611-018', code: 'WF-200-A', itemName: '200mm 웨이퍼', line: 'M-Line', qty: 3200, shift: '야간', status: '대기', plannedDate: '2026-06-11', start: '', end: '' },
  { no: 'WO-260611-015', code: 'PKG-BGA-14', itemName: 'BGA 기판', line: 'P-Line', qty: 2500, shift: '주간', status: '진행', plannedDate: '2026-06-11', start: '2026-06-11 08:40', end: '' },
  { no: 'WO-260610-040', code: 'MOD-CAM-02', itemName: '카메라 모듈', line: 'A-Line', qty: 1800, shift: '주간', status: '완료', plannedDate: '2026-06-10', start: '2026-06-10 08:10', end: '2026-06-10 18:30' },
];
