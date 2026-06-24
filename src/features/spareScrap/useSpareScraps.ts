import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spareScrapRepo, type SpareScrapFilter } from '@/data/spareScrap/spareScrap.repo';
import type { SpareScrap } from '@/domain/spareScrap/schema';

/**
 * 예비품 폐기·불용(SpareScrap) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'spareScraps';

/** 폐기·불용 목록(상태·사유·검색 필터) 조회. */
export function useSpareScraps(filter?: SpareScrapFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spareScrapRepo.list(filter),
  });
}

/** 상태 전이(승인 요청·승인·폐기 완료 등). */
export function useTransitionSpareScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: SpareScrap['state'] }) =>
      spareScrapRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
