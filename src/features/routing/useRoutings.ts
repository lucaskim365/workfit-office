import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { routingRepo } from '@/data/routing/routing.repo';
import type { Routing } from '@/domain/routing/schema';

/** 라우팅 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'routings';

export function useRoutings() {
  return useQuery({ queryKey: [KEY], queryFn: () => routingRepo.list() });
}

export function useSaveRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routing: Routing) => routingRepo.save(routing),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
