import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { traceNodeRepo, type TraceNodeFilter } from '@/data/traceNode/traceNode.repo';
import type { TraceNode } from '@/domain/traceNode/schema';

/**
 * LOT 계보 추적 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'traceNodes';

/** LOT 계보 노드 목록(필터 포함) 조회. */
export function useTraceNodes(filter?: TraceNodeFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => traceNodeRepo.list(filter),
  });
}

/** LOT 계보 노드 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveTraceNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (node: TraceNode) => traceNodeRepo.save(node),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
