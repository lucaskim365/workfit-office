import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pqcDeviceRepo, type PqcDeviceFilter } from '@/data/pqcDevice/pqcDevice.repo';
import type { PqcDevice } from '@/domain/pqcDevice/schema';

/**
 * PQC 설비·계측 인터페이스 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pqcDevices';

/** PQC 설비·계측 인터페이스 목록(필터 포함) 조회. */
export function usePqcDevices(filter?: PqcDeviceFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pqcDeviceRepo.list(filter),
  });
}

/** PQC 설비·계측 인터페이스 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePqcDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (device: PqcDevice) => pqcDeviceRepo.save(device),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
