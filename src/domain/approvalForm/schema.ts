import { z } from 'zod';
import { autoNumberConfigSchema } from './autoNumber';
import { letterheadConfigSchema } from './headerItems';

/**
 * 결재서식(ApprovalForm) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * 전자결재 "문서 양식"을 데이터화한다. 하나의 서식 = ① 상신 시 채우는 입력 폼 +
 * ② 결재·인쇄 시 보이는 격식 문서. 코드 수정 없이 문서유형을 추가/편집/삭제·디자인.
 * (docs/결재서식_문서관리_개발_계획서.md)
 *
 * RDB 이관 시 approvalForms=서식헤더, fields=라인. ([[DB_이관_대비_설계원칙.md]])
 * fields 는 배열-of-맵이라 Firestore 중첩배열 제약 무관. ([[이슈_Firestore_중첩배열_코덱.md]])
 */

/** 필드 타입 — 상신 입력 위젯 + 인쇄 표현을 결정. */
export const FIELD_TYPES = [
  '텍스트', // 한 줄
  '장문', // 여러 줄(본문 대체 가능, key='body' 는 문서 본문에 바인딩)
  '숫자',
  '금액', // isAmountKey 지정 시 결재선 금액매칭 amount 로 승격
  '날짜',
  '기간', // 시작~종료(+일수). 값은 key(시작)·keyEnd·keyDays 로 저장
  '선택', // 단일 select(options)
  '다중선택', // 체크 목록(options) → 콤마 결합 저장
  '체크', // boolean
  '사용자', // 조직도 사용자 id
  '부서', // 부서명
  '안내문', // 입력 없음(작성 가이드)
  '표', // 동적 입력 테이블
  '직인', // 회사 직인 자리(입력 없음) — 있으면 결재란 대신 결재 완료 후 회사 직인
  '자동번호', // 입력 없음 — 상신할 때 서식별 규칙(autoNumber)으로 번호를 매긴다
  '문서제목', // 문서 제목을 이 자리에 — 있으면 머리의 제목 줄 대신 여기서 입력·표시
  '회사정보', // 입력 없음 — 회사 정보(주소·전화·팩스·홈페이지·이메일)와 연구소 주소 머리글
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** 필드 값 타입 — Record 로 저장(스칼라). 기간은 보조 키로 분해 저장. */
export const fieldValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type FieldValue = z.infer<typeof fieldValueSchema>;

export const formFieldSchema = z.object({
  /** 문서 내 필드 식별자(값 저장 키). 예약: 'body'=본문. */
  key: z.string().min(1),
  /** 표시 라벨. */
  label: z.string().default(''),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  /** 선택/다중선택 항목. */
  options: z.array(z.string()).default([]),
  placeholder: z.string().default(''),
  /** 2열 배치 폭. */
  width: z.enum(['half', 'full']).default('full'),
  /** 섹션(구분 제목) — 같은 값끼리 묶어 표시. 비면 기본 섹션. */
  section: z.string().default(''),
  /** 이 필드값이 결재선 금액매칭 amount 로 승격됨(서식당 0~1개, type='금액'). */
  isAmountKey: z.boolean().default(false),
  /** 특정 선택형 필드값에 따라서만 노출 (형식: "상위필드키:값", 예: "insuranceType:자동차보험") */
  visibleIf: z.string().nullable().default(null),
  /** 이 선택 필드가 상단 탭 분리 기준으로 작동하는지 여부 */
  isTabSelector: z.boolean().optional().default(false),
  /** 이 필드가 보안/마스킹 대상 필드인지 여부 */
  isSecret: z.boolean().default(false),
  /** 대외 문서(결재 완료 후 거래처용 모양·발주서 PDF)에서 숨김 */
  hideOnExternal: z.boolean().optional(),
  /** type='직인'·직인 칸이 있는 '표' — 쓸 직인(회사 로고·직인 목록 id). 없으면 대표 직인 */
  markId: z.string().max(64).optional(),
  /** type='자동번호' 의 번호 모양(접두어·날짜·자릿수·초기화 주기) — [[autoNumber]] */
  autoNumber: autoNumberConfigSchema.optional(),
  /** type='회사정보' 의 표시 항목과 연구소 주소 — [[headerItems]] */
  letterhead: letterheadConfigSchema.optional(),
  /**
   * 탭별 공통 필드 오버라이드 — 공통 필드(visibleIf=null)를 특정 탭에서 볼 때
   * width/section 을 독립적으로 다르게 설정하기 위한 맵.
   * 키 = 탭 옵션값(예: "반차"), 값 = 오버라이드 속성.
   */
  tabOverrides: z.record(z.string(), z.object({
    width: z.enum(['half', 'full']).optional(),
    section: z.string().optional(),
  })).optional().default({}),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const approvalFormSchema = z.object({
  /** PK = code. */
  id: z.string().min(1),
  /** 문서유형 코드 — 결재선 룰 docType·approvalDocs.docType 와 매칭. 예: '기안','출장'. */
  code: z.string().min(1, '코드는 필수입니다'),
  /** 표시명(예: '출장신청서'). */
  name: z.string().min(1, '서식명은 필수입니다'),
  icon: z.string().default('📄'),
  /** 격식 문서명(예: '출 장 신 청 서'). 비면 name 사용. */
  docTitle: z.string().default(''),
  /** 맺음말(예: '위와 같이 신청하오니 재가하여 주시기 바랍니다.'). */
  closing: z.string().default(''),
  fields: z.array(formFieldSchema).default([]),
  active: z.boolean().default(true),
  order: z.number().default(0),
  /** 기본 4종 보호(삭제 방지). 복제는 허용. */
  system: z.boolean().default(false),
  /** 소속 폴더 ID (null이면 최상위 루트) */
  folderId: z.string().nullable().default(null),
  /** 기본 수신 부서 ID */
  recipientDeptId: z.string().nullable().optional(),
  /** 기본 수신 사용자 ID */
  recipientUserId: z.string().nullable().optional(),
  /** 기안자 본인을 기본 수신처로 지정 여부 */
  recipientDrafter: z.boolean().nullable().optional(),
  /** 기본 참조 부서 ID */
  referenceDeptId: z.string().nullable().optional(),
  /** 기본 참조 사용자 ID */
  referenceUserId: z.string().nullable().optional(),
  /** 기안 가능한 직급 서열 최소값 (null 이면 제한 없음) */
  allowedPositionFromRank: z.number().nullable().optional(),
  /** 기안 가능한 직급 서열 최대값 (null 이면 제한 없음) */
  allowedPositionToRank: z.number().nullable().optional(),
  /** 기안 가능한 부서 ID 목록 (null/빈 배열 이면 모든 부서 가능) */
  allowedDeptIds: z.array(z.string()).nullable().optional(),
  /** 기안 가능한 직책 목록 (null/빈 배열 이면 모든 직책 가능) */
  allowedJobTitles: z.array(z.string()).nullable().optional(),
  /** 기안 자격을 예외 허용하는 개별 사용자 ID 목록 */
  allowedUserIds: z.array(z.string()).nullable().optional(),
  /** 보존연한 */
  preservationPeriod: z.string().nullable().optional(),
  /** 기본 보안 등급 */
  securityLevel: z.enum(['일반', '대외비', '극비']).nullable().optional(),
  /** 기본 공개 범위 */
  visibility: z.enum(['부서', '비공개']).nullable().optional(),
  /** 결재 완료 문서에서 상단 자동 정보(문서번호·기안부서·기안자·기안일·완료일·보존연한) 숨김 — 대외 문서용 */
  hideDocInfoOnComplete: z.boolean().nullable().optional(),
  /** 문서 종이에서 늘 숨기는 머리 항목(문서번호·기안부서 등) — 작성·결재 중·완료·인쇄 모두. 공문처럼 배치가 다른 서식용 */
  hiddenHeaderItems: z.array(z.string()).nullable().optional(),
});
export type ApprovalForm = z.infer<typeof approvalFormSchema>;



/** 폴더(Folder) 도메인 스키마 추가 */
export const approvalFolderSchema = z.object({
  id: z.string(),              // 폴더 식별자
  name: z.string().min(1, '폴더명은 필수입니다'), // 폴더 이름
  order: z.number().default(0) // 정렬 순서
});
export type ApprovalFolder = z.infer<typeof approvalFolderSchema>;

/** 문서 본문(doc.body) 기본 키 — 장문 필드이거나 서식이 이 키를 쓰지 않을 때만 본문에 바인딩된다. */
export const RESERVED_BODY_KEY = 'body';

/** 'body' 키를 표 등 다른 종류 필드가 쓰고 있을 때, 기본 본문 칸(장문 필드가 없을 때 제공)이 쓰는 키. */
export const BODY_BOX_FALLBACK_KEY = '__body';

/**
 * 문서 본문(doc.body)으로 저장·표시할 값의 키.
 * 'body' 는 예약어가 아니다 — 표·텍스트 등 다른 종류가 'body' 키를 쓰면 일반 필드로 취급하고,
 * 본문은 별도 키(`__body`)에 담아 서로 덮어쓰지 않게 한다.
 */
export function documentBodyKeyOf(fields?: Array<Pick<FormField, 'key' | 'type'>> | null): string {
  const bodyField = fields?.find((f) => f.key === RESERVED_BODY_KEY);
  return !bodyField || bodyField.type === '장문' ? RESERVED_BODY_KEY : BODY_BOX_FALLBACK_KEY;
}

/** 기존 문서 취소 전용 서식 코드 — 문서 상세의 [취소 기안]으로만 작성한다. */
export const CANCEL_FORM_CODE = '취소신청';
/** 휴일근로 신청서와, 그 전에 쓰던 연장근로 신청서 코드 */
const HOLIDAY_WORK_FORM_CODE = '휴일근무';
const LEGACY_OVERTIME_FORM_CODE = '연장근로';

type FormIdentity = Pick<ApprovalForm, 'id' | 'code' | 'active'>;
const isCancelForm = (form: FormIdentity) => form.code === CANCEL_FORM_CODE || form.id === CANCEL_FORM_CODE;

/** 기안 화면이 서식을 찾는 목록 — 활성 서식 전부(취소 기안이 취소신청서를 찾아야 한다). */
export function draftableForms<T extends FormIdentity>(forms: T[]): T[] {
  return forms.filter((form) => form.active);
}

/** 서식 선택 목록 — 취소신청서는 기존 문서 취소 전용이라 뺀다. */
export function draftCatalogForms<T extends FormIdentity>(forms: T[]): T[] {
  const active = draftableForms(forms).filter((form) => !isCancelForm(form));
  // 휴일근무 서식이 생기면 옛 연장근로 서식은 목록에서 뺀다 — 켜 둔 채라 반려·회수 문서는 그대로 재상신할 수 있다
  const replaced = active.some((form) => form.code === HOLIDAY_WORK_FORM_CODE);
  return replaced ? active.filter((form) => form.code !== LEGACY_OVERTIME_FORM_CODE) : active;
}

/** 서식의 금액 필드(있으면) — 상신 시 이 값을 amount 로 승격. */
export const amountFieldOf = (form: ApprovalForm): FormField | undefined =>
  form.fields.find((f) => f.type === '금액' && f.isAmountKey) ?? form.fields.find((f) => f.type === '금액');
