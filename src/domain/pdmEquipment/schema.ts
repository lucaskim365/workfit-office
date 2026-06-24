import { z } from 'zod';

/**
 * 설비 예지보전(PdM) 마스터 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 설비 예지보전 `pdmEquipments`. PK=code. 조회전용.
 */
/** 건전성 추세 — 악화(down)·개선(up)·유지(flat). */
export const PDM_TREND = ['down', 'up', 'flat'] as const;

export const pdmEquipmentSchema = z.object({
  code: z.string().min(1, '설비 코드는 필수입니다'),
  name: z.string().min(1, '설비명은 필수입니다'),
  /** 건전성 지수(Health Index, 0~100). */
  health: z.number(),
  /** 예측 잔여수명(Remaining Useful Life, 일). */
  rul: z.number(),
  /** 건전성 추세. */
  trend: z.enum(PDM_TREND),
  /** 상태 등급(정상·주의·위험 등). */
  state: z.string(),
  /** 주요 열화 인자. 없으면 '–'. */
  driver: z.string(),
});

export type PdmEquipment = z.infer<typeof pdmEquipmentSchema>;
