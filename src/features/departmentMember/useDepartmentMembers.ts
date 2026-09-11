import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentMemberRepo } from '@/data/departmentMember/departmentMember.repo';
import type { DepartmentMemberInput } from '@/domain/departmentMember/schema';

export const DEPARTMENT_MEMBERS_KEY = 'departmentMembers';

export function useDepartmentMembers() {
  return useQuery({
    queryKey: [DEPARTMENT_MEMBERS_KEY],
    queryFn: () => departmentMemberRepo.list(),
  });
}

export function useUserDepartmentMembers(userId?: string | null) {
  return useQuery({
    queryKey: [DEPARTMENT_MEMBERS_KEY, 'user', userId ?? ''],
    queryFn: () => (userId ? departmentMemberRepo.listByUserId(userId) : []),
    enabled: Boolean(userId),
  });
}

export function useDeptDepartmentMembers(deptId?: string | null) {
  return useQuery({
    queryKey: [DEPARTMENT_MEMBERS_KEY, 'dept', deptId ?? ''],
    queryFn: () => (deptId ? departmentMemberRepo.listByDeptId(deptId) : []),
    enabled: Boolean(deptId),
  });
}

export function useUpsertDepartmentMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: DepartmentMemberInput) => {
      return await departmentMemberRepo.save(member);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_KEY] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
    },
  });
}

export function useRemoveDepartmentMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await departmentMemberRepo.remove(id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_KEY] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
    },
  });
}
