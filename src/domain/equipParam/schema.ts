import { z } from 'zod';

/**
 * 설비 파라미터 현황 equipParams. PK=code. 조회전용.
 *
 * 설비별 1 도큐먼트 — 설비 실시간 운전 조건·공정 파라미터 현황 마스터.
 * 화면(EquipParamScreen)의 인라인 PARAMS(Record<설비코드, EqParam>)를 데이터화한 정의.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 */

/** 설비별 실시간 파라미터 [이름, 단위, 목표, 하한LSL, 상한USL, 현재값]. */
export const paramSchema = z.tuple([
  z.string(), // 이름
  z.string(), // 단위
  z.number(), // 목표(target)
  z.number(), // 하한 LSL
  z.number(), // 상한 USL
  z.number(), // 현재값(cur)
]);
export type Param = z.infer<typeof paramSchema>;

export const equipParamSchema = z.object({
  /** PK — 설비코드(PARAMS의 키). */
  code: z.string().min(1, '설비코드는 필수입니다'),
  /** 진행 레시피 코드. */
  recipe: z.string(),
  /** 진행 LOT. */
  lot: z.string(),
  /** 공정 STEP. */
  step: z.string(),
  /** 설비 가동 상태(가동·대기·정지·고장). */
  state: z.string(),
  /** 공정 파라미터 목록(6개 항목). */
  p: z.array(paramSchema),
});

export type EquipParam = z.infer<typeof equipParamSchema>;
