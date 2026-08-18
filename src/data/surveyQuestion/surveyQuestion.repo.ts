import type { User } from '@/domain/user/schema';
import {
  surveyQuestionSchema,
  type SurveyQuestion,
  type SurveyQuestionDraft,
} from '@/domain/surveyQuestion/schema';
import {
  assertQuestionsEditable,
  assertQuestionSet,
  canManageSurvey,
  normalizeQuestionOrders,
  SurveyError,
} from '@/domain/survey/engine';
import { surveySchema } from '@/domain/survey/schema';
import {
  cloneQuestion,
  exclusive,
  loadSurveyStore,
  nextQuestionId,
  persistDocs,
  questionsOf,
  refreshSurveyStatuses,
  removeDocs,
  SURVEY_COLL,
  SURVEY_QUESTION_COLL,
  surveyStore,
} from '@/data/survey/store';

function requireManageableSurvey(actor: User, surveyId: string) {
  const survey = surveyStore.surveys.find((row) => row.id === surveyId);
  if (!survey) throw new SurveyError('INVALID_INPUT', '설문을 찾을 수 없습니다.');
  if (!canManageSurvey(actor, survey)) {
    throw new SurveyError('FORBIDDEN', '이 설문을 관리할 권한이 없습니다.');
  }
  return survey;
}

/**
 * 설문 질문 저장소.
 *
 * 초안은 화면 로컬 상태에서 편집한 뒤 저장 버튼으로 질문 전체를 한 번에 저장한다.
 * 부분 갱신 API를 두면 순서·선택지 정합성을 화면과 저장소가 나눠 갖게 되어
 * 카드 편집 UX와 어긋난다. ([[jwheo/feat/survey/DESIGN.md]] §8.1)
 */
export const surveyQuestionRepo = {
  async list(surveyId: string): Promise<SurveyQuestion[]> {
    await loadSurveyStore();
    return questionsOf(surveyId).map(cloneQuestion);
  },

  /**
   * 설문의 질문 목록을 통째로 교체한다.
   * 기존 질문 ID를 유지한 카드는 그대로 두어 저장된 응답의 참조를 깨뜨리지 않는다.
   */
  replaceAll(actor: User, surveyId: string, drafts: SurveyQuestionDraft[]): Promise<SurveyQuestion[]> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const survey = requireManageableSurvey(actor, surveyId);
      assertQuestionsEditable(survey);

      const ordered = normalizeQuestionOrders(drafts);
      const existing = new Map(questionsOf(surveyId).map((row) => [row.id, row]));
      const keptIds = new Set<string>();
      const stamp = new Date().toISOString();
      let created = 0;

      const next = ordered.map((draft) => {
        const previous = draft.id ? existing.get(draft.id) : undefined;
        if (draft.id && !previous) {
          throw new SurveyError('INVALID_INPUT', '이 설문에 없는 질문을 수정할 수 없습니다.');
        }
        if (previous) {
          if (keptIds.has(previous.id)) {
            throw new SurveyError('INVALID_INPUT', '같은 질문이 두 번 담겼습니다.');
          }
          keptIds.add(previous.id);
        }
        const id = previous?.id ?? nextQuestionId(created);
        if (!previous) created += 1;
        return surveyQuestionSchema.parse({
          ...draft,
          id,
          surveyId,
          options: draft.options.map((option) => ({ ...option })),
          createdAt: previous?.createdAt ?? stamp,
          updatedAt: stamp,
        });
      });

      assertQuestionSet(next);

      // 통째로 교체하므로 이번에 남지 않은 기존 질문은 저장소에서도 지운다.
      const removedIds = questionsOf(surveyId)
        .filter((row) => !next.some((item) => item.id === row.id))
        .map((row) => row.id);
      surveyStore.questions = [
        ...surveyStore.questions.filter((row) => row.surveyId !== surveyId),
        ...next,
      ];
      // 질문 구조가 바뀌면 응답 화면이 새 질문을 다시 불러오도록 version을 올린다. ([[DESIGN.md]] §13)
      const updated = surveySchema.parse({
        ...survey,
        questionCount: next.length,
        version: survey.version + 1,
        updatedAt: stamp,
      });
      surveyStore.surveys = surveyStore.surveys.map((row) => (row.id === surveyId ? updated : row));

      await persistDocs(SURVEY_QUESTION_COLL, next);
      await removeDocs(SURVEY_QUESTION_COLL, removedIds);
      await persistDocs(SURVEY_COLL, [updated]);

      return next.map(cloneQuestion);
    });
  },
};
