import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bomRepo } from '@/data/bom/bom.repo';
import type { Bom } from '@/domain/bom/schema';

/** BOM 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'boms';

export function useBoms() {
  return useQuery({ queryKey: [KEY], queryFn: () => bomRepo.list() });
}

export function useSaveBom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bom: Bom) => bomRepo.save(bom),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
