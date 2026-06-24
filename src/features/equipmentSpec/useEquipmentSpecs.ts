import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipmentSpecRepo, type EquipmentSpecFilter } from '@/data/equipmentSpec/equipmentSpec.repo';
import type { EquipmentSpec } from '@/domain/equipmentSpec/schema';

/**
 * 설비 제원·스펙 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipmentSpecs';

/** 설비 제원·스펙 목록(type별 도큐먼트) 조회. */
export function useEquipmentSpecs(filter?: EquipmentSpecFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipmentSpecRepo.list(filter),
  });
}

/** 설비 제원·스펙 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipmentSpec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (spec: EquipmentSpec) => equipmentSpecRepo.save(spec),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
