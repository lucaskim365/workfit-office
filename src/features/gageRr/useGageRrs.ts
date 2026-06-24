import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gageRrRepo, type GageRrFilter } from '@/data/gageRr/gageRr.repo';
import type { GageRr } from '@/domain/gageRr/schema';

/**
 * Gage R&R(MSA) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'gageRrStudies';

/** MSA 분석 목록(필터 포함) 조회. */
export function useGageRrs(filter?: GageRrFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => gageRrRepo.list(filter),
  });
}

/** MSA 분석 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveGageRr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: GageRr) => gageRrRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
