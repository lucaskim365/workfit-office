import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lotSplitRepo, type LotSplitFilter } from '@/data/lotSplit/lotSplit.repo';
import type { LotSplit } from '@/domain/lotSplit/schema';

/**
 * LOT 분할/병합 이력 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'lotSplits';

/** 분할/병합 이력 목록(필터 포함) 조회. */
export function useLotSplits(filter?: LotSplitFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => lotSplitRepo.list(filter),
  });
}

/** 분할/병합 이력 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveLotSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: LotSplit) => lotSplitRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
