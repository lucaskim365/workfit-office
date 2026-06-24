import type { SafetyStock } from '@/domain/safetyStock/schema';

/**
 * 자재 안전재고 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 ROWS 튜플 이관)
 */
export const SAFETY_STOCK_SEED: SafetyStock[] = [
  { code: 'WF-300-B', name: '300mm 웨이퍼', current: 320, safety: 500, max: 3000, reorder: 800, optimal: 2500, status: '미달' },
  { code: 'RES-PR-22', name: '포토레지스트', current: 46, safety: 40, max: 200, reorder: 70, optimal: 120, status: '발주필요' },
  { code: 'CHM-SL-05', name: '슬러리 SL-05', current: 180, safety: 60, max: 300, reorder: 100, optimal: 150, status: '정상' },
  { code: 'PKG-BGA-14', name: 'BGA 기판', current: 760, safety: 500, max: 4000, reorder: 1200, optimal: 3000, status: '발주필요' },
  { code: 'CHM-GAS-02', name: '공정 가스', current: 28, safety: 30, max: 120, reorder: 50, optimal: 80, status: '미달' },
  { code: 'WF-200-A', name: '200mm 웨이퍼', current: 1450, safety: 800, max: 4000, reorder: 1500, optimal: 2000, status: '정상' },
];
