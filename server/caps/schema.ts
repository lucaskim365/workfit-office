import { z } from 'zod';

/**
 * CAPS 근태 인제스트 페이로드 계약.
 *
 * 원본 계약: `jwheo/CommuteRef/db_decryption/docs/ingest-api-and-schema.md` §3.
 * 에이전트 e2e로 검증된 형식이므로 여기서 임의로 느슨하게 하거나 필드를 더하지 않는다.
 * `raw`는 원본 코드 보존용이라 모르는 키도 통과시킨다(status 재해석 안전망).
 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이 아닙니다');
const monthDay = z.string().regex(/^\d{2}-\d{2}$/, 'MM-DD 형식이 아닙니다');
const isoDateTime = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'ISO8601 일시가 아닙니다',
);

export const CAPS_STATUS = [
  'normal', 'late', 'holiday_work', 'off', 'absent', 'missing_out', 'missing_in', 'unknown',
] as const;

export const capsAttendanceSchema = z.object({
  empId: z.number().int(),
  name: z.string(),
  date: dateOnly,
  inAt: isoDateTime.nullable(),
  outAt: isoDateTime.nullable(),
  basicMin: z.number().int(),
  overMin: z.number().int(),
  nightMin: z.number().int(),
  lateMin: z.number().int(),
  totalMin: z.number().int(),
  status: z.enum(CAPS_STATUS),
  raw: z.object({
    decision: z.number().int(),
    inTime: z.number().int(),
    outTime: z.number().int(),
  }).passthrough(),
});

export const capsEmployeeSchema = z.object({
  empId: z.number().int(),
  name: z.string(),
  active: z.boolean(),
  retireDate: dateOnly.nullable(),
});

export const capsHolidaySchema = z.object({
  date: dateOnly.nullable(),
  monthDay: monthDay.nullable(),
  recurring: z.boolean(),
  name: z.string(),
}).refine(
  (row) => (row.recurring ? row.monthDay !== null : row.date !== null),
  '반복 공휴일은 monthDay, 특정일 공휴일은 date가 필요합니다',
);

export const capsIngestPayloadSchema = z.object({
  source: z.literal('caps'),
  generatedAt: isoDateTime,
  windowStart: dateOnly,
  attendance: z.array(capsAttendanceSchema),
  employees: z.array(capsEmployeeSchema),
  holidays: z.array(capsHolidaySchema),
});

export type CapsAttendance = z.infer<typeof capsAttendanceSchema>;
export type CapsEmployee = z.infer<typeof capsEmployeeSchema>;
export type CapsHoliday = z.infer<typeof capsHolidaySchema>;
export type CapsIngestPayload = z.infer<typeof capsIngestPayloadSchema>;

/** 계약 §6의 400 응답 `detail` 형식("attendance[3].date ...")으로 zod 오류를 줄인다. */
export function formatPayloadIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid payload';
  const path = issue.path
    .map((part) => (typeof part === 'number' ? `[${part}]` : `.${String(part)}`))
    .join('')
    .replace(/^\./, '');
  return path ? `${path} ${issue.message}` : issue.message;
}
