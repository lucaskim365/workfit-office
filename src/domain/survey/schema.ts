import { z } from 'zod';

export const SURVEY_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED'] as const;
export const SURVEY_AUDIENCE_TYPES = ['COMPANY', 'DEPARTMENT', 'USERS'] as const;

/**
 * 설문 기본정보. 질문·응답·참여기록은 별도 컬렉션으로 분리한다.
 * ([[jwheo/feat/survey/DESIGN.md]] §7.1)
 */
export const surveySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, '설문 제목을 입력하세요.').max(100),
  description: z.string().trim().max(1000),
  categoryCode: z.string().trim().min(1, '설문 분류를 선택하세요.'),
  ownerUserId: z.string().min(1),
  status: z.enum(SURVEY_STATUSES),
  audienceType: z.enum(SURVEY_AUDIENCE_TYPES),
  audienceDeptIds: z.array(z.string()),
  audienceUserIds: z.array(z.string()),
  anonymous: z.boolean(),
  /**
   * 응답 기간. 초안 단계에서는 비어 있을 수 있고, 배포 시점에 반드시 채워진다.
   * 설문 복제가 기간을 비운 새 초안을 만들기 때문이다. ([[DESIGN.md]] §8.4)
   */
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  showResultToRespondent: z.boolean(),
  /** 목록 성능용 비정규화 값 — 질문·응답 쓰기 서비스에서 함께 갱신한다. */
  questionCount: z.number().int().min(0),
  responseCount: z.number().int().min(0),
  publishedAt: z.string().datetime().nullable(),
  /** 첫 응답 시각. 값이 있으면 질문 구조가 잠긴다. */
  firstRespondedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (value.startsAt !== null && value.endsAt !== null && value.startsAt >= value.endsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: '마감일시는 시작일시보다 늦어야 합니다.' });
  }
  if (value.status !== 'DRAFT' && (value.startsAt === null || value.endsAt === null)) {
    ctx.addIssue({ code: 'custom', path: ['startsAt'], message: '배포된 설문에는 응답 기간이 필요합니다.' });
  }
  if (value.audienceType === 'COMPANY' && (value.audienceDeptIds.length > 0 || value.audienceUserIds.length > 0)) {
    ctx.addIssue({ code: 'custom', path: ['audienceType'], message: '전사 대상 설문에는 부서·사용자를 지정하지 않습니다.' });
  }
  // 대상 미선택은 작성 중인 초안에서만 허용한다. 배포 시 assertPublishable이 다시 막는다.
  if (value.status !== 'DRAFT' && value.audienceType === 'DEPARTMENT' && value.audienceDeptIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['audienceDeptIds'], message: '대상 부서를 한 개 이상 선택하세요.' });
  }
  if (value.audienceType === 'DEPARTMENT' && value.audienceUserIds.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['audienceUserIds'], message: '부서 대상 설문에는 개별 사용자를 지정하지 않습니다.' });
  }
  if (value.status !== 'DRAFT' && value.audienceType === 'USERS' && value.audienceUserIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['audienceUserIds'], message: '대상 사용자를 한 명 이상 선택하세요.' });
  }
  if (value.audienceType === 'USERS' && value.audienceDeptIds.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['audienceDeptIds'], message: '사용자 대상 설문에는 부서를 지정하지 않습니다.' });
  }
  if (new Set(value.audienceDeptIds).size !== value.audienceDeptIds.length) {
    ctx.addIssue({ code: 'custom', path: ['audienceDeptIds'], message: '중복된 대상 부서가 있습니다.' });
  }
  if (new Set(value.audienceUserIds).size !== value.audienceUserIds.length) {
    ctx.addIssue({ code: 'custom', path: ['audienceUserIds'], message: '중복된 대상 사용자가 있습니다.' });
  }
  if (value.status !== 'DRAFT' && !value.publishedAt) {
    ctx.addIssue({ code: 'custom', path: ['publishedAt'], message: '배포된 설문에는 배포 일시가 필요합니다.' });
  }
  if (value.status === 'DRAFT' && value.publishedAt) {
    ctx.addIssue({ code: 'custom', path: ['publishedAt'], message: '초안에는 배포 일시를 저장하지 않습니다.' });
  }
  if (value.status === 'DRAFT' && value.responseCount > 0) {
    ctx.addIssue({ code: 'custom', path: ['responseCount'], message: '초안에는 응답이 있을 수 없습니다.' });
  }
  if ((value.responseCount > 0) !== (value.firstRespondedAt !== null)) {
    ctx.addIssue({ code: 'custom', path: ['firstRespondedAt'], message: '응답 수와 첫 응답 일시가 일치하지 않습니다.' });
  }
});

/** 설문 기본정보 입력값 — 시스템 필드와 파생 카운터를 제외한 편집 대상. */
export const surveyDraftSchema = z.object({
  title: z.string().trim().min(1, '설문 제목을 입력하세요.').max(100),
  description: z.string().trim().max(1000),
  categoryCode: z.string().trim().min(1, '설문 분류를 선택하세요.'),
  audienceType: z.enum(SURVEY_AUDIENCE_TYPES),
  audienceDeptIds: z.array(z.string()),
  audienceUserIds: z.array(z.string()),
  anonymous: z.boolean(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  showResultToRespondent: z.boolean(),
});

export type Survey = z.infer<typeof surveySchema>;
export type SurveyDraft = z.infer<typeof surveyDraftSchema>;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];
export type SurveyAudienceType = (typeof SURVEY_AUDIENCE_TYPES)[number];

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  DRAFT: '초안',
  SCHEDULED: '예정',
  ACTIVE: '진행',
  CLOSED: '마감',
  ARCHIVED: '보관',
};

export const SURVEY_AUDIENCE_TYPE_LABELS: Record<SurveyAudienceType, string> = {
  COMPANY: '전사',
  DEPARTMENT: '부서',
  USERS: '특정 사용자',
};
