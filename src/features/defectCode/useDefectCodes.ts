import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defectCodeRepo, type DefectCodeFilter } from '@/data/defectCode/defectCode.repo';
import type { DefectCode } from '@/domain/defectCode/schema';

/**
 * 불량코드 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'defectCodes';

/** 불량코드 목록(필터 포함) 조회. */
export function useDefectCodes(filter?: DefectCodeFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => defectCodeRepo.list(filter),
  });
}

/** 불량코드 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveDefectCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: DefectCode) => defectCodeRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 불량코드 삭제. */
export function useRemoveDefectCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => defectCodeRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
