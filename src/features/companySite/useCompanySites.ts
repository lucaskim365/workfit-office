import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companySiteRepo, type CompanySiteFilter } from '@/data/companySite/companySite.repo';
import type { CompanySite } from '@/domain/companySite/schema';

/**
 * 회사 사업장 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'companySites';

/** 회사 사업장 목록(필터 포함) 조회. */
export function useCompanySites(filter?: CompanySiteFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => companySiteRepo.list(filter),
  });
}

/** 회사 사업장 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCompanySite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CompanySite) => companySiteRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
