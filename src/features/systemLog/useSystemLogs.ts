import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { systemLogRepo, type SystemLogFilter } from '@/data/systemLog/systemLog.repo';
import type { SystemLog } from '@/domain/systemLog/schema';

/**
 * 시스템 로그 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'systemLogs';

/** 시스템 로그 목록(필터 포함) 조회. */
export function useSystemLogs(filter?: SystemLogFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => systemLogRepo.list(filter),
  });
}

/** 시스템 로그 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSystemLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SystemLog) => systemLogRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
