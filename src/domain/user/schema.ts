import { z } from 'zod';

/**
 * 사용자(User) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * roleGroup 은 roleGroups.code 참조(FK). ([[데이터_모델_설계서.md]] users)
 */
export const ROLE_GROUPS = ['ADMIN', 'OPERATOR', 'FIELD_ADMIN', 'MT_ADMIN', 'MT_USER', 'QC_USER'] as const;
export const USER_STATUS = ['사용', '잠금', '미사용'] as const;

export const userSchema = z.object({
  id: z.string().min(1),
  empNo: z.string().min(1, '사번을 입력하세요').max(20),
  name: z.string().min(1, '이름을 입력하세요').max(30),
  dept: z.string().min(1, '부서를 입력하세요').max(30),
  position: z.string().min(1, '직책을 입력하세요').max(20),
  roleGroup: z.enum(ROLE_GROUPS),
  email: z.string().min(1, '이메일을 입력하세요').email('올바른 이메일 형식이 아닙니다'),
  status: z.enum(USER_STATUS).default('사용'),
  lastLogin: z.string().default('-'),
  /**
   * 로그인 비밀번호. ⚠ 데모 한정 평문 저장 — 실제 보안 아님.
   * 진짜 인증은 후속(Cloud Function custom token)으로 전환 예정. ([[firebase-backend-setup]])
   */
  password: z.string().default(''),
});

export type User = z.infer<typeof userSchema>;

/** 폼 입력값(시스템 필드 제외). default 없이 정의해 RHF 입력/출력 타입 일치. */
export const userFormSchema = z.object({
  empNo: z.string().min(1, '사번을 입력하세요').max(20),
  name: z.string().min(1, '이름을 입력하세요').max(30),
  dept: z.string().min(1, '부서를 입력하세요').max(30),
  position: z.string().min(1, '직책을 입력하세요').max(20),
  roleGroup: z.enum(ROLE_GROUPS),
  email: z.string().min(1, '이메일을 입력하세요').email('올바른 이메일 형식이 아닙니다'),
  status: z.enum(USER_STATUS),
});
export type UserFormValues = z.infer<typeof userFormSchema>;
