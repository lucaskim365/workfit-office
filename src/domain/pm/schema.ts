import { z } from 'zod';

/**
 * 프로젝트 관리(PM) 데이터 모양 — 프관 PM 데모(`FactoryFlow_PM_데모.html`)의 업무 목록을 옮긴 것.
 * 컬렉션은 모두 `pm*` 이름 아래 따로 둔다 (그룹웨어 다른 데이터와 섞지 않음).
 * ([[2026-11-24-pms-port-design]] §3.2)
 *
 * 날짜는 'YYYY-MM-DD' 글자(비면 ''), 사람은 그룹웨어 사용자 ID.
 */

export const PM_TASK_STATUSES = ['계획', '진행중', '완료'] as const;
export type PmTaskStatus = (typeof PM_TASK_STATUSES)[number];

const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, '날짜 형식이 아닙니다');

/** 사업 (`pmProjects`) — 데모 `wbs-data.projects`. 사업관리(`workProjects`)와는 따로 (§3.1) */
export const pmProjectSchema = z.object({
  /** 데모 사업 키 P1~P13 그대로 */
  id: z.string().min(1),
  /** 사업 구분 묶음(가·나·다…) */
  track: z.string().default(''),
  /** 사업 구분 (정부일반형 등) */
  biz: z.string().default(''),
  /** 도입기업 */
  company: z.string().default(''),
  /** 줄인 이름 (신광·효광(AI)…). 비면 화면에서 계산 */
  short: z.string().default(''),
  /** 공급기업 */
  supplier: z.string().default(''),
  /** 사업번호 SF… */
  bizNo: z.string().default(''),
  /** 주관기관 */
  org: z.string().default(''),
  /** PM — 데모는 "박명규 부장" 글자. 그룹웨어 사용자와 이으면 pmUserId */
  pmName: z.string().default(''),
  pmUserId: z.string().default(''),
  start: day.default(''),
  end: day.default(''),
  summary: z.string().default(''),
  /** 종료 처리됨 (사업 상태 '종료') */
  closed: z.boolean().default(false),
  /** 화면 순서 */
  order: z.number().default(0),
  // ── 3단계(대시보드)가 쓰는 칸 — 데모 사업 정보(S.sites). 내장 데이터엔 없어 비어 있음 (state.json 값은 7단계 옮기기 때) ──
  /** 공고 마감일 (수주 단계) */
  annDue: day.default(''),
  /** 선정평가일 */
  evalDate: day.default(''),
  /** 선정 결과: '' | 선정 | 탈락 (탈락 = 현황·알림에서 빠짐) */
  bidRes: z.enum(['', '선정', '탈락']).default(''),
  bidAt: z.object({ date: z.string(), by: z.string() }).nullable().default(null),
  /** 하자보증 기간(개월) — 협약 종료일부터 */
  warrantyM: z.number().nullable().default(null),
  /** 도입기업 대표 · 업종 · 소재지 · 사업자번호 · 현장 담당자 (이름 글자 — 그룹웨어 사용자 아님, §0) */
  ceo: z.string().default(''),
  industry: z.string().default(''),
  region: z.string().default(''),
  bizRegNo: z.string().default(''),
  contactName: z.string().default(''),
  contactPhone: z.string().default(''),
  contactEmail: z.string().default(''),
});
export type PmProject = z.infer<typeof pmProjectSchema>;

// ── 3단계: 사업 현황이 쓰는 기록 (데모 S.gov · S.planChk · S.govLink · S.agrChg · S.msOk). 지금 데이터는 모두 0건 ──

/** 점검 지적 사항 (보완 항목) */
/** 데모 GI: 조치 전 → (담당) 조치 완료 → (PM) 확인 · 반려 = 조치 전으로 */
export const PM_FIX_STATES = ['조치 전', '조치 완료', '확인'] as const;
export const pmFixItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  /** 조치 담당 — 그룹웨어 사용자 ID */
  whoId: z.string().default(''),
  st: z.enum(PM_FIX_STATES).default('조치 전'),
  /** a = 조치 완료 · 확인 · 반려 · 조치 전(되돌리기) */
  hist: z.array(z.object({ date: day, by: z.string(), a: z.string(), note: z.string().default('') })).default([]),
});
export type PmFixItem = z.infer<typeof pmFixItemSchema>;

/** 관리기준 기한 기록 (`pmGovRecords`) — 완료 체크 또는 점검 판정. id = `${projectId}|${itemId}` */
export const pmGovRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  /** 관리기준 항목 id (g_start·g_mid…) */
  itemId: z.string().min(1),
  /** 판정 (계속·보완·중단·적정·부적정·성공·실패). 서류 제출 항목은 비어 있음 = 완료 체크 */
  v: z.string().default(''),
  /** 완료한 날 / 판정 통보일 */
  date: day,
  by: z.string().default(''),
  memo: z.string().default(''),
  /** 보완일 때 직접 정한 후속 기한 */
  fix: day.default(''),
  /** 지적 사항 */
  items: z.array(pmFixItemSchema).default([]),
  /** 지난 기한 정리로 한꺼번에 처리한 날 */
  bulk: day.default(''),
});
export type PmGovRecord = z.infer<typeof pmGovRecordSchema>;

/** 계획서 약속 완료 체크 (`pmPlanChecks`). id = `${projectId}|${dutyId}` */
export const pmPlanCheckSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  dutyId: z.string().min(1),
  date: day,
  by: z.string().default(''),
  bulk: day.default(''),
});
export type PmPlanCheck = z.infer<typeof pmPlanCheckSchema>;

/** 관리기준 필수 TASK 직접 연결 (`pmGovLinks`). 빈 배열 = '연결 없음'으로 확정. id = `${projectId}|${itemId}` */
export const pmGovLinkSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  itemId: z.string().min(1),
  taskIds: z.array(z.string()).default([]),
});
export type PmGovLink = z.infer<typeof pmGovLinkSchema>;

export const PM_AGR_STATES = ['준비 중', '신청함', '승인', '반려', '등록 완료'] as const;
/** 협약변경 기록 (`pmAgreementChanges`) — 세부관리기준 24조 */
export const pmAgreementChangeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  date: day,
  /** ext·staff·eqS·addr·scope·eqL·sup·budget·move */
  kind: z.string().min(1),
  from: day.default(''),
  to: day.default(''),
  text: z.string().default(''),
  why: z.string().default(''),
  st: z.enum(PM_AGR_STATES).default('준비 중'),
  /** 기간 연장이 협약 종료일에 반영됨 (한 번만) */
  applied: z.boolean().default(false),
  by: z.string().default(''),
});
export type PmAgreementChange = z.infer<typeof pmAgreementChangeSchema>;

/** 마일스톤 확인(승인) (`pmMilestoneOks`). id = taskId */
export const pmMilestoneOkSchema = z.object({ id: z.string().min(1), date: day, by: z.string().default('') });
export type PmMilestoneOk = z.infer<typeof pmMilestoneOkSchema>;

/** 이슈 (`pmIssues`) — 대시보드가 세는 칸만. 등록·수정 화면과 나머지 칸은 5단계 */
export const PM_ISSUE_SEVS = ['긴급', '높음', '보통', '낮음'] as const;
export const pmIssueSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  cat: z.string().default(''),
  sev: z.enum(PM_ISSUE_SEVS).default('보통'),
  /** 열림 · … · 해결 */
  status: z.string().default('열림'),
  ownerId: z.string().default(''),
  watchIds: z.array(z.string()).default([]),
  by: z.string().default(''),
  /** 발생일 */
  date: day.default(''),
  /** 등록일 */
  at: day.default(''),
});
export type PmIssue = z.infer<typeof pmIssueSchema>;

/** 액션 아이템 (`pmActions`) — 대시보드가 세는 칸만. 나머지는 5단계 */
export const pmActionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().default(''),
  meetingId: z.string().default(''),
  text: z.string().min(1),
  whoId: z.string().default(''),
  due: day.default(''),
  done: z.boolean().default(false),
  /** 완료한 날 · 사람 (actDone — 내 업무 '처리할 일'에서 체크) */
  doneDate: day.default(''),
  doneBy: z.string().default(''),
});
export type PmAction = z.infer<typeof pmActionSchema>;

/** 진행률 '변동 없음' 확인 (`pmWeekChecks`, 데모 S.wcChk) — 그 주에 갱신한 것으로 침. id = `${주 시작일}|${taskId}` */
export const pmWeekCheckSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  /** 주 시작일 (월요일) */
  week: day,
  date: day,
  by: z.string().default(''),
});
export type PmWeekCheck = z.infer<typeof pmWeekCheckSchema>;

/** 나중에 할 일 (`pmLater`, 데모 S.later) — 사람마다 직접 내려 둔 업무. id = 사용자 ID */
export const pmLaterSchema = z.object({ id: z.string().min(1), taskIds: z.array(z.string()).default([]) });
export type PmLater = z.infer<typeof pmLaterSchema>;

/** 진행률 갱신 요청 (데모 S.updReq) — PM 이 주간 진행률 화면(5단계)에서 보냄. id = 받는 사람 ID */
export const pmUpdRequestSchema = z.object({ id: z.string().min(1), date: day, by: z.string().default(''), projectId: z.string().default('') });
export type PmUpdRequest = z.infer<typeof pmUpdRequestSchema>;

/** 업무 (`pmTasks`) — 데모 `WF` 19칸. 업무 목록 양식은 미확정이라 필수 칸을 최소로 (§3.2) */
export const pmTaskSchema = z.object({
  /** `${projectId}|${code}` — 데모 key 와 같다 */
  id: z.string().min(1),
  projectId: z.string().min(1),
  /** 단계 (데모 stage) */
  stage: z.string().default(''),
  /** 묶음 (데모 grp, 예: "01 자재관리"). 비면 단계로 묶음 */
  group: z.string().default(''),
  /** 번호 (데모 wbs, 예: "01-01") */
  code: z.string().min(1),
  name: z.string().min(1),
  /** 산출물 (완료 조건) */
  output: z.string().default(''),
  pmName: z.string().default(''),
  /** 담당 — 그룹웨어 사용자 ID. 첫 사람이 정(기본 담당) */
  assigneeIds: z.array(z.string()).default([]),
  /** 부 담당 (assigneeIds 중 '부'인 사람) */
  subAssigneeIds: z.array(z.string()).default([]),
  /** 사람이 아닌 실행 주체 (예: "효광 구매TF / Cloud 공급사") */
  execMemo: z.string().default(''),
  start: day.default(''),
  end: day.default(''),
  milestone: z.boolean().default(false),
  status: z.enum(PM_TASK_STATUSES).default('계획'),
  /** 계획 진행률 % (데모 pp) */
  planPct: z.number().min(0).max(100).default(0),
  /** 실적 진행률 % (데모 ap) */
  actualPct: z.number().min(0).max(100).default(0),
  /** 공수 MD. 없으면 null (가중 평균에서 1건 = 1) */
  md: z.number().nullable().default(null),
  /** 할 일 메모 (데모 memo) */
  memo: z.string().default(''),
  /** 기능 수·난이도·계획서 쪽 (데모 info) */
  info: z.string().default(''),
  /** 선행 업무 ID */
  predecessorIds: z.array(z.string()).default([]),
  /** 목록 순서 */
  order: z.number().default(0),
  // ── 양식이 바뀔 때를 위한 선택 칸 (§3.2, 지금 데이터엔 비움) ──
  /** 부서: 영업 / PMO / 버티컬 / 개발 / PLC */
  dept: z.string().default(''),
  /** 진척 계산에서 뺌 (PLC 업무 등) */
  excludeFromProgress: z.boolean().default(false),
  /** "FP 제외 n" — 업무명 끝 표시를 떼어 낸 값 */
  fpExcluded: z.number().nullable().default(null),
});
export type PmTask = z.infer<typeof pmTaskSchema>;

export const PM_FUNCTION_KINDS = ['재사용', '신규', '변경'] as const;
export type PmFunctionKind = (typeof PM_FUNCTION_KINDS)[number];

/** FP 세부 기능 (`pmTaskFunctions`) — 업무 1건당 문서 1개 (데모 `fn[key]`) */
export const pmTaskFunctionsSchema = z.object({
  /** = taskId */
  id: z.string().min(1),
  items: z.array(z.object({
    name: z.string(),
    kind: z.enum(PM_FUNCTION_KINDS),
    note: z.string().default(''),
  })).default([]),
});
export type PmTaskFunctions = z.infer<typeof pmTaskFunctionsSchema>;

/** 세부 작업 (`pmSubtasks`) — 데모 `S.subs[key][]` */
export const pmSubtaskSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  text: z.string().min(1),
  /** 담당 사용자 ID (비어도 됨) */
  assigneeId: z.string().default(''),
  due: day.default(''),
  /** 예상 시간 h */
  estHours: z.number().default(0),
  done: z.boolean().default(false),
  doneDate: day.default(''),
  memo: z.string().default(''),
  createdBy: z.string().default(''),
  createdDate: day.default(''),
  /** FP 세부 기능에서 미리 넣은 것 (§3.3 세부 작업 미리 넣기) */
  fromFp: z.boolean().default(false),
  order: z.number().default(0),
  /** 옛 업무 = 예전 WBS 번호 (예: "P2|5.24"). 있으면 '옛 업무' 기록으로만 — 지금 업무와 연결 없음 (11/24 사용자, §5.1.2) */
  legacyKey: z.string().default(''),
});
export type PmSubtask = z.infer<typeof pmSubtaskSchema>;

/** 완료 기록 (`pmTaskDone`) — 데모 `S.taskDone[key]`: 언제·누가·완료 전 % */
export const pmTaskDoneSchema = z.object({
  /** = taskId */
  id: z.string().min(1),
  date: day,
  by: z.string().default(''),
  prevPct: z.number().default(0),
});
export type PmTaskDone = z.infer<typeof pmTaskDoneSchema>;

/** 일정 기준선 (`pmBaselines`) — 사업 1개당 1개 (데모 `S.baselines[k]`) */
export const pmBaselineSchema = z.object({
  /** = projectId */
  id: z.string().min(1),
  date: day,
  by: z.string().default(''),
  label: z.string().default(''),
  /** taskId → 그때의 시작·종료·번호·이름 (번호·이름은 삭제된 업무 표시용) */
  map: z.record(z.string(), z.object({ start: z.string(), end: z.string(), code: z.string(), name: z.string() })),
});
export type PmBaseline = z.infer<typeof pmBaselineSchema>;

/** 변경 이력 (`pmChangeLogs`) — 데모 `S.wbsLog` */
export const pmChangeLogSchema = z.object({
  id: z.string().min(1),
  projectId: z.string(),
  code: z.string().default(''),
  kind: z.enum(['추가', '수정', '삭제', '기준선']),
  text: z.string().default(''),
  date: day,
  by: z.string().default(''),
});
export type PmChangeLog = z.infer<typeof pmChangeLogSchema>;

// ── 3-6 업무계획 (데모 S.plan · S.planRep · S.pdfDraft) ──
/**
 * 업무계획 한 줄 — 업무(taskId) · 세부 작업(taskId+subId) · 직접 쓴 일(text) 중 하나.
 * done = 오늘 할 몫 끝(세부 작업 줄은 세부 작업 완료가 기준) · pct = 직접 쓴 일의 진행률 · hours = 실제로 쓴 시간.
 * ticketNo · actionId = 티켓 · 회의 액션에서 가져온 줄 · from = 처음 계획한 날(넘어온 일) · rep = 반복 업무 · auto = 자동 초안
 */
export const pmPlanItemSchema = z.object({
  taskId: z.string().optional(),
  subId: z.string().optional(),
  text: z.string().optional(),
  done: z.boolean().optional(),
  memo: z.string().optional(),
  hours: z.number().optional(),
  pct: z.number().optional(),
  rep: z.boolean().optional(),
  ticketNo: z.string().optional(),
  actionId: z.string().optional(),
  from: z.string().optional(),
  auto: z.boolean().optional(),
});
export type PmPlanItem = z.infer<typeof pmPlanItemSchema>;

/** 그날 직접 고친 계획 (`pmPlans`) — 쓴 날만 저장. id = `${사용자 ID}|${날짜}` */
export const pmPlanDaySchema = z.object({
  id: z.string().min(1),
  who: z.string().min(1),
  date: day,
  items: z.array(pmPlanItemSchema).default([]),
});
export type PmPlanDay = z.infer<typeof pmPlanDaySchema>;

/** 반복 업무 (`pmPlanReps`) — 사람마다. wd = 요일(1 월 ~ 5 금). id = 사용자 ID */
export const pmPlanRepSchema = z.object({
  id: z.string().min(1),
  items: z.array(z.object({ wd: z.array(z.number()), text: z.string().min(1) })).default([]),
});
export type PmPlanRep = z.infer<typeof pmPlanRepSchema>;

/** 일일 업무 보고 임시저장 (`pmPdfDrafts`) — rows = [업무 내용, 비고, 진행상태]. id = `${사용자 ID}|${날짜}`. 30일 지나면 지움 */
export const pmPdfDraftSchema = z.object({
  id: z.string().min(1),
  who: z.string().min(1),
  date: day,
  dept: z.string().default(''),
  name: z.string().default(''),
  rows: z.array(z.tuple([z.string(), z.string(), z.string()])).default([]),
  /** 저장한 때 "11/25 14:03" */
  at: z.string().default(''),
});
export type PmPdfDraft = z.infer<typeof pmPdfDraftSchema>;
