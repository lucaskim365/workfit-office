import { z } from 'zod';

/**
 * 설비 OEE oeeEquipments. PK=code. 조회전용.
 *
 * 설비별 OEE 행 1개 = 1 도큐먼트. 종합 설비 효율(OEE) 모니터링 마스터.
 * OEE 값(가용성×성능×품질)은 a·p·q 에서 화면이 파생하므로 저장하지 않는다.
 */
export const OEE_EQUIPMENT_STATE = ['가동', '대기', '정지', '고장'] as const;

export const oeeEquipmentSchema = z.object({
  /** 설비 코드(PK). */
  code: z.string().min(1, '설비 코드는 필수입니다'),
  /** 설비명. */
  name: z.string().min(1, '설비명은 필수입니다'),
  /** 소속 라인. */
  line: z.string().min(1, '라인은 필수입니다'),
  /** 가용성(Availability) %. */
  a: z.number(),
  /** 성능(Performance) %. */
  p: z.number(),
  /** 품질(Quality) %. */
  q: z.number(),
  /** 설비 상태. */
  st: z.enum(OEE_EQUIPMENT_STATE),
  /** OEE 추이(최근 N일). */
  tr: z.array(z.number()).default([]),
});

export type OeeEquipment = z.infer<typeof oeeEquipmentSchema>;
