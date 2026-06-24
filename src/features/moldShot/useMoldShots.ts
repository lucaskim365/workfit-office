import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moldShotRepo, type MoldShotFilter } from '@/data/moldShot/moldShot.repo';
import type { MoldShot } from '@/domain/moldShot/schema';

/**
 * 금형 타수 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다.
 */
const KEY = 'moldShots';

/** 금형 타수 목록(필터 포함) 조회. */
export function useMoldShots(filter?: MoldShotFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => moldShotRepo.list(filter),
  });
}

/** 금형 타수 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMoldShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MoldShot) => moldShotRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
