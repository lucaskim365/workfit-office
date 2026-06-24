import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { liveAlarmRepo, type AlarmFilter } from '@/data/liveAlarm/liveAlarm.repo';
import type { LiveAlarm } from '@/domain/liveAlarm/schema';

/**
 * 설비 실시간 알람 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'liveAlarms';

/** 알람 목록(상태·등급·검색 필터) 조회. */
export function useLiveAlarms(filter?: AlarmFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => liveAlarmRepo.list(filter),
  });
}

/** 상태 전이(조치 착수·조치 완료). */
export function useTransitionLiveAlarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: LiveAlarm['state'] }) =>
      liveAlarmRepo.transition(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
