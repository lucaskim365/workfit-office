import { z } from 'zod';

/**
 * 검사(Inspection) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.5 `inspections` ★통합(IQC/PQC/OQC). 상태머신 대기→검사중→판정완료(+보류).
 *
 * 측정 실적은 별도 컬렉션(inspectionMeasurements) 대신 items[]에 임베드한다
 * (검사 1건과 항상 함께 로드되는 bounded 데이터 → header-line 패턴, [[data-layer-pattern]]).
 * 운영 규모 확대 시 서브컬렉션으로 분리해도 repo만 재작성하면 된다.
 */
export const INSPECTION_STAGES = ['IQC', 'PQC', 'OQC'] as const;
export const INSPECTION_SAMPLING = ['샘플링', '전수'] as const;
export const INSPECTION_PRIORITY = ['긴급', '일반'] as const;
export const INSPECTION_STATUS = ['대기', '검사중', '보류', '판정완료'] as const;
/** 최종 판정. 자동판정(합격/불합격) + 등급/특채/반품 처리. */
export const INSPECTION_JUDGEMENTS = ['합격', '조건부합격', '특채', '불합격', '반품'] as const;

/** 검사 항목 라인(임베드) — 규격 + 측정 실적. */
export const inspectionLineSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['계량', '계수']),
  unit: z.string().default('-'),
  /** 표시용 규격 문구(예: "25.00 ±0.05 mm"). */
  spec: z.string().default(''),
  /** 계량 규격 하한/상한. 계수이거나 단측이면 null. */
  lsl: z.number().nullable().default(null),
  usl: z.number().nullable().default(null),
  /** 계량 측정 시료값(문자열로 보관 — 입력 그대로). */
  values: z.array(z.string()).default([]),
  /** 계수 부적합 개수. */
  defect: z.number().int().nonnegative().default(0),
});
export type InspectionLine = z.infer<typeof inspectionLineSchema>;

export const inspectionSchema = z.object({
  /** PK — IQC는 입고번호(GR-...). stage별 ref 번호를 그대로 식별자로 쓴다. */
  recv: z.string().min(1),
  date: z.string().default(''),
  stage: z.enum(INSPECTION_STAGES).default('IQC'),
  code: z.string().default(''),
  name: z.string().default(''),
  mtype: z.string().default(''),
  vendor: z.string().default(''),
  qty: z.number().nonnegative().default(0),
  unit: z.string().default('EA'),
  lot: z.string().default(''),
  insp: z.enum(INSPECTION_SAMPLING).default('샘플링'),
  /** 샘플링 시료문자(전수면 '—'). */
  letter: z.string().default('—'),
  n: z.number().int().nonnegative().default(0),
  ac: z.number().int().nonnegative().default(0),
  re: z.number().int().nonnegative().default(0),
  level: z.string().default('—'),
  aql: z.number().nonnegative().default(0),
  prio: z.enum(INSPECTION_PRIORITY).default('일반'),
  /** 대기시간(h) — 표시용. */
  wait: z.number().nonnegative().default(0),
  due: z.string().default(''),
  pic: z.string().default('미지정'),
  status: z.enum(INSPECTION_STATUS).default('대기'),
  /** 판정완료 전까지 null. */
  judgement: z.enum(INSPECTION_JUDGEMENTS).nullable().default(null),
  items: z.array(inspectionLineSchema).default([]),

  // OQC(출하검사) 전용 선택 필드 — IQC에서는 비워둔다.
  /** 고객(거래처). vendor가 매입처면 cust는 매출처. */
  cust: z.string().default(''),
  /** 납품처. */
  dest: z.string().default(''),
  /** 출하 예정 일시. */
  ship: z.string().default(''),
  /** COA(성적서) 발행 필요 여부. */
  coa: z.boolean().default(false),
  /** 연계 공정검사(PQC) 결과 — 출하검사 선행 게이트. */
  pqc: z.string().default(''),
  /** 고객 요구사항(필요서류·검사조건). */
  req: z.array(z.string()).default([]),
});

export type Inspection = z.infer<typeof inspectionSchema>;
