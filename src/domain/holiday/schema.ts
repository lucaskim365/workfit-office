import { z } from 'zod';

export type HolidayType = 'legal' | 'substitute' | 'company' | 'special';

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  legal: '법정 공휴일',
  substitute: '대체 공휴일',
  company: '회사 지정 휴일',
  special: '임시 공휴일',
};

export const HOLIDAY_TYPE_TONES: Record<HolidayType, 'danger' | 'amber' | 'teal' | 'navy'> = {
  legal: 'danger',
  substitute: 'amber',
  company: 'teal',
  special: 'navy',
};

export const holidaySchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다'),
  name: z.string().min(1, '휴일명을 입력해주세요'),
  type: z.enum(['legal', 'substitute', 'company', 'special']),
  isPaid: z.boolean().default(true),
  isRecurring: z.boolean().optional(),
  memo: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Holiday = z.infer<typeof holidaySchema>;
