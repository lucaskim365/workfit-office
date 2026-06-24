import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { palletRepo, type PalletFilter } from '@/data/pallet/pallet.repo';
import type { Pallet } from '@/domain/pallet/schema';

/**
 * 파렛트/용기 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pallets';

/** 파렛트/용기 목록(필터 포함) 조회. */
export function usePallets(filter?: PalletFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => palletRepo.list(filter),
  });
}

/** 파렛트/용기 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Pallet) => palletRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
