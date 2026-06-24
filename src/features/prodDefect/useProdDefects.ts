import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prodDefectRepo, type ProdDefectFilter } from '@/data/prodDefect/prodDefect.repo';
import type { ProdDefect } from '@/domain/prodDefect/schema';

/**
 * 생산 불량실적 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'prodDefects';

/** 불량실적 목록(필터 포함) 조회. */
export function useProdDefects(filter?: ProdDefectFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => prodDefectRepo.list(filter),
  });
}

/** 불량실적 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveProdDefect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProdDefect) => prodDefectRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
