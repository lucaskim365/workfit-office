import { z } from 'zod';

/**
 * 금형 수리/세척 이력(MoldRepair) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 금형 수리이력 moldRepairs. PK=no.
 * 로그 마스터 — 1행 = 1작업 도큐먼트(MR-YYMM-NNN).
 */
export const MR_TYPES = ['수리', '정기세척', '세척', '점검', '개조'] as const;
export const MR_STATE = ['완료', '진행중'] as const;

export const moldRepairSchema = z.object({
  /** 작업번호(PK). MR-YYMM-NNN. */
  no: z.string().min(1, '작업번호는 필수입니다'),
  /** 작업 일시(MM-DD HH:mm). */
  date: z.string().min(1, '작업 일시는 필수입니다'),
  /** 금형 코드(molds 참조). */
  code: z.string().min(1, '금형 코드는 필수입니다'),
  /** 금형명. */
  name: z.string().min(1, '금형명은 필수입니다'),
  /** 작업 유형 — 수리·정기세척·세척·점검·개조. */
  type: z.enum(MR_TYPES),
  /** 작업 내용. */
  detail: z.string().default(''),
  /** 작업 시점 누적 타수(shot). */
  shotAt: z.number().nonnegative().default(0),
  /** 소요 시간(h). */
  hrs: z.number().nonnegative().default(0),
  /** 정비 비용(₩). */
  cost: z.number().nonnegative().default(0),
  /** 수행 업체 — '자체정비' 또는 외주사명. */
  vendor: z.string().default(''),
  /** 수행자. */
  who: z.string().default(''),
  state: z.enum(MR_STATE).default('완료'),
});

export type MoldRepair = z.infer<typeof moldRepairSchema>;
