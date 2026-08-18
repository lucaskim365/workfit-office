import { z } from 'zod';

export const workPhaseSchema = z.object({
  id: z.string().regex(/^PHASE-\d{4}$/, 'WBS 단계 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  name: z.string().trim().min(1, '단계명을 입력하세요.').max(80),
  sortOrder: z.number().int().min(0),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export type WorkPhase = z.infer<typeof workPhaseSchema>;
export type WorkPhaseDraft = Pick<WorkPhase, 'projectId' | 'name'>;
