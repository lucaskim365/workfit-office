import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Department } from '@/domain/department/schema';
import type { User } from '@/domain/user/schema';
import { surveyRepo } from '@/data/survey/survey.repo';
import { surveyResponseRepo, type SurveySubmission } from '@/data/surveyResponse/surveyResponse.repo';

const RESPONDENT_KEY = 'gw-survey-respondent';
const PARTICIPATION_KEY = 'gw-survey-participations';
const RESULT_KEY = 'gw-survey-result';

/**
 * `users.dept`는 표준 부서명 문자열이고 설문 대상은 부서 ID로 저장된다.
 * 부서 대상 판정 전에 이름을 ID로 해석한다. 매칭되는 부서가 없으면 null.
 */
export function resolveUserDeptId(departments: Department[], user: User | null): string | null {
  if (!user) return null;
  return departments.find((dept) => dept.name === user.dept)?.id ?? null;
}

/** 참여할 설문 — 대상 진행 중 설문과 이미 참여한 설문. */
export function useRespondentSurveys(actor: User | null, actorDeptId: string | null) {
  return useQuery({
    queryKey: [RESPONDENT_KEY, actor?.id ?? null, actorDeptId],
    queryFn: () => surveyRepo.listForRespondent(actor as User, actorDeptId),
    enabled: actor !== null,
  });
}

/** 현재 사용자가 참여한 설문 ID 목록. 응답 내용은 담기지 않는다. */
export function useMyParticipations(actor: User | null) {
  return useQuery({
    queryKey: [PARTICIPATION_KEY, actor?.id ?? null],
    queryFn: () => surveyResponseRepo.participatedSurveyIds(actor?.id as string),
    enabled: actor !== null,
  });
}

/**
 * 결과 집계 원본. 권한이 없으면 저장소가 `FORBIDDEN`으로 거절하므로 재시도하지 않는다.
 *
 * 사용자마다 볼 수 있는지가 달라 `actor.id`를 키에 포함한다.
 */
export function useSurveyResult(actor: User | null, surveyId: string | null) {
  return useQuery({
    queryKey: [RESULT_KEY, surveyId, actor?.id ?? null],
    queryFn: () => surveyResponseRepo.readResult(actor as User, surveyId as string),
    enabled: actor !== null && surveyId !== null,
    retry: false,
  });
}

export function useSubmitSurveyResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actor, actorDeptId, submission }: {
      actor: User;
      actorDeptId: string | null;
      submission: SurveySubmission;
    }) => surveyResponseRepo.submit(actor, actorDeptId, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESPONDENT_KEY] });
      queryClient.invalidateQueries({ queryKey: [PARTICIPATION_KEY] });
      queryClient.invalidateQueries({ queryKey: [RESULT_KEY] });
      queryClient.invalidateQueries({ queryKey: ['gw-surveys'] });
    },
  });
}
