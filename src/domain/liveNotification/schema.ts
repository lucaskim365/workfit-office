import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(), // 알림 대상자
  type: z.enum(['결재', '메신저', '시스템']),
  title: z.string(),
  text: z.string(),
  senderName: z.string(),
  linkUrl: z.string().nullable().optional(),
  read: z.boolean().default(false),
  createdAt: z.string(),
});

export type LiveNotification = z.infer<typeof notificationSchema>;
