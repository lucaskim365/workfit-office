import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pqcFmlRepo, type PqcFmlFilter } from '@/data/pqcFml/pqcFml.repo';
import type { PqcFml } from '@/domain/pqcFml/schema';

/**
 * PQC 초·중·종물 검사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pqcFmlChecks';

/** PQC 초·중·종물 검사 목록(필터 포함) 조회. */
export function usePqcFmlChecks(filter?: PqcFmlFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pqcFmlRepo.list(filter),
  });
}

/** PQC 초·중·종물 검사 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePqcFml() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: PqcFml) => pqcFmlRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
