import { z } from 'zod';

/**
 * 생산 불량실적 prodDefects. PK=no.
 * 불량 기록 1건 = 1 도큐먼트(로그 마스터). 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 *
 * 화면(ProdDefectScreen) 상수인 CODES/CODE_MAP/LOTS는 마스터 참조이므로 데이터화 대상 아님.
 * 본 슬라이스는 불량 기록 트랜잭션 배열만 데이터로 이관한다.
 */
export const PD_ACTIONS = ['재작업', '폐기', '특채'] as const;

export const prodDefectSchema = z.object({
  /** PK — 불량 전표번호(DF-YYMM-NN). */
  no: z.string().min(1, '전표번호는 필수입니다'),
  /** 발생 일시(MM-DD HH:mm). */
  date: z.string().min(1, '일시는 필수입니다'),
  /** 대상 LOT 번호. */
  lot: z.string().min(1, 'LOT은 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 발생 공정. */
  proc: z.string().default(''),
  /** 불량 코드(defectCodes 참조). */
  code: z.string().min(1, '불량 코드는 필수입니다'),
  /** 불량 수량(EA). */
  qty: z.number().int().nonnegative().default(0),
  /** 조치 구분. */
  action: z.enum(PD_ACTIONS),
  /** 등록자. */
  by: z.string().default(''),
});

export type ProdDefect = z.infer<typeof prodDefectSchema>;
