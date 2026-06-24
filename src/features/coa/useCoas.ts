import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coaRepo, type CoaFilter } from '@/data/coa/coa.repo';
import type { Coa } from '@/domain/coa/schema';

/**
 * 출하 성적서(COA) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'coaCertificates';

/** COA 목록(상태·검색 필터) 조회. */
export function useCoas(filter?: CoaFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => coaRepo.list(filter),
  });
}

/** 상태 전이(발행 확정·이메일 전송). */
export function useTransitionCoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: Coa['status'] }) => coaRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
