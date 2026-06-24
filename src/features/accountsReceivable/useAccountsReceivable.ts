import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountsReceivableRepo, type AccountsReceivableFilter } from '@/data/accountsReceivable/accountsReceivable.repo';
import type { AccountsReceivable } from '@/domain/accountsReceivable/schema';

/**
 * 채권(미수금) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'accountsReceivable';

/** 채권 목록(필터 포함) 조회. */
export function useAccountsReceivable(filter?: AccountsReceivableFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => accountsReceivableRepo.list(filter),
  });
}

/** 채권 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveAccountsReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: AccountsReceivable) => accountsReceivableRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
