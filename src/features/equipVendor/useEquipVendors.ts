import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipVendorRepo, type EquipVendorFilter } from '@/data/equipVendor/equipVendor.repo';
import type { EquipVendor } from '@/domain/equipVendor/schema';

/**
 * 설비 보전협력사 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'equipVendors';

/** 협력사 목록(필터 포함) 조회. */
export function useEquipVendors(filter?: EquipVendorFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => equipVendorRepo.list(filter),
  });
}

/** 협력사 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveEquipVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: EquipVendor) => equipVendorRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
