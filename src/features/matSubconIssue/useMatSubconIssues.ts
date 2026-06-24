import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matSubconIssueRepo, type MatSubconIssueFilter } from '@/data/matSubconIssue/matSubconIssue.repo';
import type { MatSubconIssue } from '@/domain/matSubconIssue/schema';

/**
 * 자재 외주불출 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'matSubconIssues';

/** 자재 외주불출 목록(필터 포함) 조회. */
export function useMatSubconIssues(filter?: MatSubconIssueFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => matSubconIssueRepo.list(filter),
  });
}

/** 자재 외주불출 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMatSubconIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MatSubconIssue) => matSubconIssueRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
