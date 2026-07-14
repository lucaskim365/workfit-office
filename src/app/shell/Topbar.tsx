import { useLayoutEffect, useRef, useState } from 'react';
import { MENU_TREE } from '../menu-tree';
import type { FlatScreen, MenuNode } from '@/shared/types/menu';
import { MenuGlyph } from '@/shared/ui/MenuGlyph';
import { UserMenu } from './UserMenu';
import ChangePasswordModal from '@/app/auth/ChangePasswordModal';
import { useAuth } from '@/app/auth/AuthProvider';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

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

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-teal text-sm font-extrabold text-white">W</div>
      <div className="leading-[1.1]">
        <div style={{ color: 'var(--color-header-text)' }} className="text-sm font-extrabold tracking-tight">
          WorkFit<span className="text-teal">Intranet</span>
        </div>
        <div style={{ color: 'var(--color-header-text)', opacity: 0.7 }} className="text-[8.5px] font-semibold">Enterprise Portal Suite</div>
      </div>
    </div>
  );
}

export function Topbar({ activeModuleId, activeUrl, openModule, setOpenModule, userOpen, setUserOpen, onPick, dockOpen, setDockOpen }: TopbarProps) {
  const [pwOpen, setPwOpen] = useState(false);
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
  // 로그인 사용자 이니셜(이름 뒤 2글자). 미로그인/데모 시 기본 표기.
  const initials = user?.name ? user.name.slice(-2) : 'WF';
  return (
    <header
      style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
      className="relative z-50 flex h-[58px] shrink-0 items-center gap-2.5 px-3.5"
    >
      <div className="flex shrink-0 items-center gap-7">
        <Brand />
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
                  className={`flex flex-col items-center gap-[3px] rounded-lg px-[11px] py-1.5 transition-all hover:opacity-100 ${active || isOpen ? 'bg-white/[0.15]' : 'hover:bg-white/[0.08]'
                    }`}
                >
                  <MenuGlyph glyph={m.icon} size={18} />
                  <span className={`whitespace-nowrap text-[11px] ${active ? 'font-bold' : 'font-semibold'}`}>{m.name}</span>
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
                            .filter((s) => s.use !== false && s.url)
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
      <div className="flex shrink-0 items-center gap-3">
        <span style={{ color: 'var(--color-header-text)', opacity: 0.7 }} className="text-[11px] tabular-nums">2026-06-10 09:00</span>
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            title={user ? `${user.name} (${user.empNo})` : '계정'}
            className={`grid h-8 w-8 place-items-center rounded-full bg-teal text-[11.5px] font-bold text-white ${userOpen ? 'ring-2 ring-white/30' : ''}`}
          >
            {initials}
          </button>
          {userOpen && (
            <UserMenu
              onClose={() => setUserOpen(false)}
              onChangePassword={() => setPwOpen(true)}
              onThemeOpen={() => setThemeOpen(true)}
            />
          )}
        </div>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      {themeOpen && <ThemeCustomizerModal open={themeOpen} onClose={() => setThemeOpen(false)} />}
    </header>
  );
}
