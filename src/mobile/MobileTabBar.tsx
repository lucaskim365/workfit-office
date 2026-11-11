import { House, Globe, MessageSquare, Sparkles } from 'lucide-react';

/** 하단 탭 — 왼쪽부터 홈·그룹웨어·Widdy·메신저 */
const TABS = [
  { path: '/m/exec', label: '홈', icon: House },
  { path: '/m', label: '그룹웨어', icon: Globe },
  { path: '/m/widdy', label: 'Widdy', icon: Sparkles },
  { path: '/m/chat', label: '메신저', icon: MessageSquare },
] as const;

const countText = (n: number) => (n > 99 ? '99+' : String(n));

export default function MobileTabBar({
  pathname,
  pendingApprovals,
  unreadChats,
  onSelect,
}: {
  pathname: string;
  pendingApprovals: number;
  unreadChats: number;
  onSelect: (path: string) => void;
}) {
  const current = pathname.replace(/\/$/, '');
  return (
    <nav
      aria-label="하단 메뉴"
      className="m-header flex shrink-0 items-stretch gap-1 px-2 pt-1 select-none"
      style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
    >
      {TABS.map((t) => {
        const active = current === t.path;
        const Icon = t.icon;
        const count = t.path === '/m' ? pendingApprovals : t.path === '/m/chat' ? unreadChats : 0;
        return (
          <button
            key={t.path}
            type="button"
            onClick={() => onSelect(t.path)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold ${active ? 'bg-white/10 text-white' : 'text-white/60'}`}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.9} />
            <span className="truncate">{t.label}</span>
            {count > 0 && (
              <span className="absolute left-[56%] top-1 rounded-full bg-[#ff687d] px-1.5 py-px text-[10px] font-bold leading-4 text-white" style={{ color: '#fff' }}>
                {countText(count)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
