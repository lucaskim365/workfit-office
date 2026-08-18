import { useQuery } from '@tanstack/react-query';
import { commuteRepo } from '@/data/commute/commute.repo';

/** 근태 조회 훅 — 읽기 전용이라 mutation이 없다. */
export function useCommuteEmployees() {
  return useQuery({
    queryKey: ['commute', 'employees'],
    queryFn: () => commuteRepo.listEmployees(),
    staleTime: 5 * 60_000,
  });
}

export function useCommuteMonth(empId: number | null, month: string) {
  return useQuery({
    queryKey: ['commute', 'month', empId, month],
    queryFn: () => commuteRepo.listMonth(empId as number, month),
    enabled: empId !== null,
    staleTime: 60_000,
  });
}
