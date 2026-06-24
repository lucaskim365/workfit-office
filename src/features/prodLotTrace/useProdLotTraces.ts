import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prodLotTraceRepo, type ProdLotTraceFilter } from '@/data/prodLotTrace/prodLotTrace.repo';
import type { ProdLotTrace } from '@/domain/prodLotTrace/schema';

/**
 * 생산 LOT 추적(투입자재) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'prodLotTraces';

/** 투입자재 계보 목록(필터 포함) 조회. */
export function useProdLotTraces(filter?: ProdLotTraceFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => prodLotTraceRepo.list(filter),
  });
}

/** 투입자재 계보 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveProdLotTrace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProdLotTrace) => prodLotTraceRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
