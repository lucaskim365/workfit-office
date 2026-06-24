import { z } from 'zod';

/**
 * SPC 품질알람(SpcAlarm) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 SPC 품질알람 spcAlarms. PK=id.
 *
 * 통계적 공정관리(SPC) 자동수집으로 발생한 규격이탈(OOS)·관리이탈(OOC)·규칙위반·설비이상 알람.
 * 알람은 외부(설비·SPC 엔진)에서 id를 발급하므로 채번 없음.
 */
export const SPC_ALARM_TYPES = ['OOS', 'OOC', '규칙위반', '설비이상'] as const;
export const SPC_ALARM_STATUS = ['미확인', '확인', '조치중', '해제'] as const;

export const spcAlarmSchema = z.object({
  /** PK — 외부 발급 알람 ID(예: AL-1042). */
  id: z.string().min(1),
  /** 발생 시각(HH:MM:SS). */
  time: z.string().default(''),
  /** 상대 시각(예: '3분 전'). */
  ago: z.string().default(''),
  type: z.enum(SPC_ALARM_TYPES),
  /** 심각도(치명·주요·경미). */
  sev: z.string().default(''),
  /** 제품명. */
  prod: z.string().default(''),
  /** 제품·공정 코드. */
  code: z.string().default(''),
  /** 관리 특성명. */
  char: z.string().default(''),
  /** 발생 공정·설비. */
  proc: z.string().default(''),
  /** 측정값. */
  val: z.number().default(0),
  /** 하한(LSL|LCL). */
  lo: z.number().default(0),
  /** 상한(USL|UCL). */
  hi: z.number().default(0),
  /** 중심선(CL). */
  cl: z.number().default(0),
  /** 한계 종류(규격·관리한계·상태). */
  kind: z.string().default(''),
  /** 단위. */
  unit: z.string().default(''),
  status: z.enum(SPC_ALARM_STATUS).default('미확인'),
  /** 담당자. */
  pic: z.string().default(''),
  /** 검출 소스. */
  src: z.string().default(''),
  /** 최근 추이(스파크라인). */
  trend: z.array(z.number()).default([]),
  /** 알람 메시지. */
  msg: z.string().default(''),
});

export type SpcAlarm = z.infer<typeof spcAlarmSchema>;
