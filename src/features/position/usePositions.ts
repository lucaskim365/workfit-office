import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { positionRepo } from '@/data/position/position.repo';
import type { Position } from '@/domain/position/schema';

/** 직급 마스터 훅 — 기준정보 직급관리 CRUD. 조직도 rank 도출과 캐시 공유('positions'). */
const KEY = 'positions';

export function usePositions() {
  return useQuery({ queryKey: [KEY, null], queryFn: () => positionRepo.list() });
}

export function useUpsertPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Position) => positionRepo.save(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemovePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => positionRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
