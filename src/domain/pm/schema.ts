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
});
export type PmProject = z.infer<typeof pmProjectSchema>;

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
