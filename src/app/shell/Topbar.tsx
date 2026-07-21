import { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU_TREE } from '../menu-tree';
import type { FlatScreen, MenuNode } from '@/shared/types/menu';
import { MenuGlyph } from '@/shared/ui/MenuGlyph';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/app/auth/AuthProvider';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/features/notification/useNotifications';
import { useChatRooms, useUnreadCounts } from '@/features/chat/useChatRooms';
import defaultLogo from '@/assets/logo.png';

interface TopbarProps {
  activeModuleId: string;
  activeUrl: string;
  openModule: string | null;
  setOpenModule: (id: string | null) => void;
  userOpen: boolean;
  setUserOpen: (v: boolean) => void;
  onPick: (screen: FlatScreen) => void;
  dockOpen: string | null;
  setDockOpen: (v: string | null) => void;
}

function Brand({ logoUrl, onLogoClick }: { logoUrl?: string; onLogoClick?: () => void }) {
  return (
    <button
      onClick={onLogoClick}
      className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
      title="메인화면으로 이동"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white overflow-hidden p-0.5 shadow-sm border border-black/5">
        <img src={logoUrl || defaultLogo} alt="Logo" className="h-full w-full object-contain" />
      </div>
      <div className="leading-[1.1]">
        <div style={{ color: 'var(--color-header-text)' }} className="text-sm font-extrabold tracking-tight">
          WorkFit<span className="text-teal">Intranet</span>
        </div>
        <div style={{ color: 'var(--color-header-text)', opacity: 0.7 }} className="text-[8.5px] font-semibold">Enterprise Portal Suite</div>
      </div>
    </button>
  );
}

export function Topbar({ activeModuleId, activeUrl, openModule, setOpenModule, userOpen, setUserOpen, onPick, dockOpen, setDockOpen }: TopbarProps) {
  const [themeOpen, setThemeOpen] = useState(false);
  // 열린 드롭다운이 화면 좌/우 가장자리를 넘어가면 안쪽으로 밀어주는 보정값(px).
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    setShift(0);
  }, [openModule]);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || !openModule) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let delta = 0;
    if (r.left < margin) delta = margin - r.left;
    else if (r.right > window.innerWidth - margin) delta = window.innerWidth - margin - r.right;
    if (delta !== 0) setShift((prev) => prev + delta);
  }, [openModule, shift]);
  const { user } = useAuth();
  const isCwhong = user?.id === 'U012';
  const { data: companyInfo } = useCompanyInfo();
  const logoUrl = companyInfo?.logoUrl;
  const navigate = useNavigate();

  // 로그인 사용자 이니셜(이름 뒤 2글자). 미로그인/데모 시 기본 표기.
  const initials = user?.name ? user.name.slice(-2) : 'WF';
  const [notiOpen, setNotiOpen] = useState(false);
  const rawNotifications = useNotifications(user?.id);
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  // 메신저('메신저') 알림은 통합 알림 센터에서 노출하지 않도록 필터링 (결재 등은 보임)
  const notifications = useMemo(() => rawNotifications.filter((n) => n.type !== '메신저'), [rawNotifications]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // 메신저 방별 미읽음 메시지 수 조회 및 합산 (참여 중인 방의 메시지만 집계)
  const { data: rooms = [] } = useChatRooms(user?.id);
  const { data: unreadMap = {} } = useUnreadCounts(user?.id);
  const chatUnreadCount = useMemo(() => {
    const joinedRoomIds = new Set(rooms.map((r) => r.id));
    return Object.entries(unreadMap).reduce((sum, [roomId, count]) => {
      if (joinedRoomIds.has(roomId)) {
        return sum + (Number(count) || 0);
      }
      return sum;
    }, 0);
  }, [rooms, unreadMap]);

  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setNotiOpen(false);
      }
    }
    if (notiOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notiOpen]);
  return (
    <header
      style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
      className="relative z-50 flex h-[58px] shrink-0 items-center gap-2.5 px-3.5"
    >
      <div className="flex shrink-0 items-center gap-7">
        <Brand logoUrl={logoUrl} onLogoClick={() => navigate('/exec')} />
        <nav className="flex gap-0.5">
          {MENU_TREE.filter((m) => m.use !== false).map((m) => {
            const active = m.id === activeModuleId;
            const isSpecial = m.id === 'M_GW' || m.id === 'M_WIDDY' || m.id === 'M_MSG';
            const isOpen = isSpecial
              ? (m.id === 'M_GW' && dockOpen === 'gw') ||
              (m.id === 'M_WIDDY' && dockOpen === 'bot') ||
              (m.id === 'M_MSG' && dockOpen === 'msg')
              : openModule === m.id;
            const groups = (m.children ?? []).filter((g) => g.use !== false);
            const screenCount = groups.reduce((s, g) => s + (g.children?.filter((x) => x.use !== false).length ?? 0), 0);
            const cols = groups.length > 3 ? 3 : groups.length > 1 ? 2 : 1;
            return (
              <div key={m.id} className="relative">
                <button
                  onClick={() => {
                    if (m.id === 'M_GW') {
                      setDockOpen(dockOpen === 'gw' ? null : 'gw');
                    } else if (m.id === 'M_WIDDY') {
                      setDockOpen(dockOpen === 'bot' ? null : 'bot');
                    } else if (m.id === 'M_MSG') {
                      setDockOpen(dockOpen === 'msg' ? null : 'msg');
                    } else {
                      setOpenModule(isOpen ? null : m.id);
                    }
                  }}
                  style={{ color: 'var(--color-header-text)', opacity: active || isOpen ? 1 : 0.7 }}
                  className={`relative flex flex-col items-center gap-[3px] rounded-lg px-[11px] py-1.5 transition-all hover:opacity-100 ${active || isOpen ? 'bg-white/[0.15]' : 'hover:bg-white/[0.08]'
                    }`}
                >
                  <MenuGlyph glyph={m.icon} size={18} />
                  <span className={`whitespace-nowrap text-[11px] ${active ? 'font-bold' : 'font-semibold'}`}>{m.name}</span>
                  {m.id === 'M_MSG' && chatUnreadCount > 0 && (
                    <span className="absolute top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow animate-pulse">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </button>

                {isOpen && !isSpecial && (
                  <div
                    ref={panelRef}
                    className="absolute left-1/2 top-[calc(100%+10px)] z-[60] flex max-h-[calc(100vh-88px)] flex-col rounded-xl border border-border bg-panel p-2 shadow-[0_16px_40px_rgba(16,24,48,0.22)]"
                    style={{ width: cols === 3 ? 624 : cols === 2 ? 432 : 248, transform: `translateX(calc(-50% + ${shift}px))` }}
                  >
                    <div className="absolute -top-1.5 -ml-1.5 h-3 w-3 rotate-45 border-l border-t border-border bg-panel" style={{ left: `calc(50% - ${shift}px)` }} />
                    <div className="flex shrink-0 items-center gap-1.5 px-2.5 pb-2 pt-1.5 text-[10px] font-extrabold tracking-wide text-ink3">
                      <MenuGlyph glyph={m.icon} size={14} color="var(--color-teal)" />
                      {m.name}
                      <span className="ml-auto font-semibold opacity-80">{screenCount}</span>
                    </div>
                    <div className="content-scroll min-h-0 flex-1 overflow-y-auto p-0.5" style={{ columns: cols, columnGap: '12px' }}>
                      {groups.map((g: MenuNode) => (
                        <div key={g.id} className="mb-2 [break-inside:avoid]">
                          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-extrabold text-navy">
                            <MenuGlyph glyph={g.icon} size={14} color="var(--color-teal)" />
                            {g.name}
                          </div>
                          {(g.children ?? [])
                            .filter((s) => s.use !== false && s.url && (s.id !== 'S_BASE_APMON' || isCwhong))
                            .map((s) => {
                              const cur = s.url === activeUrl;
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => onPick({ id: s.id, name: s.name, url: s.url!, icon: s.icon, moduleId: m.id, moduleName: m.name, groupId: g.id, groupName: g.name })}
                                  className={`flex w-full items-center gap-2 rounded-[7px] py-[7px] pl-4 pr-2.5 text-left transition-colors ${cur ? 'bg-teal-soft' : 'hover:bg-panel-alt'
                                    }`}
                                >
                                  <span className="flex w-[15px] shrink-0 justify-center">
                                    <MenuGlyph glyph={s.icon} size={14} color={cur ? 'var(--color-teal)' : 'var(--color-ink3)'} />
                                  </span>
                                  <span className={`truncate text-[11.5px] ${cur ? 'font-bold text-teal' : 'font-medium text-ink2'}`}>{s.name}</span>
                                </button>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* 공지 마퀴 숨김 — 우측(날짜·계정)을 오른쪽으로 밀기 위한 spacer */}
      <div className="flex-1" />

      {/* 날짜 + 계정 */}
      <div className="flex shrink-0 items-center gap-3.5">
        {/* GNB 통합 알림 센터 */}
        <div className="relative" ref={notiRef}>
          <button
            onClick={() => setNotiOpen(!notiOpen)}
            className={`relative grid h-8 w-8 place-items-center rounded-lg hover:bg-white/[0.08] transition-all ${
              notiOpen ? 'bg-white/[0.15]' : ''
            }`}
            title="알림 센터"
          >
            <span className="text-[17px] leading-none">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9.5px] font-extrabold text-white shadow animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notiOpen && (
            <div 
              className="absolute right-0 top-[calc(100%+10px)] z-[60] flex w-80 flex-col rounded-xl border border-border bg-panel p-3.5 shadow-[0_16px_40px_rgba(16,24,48,0.22)] text-ink"
            >
              <div className="absolute -top-1.5 right-2.5 h-3 w-3 rotate-45 border-l border-t border-border bg-panel" />
              
              <div className="flex items-center justify-between border-b border-border pb-2 mb-2 select-none">
                <span className="text-[12.5px] font-bold text-ink">알림 센터</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => user?.id && markAll.mutate(user.id)}
                    className="text-[10px] font-semibold text-teal hover:underline"
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              <div className="content-scroll max-h-64 overflow-y-auto space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[11.5px] text-ink3 select-none">수신된 알림이 없습니다.</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markOne.mutate(n.id);
                        setNotiOpen(false);
                        if (n.type === '메신저') {
                          setDockOpen('msg');
                        } else if (n.linkUrl) {
                          navigate(n.linkUrl);
                        }
                      }}
                      className={`flex items-start gap-2.5 rounded-lg p-2 text-left cursor-pointer transition-colors ${
                        n.read ? 'hover:bg-panel-alt/50 opacity-70' : 'bg-teal-soft/10 hover:bg-teal-soft/20 border-l-2 border-teal'
                      }`}
                    >
                      <span className="text-[16px] shrink-0 mt-0.5 select-none">
                        {n.type === '결재' ? '🖋️' : n.type === '메신저' ? '💬' : '📢'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-ink">{n.senderName}</span>
                          <span className="text-[9px] text-ink3">{n.createdAt.split('T')[0]}</span>
                        </div>
                        <p className="text-[11.5px] font-semibold text-ink2 truncate mt-0.5">{n.title}</p>
                        <p className="text-[10.5px] text-ink3 line-clamp-2 mt-0.5">{n.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            title={user ? `${user.name} (${user.empNo})` : '계정'}
            className={`relative grid h-8 w-8 place-items-center rounded-full bg-teal text-[11.5px] font-bold text-white overflow-hidden ${userOpen ? 'ring-2 ring-white/30' : ''}`}
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="프로필 사진" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
          {userOpen && (
            <UserMenu
              onClose={() => setUserOpen(false)}
              onThemeOpen={() => setThemeOpen(true)}
            />
          )}
        </div>
      </div>

      {themeOpen && <ThemeCustomizerModal open={themeOpen} onClose={() => setThemeOpen(false)} />}
    </header>
  );
}
