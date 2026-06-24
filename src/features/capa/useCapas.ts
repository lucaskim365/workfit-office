import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { capaRepo, type CapaFilter } from '@/data/capa/capa.repo';
import type { Capa } from '@/domain/capa/schema';

/**
 * 시정·예방조치(CAPA) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'capaActions';

/** CAPA 목록(발생원·상태·검색 필터) 조회. */
export function useCapas(filter?: CapaFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => capaRepo.list(filter),
  });
}

/** 상태 전이(검증 단계로·재개·종결 처리). */
export function useTransitionCapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: Capa['status'] }) =>
      capaRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
