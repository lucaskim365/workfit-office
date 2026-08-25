import { z } from 'zod';

export const employmentStatusSchema = z.enum(['ACTIVE', 'LEAVE', 'RETIRED']);

export const employeeSchema = z.object({
  id: z.string(),
  employeeNo: z.string(), // 사번
  name: z.string(),
  userId: z.string().optional().or(z.literal('')), // 로그인 계정 매핑
  dept: z.string(),
  position: z.string(), // 직급 (사원, 대리, 과장, 차장, 부장 등)
  duty: z.string().default('팀원'), // 직책 (팀원, 팀장, 파트장, 본부장 등)
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  profileImage: z.string().optional().or(z.literal('')),
  hireDate: z.string().optional().or(z.literal('')),
  employmentStatus: employmentStatusSchema.default('ACTIVE'),
  // 인사 상세 개인 신상정보 필드 추가
  rrn: z.string().optional().or(z.literal('')), // 주민등록번호
  address: z.string().optional().or(z.literal('')), // 주소
  personalEmail: z.string().optional().or(z.literal('')), // 개인 이메일
  emergencyPhone: z.string().optional().or(z.literal('')), // 비상 연락처
  education: z.string().optional().or(z.literal('')), // 최종 학력
  gender: z.string().optional().or(z.literal('')), // 성별
  birthDate: z.string().optional().or(z.literal('')) // 생년월일
});

export type EmploymentStatus = z.infer<typeof employmentStatusSchema>;
export type Employee = z.infer<typeof employeeSchema>;
