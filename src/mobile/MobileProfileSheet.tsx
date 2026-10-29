import { createPortal } from 'react-dom';
import { ProfileCardContent } from '@/features/chat/desktop/ProfileCard';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { PresenceDot, PresenceBadge } from '@/features/userPresence/PresenceIndicator';
import { BirthdayMark } from '@/features/birthday/BirthdayProvider';
import { useUsers } from '@/features/user/useUsers';
import { getAvatarStyle } from '@/features/chat/avatarStyle';

/**
 * 모바일 대화방 명함 — 프로필 사진·이름을 누르면 아래에서 올라온다. 내용은 웹 명함과 같다(ProfileCardContent).
 * 배경을 누르면 닫힌다(MobileActionSheet 와 같은 모양).
 */
export function MobileProfileSheet({
  userId,
  fallbackName,
  me,
  meName,
  onClose,
  onOpenRoom,
}: {
  userId: string;
  fallbackName?: string;
  me: string;
  meName: string;
  onClose: () => void;
  /** 1:1 대화방이 정해지면 그 방을 연다 */
  onOpenRoom: (roomId: string) => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        className="mx-2 overflow-hidden rounded-2xl bg-white text-ink shadow-xl"
        style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileCardContent userId={userId} fallbackName={fallbackName} me={me} meName={meName} onOpenRoom={onOpenRoom} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * 모바일 단체방 참여자 목록 — 방 이름(·인원)을 누르면 아래에서 올라온다. 사람을 누르면 명함(onPick).
 * 웹 메신저의 참여자 목록과 같은 정보(이름·직급·부서·상태).
 */
export function MobileMemberSheet({
  memberIds,
  onPick,
  onClose,
}: {
  memberIds: string[];
  onPick: (userId: string, name: string) => void;
  onClose: () => void;
}) {
  const { data: users = [] } = useUsers();
  const presenceMap = useAllUserPresences();
  const members = memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .sort((a, b) => a.name.localeCompare(b.name));

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="대화방 참여자"
        className="mx-2 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl bg-white text-ink shadow-xl"
        style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-bold text-ink">대화방 참여자 ({members.length})</span>
          <button type="button" onClick={onClose} className="text-[12px] font-semibold text-ink3">닫기</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          {members.map((m) => {
            const p = presenceMap[m.id];
            const avatar = getAvatarStyle(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m.id, m.name)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left active:bg-panel-alt"
              >
                <span className="relative shrink-0">
                  <span style={{ backgroundColor: avatar.bg, color: avatar.text }} className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold">
                    {m.name?.[0] ?? '?'}
                  </span>
                  <PresenceDot presence={p} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[13px] font-semibold text-ink">{m.name}</span>
                    <BirthdayMark userId={m.id} />
                    <span className="shrink-0 text-[11px] text-ink3">{m.position ?? ''}</span>
                  </span>
                  <span className="block truncate text-[11px] text-ink3">{m.dept ?? ''}</span>
                </span>
                {p && <PresenceBadge presence={p} showMessage={false} size="xs" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
