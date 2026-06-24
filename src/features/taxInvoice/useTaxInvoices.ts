import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taxInvoiceRepo, type TaxInvoiceFilter } from '@/data/taxInvoice/taxInvoice.repo';
import type { TaxInvoice } from '@/domain/taxInvoice/schema';

/**
 * 세금계산서 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'taxInvoices';

/** 세금계산서 목록(필터 포함) 조회. */
export function useTaxInvoices(filter?: TaxInvoiceFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => taxInvoiceRepo.list(filter),
  });
}

/** 세금계산서 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveTaxInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: TaxInvoice) => taxInvoiceRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
