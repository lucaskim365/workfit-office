import { z } from 'zod';

/**
 * 창고 구역 warehouseZones. PK=z. 조회전용.
 * 도메인 스키마 — 단일 진실 공급원(SSOT). 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * (와이어프레임 wms-screens.jsx MatLocationScreen 의 인라인 ZONES 이관)
 */
export const warehouseZoneSchema = z.object({
  /** 구역코드(PK) — 예: A, B, C, D. */
  z: z.string().min(1, '구역코드는 필수입니다'),
  /** 구역명. */
  name: z.string().min(1, '구역명은 필수입니다'),
  /** 랙 수. */
  racks: z.number().int().nonnegative(),
  /** 사용률(%). */
  use: z.number(),
  /** 표시 색상(리터럴 컬러 토큰 문자열). */
  c: z.string().min(1),
});

export type WarehouseZone = z.infer<typeof warehouseZoneSchema>;
