import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pqcSelfRepo, type PqcSelfFilter } from '@/data/pqcSelf/pqcSelf.repo';
import type { PqcSelf } from '@/domain/pqcSelf/schema';

/**
 * PQC 자주검사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pqcSelfChecks';

/** PQC 자주검사 목록(필터 포함) 조회. */
export function usePqcSelfChecks(filter?: PqcSelfFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pqcSelfRepo.list(filter),
  });
}

/** PQC 자주검사 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePqcSelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: PqcSelf) => pqcSelfRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
