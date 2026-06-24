import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionStandardRepo } from '@/data/inspectionStandard/inspectionStandard.repo';
import type { InspectionStandard } from '@/domain/inspectionStandard/schema';

/** 검사기준 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'inspectionStandards';

export function useInspectionStandards(q?: string) {
  return useQuery({ queryKey: [KEY, q ?? ''], queryFn: () => inspectionStandardRepo.list(q) });
}

export function useSaveInspectionStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (std: InspectionStandard) => inspectionStandardRepo.save(std),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
