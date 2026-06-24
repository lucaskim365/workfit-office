import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { andonStatusRepo, type AndonStatusFilter } from '@/data/andonStatus/andonStatus.repo';
import type { AndonStatus } from '@/domain/andonStatus/schema';

/**
 * 설비 안돈 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'andonStatus';

/** 설비 안돈 목록(필터 포함) 조회. */
export function useAndonStatus(filter?: AndonStatusFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => andonStatusRepo.list(filter),
  });
}

/** 설비 안돈 상태 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveAndonStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: AndonStatus) => andonStatusRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
