import { z } from 'zod';
import { SURVEY_RATING_MAX, SURVEY_RATING_MIN } from '@/domain/surveyQuestion/schema';

/**
 * 답변 1건. 질문 유형별로 하나의 값 영역만 사용한다.
 * ([[jwheo/feat/survey/DESIGN.md]] §7.4)
 */
export const surveyAnswerSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  responseId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)),
  textValue: z.string().nullable(),
  ratingValue: z.number().int().min(SURVEY_RATING_MIN).max(SURVEY_RATING_MAX).nullable(),
  createdAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  const filled = [
    value.selectedOptionIds.length > 0,
    value.textValue !== null,
    value.ratingValue !== null,
  ].filter(Boolean).length;
  if (filled !== 1) {
    ctx.addIssue({ code: 'custom', path: ['questionId'], message: '답변은 질문 유형에 맞는 값 하나만 저장합니다.' });
  }
  if (new Set(value.selectedOptionIds).size !== value.selectedOptionIds.length) {
    ctx.addIssue({ code: 'custom', path: ['selectedOptionIds'], message: '같은 선택지를 중복 선택했습니다.' });
  }
});

export type SurveyAnswer = z.infer<typeof surveyAnswerSchema>;

/** 제출 요청에 실려오는 답변 입력값 — 서버가 질문 목록과 대조해 검증한다. */
export const surveyAnswerInputSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).default([]),
  textValue: z.string().nullable().default(null),
  ratingValue: z.number().nullable().default(null),
});

export type SurveyAnswerInput = z.infer<typeof surveyAnswerInputSchema>;
