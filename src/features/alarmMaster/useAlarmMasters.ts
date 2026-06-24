import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alarmMasterRepo, type AlarmMasterFilter } from '@/data/alarmMaster/alarmMaster.repo';
import type { AlarmMaster } from '@/domain/alarmMaster/schema';

/**
 * 알람·에러 코드 마스터 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'alarmMasters';

/** 알람 마스터 목록(type별 도큐먼트) 조회. */
export function useAlarmMasters(filter?: AlarmMasterFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => alarmMasterRepo.list(filter),
  });
}

/** 알람 마스터 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveAlarmMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (master: AlarmMaster) => alarmMasterRepo.save(master),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
