import { z } from 'zod';

/**
 * 직책(JobTitle) 도메인 스키마.
 * 직책은 조직 내 역할(대표, 임원, 팀장, 팀원)을 정의합니다.
 */
export const jobTitleSchema = z.object({
  /** 직책 ID (예: `J01`) */
  id: z.string().min(1),
  /** 직책명 (대표, 임원, 팀장, 팀원) */
  name: z.string().min(1, '직책명은 필수입니다'),
});

export type JobTitle = z.infer<typeof jobTitleSchema>;
