import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calibrationRepo, type CalFilter } from '@/data/calibration/calibration.repo';
import type { Calibration } from '@/domain/calibration/schema';

/**
 * 검교정(Calibration) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'calibrations';

/** 검교정 목록(상태·검색 필터) 조회. */
export function useCalibrations(filter?: CalFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => calibrationRepo.list(filter),
  });
}

/** 상태 전이(검교정 착수·완료 처리·재개). */
export function useTransitionCalibration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: Calibration['status'] }) =>
      calibrationRepo.transition(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
