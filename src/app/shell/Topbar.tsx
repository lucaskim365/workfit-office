import { useState } from 'react';
import { MENU_TREE } from '../menu-tree';
import type { FlatScreen, MenuNode } from '@/shared/types/menu';
import { MenuGlyph } from '@/shared/ui/MenuGlyph';
import { UserMenu } from './UserMenu';
import ChangePasswordModal from '@/app/auth/ChangePasswordModal';

const NOTICE_TICKER = [
  '[WorkFit] M-line · Fab1 정상 가동 중',
  'MES v5.2 정기 배포 안내 (06/12 02:00)',
  '수입검사 기준 변경 — 신규 항목 적용',
  '설비 가동 코드 표준 개정 공지',
  '2분기 품질 교육 일정 안내 (06/20)',
];

interface TopbarProps {
  activeModuleId: string;
  activeUrl: string;
  openModule: string | null;
  setOpenModule: (id: string | null) => void;
  userOpen: boolean;
  setUserOpen: (v: boolean) => void;
  onPick: (screen: FlatScreen) => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-teal text-sm font-extrabold text-white">W</div>
      <div className="leading-[1.1]">
        <div className="text-sm font-extrabold tracking-tight text-white">
          WorkFit<span className="text-teal">MES</span>
        </div>
        <div className="text-[8.5px] font-semibold text-[#9fabc6]">Smart Factory Suite</div>
      </div>
    </div>
  );
}

export function Topbar({ activeModuleId, activeUrl, openModule, setOpenModule, userOpen, setUserOpen, onPick }: TopbarProps) {
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <header className="relative z-50 flex h-[58px] shrink-0 items-center gap-2.5 bg-navy-deep px-3.5">
      <div className="flex shrink-0 items-center gap-7">
        <Brand />
        <nav className="flex gap-0.5">
          {MENU_TREE.map((m) => {
            const active = m.id === activeModuleId;
            const isOpen = openModule === m.id;
            const groups = (m.children ?? []).filter((g) => g.use !== false);
            const screenCount = groups.reduce((s, g) => s + (g.children?.filter((x) => x.use !== false).length ?? 0), 0);
            const cols = groups.length > 3 ? 3 : groups.length > 1 ? 2 : 1;
            return (
              <div key={m.id} className="relative">
                <button
                  onClick={() => setOpenModule(isOpen ? null : m.id)}
                  className={`flex flex-col items-center gap-[3px] rounded-lg px-[11px] py-1.5 transition-colors ${
                    active || isOpen ? 'bg-white/[0.13] text-white' : 'text-[#9fabc6] hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <MenuGlyph glyph={m.icon} size={18} />
                  <span className={`whitespace-nowrap text-[11px] ${active ? 'font-bold' : 'font-semibold'}`}>{m.name}</span>
                </button>

                {isOpen && (
                  <div
                    className="absolute left-1/2 top-[calc(100%+10px)] z-[60] flex max-h-[calc(100vh-88px)] -translate-x-1/2 flex-col rounded-xl border border-border bg-panel p-2 shadow-[0_16px_40px_rgba(16,24,48,0.22)]"
                    style={{ width: cols === 3 ? 624 : cols === 2 ? 432 : 248 }}
                  >
                    <div className="absolute -top-1.5 left-1/2 -ml-1.5 h-3 w-3 rotate-45 border-l border-t border-border bg-panel" />
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
                                  className={`flex w-full items-center gap-2 rounded-[7px] py-[7px] pl-4 pr-2.5 text-left transition-colors ${
                                    cur ? 'bg-teal-soft' : 'hover:bg-panel-alt'
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

      {/* 공지 마퀴 */}
      <div className="flex h-[30px] min-w-[48px] flex-1 items-center gap-2 overflow-hidden rounded-[7px] bg-white/10 px-3">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#5fe0d8]">📢 공지</span>
        <span className="h-3.5 w-px shrink-0 bg-white/20" />
        <div className="flex-1 overflow-hidden">
          <div className="mes-marquee flex w-max">
            {[0, 1].map((k) => (
              <span key={k} className="inline-flex gap-6 pr-6 text-[11px] font-medium text-[#dfe6f2]">
                {NOTICE_TICKER.map((n, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-[#5fe0d8]" />
                    {n}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 날짜 + 계정 */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="text-[11px] tabular-nums text-[#9fabc6]">2026-06-10 09:00</span>
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            title="계정"
            className={`grid h-8 w-8 place-items-center rounded-full bg-teal text-[11.5px] font-bold text-white ${userOpen ? 'ring-2 ring-white/30' : ''}`}
          >
            KS
          </button>
          {userOpen && (
            <UserMenu
              onClose={() => setUserOpen(false)}
              onChangePassword={() => setPwOpen(true)}
            />
          )}
        </div>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </header>
  );
}
