import { z } from 'zod';

/**
 * 임직원 인사 마스터 employeeProfiles 스키마.
 * 계정 인증(users)과 독립적으로 인사 정보, 발령 부서, 직급, 직책 및 개인 신상정보를 보관.
 */
export const EMPLOYMENT_STATUS = ['ACTIVE', 'LEAVE', 'RETIRED'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUS)[number];

export const employeeProfileSchema = z.object({
  /** 프로필 고유 ID (PK, 보통 userId와 동일) */
  id: z.string().min(1),
  /** 매핑된 users 계정 ID (FK) */
  userId: z.string().min(1),
  /** 사번 */
  empNo: z.string().min(1),
  /** 이름 */
  name: z.string().min(1),
  /** 소속 부서 */
  dept: z.string().default('미지정'),
  /** 직급 */
  position: z.string().default('사원'),
  /** 직책 */
  jobTitle: z.string().default('팀원'),
  /** 재직 상태 */
  status: z.enum(EMPLOYMENT_STATUS).default('ACTIVE'),
  /** 업무/개인 연락처 */
  phone: z.string().optional().default(''),
  /** 입사일 (YYYY-MM-DD) */
  hireDate: z.string().optional().default(''),
  /** 주민등록번호 */
  rrn: z.string().optional().default(''),
  /** 생년월일 */
  birthDate: z.string().optional().default(''),
  /** 성별 (남성 / 여성) */
  gender: z.string().optional().default(''),
  /** 자택 주소 */
  address: z.string().optional().default(''),
  /** 개인 이메일 */
  personalEmail: z.string().optional().default(''),
  /** 비상 연락처 */
  emergencyPhone: z.string().optional().default(''),
  /** 최종 학력 */
  education: z.string().optional().default(''),
  /** 최종 수정일시 (ISO) */
  updatedAt: z.string().optional().default(''),
});

export type EmployeeProfile = z.infer<typeof employeeProfileSchema>;

export const employeeProfileFormSchema = employeeProfileSchema.omit({
  updatedAt: true,
});

export type EmployeeProfileFormValues = z.infer<typeof employeeProfileFormSchema>;
