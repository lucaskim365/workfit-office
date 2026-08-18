import { z } from 'zod';

export const SURVEY_QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
] as const;

export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

/** 설문 하나당 질문 수 상한 — 제출 transaction 문서 수를 제한한다. ([[DESIGN.md]] §7.2 · §13) */
export const SURVEY_MAX_QUESTIONS = 100;
/** MVP 만족도 척도는 1~5점 고정. */
export const SURVEY_RATING_MIN = 1;
export const SURVEY_RATING_MAX = 5;
/** 질문에 maxLength가 없을 때 적용하는 기본 상한. */
export const SURVEY_SHORT_TEXT_MAX = 500;
export const SURVEY_LONG_TEXT_MAX = 2000;
/** 질문 order는 저장 전에 이 간격으로 재정렬한다. */
export const SURVEY_ORDER_STEP = 10;

export const CHOICE_QUESTION_TYPES: SurveyQuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
export const TEXT_QUESTION_TYPES: SurveyQuestionType[] = ['SHORT_TEXT', 'LONG_TEXT'];

export const isChoiceQuestion = (type: SurveyQuestionType) => CHOICE_QUESTION_TYPES.includes(type);
export const isTextQuestion = (type: SurveyQuestionType) => TEXT_QUESTION_TYPES.includes(type);

export const surveyOptionSchema = z.object({
  /** 설문 질문 안에서 고유. 표시 문구가 바뀌어도 응답 참조가 유지되도록 문구와 분리한다. */
  id: z.string().trim().min(1),
  label: z.string().trim().min(1, '선택지 문구를 입력하세요.').max(200),
  order: z.number().int().min(0),
});

export const surveyQuestionSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  type: z.enum(SURVEY_QUESTION_TYPES),
  title: z.string().trim().min(1, '질문 문구를 입력하세요.').max(300),
  description: z.string().trim().max(500),
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(surveyOptionSchema),
  ratingMinLabel: z.string().trim().max(30),
  ratingMaxLabel: z.string().trim().max(30),
  maxLength: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (isChoiceQuestion(value.type)) {
    if (value.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: '선택형 질문에는 선택지가 2개 이상 필요합니다.' });
    }
    const ids = value.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: '선택지 ID가 중복되었습니다.' });
    }
    const labels = value.options.map((option) => option.label);
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: '같은 문구의 선택지가 있습니다.' });
    }
  } else if (value.options.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: '이 질문 유형에는 선택지를 저장하지 않습니다.' });
  }

  if (value.type === 'RATING') {
    if (value.maxLength !== null) {
      ctx.addIssue({ code: 'custom', path: ['maxLength'], message: '만족도 질문에는 글자 수 제한을 저장하지 않습니다.' });
    }
  } else {
    if (value.ratingMinLabel !== '' || value.ratingMaxLabel !== '') {
      ctx.addIssue({ code: 'custom', path: ['ratingMinLabel'], message: '만족도 질문이 아니면 척도 문구를 저장하지 않습니다.' });
    }
    if (isChoiceQuestion(value.type) && value.maxLength !== null) {
      ctx.addIssue({ code: 'custom', path: ['maxLength'], message: '선택형 질문에는 글자 수 제한을 저장하지 않습니다.' });
    }
  }

  if (value.type === 'SHORT_TEXT' && value.maxLength !== null && value.maxLength > SURVEY_SHORT_TEXT_MAX) {
    ctx.addIssue({ code: 'custom', path: ['maxLength'], message: `단답형 글자 수는 ${SURVEY_SHORT_TEXT_MAX}자 이하로 설정하세요.` });
  }
  if (value.type === 'LONG_TEXT' && value.maxLength !== null && value.maxLength > SURVEY_LONG_TEXT_MAX) {
    ctx.addIssue({ code: 'custom', path: ['maxLength'], message: `장문형 글자 수는 ${SURVEY_LONG_TEXT_MAX}자 이하로 설정하세요.` });
  }
});

export type SurveyOption = z.infer<typeof surveyOptionSchema>;
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;

/** 편집 중인 질문 카드 — 저장 전 화면 로컬 상태. */
export type SurveyQuestionDraft = Omit<SurveyQuestion, 'id' | 'surveyId' | 'createdAt' | 'updatedAt'> & {
  /** 저장된 질문이면 기존 ID, 새로 추가한 카드면 null. */
  id: string | null;
};

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: '단일 선택',
  MULTIPLE_CHOICE: '복수 선택',
  SHORT_TEXT: '단답형',
  LONG_TEXT: '장문형',
  RATING: '만족도',
};

/** 질문 유형별 텍스트 상한 — maxLength 미지정 시 적용. */
export function questionTextLimit(question: Pick<SurveyQuestion, 'type' | 'maxLength'>): number {
  if (question.maxLength !== null) return question.maxLength;
  return question.type === 'SHORT_TEXT' ? SURVEY_SHORT_TEXT_MAX : SURVEY_LONG_TEXT_MAX;
}
