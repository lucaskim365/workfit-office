import { z } from 'zod';

/**
 * 근태 조회 도메인 — CAPS 인제스트가 저장하는 Firestore 문서(서버 계약 §5)의 클라이언트 뷰.
 * 쓰기는 서버(/api/ingest) 전용이라 여기는 조회 형태만 정의한다. 시각은 ISO 문자열로
 * 정규화한다(Firestore Timestamp 변환은 repo 몫).
 */
export const COMMUTE_STATUS = [
  'normal', 'late', 'holiday_work', 'off', 'absent', 'missing_out', 'missing_in', 'unknown',
] as const;

export type CommuteStatus = (typeof COMMUTE_STATUS)[number];

export const COMMUTE_STATUS_LABELS: Record<CommuteStatus, string> = {
  normal: '정상',
  late: '지각',
  holiday_work: '휴일근무',
  off: '휴무',
  absent: '결근',
  missing_out: '퇴근 미기록',
  missing_in: '출근 미기록',
  unknown: '미정',
};

export const commuteEmployeeSchema = z.object({
  empId: z.number().int(),
  name: z.string(),
  active: z.boolean(),
  retireDate: z.string().nullable(),
});

export type CommuteEmployee = z.infer<typeof commuteEmployeeSchema>;

export const commuteRecordSchema = z.object({
  empId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inAt: z.string().nullable(),
  outAt: z.string().nullable(),
  basicMin: z.number().int(),
  overMin: z.number().int(),
  nightMin: z.number().int(),
  lateMin: z.number().int(),
  totalMin: z.number().int(),
  status: z.enum(COMMUTE_STATUS),
});

export type CommuteRecord = z.infer<typeof commuteRecordSchema>;

/** 월별 요약. status 매핑이 추정치(계약 §3)라 집계도 참고용임을 화면이 안내한다. */
export interface CommuteMonthSummary {
  workDays: number;
  lateDays: number;
  absentDays: number;
  overMinTotal: number;
}

export function summarizeCommuteMonth(rows: CommuteRecord[]): CommuteMonthSummary {
  return {
    workDays: rows.filter((row) => row.inAt !== null || row.outAt !== null).length,
    lateDays: rows.filter((row) => row.status === 'late').length,
    absentDays: rows.filter((row) => row.status === 'absent').length,
    overMinTotal: rows.reduce((sum, row) => sum + row.overMin, 0),
  };
}
