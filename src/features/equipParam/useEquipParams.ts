import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipParamRepo, type EquipParamFilter } from '@/data/equipParam/equipParam.repo';
import type { EquipParam } from '@/domain/equipParam/schema';

/**
 * 설비 파라미터 현황 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipParams';

/** 설비 파라미터 목록(필터 포함) 조회. */
export function useEquipParams(filter?: EquipParamFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipParamRepo.list(filter),
  });
}

/** 설비 파라미터 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipParam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: EquipParam) => equipParamRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
