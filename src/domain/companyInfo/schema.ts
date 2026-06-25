import { z } from 'zod';

/**
 * 회사 기본정보 companyInfo — 단일 문서(싱글톤, id='main').
 * 시스템 관리 / 회사 정보 화면의 법인·연락처·표기 폼을 데이터화한 마스터다.
 * 단일 진실 공급원(SSOT) — 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 */
export const companyInfoSchema = z.object({
  /** 문서 ID(싱글톤 고정값 'main'). */
  id: z.string().default('main'),
  /** 회사명. */
  name: z.string().min(1, '회사명은 필수입니다'),
  /** 영문 회사명. */
  nameEn: z.string().default(''),
  /** 사업자등록번호. */
  bizNo: z.string().default(''),
  /** 법인등록번호. */
  corpNo: z.string().default(''),
  /** 대표자. */
  ceo: z.string().min(1, '대표자는 필수입니다'),
  /** 설립일(YYYY-MM-DD). */
  foundedDate: z.string().default(''),
  /** 업태. */
  bizType: z.string().default(''),
  /** 종목. */
  bizItem: z.string().default(''),
  /** 회사 구분 — 법인·개인. */
  companyType: z.enum(['법인', '개인']).default('법인'),
  /** 회계연도 시작월. */
  fiscalStart: z.string().default('1'),
  /** 사용 여부. */
  active: z.boolean().default(true),
  /** 대표 전화. */
  tel: z.string().default(''),
  /** 팩스. */
  fax: z.string().default(''),
  /** 대표 이메일. */
  email: z.string().default(''),
  /** 홈페이지. */
  homepage: z.string().default(''),
  /** 본사 주소. */
  address: z.string().default(''),
  /** 시스템 표기명. */
  sysName: z.string().default(''),
  /** 보고서 머리말. */
  reportHeader: z.string().default(''),
  /** 문서 푸터. */
  docFooter: z.string().default(''),
  /** 회사 로고 다운로드 URL(Storage). 비어 있으면 미등록. */
  logoUrl: z.string().default(''),
  /** 회사 로고 Storage 경로(교체·삭제용). */
  logoPath: z.string().default(''),
  /** 민감정보 마스킹 표기 여부. */
  mask: z.boolean().default(true),
});

export type CompanyInfo = z.infer<typeof companyInfoSchema>;
