import { z } from 'zod';

/**
 * 설비 비가동(Downtime) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.x 비가동 downtimes. PK=id. 조회전용 로그.
 *
 * DT_LOG 1행 = 1 도큐먼트. 원본 컬럼 순서: [eq, start, end, dur, category, reason, worker, state].
 * 원본에 PK 필드가 없어 시드에서 결정적(DT-01~) id 를 부여한다.
 */
export const DT_STATE = ['진행중', '완료'] as const;

export const downtimeSchema = z.object({
  /** PK — 시드에서 인덱스순 결정적 부여(DT-01~). */
  id: z.string().min(1, '비가동 ID는 필수입니다'),
  /** 설비명. */
  eq: z.string(),
  /** 시작 일시(MM-DD HH:mm). */
  start: z.string(),
  /** 종료 일시. 진행중이면 '— (진행중)'. */
  end: z.string(),
  /** 지속 시간(h) — 원본이 문자열이므로 string 유지. */
  dur: z.string(),
  /** 비가동 구분(고장(BM)·계획보전(PM) 등). */
  category: z.string(),
  /** 사유 / 조치 내용. */
  reason: z.string(),
  /** 담당자. 미지정이면 '—'. */
  worker: z.string(),
  state: z.enum(DT_STATE),
});

export type Downtime = z.infer<typeof downtimeSchema>;
