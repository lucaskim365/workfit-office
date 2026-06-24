import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vocRepo, type VocFilter } from '@/data/voc/voc.repo';
import type { Voc } from '@/domain/voc/schema';

/**
 * 고객 클레임(VOC) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'voc';

/** VOC 목록(상태·유형·검색 필터) 조회. */
export function useVocs(filter?: VocFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => vocRepo.list(filter),
  });
}

/** 상태 전이(조사 착수·고객 회신·종결 처리). */
export function useTransitionVoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: Voc['status'] }) =>
      vocRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
