import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipmentRepo, type EquipmentFilter } from '@/data/equipment/equipment.repo';
import type { Equipment } from '@/domain/equipment/schema';

/**
 * 설비 마스터 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipments';

/** 설비 목록(필터 포함) 조회. */
export function useEquipments(filter?: EquipmentFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipmentRepo.list(filter),
  });
}

/** 설비 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (equip: Equipment) => equipmentRepo.save(equip),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 설비 삭제. */
export function useRemoveEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => equipmentRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
