import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moldRepairRepo, type MoldRepairFilter } from '@/data/moldRepair/moldRepair.repo';
import type { MoldRepair } from '@/domain/moldRepair/schema';

/**
 * 금형 수리/세척 이력 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'moldRepairs';

/** 금형 수리/세척 이력 목록(필터 포함) 조회. */
export function useMoldRepairs(filter?: MoldRepairFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => moldRepairRepo.list(filter),
  });
}

/** 금형 수리/세척 이력 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMoldRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MoldRepair) => moldRepairRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
