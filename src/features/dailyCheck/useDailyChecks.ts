import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyCheckRepo, type DailyCheckFilter } from '@/data/dailyCheck/dailyCheck.repo';
import type { DailyCheck } from '@/domain/dailyCheck/schema';

/**
 * 일상점검 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'dailyChecks';

/** 일상점검 설비 세션 목록(상태·검색 필터) 조회. */
export function useDailyChecks(filter?: DailyCheckFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => dailyCheckRepo.list(filter),
  });
}

/** 상태 전이(점검 착수·점검 완료). */
export function useTransitionDailyCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, to }: { code: string; to: DailyCheck['state'] }) =>
      dailyCheckRepo.transition(code, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
