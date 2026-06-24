import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sysInterfaceRepo, type SysInterfaceFilter } from '@/data/sysInterface/sysInterface.repo';
import type { SysInterface } from '@/domain/sysInterface/schema';

/**
 * 외부 인터페이스 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'interfaces';

/** 외부 인터페이스 목록(필터 포함) 조회. */
export function useSysInterfaces(filter?: SysInterfaceFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => sysInterfaceRepo.list(filter),
  });
}

/** 외부 인터페이스 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSysInterface() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SysInterface) => sysInterfaceRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
