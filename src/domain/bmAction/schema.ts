import { z } from 'zod';

/**
 * 사후보전(Breakdown Maintenance, BM) 조치 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 컬렉션 `bmActions`. 상태머신 접수→진단중→수리중→시운전→완료 (선형). 채번 BM-YYMM-NNN.
 *
 * 설비 고장 접수~진단~수리~시운전~완료 이력. 화면 Row 구조를 그대로 정본화.
 */
export const BM_SEVERITY = ['중대', '주의', '경미'] as const;
/** 상태 값은 화면(EquipBmScreen) Row.state 표기와 정확히 일치해야 함(Pill/토널 표시 유지). */
export const BM_STATUS = ['접수', '진단중', '수리중', '시운전', '완료'] as const;

export const bmActionSchema = z.object({
  /** PK — BM-YYMM-NNN. */
  no: z.string().min(1),
  /** 대상 설비. */
  eq: z.string().default(''),
  /** 고장 증상. */
  sym: z.string().default(''),
  /** 추정 원인. */
  cause: z.string().default(''),
  /** 접수 시각(표시 문자열). */
  date: z.string().default(''),
  /** 담당자. */
  worker: z.string().default(''),
  /** 담당 팀. */
  team: z.string().default(''),
  /** 다운타임(분). */
  down: z.number().nonnegative().default(0),
  /** 심각도. */
  sev: z.enum(BM_SEVERITY),
  /** 상태머신 현재 상태. */
  state: z.enum(BM_STATUS).default('접수'),
  /** 교체 부품 수. */
  parts: z.number().int().nonnegative().default(0),
  /** 수리 비용(원). */
  cost: z.number().nonnegative().default(0),
});

export type BmAction = z.infer<typeof bmActionSchema>;

/** 신규 접수용(번호·상태는 repo가 채움). */
export const bmActionDraftSchema = bmActionSchema.partial().extend({
  sev: z.enum(BM_SEVERITY),
  eq: z.string().min(1, '설비는 필수입니다'),
  sym: z.string().min(1, '고장 증상은 필수입니다'),
});
export type BmActionDraft = z.infer<typeof bmActionDraftSchema>;
