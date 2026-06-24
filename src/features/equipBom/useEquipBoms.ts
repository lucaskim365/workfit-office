import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipBomRepo } from '@/data/equipBom/equipBom.repo';
import type { EquipBom } from '@/domain/equipBom/schema';

/** 설비 BOM 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'equipBoms';

export function useEquipBoms() {
  return useQuery({ queryKey: [KEY], queryFn: () => equipBomRepo.list() });
}

export function useSaveEquipBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bom: EquipBom) => equipBomRepo.save(bom),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
