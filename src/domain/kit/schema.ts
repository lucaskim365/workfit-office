import { z } from 'zod';

/**
 * 키팅 kits. PK=no.
 * 작업지시별 Set 구성(키트) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 KITS 이관)
 */
export const KIT_STATUS = ['준비중', '대기', '완료'] as const;

export const kitSchema = z.object({
  /** 키트번호(PK). 채번 KIT-YYMMDD-NN. */
  no: z.string().min(1, '키트번호는 필수입니다'),
  /** 연계 작업지시(workOrders 참조). */
  wo: z.string().min(1, '작업지시는 필수입니다'),
  /** 작업장(라인). */
  line: z.string().default(''),
  /** 구성 부품 총 종수. */
  count: z.number().int().nonnegative().default(0),
  status: z.enum(KIT_STATUS).default('대기'),
  /** 준비 완료된 부품 종수. */
  done: z.number().int().nonnegative().default(0),
});

export type Kit = z.infer<typeof kitSchema>;
