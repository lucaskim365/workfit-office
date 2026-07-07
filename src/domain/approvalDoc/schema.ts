import { z } from 'zod';

/**
 * 전자결재 문서(approvalDoc) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * 한국형 전자결재의 실무 개념(결재선 3방식·결재구분 5종·순차/병렬·상태머신)을
 * 데이터로 담는 범용 결재 엔진의 저장 모델.
 * 결재선(steps)은 **header-line 임베드**(boms/routings 패턴) — 항상 문서와 함께
 * 로드되고 소량이라 서브컬렉션 대신 문서에 임베드하며, 원자적 갱신 이점을 얻는다.
 * ([[groupware-feature]] · docs/전자결재_워크플로_개발_계획서.md §5)
 *
 * ⚠ steps 는 **배열-of-맵**(z.array(z.object)) 이라 Firestore 중첩배열 제약에
 * 걸리지 않는다(코덱 불필요). ([[이슈_Firestore_중첩배열_코덱.md]] 교훈 반영)
 * RDB 이관 시 approvalDocs=헤더 테이블, steps=라인 테이블로 분해. ([[DB_이관_대비_설계원칙.md]])
 */

/** 문서 종류 — 휴가 포함(Phase 3 에서 결재 엔진 재사용). */
export const DOC_TYPES = ['기안', '품의', '지출결의', '휴가'] as const;
/** 문서 상태(§4.4 상태머신). */
export const DOC_STATUS = ['임시저장', '진행중', '반려', '완료', '회수'] as const;
/** 결재 구분 — 각 결재선 노드의 역할(§4.2). */
export const STEP_KINDS = ['결재', '합의', '참조', '전결', '대결'] as const;
/** 노드 결정. */
export const STEP_DECISIONS = ['대기', '승인', '반려', '보류'] as const;
/** 휴가 종류(§5.4). */
export const LEAVE_TYPES = ['연차', '반차', '병가', '경조', '공가'] as const;

export type DocType = (typeof DOC_TYPES)[number];
export type DocStatus = (typeof DOC_STATUS)[number];
export type StepKind = (typeof STEP_KINDS)[number];
export type StepDecision = (typeof STEP_DECISIONS)[number];
export type LeaveType = (typeof LEAVE_TYPES)[number];

/**
 * 결재선 노드(ApprovalStep) — 임베드 라인.
 * 순차는 seq 오름차순, 병렬(합의)은 같은 parallelGroup 태그로 동시 활성(§4.3).
 */
export const approvalStepSchema = z.object({
  /** 순서(직렬 기준, 1부터). */
  seq: z.number().int().min(1),
  /** 병렬 그룹 태그 — 같으면 동시 활성(합의용). null 이면 단독 순차. */
  parallelGroup: z.string().nullable().default(null),
  /** 결재 구분(§4.2). 참조=열람만(진행 막지 않음), 전결=승인 시 상위 생략 완료. */
  kind: z.enum(STEP_KINDS),
  /** 결재자 users.id(FK). */
  approverId: z.string().min(1),
  /** 대결 시 원 결재자 users.id — 대리 승인 위임 기록(§4.2 대결). */
  delegatedFromId: z.string().nullable().default(null),
  /** 노드 결정. */
  decision: z.enum(STEP_DECISIONS).default('대기'),
  /** 결정 시각(ISO). */
  decidedAt: z.string().nullable().default(null),
  /** 의견 — 반려 시 필수(엔진에서 강제). */
  comment: z.string().default(''),
});

export type ApprovalStep = z.infer<typeof approvalStepSchema>;

/** 휴가 확장 필드(docType='휴가' 일 때만 유효, §5.4). */
export const leaveFormSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  /** 기간(date, YYYY-MM-DD). */
  startDate: z.string(),
  endDate: z.string(),
  /** 사용 일수(반차=0.5). 잔여일수는 저장 안 하고 도출(§5.4). */
  days: z.number().min(0),
});

export type LeaveForm = z.infer<typeof leaveFormSchema>;

export const approvalDocSchema = z.object({
  /** 문서 ID(PK) = docNo. */
  id: z.string().min(1),
  /** 문서번호 `AP-YYMMDD-NNN`(counters 채번). */
  docNo: z.string().min(1),
  docType: z.enum(DOC_TYPES),
  title: z.string().min(1, '제목은 필수입니다'),
  /** 기안자·기안부서(비정규화 — 목록 표시 성능). */
  drafterId: z.string().min(1),
  drafterDept: z.string().default(''),
  status: z.enum(DOC_STATUS).default('임시저장'),
  /** 결재선(임베드, §5.2). */
  steps: z.array(approvalStepSchema).default([]),
  /** 금액(지출결의·품의) → 전결규정 매칭 키. */
  amount: z.number().nullable().default(null),
  /** 본문. */
  body: z.string().default(''),
  /** 유형 확장 필드(휴가=기간·종류 등). 유형별 optional. */
  form: leaveFormSchema.nullable().default(null),
  /** 현재 활성 단계 seq(도출 캐시, 목록 성능용). 종결이면 마지막 seq. */
  currentSeq: z.number().default(0),
  createdAt: z.string().nullable().default(null),
  submittedAt: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
});

export type ApprovalDoc = z.infer<typeof approvalDocSchema>;

/** 결재함 탭(§7.2). 받은결재(대기)·상신함·완료함·참조함·임시저장. */
export const APPROVAL_BOXES = ['대기', '상신', '완료', '참조', '임시'] as const;
export type ApprovalBox = (typeof APPROVAL_BOXES)[number];
