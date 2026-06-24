import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fifoRuleRepo, type FifoRuleFilter } from '@/data/fifoRule/fifoRule.repo';
import type { FifoRule } from '@/domain/fifoRule/schema';

/**
 * FIFO 출고규칙 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'fifoRules';

/** FIFO 출고규칙 목록(필터 포함) 조회. */
export function useFifoRules(filter?: FifoRuleFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => fifoRuleRepo.list(filter),
  });
}

/** FIFO 출고규칙 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveFifoRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: FifoRule) => fifoRuleRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
