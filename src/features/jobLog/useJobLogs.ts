import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobLogRepo, type JobLogFilter } from '@/data/jobLog/jobLog.repo';
import type { JobLog } from '@/domain/jobLog/schema';

/**
 * 작업 시작/종료 로그 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'jobLogs';

/** 작업 로그 목록(필터 포함) 조회. */
export function useJobLogs(filter?: JobLogFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => jobLogRepo.list(filter),
  });
}

/** 작업 로그 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveJobLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: JobLog) => jobLogRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
