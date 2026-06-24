import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseZoneRepo, type WarehouseZoneFilter } from '@/data/warehouseZone/warehouseZone.repo';
import type { WarehouseZone } from '@/domain/warehouseZone/schema';

/**
 * 창고 구역 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'warehouseZones';

/** 창고 구역 목록(필터 포함) 조회. */
export function useWarehouseZones(filter?: WarehouseZoneFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => warehouseZoneRepo.list(filter),
  });
}

/** 창고 구역 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveWarehouseZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: WarehouseZone) => warehouseZoneRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
