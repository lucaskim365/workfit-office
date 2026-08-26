import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(), // 알림 대상자
  type: z.enum(['결재', '메신저', '시스템', '일정']),
  title: z.string(),
  text: z.string(),
  senderName: z.string(),
  linkUrl: z.string().nullable().optional(),
  read: z.boolean().default(false),
  createdAt: z.string(),
});

export type LiveNotification = z.infer<typeof notificationSchema>;

export const NOTIFICATION_TYPE_META = {
  결재:   { icon: '🖋️', color: '#6c5ce7', channel: 'workfit_approvals' },
  메신저: { icon: '💬', color: '#16b8cf', channel: 'workfit_messages' },
  일정:   { icon: '📅', color: '#16b8cf', channel: 'workfit_general' },
  시스템: { icon: '📢', color: '#16b8cf', channel: 'workfit_general' },
} as const;
