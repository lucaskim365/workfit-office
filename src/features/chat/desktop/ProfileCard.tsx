import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Mail, MessageCircle, Phone } from 'lucide-react';
import { useUsers } from '@/features/user/useUsers';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { PresenceBadge } from '@/features/userPresence/PresenceIndicator';
import { useCreateRoom } from '@/features/chat/useChatRooms';
import { getAvatarStyle } from './MessengerPanel';

/**
 * 대화방 프로필 명함 — 프로필 사진·이름을 누르면 그 옆에 작게 뜬다.
 * 업무 정보(부서·직급·직책·업무 이메일·업무 연락처)만 보여 주고, 1:1 대화로 바로 갈 수 있다.
 */
type OpenProfileCard = (userId: string, anchor: HTMLElement, fallbackName?: string) => void;

const ProfileCardContext = createContext<OpenProfileCard | null>(null);

/** 명함을 여는 함수. 명함을 띄울 곳(ProfileCardHost) 밖이면 null — 누를 수 없게 그린다. */
export const useOpenProfileCard = () => useContext(ProfileCardContext);

interface Target {
  userId: string;
  fallbackName?: string;
  rect: DOMRect;
}

export function ProfileCardHost({
  me,
  meName,
  onOpenRoom,
  children,
}: {
  me: string;
  meName: string;
  /** 1:1 대화방이 정해지면 그 방을 연다 */
  onOpenRoom: (roomId: string) => void;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const open: OpenProfileCard = (userId, anchor, fallbackName) => {
    if (!userId) return;
    setTarget((cur) => (cur?.userId === userId ? null : { userId, fallbackName, rect: anchor.getBoundingClientRect() }));
  };
  return (
    <ProfileCardContext.Provider value={open}>
      {children}
      {target && (
        <ProfileCard
          target={target}
          me={me}
          meName={meName}
          onClose={() => setTarget(null)}
          onOpenRoom={(id) => {
            setTarget(null);
            onOpenRoom(id);
          }}
        />
      )}
    </ProfileCardContext.Provider>
  );
}

const CARD_W = 264;

function ProfileCard({
  target,
  me,
  meName,
  onClose,
  onOpenRoom,
}: {
  target: Target;
  me: string;
  meName: string;
  onClose: () => void;
  onOpenRoom: (roomId: string) => void;
}) {
  const { data: users = [] } = useUsers();
  const { data: profiles = [] } = useEmployeeProfiles();
  const presenceMap = useAllUserPresences();
  const createRoom = useCreateRoom();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const user = users.find((u) => u.id === target.userId);
  const profile = profiles.find((p) => p.userId === target.userId || p.id === target.userId);
  const name = user?.name ?? target.fallbackName ?? '알 수 없음';
  const active = user?.status === '사용';
  const title = [user?.position, user?.jobTitle && user.jobTitle !== user.position ? user.jobTitle : ''].filter(Boolean).join(' · ');
  const avatar = getAvatarStyle(target.userId);

  // 누른 자리 오른쪽(모자라면 왼쪽)에, 화면 밖으로 나가지 않게. 화면 배율(body zoom) 안의 고정 위치라 좌표를 배율로 나눈다.
  useLayoutEffect(() => {
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    const r = target.rect;
    const h = (ref.current?.getBoundingClientRect().height ?? 220) / zoom;
    let x = r.right / zoom + 8;
    if (x + CARD_W > vw - 8) x = r.left / zoom - CARD_W - 8;
    x = Math.min(Math.max(8, x), vw - CARD_W - 8);
    const y = Math.min(Math.max(8, r.top / zoom - 8), vh - h - 8);
    setPos({ x, y });
  }, [target]);

  // 바깥을 누르거나 Esc 면 닫는다
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const startDirect = async () => {
    if (!user || createRoom.isPending) return;
    try {
      // 같은 두 사람의 1:1 방이 있으면 저장소가 그 방을 돌려준다
      const room = await createRoom.mutateAsync({ name: `${meName}, ${user.name}`, type: 'direct', members: [me, user.id], createdBy: me });
      onOpenRoom(room.id);
    } catch (e) {
      window.alert(`대화방을 열지 못했습니다: ${(e as Error)?.message || e}`);
    }
  };

  const copyEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt('이메일 주소', user.email);
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${name} 프로필`}
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, width: CARD_W }}
      className="fixed z-[99999] overflow-hidden rounded-xl border border-border bg-white text-ink shadow-[0_12px_32px_rgba(16,24,48,0.22)]"
    >
      <div className="flex items-center gap-3 bg-[#f2f8fc] px-4 py-3.5">
        <span style={{ backgroundColor: avatar.bg, color: avatar.text }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[17px] font-bold">
          {name[0] ?? '?'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-extrabold">{name}</span>
            {title && <span className="shrink-0 text-[11px] font-semibold text-ink2">{title}</span>}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-ink2">{user ? (active ? user.dept : '퇴직') : ''}</div>
          {active && presenceMap[target.userId] && <PresenceBadge presence={presenceMap[target.userId]} showMessage size="xs" className="mt-1" />}
        </div>
      </div>

      {user && active && (
        <div className="space-y-1.5 px-4 py-3 text-[11.5px]">
          <div className="flex items-center gap-2">
            <Mail size={13} className="shrink-0 text-ink3" />
            <span className="min-w-0 flex-1 truncate font-mono text-ink2">{user.email || '-'}</span>
            {user.email && (
              <button type="button" onClick={copyEmail} title="이메일 복사" className="shrink-0 rounded p-0.5 text-ink3 hover:bg-black/5 hover:text-ink">
                {copied ? <span className="text-[10px] font-bold text-teal">복사됨</span> : <Copy size={12} />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Phone size={13} className="shrink-0 text-ink3" />
            <span className="font-mono text-ink2">{profile?.phone || '-'}</span>
          </div>
        </div>
      )}

      {user && active && user.id !== me && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={startDirect}
            disabled={createRoom.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
            style={{ background: '#4ea8de' }}
          >
            <MessageCircle size={14} /> {createRoom.isPending ? '여는 중…' : '1:1 대화'}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
