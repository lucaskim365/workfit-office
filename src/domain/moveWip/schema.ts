import { z } from 'zod';

/**
 * 공정이동 재공 moveWip. PK=lot. 조회전용.
 * 화면(MoveScreen)의 인라인 mock(WIP)을 이관한 조회 마스터 슬라이스다.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 스키마가 곧 테이블 DDL)
 */
export const moveWipSchema = z.object({
  /** PK — 재공 LOT 번호. */
  lot: z.string().min(1, 'LOT 번호는 필수입니다'),
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 현 공정. */
  cur: z.string().default(''),
  /** 다음 공정. */
  next: z.string().default(''),
  /** 총 재공 수량(EA). */
  qty: z.number().nonnegative().default(0),
  /** 양품 수량(EA). */
  good: z.number().nonnegative().default(0),
  /** 불량 수량(EA). */
  bad: z.number().nonnegative().default(0),
  /** 공정 정체 시간(h). */
  wait: z.number().nonnegative().default(0),
});

export type MoveWip = z.infer<typeof moveWipSchema>;
