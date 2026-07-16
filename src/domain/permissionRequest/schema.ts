import { z } from 'zod';

export const permissionRequestSchema = z.object({
  id: z.string().min(1),
  submitterId: z.string().min(1),
  submitterName: z.string().min(1),
  createdAt: z.string().min(1),
  userRoles: z.record(z.string(), z.string()),
  comments: z.string().default(''),
  status: z.enum(['대기', '처리완료']).default('대기'),
});

export type PermissionRequest = z.infer<typeof permissionRequestSchema>;
