import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bmActionRepo, type BmFilter } from '@/data/bmAction/bmAction.repo';
import type { BmAction } from '@/domain/bmAction/schema';

/**
 * 사후보전(BM) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'bmActions';

/** BM 작업 목록(상태·심각도·검색 필터) 조회. */
export function useBmActions(filter?: BmFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => bmActionRepo.list(filter),
  });
}

/** 상태 전이(진단 착수·수리 진행·시운전·완료 처리). */
export function useTransitionBm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: BmAction['state'] }) =>
      bmActionRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
