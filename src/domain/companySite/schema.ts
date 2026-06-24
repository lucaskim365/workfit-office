import { z } from 'zod';

/**
 * 회사 사업장 companySites. PK=name. 조회전용.
 * 시스템 관리 / 회사 정보 화면의 사업장 현황 목록을 데이터화한 마스터다.
 * 단일 진실 공급원(SSOT) — 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 */
export const companySiteSchema = z.object({
  /** 사업장명(PK). */
  name: z.string().min(1, '사업장명은 필수입니다'),
  /** 구분 — 본점·제조장·물류장 등. */
  kind: z.string().min(1, '구분은 필수입니다'),
  /** 주소. */
  addr: z.string().default(''),
  /** 대표 전화. */
  tel: z.string().default(''),
  /** 관리자. */
  mgr: z.string().default(''),
  /** 사용 여부. */
  active: z.boolean().default(true),
});

export type CompanySite = z.infer<typeof companySiteSchema>;
