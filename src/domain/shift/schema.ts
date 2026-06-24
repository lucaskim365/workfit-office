import { z } from 'zod';

/**
 * 근무조(Shift) + 근무 로테이션 도메인 스키마.
 * ([[데이터_모델_설계서.md]] shifts / shiftRotations)
 */
export const shiftSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
  /** 휴게(분). */
  brk: z.number().int().nonnegative().default(0),
  /** 실근무(시간). */
  net: z.number().nonnegative().default(0),
  /** 표시 색(UI). */
  color: z.string().default('#17a89a'),
});
export type Shift = z.infer<typeof shiftSchema>;

export const shiftRotationSchema = z.object({
  crew: z.string().min(1),
  lead: z.string().default(''),
  n: z.number().int().nonnegative().default(0),
  /** 요일별(월~일) 근무 — 주간|야간|휴무. */
  plan: z.array(z.string()).length(7),
});
export type ShiftRotation = z.infer<typeof shiftRotationSchema>;
