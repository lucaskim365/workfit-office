import { z } from 'zod';

export const employmentStatusSchema = z.enum(['ACTIVE', 'LEAVE', 'RETIRED']);

export const employeeSchema = z.object({
  id: z.string(),
  employeeNo: z.string(), // 사번
  name: z.string(),
  userId: z.string().optional(), // 로그인 계정 매핑
  dept: z.string(),
  position: z.string(), // 직급 (사원, 대리, 과장, 차장, 부장 등)
  duty: z.string().default('팀원'), // 직책 (팀원, 팀장, 파트장, 본부장 등)
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  profileImage: z.string().optional().or(z.literal('')),
  hireDate: z.string().optional().or(z.literal('')),
  employmentStatus: employmentStatusSchema.default('ACTIVE')
});

export type EmploymentStatus = z.infer<typeof employmentStatusSchema>;
export type Employee = z.infer<typeof employeeSchema>;
