import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calResultRepo, type CalResultFilter } from '@/data/calResult/calResult.repo';
import type { CalResult } from '@/domain/calResult/schema';

/**
 * 검교정 실적 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'calResults';

/** 검교정 실적 목록(필터 포함) 조회. */
export function useCalResults(filter?: CalResultFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => calResultRepo.list(filter),
  });
}

/** 검교정 실적 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCalResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CalResult) => calResultRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
