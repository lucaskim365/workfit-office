import { z } from 'zod';

/**
 * 설비 검교정 실적 calResults. PK=no.
 * 로그 마스터(트랜잭션 원장) — RES_TX 각 행이 1 도큐먼트다.
 * 채번 no = CR-YYMM-NNN. 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 스키마가 곧 테이블 DDL)
 */
export const calResultSchema = z.object({
  /** 실적번호(PK) — CR-YYMM-NNN. */
  no: z.string().min(1, '실적번호는 필수입니다'),
  /** 검교정 일자(MM-DD). */
  date: z.string().min(1, '검교정 일자는 필수입니다'),
  /** 계측기 시리얼(관리번호). */
  sn: z.string().min(1),
  /** 계측기명. */
  name: z.string().min(1),
  /** 의뢰기관. */
  org: z.string().default(''),
  /** 판정 결과(합격 / 합격(조정) / 불합격). */
  result: z.string().min(1),
  /** 측정 오차값. */
  err: z.string().default(''),
  /** 허용 공차. */
  tol: z.string().default(''),
  /** 성적서 번호. */
  cert: z.string().default(''),
  /** 교정 필증 바코드. */
  barcode: z.string().default(''),
  /** 담당자. */
  who: z.string().default(''),
});

export type CalResult = z.infer<typeof calResultSchema>;
