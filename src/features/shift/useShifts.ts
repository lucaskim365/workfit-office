import { useQuery } from '@tanstack/react-query';
import { shiftRepo } from '@/data/shift/shift.repo';

/** 근무조 데이터 훅. ([[data-layer-pattern]]) */
export function useShifts() {
  return useQuery({ queryKey: ['shifts'], queryFn: () => shiftRepo.listShifts() });
}

export function useShiftRotations() {
  return useQuery({ queryKey: ['shiftRotations'], queryFn: () => shiftRepo.listRotations() });
}
