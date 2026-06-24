import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendorRepo, type VendorFilter } from '@/data/vendor/vendor.repo';
import type { Vendor } from '@/domain/vendor/schema';

/**
 * 거래처 데이터 훅 — 화면이 repository 대신 호출하는 React 바인딩.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'vendors';

export function useVendors(filter?: VendorFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => vendorRepo.list(filter),
  });
}

export function useSaveVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vendor: Vendor) => vendorRepo.save(vendor),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => vendorRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
