import type { ProductionResult } from '@/domain/productionResult/schema';

/**
 * 생산실적 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (ProdResultScreen 인라인 RESULTS 이관)
 */
export const PRODUCTION_RESULT_SEED: ProductionResult[] = [
  { no: 'WO-260611-021', code: 'WF-300-B', order: '4,000', good: '2,480', bad: '38', defect: 'LB-1001', agg: '자동(PLC)' },
  { no: 'WO-260611-022', code: 'WF-300-B', order: '2,000', good: '780', bad: '12', defect: 'A-2210', agg: '자동(PLC)' },
  { no: 'WO-260611-015', code: 'PKG-BGA-14', order: '2,500', good: '1,625', bad: '21', defect: 'LB-1002', agg: '수기' },
];
