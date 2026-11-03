import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userRepo } from '@/data/user/user.repo';
import { DEFAULT_NOTIFICATION_PREFS, parseNotificationPrefs, type NotificationPrefs } from '@/domain/notificationPrefs/schema';

const key = (userId: string | undefined) => ['notificationPrefs', userId];

/** 내 알림 설정. 불러오기 전에는 기본값(모두 받기) */
export function useNotificationPrefs(userId: string | undefined) {
  const query = useQuery({
    queryKey: key(userId),
    enabled: Boolean(userId),
    queryFn: async () => parseNotificationPrefs((await userRepo.get(userId!))?.notificationPrefs),
  });
  return { prefs: query.data ?? DEFAULT_NOTIFICATION_PREFS, isLoading: query.isLoading };
}

export function useSaveNotificationPrefs(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      await userRepo.saveNotificationPrefs(userId!, prefs);
      return prefs;
    },
    onSuccess: (prefs) => qc.setQueryData(key(userId), prefs),
  });
}
