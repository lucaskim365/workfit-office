import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commutePolicyRepo } from '@/data/commutePolicy/commutePolicy.repo';
import type { CommutePolicy } from '@/domain/commutePolicy/schema';
import { useAuth } from '@/app/auth/AuthProvider';

export const COMMUTE_POLICY_KEY = ['commutePolicy'];

export function useCommutePolicy() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: COMMUTE_POLICY_KEY,
    queryFn: () => commutePolicyRepo.getDefault(),
    staleTime: 1000 * 60 * 5, // 5분
  });

  const mutation = useMutation({
    mutationFn: (policy: CommutePolicy) => commutePolicyRepo.save(policy, user?.name),
    onSuccess: (saved) => {
      queryClient.setQueryData(COMMUTE_POLICY_KEY, saved);
      queryClient.invalidateQueries({ queryKey: ['commute'] });
    },
  });

  return {
    policy: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    savePolicy: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
