import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workCenterRepo } from '@/data/workCenter/workCenter.repo';
import type { WorkCenter } from '@/domain/workCenter/schema';

/** 작업장 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'workCenters';

export function useWorkCenters() {
  return useQuery({ queryKey: [KEY], queryFn: () => workCenterRepo.list() });
}

export function useSaveWorkCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wc: WorkCenter) => workCenterRepo.save(wc),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
