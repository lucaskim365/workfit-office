import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipGageRepo, type EquipGageFilter } from '@/data/equipGage/equipGage.repo';
import type { EquipGage } from '@/domain/equipGage/schema';

/**
 * 설비 계측기 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipGages';

/** 설비 계측기 목록(필터 포함) 조회. */
export function useEquipGages(filter?: EquipGageFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipGageRepo.list(filter),
  });
}

/** 설비 계측기 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipGage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gage: EquipGage) => equipGageRepo.save(gage),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
