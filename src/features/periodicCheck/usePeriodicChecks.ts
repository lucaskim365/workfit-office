import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  periodicCheckRepo,
  type PeriodicCheckFilter,
} from '@/data/periodicCheck/periodicCheck.repo';
import type { PeriodicCheck } from '@/domain/periodicCheck/schema';

/**
 * 정기 점검(Periodic Check) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'periodicChecks';

/** 정기 점검 목록(판정·검색 필터) 조회. */
export function usePeriodicChecks(filter?: PeriodicCheckFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => periodicCheckRepo.list(filter),
  });
}

/** 상태 전이(점검 완료). */
export function useTransitionPeriodicCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: PeriodicCheck['status'] }) =>
      periodicCheckRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
