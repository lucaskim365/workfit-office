import { z } from 'zod';

/**
 * 참여 기록. 익명 설문에서 응답에 사용자 ID를 저장하지 않으면서도
 * 1인 1회 응답을 강제하기 위한 별도 문서다.
 *
 * `responseId`를 저장하지 않는 것이 익명성의 핵심이다. participation과 response를
 * 연결할 수 있는 값은 어느 쪽에도 두지 않는다.
 * ([[jwheo/feat/survey/DESIGN.md]] §7.5)
 */
export const surveyParticipationSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  userId: z.string().min(1),
  responded: z.boolean(),
  respondedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (value.id !== surveyParticipationId(value.surveyId, value.userId)) {
    ctx.addIssue({ code: 'custom', path: ['id'], message: '참여 기록 ID는 설문ID__사용자ID 형식이어야 합니다.' });
  }
});

export type SurveyParticipation = z.infer<typeof surveyParticipationSchema>;

/** 중복 제출 경쟁에서 문서가 하나만 생성되도록 ID를 결정적으로 만든다. */
export function surveyParticipationId(surveyId: string, userId: string): string {
  return `${surveyId}__${userId}`;
}
