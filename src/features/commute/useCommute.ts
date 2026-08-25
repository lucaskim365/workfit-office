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

/** 하루치 전 직원. 일별 현황 화면이 쓴다. */
export function useCommuteDay(date: string | null) {
  return useQuery({
    queryKey: ['commute', 'day', date],
    queryFn: () => commuteRepo.listDay(date as string),
    enabled: date !== null,
    staleTime: 60_000,
  });
}

/** 한 달치 전 직원. 월별 집계 화면이 쓴다. */
export function useCommuteMonthAll(month: string | null) {
  return useQuery({
    queryKey: ['commute', 'month-all', month],
    queryFn: () => commuteRepo.listMonthAll(month as string),
    enabled: month !== null,
    staleTime: 60_000,
  });
}
