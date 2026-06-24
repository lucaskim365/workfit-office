import { z } from 'zod';

/**
 * 설비 부착 계측기 마스터 equipGages. PK=sn. (품질 gages와 별개)
 *
 * 설비 관리 / 계측기 및 검교정 관리에서 사용하는 계측기 마스터(CAL-, 시리얼 기반).
 * ⚠ 품질 모듈 gages(QG-)와는 별개 컬렉션이다.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 */
export const equipGageSchema = z.object({
  /** PK — 시리얼 번호(CAL-YYMM-NNN). */
  sn: z.string().min(1, '시리얼 번호는 필수입니다'),
  name: z.string().min(1, '계측기 품명은 필수입니다'),
  /** 분류(캘리퍼스·저울·압력계 등). */
  cat: z.string().min(1, '분류는 필수입니다'),
  maker: z.string().default(''),
  model: z.string().default(''),
  /** 도입일(YYYY-MM-DD). */
  intro: z.string().default(''),
  /** 측정범위 표시 문자열. */
  range: z.string().default(''),
  /** 허용오차 표시 문자열. */
  tol: z.string().default(''),
  unit: z.string().default('-'),
  /** 보관위치. */
  loc: z.string().default(''),
  /** 관리부서. */
  dept: z.string().default(''),
  /** 검교정 주기(개월). */
  cycle: z.number(),
  /** 최근 검교정일(YYYY-MM-DD). */
  lastCal: z.string().default(''),
  /** 차기 검교정일(YYYY-MM-DD). */
  nextCal: z.string().default(''),
  /** 상태(사용중·검교정중·사용중지). */
  state: z.string().default('사용중'),
});

export type EquipGage = z.infer<typeof equipGageSchema>;
