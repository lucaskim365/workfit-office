import { z } from 'zod';

/**
 * 예비품 폐기·불용(SpareScrap) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 컬렉션 `spareScraps`. 상태머신 불용지정→폐기요청→승인대기→승인완료→폐기완료(+반려). 채번 DS-YYMM-NNN.
 *
 * 설비 예비품(스페어 파트)의 불용 지정~폐기 승인~폐기 완료 처리 대장.
 */

/** 처리 상태 — 5단계 선형 흐름 + 반려(예외). */
export const SPARE_SCRAP_STATUS = ['불용지정', '폐기요청', '승인대기', '승인완료', '폐기완료', '반려'] as const;

export const spareScrapSchema = z.object({
  /** PK — DS-YYMM-NNN. (미요청 항목은 '–'). */
  no: z.string().min(1),
  code: z.string().default(''),
  name: z.string().default(''),
  /** 분류(기구부품·전장부품·정밀부품·소모성 등). */
  cat: z.string().default(''),
  unit: z.string().default('EA'),
  /** 수량. */
  qty: z.number().nonnegative().default(0),
  /** 단위 장부금액(₩). */
  book: z.number().nonnegative().default(0),
  /** 단위 회수가치(₩). */
  recover: z.number().nonnegative().default(0),
  /** 불용 사유. */
  reason: z.string().default(''),
  /** 정체 일수. */
  idle: z.number().nonnegative().default(0),
  /** 요청 일자. */
  reqDate: z.string().default('–'),
  /** 요청자. */
  reqBy: z.string().default('–'),
  /** 처리 상태(화면 Row와 동일 필드명 `state`). */
  state: z.enum(SPARE_SCRAP_STATUS).default('불용지정'),
  /** 승인자. */
  appr: z.string().default('–'),
});

export type SpareScrap = z.infer<typeof spareScrapSchema>;

/** 신규 불용 지정용(번호·상태는 repo가 채움). */
export const spareScrapDraftSchema = spareScrapSchema.partial().extend({
  name: z.string().min(1, '품명은 필수입니다'),
  reason: z.string().min(1, '불용 사유는 필수입니다'),
});
export type SpareScrapDraft = z.infer<typeof spareScrapDraftSchema>;
