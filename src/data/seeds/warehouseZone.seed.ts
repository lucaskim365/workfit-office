import type { WarehouseZone } from '@/domain/warehouseZone/schema';

/**
 * 창고 구역 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens.jsx MatLocationScreen 의 인라인 ZONES 이관)
 * 색상 c 는 _mat.tsx C 토큰의 리터럴 값으로 보존: teal=#17a89a, warn=#e6960c, blue=#3a6ee0, navy=#1f2f55.
 */
export const WAREHOUSE_ZONE_SEED: WarehouseZone[] = [
  { z: 'A', name: '원자재 창고', racks: 24, use: 86, c: '#17a89a' },
  { z: 'B', name: '격리 구역', racks: 8, use: 42, c: '#e6960c' },
  { z: 'C', name: '반제품 창고', racks: 16, use: 71, c: '#3a6ee0' },
  { z: 'D', name: '완제품 창고', racks: 20, use: 64, c: '#1f2f55' },
];
