import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subconIssueRepo, type SubconIssueFilter } from '@/data/subconIssue/subconIssue.repo';
import type { SubconIssue } from '@/domain/subconIssue/schema';

/**
 * 외주 자재불출 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'subconIssues';

/** 외주 지시 목록(필터 포함) 조회. */
export function useSubconIssues(filter?: SubconIssueFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => subconIssueRepo.list(filter),
  });
}

/** 외주 지시 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSubconIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubconIssue) => subconIssueRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
