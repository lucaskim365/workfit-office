import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { iqcLinkRepo, type IqcLinkFilter } from '@/data/iqcLink/iqcLink.repo';
import type { IqcLink } from '@/domain/iqcLink/schema';

/**
 * IQC 연동 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'iqcLinks';

/** IQC 연동 목록(필터 포함) 조회. */
export function useIqcLinks(filter?: IqcLinkFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => iqcLinkRepo.list(filter),
  });
}

/** IQC 연동 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveIqcLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: IqcLink) => iqcLinkRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
