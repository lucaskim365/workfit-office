import { useState } from 'react';
import { NOTIFICATION_PREF_ROWS, type NotificationPrefs } from '@/domain/notificationPrefs/schema';
import { useNotificationPrefs, useSaveNotificationPrefs } from '@/features/notification/useNotificationPrefs';
import { Card, Feedback } from './shared';

/** 앱 내 프로필 > 알림 설정 — 누르면 바로 저장한다 */
export default function NotificationPrefsCard({ userId }: { userId: string }) {
  const { prefs, isLoading } = useNotificationPrefs(userId);
  const save = useSaveNotificationPrefs(userId);
  const [err, setErr] = useState('');

  const toggle = (key: keyof NotificationPrefs) => {
    setErr('');
    save.mutate({ ...prefs, [key]: !prefs[key] }, { onError: () => setErr('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.') });
  };

  return (
    <Card title="알림 설정">
      <div className="divide-y divide-border/60">
        {NOTIFICATION_PREF_ROWS.map((row) => (
          <label key={row.key} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[12.5px] font-bold text-ink">{row.label}</span>
              <span className="mt-0.5 block text-[10.5px] text-ink3">{row.desc}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[row.key]}
              disabled={isLoading || save.isPending}
              onChange={() => toggle(row.key)}
              className="h-5 w-5 shrink-0 accent-teal"
            />
          </label>
        ))}
      </div>
      {err && <Feedback msg="" err={err} />}
    </Card>
  );
}
