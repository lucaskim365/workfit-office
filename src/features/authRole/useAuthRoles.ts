import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authRoleRepo, type AuthRoleFilter } from '@/data/authRole/authRole.repo';
import type { AuthRole } from '@/domain/authRole/schema';

/**
 * 권한 역할 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'authRoles';

/** 권한 역할 목록(필터 포함) 조회. */
export function useAuthRoles(filter?: AuthRoleFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => authRoleRepo.list(filter),
  });
}

/** 권한 역할 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveAuthRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: AuthRole) => authRoleRepo.save(role),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
