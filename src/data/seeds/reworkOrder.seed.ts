import type { ReworkOrder } from '@/domain/reworkOrder/schema';

/**
 * 재작업·폐기 지시 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-rework.jsx 인라인 mock 이관)
 */
export const REWORK_ORDER_SEED: ReworkOrder[] = [
  { no: 'RW-260621-006', type: '재작업', mrb: 'MRB-260619-001', ncr: 'NCR-260619-009', code: 'FG-SFT-D', name: '샤프트 D-40', lot: 'L2606-0905', qty: 60, unit: 'EA', pic: '김작업', due: '06-22 18:00', status: '작업중', method: '재연삭 (진원도 교정)', proc: '연삭 · GRD-02', done: 42, pass: 40, fail: 2, cost: 180000 },
  { no: 'RW-260621-004', type: '재작업', mrb: 'MRB-260618-006', ncr: 'NCR-260619-014', code: 'FG-HSG-C', name: '하우징 C-Type', lot: 'L2606-0922', qty: 120, unit: 'EA', pic: '이작업', due: '06-21 16:00', status: '완료', method: '디버링 (버 제거)', proc: '후가공 · DBR-01', done: 120, pass: 118, fail: 2, cost: 96000 },
  { no: 'RW-260620-008', type: '재작업', mrb: 'MRB-260620-005', ncr: 'NCR-260621-008', code: 'FG-BRK-A', name: '브래킷 ASSY-A', lot: 'L2606-1013', qty: 18, unit: 'EA', pic: '김작업', due: '06-22 12:00', status: '지시', method: '외경 재가공', proc: 'CNC · CNC-05', done: 0, pass: 0, fail: 0, cost: 54000 },
  { no: 'SC-260621-003', type: '폐기', mrb: 'MRB-260620-003', ncr: 'NCR-260620-011', code: 'FG-GER-22', name: '기어 G-22T', lot: 'L2605-0820', qty: 35, unit: 'EA', pic: '이품질', due: '06-23', status: '승인대기', dmethod: '파쇄 (내부 처리)', approver: '품질이사', loss: 2800000, recover: 42000 },
  { no: 'SC-260620-001', type: '폐기', mrb: 'MRB-260618-004', ncr: 'NCR-260618-007', code: 'FG-INJ-X', name: '사출 불량품 일괄', lot: 'L2606-0888', qty: 80, unit: 'EA', pic: '이품질', due: '06-20', status: '완료', dmethod: '매각 (고철 처리)', approver: '품질이사', loss: 640000, recover: 88000 },
];
