import { z } from 'zod';

/**
 * 응답 1건. 익명 설문에서는 응답자와 부서를 저장하지 않는다.
 * IP·브라우저 지문 등 우회 식별 정보도 저장 대상이 아니다.
 * ([[jwheo/feat/survey/DESIGN.md]] §7.3)
 */
export const surveyResponseSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  respondentUserId: z.string().min(1).nullable(),
  respondentDeptId: z.string().min(1).nullable(),
  /** 응답 시점의 설문 version. 질문 구조가 바뀌면 통계 기준을 구분한다. */
  surveyVersion: z.number().int().min(1),
  submittedAt: z.string().datetime(),
});

export type SurveyResponse = z.infer<typeof surveyResponseSchema>;

/** 익명 응답에 사용자 식별자가 섞이지 않았는지 최종 확인한다. */
export function assertAnonymousResponse(row: SurveyResponse): void {
  if (row.respondentUserId !== null || row.respondentDeptId !== null) {
    throw new Error('익명 설문 응답에는 사용자·부서를 저장할 수 없습니다.');
  }
}
