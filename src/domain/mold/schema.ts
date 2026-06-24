import { z } from 'zod';

/**
 * 금형/치공구(Mold) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.4 금형 `molds`. PK=code.
 */
export const moldSchema = z.object({
  code: z.string().min(1, '자산 코드는 필수입니다'),
  name: z.string().min(1, '자산명은 필수입니다'),
  /** 분류(사출금형·프레스금형·지그/Fixture·게이지/검구·절삭공구). */
  cat: z.string(),
  /** 자산번호. */
  asset: z.string(),
  /** 제조사. */
  maker: z.string(),
  /** 캐비티 수(해당 없으면 0). */
  cav: z.number(),
  /** 보관위치. */
  loc: z.string(),
  /** 누적 타수(Shot). 수명관리 미적용이면 0. */
  shot: z.number(),
  /** 보증 수명 타수. 수명관리 미적용이면 0. */
  life: z.number(),
  /** 적용 품목(품번). */
  item: z.string(),
  /** 적용 설비/라인 목록. */
  eqs: z.array(z.string()).default([]),
  /** 최근 점검일(MM-DD). */
  lastChk: z.string(),
  /** 누적 수리 횟수. */
  repairs: z.number(),
  /** 상태(사용중·보관·수명임박·수리중·폐기예정). */
  state: z.string(),
});

export type Mold = z.infer<typeof moldSchema>;
