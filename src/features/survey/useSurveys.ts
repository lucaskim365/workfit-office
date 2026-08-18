import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { surveyRepo, type SurveyFilter } from '@/data/survey/survey.repo';
import { surveyQuestionRepo } from '@/data/surveyQuestion/surveyQuestion.repo';
import type { SurveyDraft } from '@/domain/survey/schema';
import type { SurveyQuestionDraft } from '@/domain/surveyQuestion/schema';
import type { User } from '@/domain/user/schema';

const SURVEY_KEY = 'gw-surveys';
const QUESTION_KEY = 'gw-survey-questions';

export function useSurveys(filter?: SurveyFilter) {
  return useQuery({ queryKey: [SURVEY_KEY, filter ?? null], queryFn: () => surveyRepo.list(filter) });
}

/** 내가 만든 설문. 작성자 본인 기준 목록. */
export function useMySurveys(actor: User | null, filter?: Omit<SurveyFilter, 'ownerUserId'>) {
  return useQuery({
    queryKey: [SURVEY_KEY, 'mine', actor?.id ?? null, filter ?? null],
    queryFn: () => surveyRepo.list({ ...filter, ownerUserId: actor?.id }),
    enabled: actor !== null,
  });
}

export function useSurvey(id: string | null) {
  return useQuery({
    queryKey: [SURVEY_KEY, 'detail', id],
    queryFn: () => surveyRepo.get(id as string),
    enabled: id !== null,
  });
}

export function useSurveyQuestions(surveyId: string | null) {
  return useQuery({
    queryKey: [QUESTION_KEY, surveyId],
    queryFn: () => surveyQuestionRepo.list(surveyId as string),
    enabled: surveyId !== null,
  });
}

/** 설문·질문 목록은 questionCount·version 비정규화 때문에 항상 함께 무효화한다. */
function useSurveyMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SURVEY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUESTION_KEY] });
    },
  });
}

export function useCreateSurveyDraft() {
  return useSurveyMutation(({ actor, draft }: { actor: User; draft: SurveyDraft }) =>
    surveyRepo.createDraft(actor, draft));
}

export function useUpdateSurveyBasics() {
  return useSurveyMutation(({ actor, id, draft }: { actor: User; id: string; draft: SurveyDraft }) =>
    surveyRepo.updateBasics(actor, id, draft));
}

export function useSaveSurveyQuestions() {
  return useSurveyMutation(({ actor, surveyId, drafts }: { actor: User; surveyId: string; drafts: SurveyQuestionDraft[] }) =>
    surveyQuestionRepo.replaceAll(actor, surveyId, drafts));
}

export function usePublishSurvey() {
  return useSurveyMutation(({ actor, id }: { actor: User; id: string }) => surveyRepo.publish(actor, id));
}

export function useCloseSurvey() {
  return useSurveyMutation(({ actor, id }: { actor: User; id: string }) => surveyRepo.close(actor, id));
}

export function useArchiveSurvey() {
  return useSurveyMutation(({ actor, id }: { actor: User; id: string }) => surveyRepo.archive(actor, id));
}

export function useDuplicateSurvey() {
  return useSurveyMutation(({ actor, id }: { actor: User; id: string }) => surveyRepo.duplicate(actor, id));
}

export function useRemoveSurvey() {
  return useSurveyMutation(({ actor, id }: { actor: User; id: string }) => surveyRepo.remove(actor, id));
}
