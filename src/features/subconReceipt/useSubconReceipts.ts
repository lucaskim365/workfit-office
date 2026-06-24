import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subconReceiptRepo, type SubconReceiptFilter } from '@/data/subconReceipt/subconReceipt.repo';
import type { SubconReceipt } from '@/domain/subconReceipt/schema';

/**
 * 외주 입고(외주 지시) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'subconReceipts';

/** 외주 지시 목록(필터 포함) 조회. */
export function useSubconReceipts(filter?: SubconReceiptFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => subconReceiptRepo.list(filter),
  });
}

/** 외주 지시 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSubconReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubconReceipt) => subconReceiptRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
