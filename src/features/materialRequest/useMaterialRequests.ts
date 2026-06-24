import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialRequestRepo, type MaterialRequestFilter } from '@/data/materialRequest/materialRequest.repo';
import type { MaterialRequest } from '@/domain/materialRequest/schema';

/**
 * 자재 요청 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'materialRequests';

/** 자재 요청 목록(필터 포함) 조회. */
export function useMaterialRequests(filter?: MaterialRequestFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => materialRequestRepo.list(filter),
  });
}

/** 자재 요청 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MaterialRequest) => materialRequestRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
