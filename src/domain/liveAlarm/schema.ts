import { z } from 'zod';

/**
 * 설비 실시간 알람(Live Alarm) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 상태머신 미조치→조치중→완료. 채번 없음(id 외부 발급, LA-NN).
 *
 * 설비에서 실시간 발생한 알람·장애의 조치 상태 추적.
 */
export const LIVE_ALARM_SEVERITY = ['중대', '경고', '주의'] as const;
export const LIVE_ALARM_STATE = ['미조치', '조치중', '완료'] as const;

export const liveAlarmSchema = z.object({
  /** PK — 외부 발급 식별자(LA-NN). */
  id: z.string().min(1),
  /** 알람 등급. */
  sev: z.enum(LIVE_ALARM_SEVERITY),
  /** 발생 시각(HH:MM:SS). */
  t: z.string().default(''),
  /** 경과 시간 라벨. */
  el: z.string().default(''),
  /** 설비명. */
  eq: z.string().default(''),
  /** 알람 코드. */
  code: z.string().default(''),
  /** 알람 메시지. */
  msg: z.string().default(''),
  /** 조치 상태(상태머신). */
  state: z.enum(LIVE_ALARM_STATE).default('미조치'),
  /** 담당자. */
  mgr: z.string().default(''),
  /** 인터록 발생 여부. */
  il: z.boolean().default(false),
});

export type LiveAlarm = z.infer<typeof liveAlarmSchema>;
