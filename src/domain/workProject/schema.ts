import { z } from 'zod';

export const WORK_PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export const WORK_VISIBILITIES = ['PRIVATE', 'TEAM', 'COMPANY'] as const;

/**
 * 사업 유형 — 대분류는 **발주처가 있는가**로 가른다.
 * ([[프로젝트관리_고도화_계획서.md]] §1)
 *
 * 정산·검수·보고 의무, 매출 인식, 산출물 소유권이 전부 이 경계에서 갈린다.
 * 국책이냐 민간이냐는 그 아래 재원 속성일 뿐이라 `fundingType` 으로 내렸다 —
 * `국책/수주/자체` 를 한 층에 두면 민간 수주가 갈 자리가 애매해진다.
 */
export const WORK_PROJECT_TYPES = ['CONTRACT', 'INTERNAL'] as const;

/** 재원 — 수주사업일 때만 쓴다. */
export const WORK_FUNDING_TYPES = ['GOVERNMENT', 'PRIVATE'] as const;

/**
 * 유형 도입 **전에 저장된 문서**를 읽을 수 있게 채워 준다.
 *
 * Appwrite에 속성을 추가해도 기존 문서에는 값이 없어 `null`로 내려온다. 그대로 두면
 * zod 파싱이 실패하고 `crudBackend`가 그 문서를 건너뛴다 — **에러 없이 프로젝트가
 * 목록에서 사라진다.** 이관 전에도 화면이 멀쩡해야 한다.
 *
 * 기본값은 자체사업이다. 계약 정보가 없는 문서를 수주사업으로 두면 "재원을 지정해야
 * 한다"는 규칙에 걸려 또 사라진다.
 */
function fillLegacyProjectFields(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (row.projectType !== 'CONTRACT' && row.projectType !== 'INTERNAL') row.projectType = 'INTERNAL';
  for (const key of ['fundingType', 'clientName', 'contractNo', 'contractStartAt', 'contractEndAt']) {
    if (row[key] === undefined) row[key] = null;
  }
  return row;
}

export const workProjectSchema = z.preprocess(fillLegacyProjectFields, z.object({
  id: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  code: z.string().trim().min(1, '프로젝트 코드를 입력하세요.').max(30),
  name: z.string().trim().min(1, '프로젝트명을 입력하세요.').max(100),
  description: z.string().trim().max(2_000),
  ownerUserId: z.string().min(1),
  memberUserIds: z.array(z.string().min(1)).min(1),
  deptId: z.string().nullable(),
  visibility: z.enum(WORK_VISIBILITIES),
  status: z.enum(WORK_PROJECT_STATUSES),
  /** 수주사업 / 자체사업. 트랙 구성을 제약하지 않는다 — 유형과 트랙은 직교한다. */
  projectType: z.enum(WORK_PROJECT_TYPES),
  /** 재원. 자체사업이면 반드시 null. */
  fundingType: z.enum(WORK_FUNDING_TYPES).nullable(),
  /** 발주처. 자체사업이면 반드시 null. */
  clientName: z.string().trim().max(100).nullable(),
  contractNo: z.string().trim().max(60).nullable(),
  contractStartAt: z.string().datetime().nullable(),
  contractEndAt: z.string().datetime().nullable(),
  startAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.'),
  chatRoomId: z.string().nullable(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (!value.memberUserIds.includes(value.ownerUserId)) {
    ctx.addIssue({ code: 'custom', path: ['memberUserIds'], message: '프로젝트 소유자는 참여자에 포함되어야 합니다.' });
  }
  if (new Set(value.memberUserIds).size !== value.memberUserIds.length) {
    ctx.addIssue({ code: 'custom', path: ['memberUserIds'], message: '프로젝트 참여자를 중복 지정할 수 없습니다.' });
  }
  if (value.startAt && value.dueAt && value.startAt > value.dueAt) {
    ctx.addIssue({ code: 'custom', path: ['dueAt'], message: '프로젝트 종료일은 시작일보다 빠를 수 없습니다.' });
  }

  // ── 계약 정보는 수주사업에만 ──
  // 자체사업인데 발주처가 적힌 데이터가 생기면 리포트의 유형별 소계가 어긋난다.
  if (value.projectType === 'INTERNAL') {
    if (value.fundingType !== null) {
      ctx.addIssue({ code: 'custom', path: ['fundingType'], message: '자체사업에는 재원 구분을 둘 수 없습니다.' });
    }
    if (value.clientName !== null) {
      ctx.addIssue({ code: 'custom', path: ['clientName'], message: '자체사업에는 발주처를 둘 수 없습니다.' });
    }
    if (value.contractNo !== null) {
      ctx.addIssue({ code: 'custom', path: ['contractNo'], message: '자체사업에는 계약번호를 둘 수 없습니다.' });
    }
  } else if (value.fundingType === null) {
    ctx.addIssue({ code: 'custom', path: ['fundingType'], message: '수주사업은 재원(국책·민간)을 지정해야 합니다.' });
  }

  if (value.contractStartAt && value.contractEndAt && value.contractStartAt > value.contractEndAt) {
    ctx.addIssue({ code: 'custom', path: ['contractEndAt'], message: '계약 종료일은 시작일보다 빠를 수 없습니다.' });
  }
}));

export type WorkProject = z.infer<typeof workProjectSchema>;
export type WorkProjectStatus = (typeof WORK_PROJECT_STATUSES)[number];
export type WorkVisibility = (typeof WORK_VISIBILITIES)[number];
export type WorkProjectType = (typeof WORK_PROJECT_TYPES)[number];
export type WorkFundingType = (typeof WORK_FUNDING_TYPES)[number];

export type WorkProjectDraft = Omit<WorkProject, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

export const WORK_PROJECT_STATUS_LABELS: Record<WorkProjectStatus, string> = {
  PLANNING: '계획',
  ACTIVE: '진행',
  ON_HOLD: '보류',
  COMPLETED: '완료',
  ARCHIVED: '보관',
};

export const WORK_PROJECT_TYPE_LABELS: Record<WorkProjectType, string> = {
  CONTRACT: '수주사업',
  INTERNAL: '자체사업',
};

export const WORK_FUNDING_TYPE_LABELS: Record<WorkFundingType, string> = {
  GOVERNMENT: '국책',
  PRIVATE: '민간',
};

/** 화면·리포트에 쓰는 한 줄 표기. 수주사업만 재원을 괄호로 붙인다. */
export function projectTypeLabel(project: Pick<WorkProject, 'projectType' | 'fundingType'>): string {
  const base = WORK_PROJECT_TYPE_LABELS[project.projectType];
  return project.fundingType ? `${base}·${WORK_FUNDING_TYPE_LABELS[project.fundingType]}` : base;
}
