import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mrbCaseRepo, type MrbFilter } from '@/data/mrbCase/mrbCase.repo';
import type { MrbCase } from '@/domain/mrbCase/schema';

/**
 * MRB 부적합 심의 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'mrbCases';

/** MRB 심의 안건 목록(상태·검색 필터) 조회. */
export function useMrbCases(filter?: MrbFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => mrbCaseRepo.list(filter),
  });
}

/** 상태 전이(심의 시작·의결 확정·보류·심의 재개). */
export function useTransitionMrb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: MrbCase['status'] }) =>
      mrbCaseRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
