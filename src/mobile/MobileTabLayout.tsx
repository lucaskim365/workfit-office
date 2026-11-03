import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import { useUnreadCounts } from '@/features/chat/useChatRooms';
import { useMyPresence } from '@/features/userPresence/useUserPresence';
import { currentApproverIds } from '@/domain/approvalDoc/engine';
import MobileNotificationBell from './MobileNotificationBell';
import MobileTabBar from './MobileTabBar';
import MobileUserMenuSheet from './MobileUserMenuSheet';
import { loadGroupwareView, saveGroupwareView, type GroupwareViewMode } from './groupwarePrefs';
import { smallPhotoOf } from '@/domain/user/schema';

/** 탭 화면이 Outlet 으로 받는 값 */
export interface MobileTabContext {
  viewMode: GroupwareViewMode;
  pendingApprovals: number;
}

const TEXT_ENTRY = 'input:not([type=file],[type=checkbox],[type=radio],[type=button],[type=submit]),textarea,[contenteditable=true]';

/** 글자 입력 중인지 — 키보드가 올라오면 하단바가 키보드 위에 떠서 입력 공간을 먹으므로 그동안 숨긴다 */
function useTextEntryFocused() {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const onIn = (e: FocusEvent) => setFocused(e.target instanceof Element && e.target.matches(TEXT_ENTRY));
    const onOut = () => setFocused(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
  return focused;
}

/**
 * 하단 탭 4개(경영 현황·그룹웨어·Widdy·메신저)의 공통 틀 — 상단바와 하단바를 함께 둔다.
 * 채팅방·결재 문서 같은 안쪽 화면은 이 틀 밖이라 자기 헤더(뒤로가기)만 쓴다.
 */
export default function MobileTabLayout() {
  const { user } = useAuth();
  const me = user!.id;
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { byBox } = useApprovalBoxes(me);
  const { data: unread = {} } = useUnreadCounts(me);
  const { meta: presenceMeta } = useMyPresence();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<GroupwareViewMode>(() => loadGroupwareView(me));
  const typing = useTextEntryFocused();

  const pendingApprovals = useMemo(
    () => (byBox['대기'] ?? []).filter((d) => currentApproverIds(d).includes(me)).length,
    [byBox, me],
  );
  const unreadChats = useMemo(() => Object.values(unread).reduce((sum, n) => sum + n, 0), [unread]);

  const toggleView = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    saveGroupwareView(me, next);
  };

  const isGroupware = pathname.replace(/\/$/, '') === '/m';
  const initials = user?.name ? user.name.slice(-2) : 'WF';
  const context: MobileTabContext = { viewMode, pendingApprovals };

  return (
    <div className="flex h-full flex-col">
      <header className="m-header flex h-[60px] shrink-0 items-center gap-2 px-3.5 text-white select-none">
        <img src="/icons/icon-192.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 leading-none">
          <div className="truncate text-[15px] font-extrabold tracking-tight text-white">WorkFit Office</div>
          <div className="mt-1 truncate text-[9px] text-white/60">Mobile Workspace</div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* 보기 방식은 그룹웨어 탭에만 있다 */}
          {isGroupware && (
            <button
              type="button"
              onClick={toggleView}
              title={viewMode === 'grid' ? '리스트형으로 변경' : '격자형으로 변경'}
              aria-label={viewMode === 'grid' ? '리스트형으로 변경' : '격자형으로 변경'}
              className="grid h-8.5 w-8.5 place-items-center rounded-xl text-white hover:bg-white/10 active:scale-95"
            >
              {viewMode === 'grid' ? <Rows3 size={19} strokeWidth={2} /> : <LayoutGrid size={19} strokeWidth={2} />}
            </button>
          )}
          <MobileNotificationBell />
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(true)}
            title={user ? `${user.name} · ${presenceMeta.label}` : '내 프로필'}
            className="relative ml-0.5 flex items-center rounded-full p-0.5 active:scale-95"
          >
            {user?.photoUrl ? (
              <img src={smallPhotoOf(user)} alt={user.name} className="h-8 w-8 rounded-full border border-white/30 object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white shadow-xs" style={{ background: '#17a89a' }}>
                {initials}
              </div>
            )}
            <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-header-bg)] ${presenceMeta.dotColor}`} />
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden" style={{ background: '#f2f8fc' }}>
        <Outlet context={context} />
      </main>

      {!typing && (
        <MobileTabBar
          pathname={pathname}
          pendingApprovals={pendingApprovals}
          unreadChats={unreadChats}
          onSelect={(path) => nav(path, { replace: true })}
        />
      )}

      <MobileUserMenuSheet isOpen={isUserMenuOpen} onClose={() => setIsUserMenuOpen(false)} />
    </div>
  );
}
