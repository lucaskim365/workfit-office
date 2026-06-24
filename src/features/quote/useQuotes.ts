import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quoteRepo, type QuoteFilter } from '@/data/quote/quote.repo';
import type { Quote } from '@/domain/quote/schema';

/**
 * 영업 견적 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'quotes';

/** 견적 목록(필터 포함) 조회. */
export function useQuotes(filter?: QuoteFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => quoteRepo.list(filter),
  });
}

/** 견적 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Quote) => quoteRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
