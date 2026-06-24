import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calFailRepo, type CalFailFilter } from '@/data/calFail/calFail.repo';
import type { CalFail } from '@/domain/calFail/schema';

/**
 * 검교정 불합격 자산 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'calFails';

/** 불합격 자산 목록(필터 포함) 조회. */
export function useCalFails(filter?: CalFailFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => calFailRepo.list(filter),
  });
}

/** 불합격 자산 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCalFail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CalFail) => calFailRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
