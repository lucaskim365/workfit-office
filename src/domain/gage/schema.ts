import { z } from 'zod';

/**
 * 설계서 계측기 마스터 gages. PK=id.
 *
 * 계측기·검사장비(Gage) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const QG_STATE = ['사용중', '검교정중', '수리중', '사용중지'] as const;

export const gageSchema = z.object({
  /** PK — 자산번호(예: QG-CMM-01). */
  id: z.string().min(1, '자산번호는 필수입니다'),
  name: z.string().min(1, '장비명은 필수입니다'),
  /** 분류(좌표측정·영상측정·경도·물성·조도·윤곽 등). */
  cat: z.string().default(''),
  maker: z.string().default(''),
  model: z.string().default(''),
  /** 측정 범위. */
  range: z.string().default(''),
  /** 분해능. */
  res: z.string().default(''),
  /** 설치 위치. */
  loc: z.string().default(''),
  /** 관리 부서. */
  dept: z.string().default(''),
  /** 최근 검교정일(YYYY-MM-DD). */
  cal: z.string().default(''),
  /** 차기 검교정일(YYYY-MM-DD). */
  calNext: z.string().default(''),
  /** MSA Gage R&R %GRR. */
  grr: z.number(),
  /** 최근 GRR 평가월(YYYY-MM). */
  grrDate: z.string().default(''),
  state: z.enum(QG_STATE).default('사용중'),
  /** 적용 검사항목명 목록. */
  items: z.array(z.string()).default([]),
});

export type Gage = z.infer<typeof gageSchema>;
