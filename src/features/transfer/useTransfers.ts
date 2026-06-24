import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transferRepo, type TransferFilter } from '@/data/transfer/transfer.repo';
import type { Transfer } from '@/domain/transfer/schema';

/**
 * 재고 이송 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'transfers';

/** 이송 목록(필터 포함) 조회. */
export function useTransfers(filter?: TransferFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => transferRepo.list(filter),
  });
}

/** 이송 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Transfer) => transferRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
