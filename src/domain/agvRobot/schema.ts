import { z } from 'zod';

/**
 * AGV 물류로봇 agvRobots. PK=id. 조회전용.
 * 도메인 스키마 — 단일 진실 공급원(SSOT). 타입·검증을 이 스키마에서 파생한다.
 */
export const agvRobotSchema = z.object({
  /** 로봇 식별자(AGV-/AMR-). 문서 ID = PK. */
  id: z.string().min(1, '로봇 ID는 필수입니다'),
  /** 현재 작업/임무 설명. */
  task: z.string().default(''),
  /** 배터리 잔량(%). */
  bat: z.number().int().min(0).max(100),
  /** 상태(이동중·대기·충전 등). */
  st: z.string().min(1, '상태는 필수입니다'),
});

export type AgvRobot = z.infer<typeof agvRobotSchema>;
