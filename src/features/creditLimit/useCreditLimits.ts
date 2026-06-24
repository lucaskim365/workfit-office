import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { creditLimitRepo, type CreditLimitFilter } from '@/data/creditLimit/creditLimit.repo';
import type { CreditLimit } from '@/domain/creditLimit/schema';

/**
 * 여신한도 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'creditLimits';

/** 여신한도 목록(필터 포함) 조회. */
export function useCreditLimits(filter?: CreditLimitFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => creditLimitRepo.list(filter),
  });
}

/** 여신한도 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCreditLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CreditLimit) => creditLimitRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
