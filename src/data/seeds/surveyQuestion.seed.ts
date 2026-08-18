import type { SurveyQuestion } from '@/domain/surveyQuestion/schema';

/**
 * 설문 질문 fixture. 질문 ID는 `surveyQuestions` 컬렉션 전체에서 고유해야 한다.
 * ([[jwheo/feat/survey/DESIGN.md]] §17.2)
 */
const AT = '2026-08-11T05:00:00.000Z';

const base = {
  description: '',
  options: [],
  ratingMinLabel: '',
  ratingMaxLabel: '',
  maxLength: null,
  createdAt: AT,
  updatedAt: AT,
};

const rating = { ...base, options: [], ratingMinLabel: '매우 불만족', ratingMaxLabel: '매우 만족' };

export const SURVEY_QUESTION_SEED: SurveyQuestion[] = [
  // SUR-20260811-0001 — 업무환경 만족도 (전사·익명)
  {
    ...rating,
    id: 'Q-0001', surveyId: 'SUR-20260811-0001', type: 'RATING',
    title: '현재 업무환경에 전반적으로 만족하십니까?', required: true, order: 10,
  },
  {
    ...base,
    id: 'Q-0002', surveyId: 'SUR-20260811-0001', type: 'SINGLE_CHOICE',
    title: '가장 개선이 필요한 영역은 무엇입니까?', required: true, order: 20,
    options: [
      { id: 'OPT-01', label: '업무 도구', order: 10 },
      { id: 'OPT-02', label: '회의 문화', order: 20 },
      { id: 'OPT-03', label: '복리후생', order: 30 },
      { id: 'OPT-04', label: '사내 소통', order: 40 },
    ],
  },
  {
    ...base,
    id: 'Q-0003', surveyId: 'SUR-20260811-0001', type: 'MULTIPLE_CHOICE',
    title: '업무에 도움이 되는 제도를 모두 선택해 주세요.', required: false, order: 30,
    options: [
      { id: 'OPT-01', label: '유연근무', order: 10 },
      { id: 'OPT-02', label: '재택근무', order: 20 },
      { id: 'OPT-03', label: '교육비 지원', order: 30 },
      { id: 'OPT-04', label: '도서 구입 지원', order: 40 },
    ],
  },
  {
    ...base,
    id: 'Q-0004', surveyId: 'SUR-20260811-0001', type: 'LONG_TEXT',
    title: '개선 의견을 자유롭게 작성해 주세요.',
    description: '특정 개인을 지목하는 내용은 남기지 말아 주세요.',
    required: false, order: 40, maxLength: 2000,
  },

  // SUR-20260812-0002 — 사내교육 수요 (부서 대상·기명)
  {
    ...base,
    id: 'Q-0005', surveyId: 'SUR-20260812-0002', type: 'MULTIPLE_CHOICE',
    title: '3분기에 수강하고 싶은 과정을 모두 선택해 주세요.', required: true, order: 10,
    options: [
      { id: 'OPT-01', label: '데이터 분석 기초', order: 10 },
      { id: 'OPT-02', label: '클라우드 인프라', order: 20 },
      { id: 'OPT-03', label: '품질 경영 실무', order: 30 },
      { id: 'OPT-04', label: '보고서 작성법', order: 40 },
    ],
  },
  {
    ...base,
    id: 'Q-0006', surveyId: 'SUR-20260812-0002', type: 'SHORT_TEXT',
    title: '위 목록에 없는 희망 과정이 있으면 적어 주세요.', required: false, order: 20, maxLength: 100,
  },

  // SUR-20260812-0003 — 창립기념일 행사 (초안)
  {
    ...base,
    id: 'Q-0007', surveyId: 'SUR-20260812-0003', type: 'SINGLE_CHOICE',
    title: '선호하는 행사 형태를 골라 주세요.', required: true, order: 10,
    options: [
      { id: 'OPT-01', label: '사내 오찬', order: 10 },
      { id: 'OPT-02', label: '워크숍', order: 20 },
      { id: 'OPT-03', label: '기념품 지급', order: 30 },
    ],
  },
  {
    ...base,
    id: 'Q-0008', surveyId: 'SUR-20260812-0003', type: 'SHORT_TEXT',
    title: '희망하는 기념품이 있으면 적어 주세요.', required: false, order: 20, maxLength: 100,
  },

  // SUR-20260720-0004 — 그룹웨어 사용성 (마감)
  {
    ...rating,
    id: 'Q-0009', surveyId: 'SUR-20260720-0004', type: 'RATING',
    title: '새 그룹웨어의 사용성에 만족하십니까?', required: true, order: 10,
  },
  {
    ...base,
    id: 'Q-0010', surveyId: 'SUR-20260720-0004', type: 'LONG_TEXT',
    title: '불편했던 점을 알려 주세요.', required: false, order: 20, maxLength: 1000,
  },
];
