import type { ProdPlan } from '@/domain/prodPlan/schema';

/**
 * 생산계획 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 prod-screens.ProdPlanContent 의 인라인 PLANS 이관)
 */
export const PROD_PLAN_SEED: ProdPlan[] = [
  { no: 'PL-260611-01', code: 'WF-300-B', name: '300mm 웨이퍼', line: 'M-Line', shift: '주간', qty: '4,000', status: '확정' },
  { no: 'PL-260611-02', code: 'WF-200-A', name: '200mm 웨이퍼', line: 'M-Line', shift: '야간', qty: '3,200', status: '확정' },
  { no: 'PL-260611-03', code: 'PKG-BGA-14', name: 'BGA 패키지', line: 'P-Line', shift: '주간', qty: '2,500', status: '검토' },
  { no: 'PL-260611-04', code: 'MOD-CAM-02', name: '카메라 모듈', line: 'A-Line', shift: '주간', qty: '1,800', status: '수신' },
  { no: 'PL-260612-01', code: 'WF-300-B', name: '300mm 웨이퍼', line: 'M-Line', shift: '주간', qty: '4,200', status: '수신' },
];
