import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleEntryRepo, type ScheduleEntryFilter } from '@/data/scheduleEntry/scheduleEntry.repo';
import type { ScheduleEntry } from '@/domain/scheduleEntry/schema';

/**
 * 생산 일정 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. (계층 구조)
 */
const KEY = 'scheduleEntries';

/** 생산 일정 목록(필터 포함) 조회. */
export function useScheduleEntries(filter?: ScheduleEntryFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => scheduleEntryRepo.list(filter),
  });
}

/** 생산 일정 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveScheduleEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ScheduleEntry) => scheduleEntryRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
