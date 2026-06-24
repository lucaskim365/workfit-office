import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { roleGroupRepo } from '@/data/roleGroup/roleGroup.repo';
import type { RoleGroup } from '@/domain/roleGroup/schema';

/**
 * 역할그룹 데이터 훅 — 화면이 repository 대신 호출하는 React 바인딩.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'roleGroups';

export function useRoleGroups() {
  return useQuery({ queryKey: [KEY], queryFn: () => roleGroupRepo.list() });
}

export function useSaveRoleGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (group: RoleGroup) => roleGroupRepo.save(group),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
