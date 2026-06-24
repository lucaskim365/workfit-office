import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spcCapabilityRepo, type SpcCapabilityFilter } from '@/data/spcCapability/spcCapability.repo';
import type { SpcCapability } from '@/domain/spcCapability/schema';

/**
 * SPC 공정능력 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'spcCapability';

/** SPC 공정능력 특성 목록(필터 포함) 조회. */
export function useSpcCapabilities(filter?: SpcCapabilityFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spcCapabilityRepo.list(filter),
  });
}

/** SPC 공정능력 특성 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSpcCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SpcCapability) => spcCapabilityRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
