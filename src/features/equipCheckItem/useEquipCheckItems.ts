import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipCheckItemRepo, type EquipCheckItemFilter } from '@/data/equipCheckItem/equipCheckItem.repo';
import type { EquipCheckItem } from '@/domain/equipCheckItem/schema';

/**
 * 설비 점검항목 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipCheckItems';

/** 설비 점검항목 목록(설비 유형별 도큐먼트, 필터 포함) 조회. */
export function useEquipCheckItems(filter?: EquipCheckItemFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipCheckItemRepo.list(filter),
  });
}

/** 설비 점검항목 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipCheckItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: EquipCheckItem) => equipCheckItemRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
