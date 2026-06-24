import { z } from 'zod';

/**
 * 설계서 금형타수 moldShots. PK=code. 조회전용.
 * 설비 카운터가 자동 수집한 금형별 누적 타수(Shot) 마스터.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const moldShotSchema = z.object({
  /** 금형 코드(PK). */
  code: z.string().min(1, '금형 코드는 필수입니다'),
  /** 금형명. */
  name: z.string().min(1, '금형명은 필수입니다'),
  /** 자산 번호. */
  asset: z.string().default(''),
  /** 장착 설비. */
  eq: z.string().default(''),
  /** 누적 타수. */
  cum: z.number().nonnegative().default(0),
  /** 수명 한계 타수. */
  life: z.number().positive(),
  /** 금일 타수. */
  today: z.number().nonnegative().default(0),
  /** 일평균 타수. */
  avg: z.number().nonnegative().default(0),
  /** 생산 품목 코드. */
  item: z.string().default(''),
});

export type MoldShot = z.infer<typeof moldShotSchema>;
