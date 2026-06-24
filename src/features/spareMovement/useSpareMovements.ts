import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spareMovementRepo, type SpareMovementFilter } from '@/data/spareMovement/spareMovement.repo';
import type { SpareMovement } from '@/domain/spareMovement/schema';

/**
 * 예비품 입출고 원장 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'spareMovements';

/** 입출고 원장 목록(필터 포함) 조회. */
export function useSpareMovements(filter?: SpareMovementFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spareMovementRepo.list(filter),
  });
}

/** 입출고 전표 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSpareMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mv: SpareMovement) => spareMovementRepo.save(mv),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
