import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { maintOutsourcingRepo, type OsFilter } from '@/data/maintOutsourcing/maintOutsourcing.repo';
import type { MaintOutsourcing } from '@/domain/maintOutsourcing/schema';

/**
 * 보전 외주 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'maintOutsourcing';

/** 외주 의뢰 목록(상태·검색 필터) 조회. */
export function useMaintOutsourcing(filter?: OsFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => maintOutsourcingRepo.list(filter),
  });
}

/** 상태 전이(작업 착수·입고 대기·입고 완료). */
export function useTransitionOutsourcing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: MaintOutsourcing['state'] }) =>
      maintOutsourcingRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
