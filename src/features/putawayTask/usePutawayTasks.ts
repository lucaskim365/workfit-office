import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { putawayTaskRepo, type PutawayTaskFilter } from '@/data/putawayTask/putawayTask.repo';
import type { PutawayTask } from '@/domain/putawayTask/schema';

/**
 * 입고 적치 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'putawayTasks';

/** 입고 적치 목록(필터 포함) 조회. */
export function usePutawayTasks(filter?: PutawayTaskFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => putawayTaskRepo.list(filter),
  });
}

/** 입고 적치 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePutawayTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: PutawayTask) => putawayTaskRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
