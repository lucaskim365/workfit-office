import { z } from 'zod';

/**
 * 설비 보전협력사(EquipVendor) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 설비 보전협력사 `equipVendors`. PK=code.
 * (vendors 통합 마스터의 보전 view를 데모용 별도 컬렉션화)
 */
export const EV_KINDS = ['제조사', '보전외주', '부품공급', '캘리브레이션'] as const;
export const EV_STATES = ['계약중', '갱신예정', '만료임박', '만료'] as const;
export const EV_GRADES = ['A', 'B', 'C'] as const;

export const equipVendorSchema = z.object({
  code: z.string().min(1, '협력사 코드는 필수입니다'),
  name: z.string().min(1, '협력사명은 필수입니다'),
  kind: z.enum(EV_KINDS),
  /** 담당 범위 설명. */
  scope: z.string().default(''),
  mgr: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  /** 계약 시작/종료일(YYYY-MM-DD). */
  start: z.string().default(''),
  end: z.string().default(''),
  sla: z.string().default(''),
  fee: z.string().default(''),
  state: z.enum(EV_STATES),
  grade: z.enum(EV_GRADES),
  /** 평가 지표 — 납기 준수율·품질 만족도·응답 속도(%). */
  delivery: z.number().default(0),
  quality: z.number().default(0),
  response: z.number().default(0),
  /** 누적 작업 건수. */
  jobs: z.number().default(0),
});

export type EquipVendor = z.infer<typeof equipVendorSchema>;
