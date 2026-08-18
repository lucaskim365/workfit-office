import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resourceRepo, type ResourceFilter } from '@/data/resource/resource.repo';
import type { ResourceDraft } from '@/domain/resource/schema';
import type { User } from '@/domain/user/schema';

const KEY = 'resources';

export function useResources(filter?: ResourceFilter) {
  return useQuery({ queryKey: [KEY, filter ?? null], queryFn: () => resourceRepo.list(filter) });
}

export function useSaveResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actor, draft, id }: { actor: User; draft: ResourceDraft; id?: string }) => resourceRepo.save(actor, draft, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
