import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userRepo, type UserFilter } from '@/data/user/user.repo';
import type { UserFormValues } from '@/domain/user/schema';

/**
 * 사용자 데이터 훅 — 화면이 repository 대신 호출하는 React 바인딩.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'users';

export function useUsers(filter?: UserFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => userRepo.list(filter),
  });
}

/** 등록/수정 통합 — id 있으면 수정, 없으면 신규 채번. */
export function useUpsertUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, id }: { values: UserFormValues; id?: string }) => {
      if (id) await userRepo.update(id, values);
      else await userRepo.create(values);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: Array<string | number>) => userRepo.removeMany(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateUserJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobTitle }: { id: string; jobTitle: string }) => {
      await userRepo.updateJobTitle(id, jobTitle);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
