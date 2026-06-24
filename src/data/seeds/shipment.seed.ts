import type { Shipment } from '@/domain/shipment/schema';

/**
 * 출하 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 sales-screens.jsx)
 * DO-120/121은 이미 출고완료(수주 seed의 누적 납품량에 반영됨). DO-122/123은 진행 전.
 */
export const SHIPMENT_SEED: Shipment[] = [
  { no: 'DO-2606-120', salesOrder: 'SO-2606-082', customer: '대륭산업', item: 'PKG-BGA-14', itemName: 'BGA 기판', qty: 30, location: 'A-01', warehouse: 'C-Zone', status: '출고완료' },
  { no: 'DO-2606-121', salesOrder: 'SO-2606-071', customer: '동진정밀', item: 'CMP-CON-14', itemName: '보드 커넥터', qty: 150, location: 'B-04', warehouse: 'C-Zone', status: '출고완료' },
  { no: 'DO-2606-122', salesOrder: 'SO-2606-088', customer: '한빛전자', item: 'MX-200', itemName: '메모리 모듈', qty: 12, location: 'A-02', warehouse: 'FG-Zone', status: '피킹중' },
  { no: 'DO-2606-123', salesOrder: 'SO-2606-088', customer: '한빛전자', item: 'PKG-BGA-14', itemName: 'BGA 기판', qty: 5, location: 'A-01', warehouse: 'C-Zone', status: '출고대기' },
];
