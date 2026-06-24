import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spcAlarmRepo, type SpcAlarmFilter } from '@/data/spcAlarm/spcAlarm.repo';
import type { SpcAlarm } from '@/domain/spcAlarm/schema';

/**
 * SPC 품질알람 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'spcAlarms';

/** 알람 목록(상태·유형·검색 필터) 조회. */
export function useSpcAlarms(filter?: SpcAlarmFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spcAlarmRepo.list(filter),
  });
}

/** 상태 전이(알람 확인·조치 착수·알람 해제). */
export function useTransitionSpcAlarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: SpcAlarm['status'] }) =>
      spcAlarmRepo.transition(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
