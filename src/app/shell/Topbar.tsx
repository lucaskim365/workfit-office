import { Link } from 'react-router-dom';
import type { MenuNode } from '@/shared/types/menu';
import { moduleEntryUrl } from '../menu-tree';

interface TopbarProps {
  modules: MenuNode[];
  activeModuleId: string;
}

/** 상단 모듈 내비게이션 — 와이어프레임 app-shell 상단 바 기준. */
export default function Topbar({ modules, activeModuleId }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 bg-navy-deep px-4 text-white">
      {/* 브랜드 */}
      <div className="mr-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded bg-teal text-sm font-bold text-white">
          M
        </span>
        <span className="text-sm font-bold tracking-tight">Smart MES</span>
      </div>

      {/* 모듈 내비 */}
      <nav className="flex items-center gap-0.5 overflow-x-auto">
        {modules.map((m) => {
          const active = m.id === activeModuleId;
          return (
            <Link
              key={m.id}
              to={moduleEntryUrl(m)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 우측 환경/프로필 */}
      <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-white/70">
        <span className="hidden rounded-md bg-white/10 px-2 py-1 sm:inline">
          [WorkFit] M-line · Fab1
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-teal text-[11px] font-bold text-white">
          KS
        </span>
      </div>
    </header>
  );
}
