import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pqcPatrolRepo, type PqcPatrolFilter } from '@/data/pqcPatrol/pqcPatrol.repo';
import type { PqcPatrol } from '@/domain/pqcPatrol/schema';

/**
 * PQC 공정 순회(Patrol) 검사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pqcPatrols';

/** 순회 라운드 목록(필터 포함) 조회. */
export function usePqcPatrols(filter?: PqcPatrolFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pqcPatrolRepo.list(filter),
  });
}

/** 순회 라운드 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePqcPatrol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (round: PqcPatrol) => pqcPatrolRepo.save(round),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
