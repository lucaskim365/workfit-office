import { NavLink } from 'react-router-dom';
import type { MenuNode } from '@/shared/types/menu';

interface SidebarProps {
  module: MenuNode;
}

/** 좌측 사이드바 — 활성 모듈의 그룹(중분류) + 화면(소분류) 표시. */
export default function Sidebar({ module }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-panel">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="text-teal">{module.icon}</span>
          {module.name}
        </div>
      </div>

      <nav className="p-3">
        {(module.children ?? []).map((grp) => (
          <div key={grp.id} className="mb-4">
            <div className="px-2 pb-1.5 text-[11px] font-bold tracking-wide text-ink3 uppercase">
              {grp.name}
            </div>
            <div className="space-y-0.5">
              {(grp.children ?? []).map((scr) => (
                <NavLink
                  key={scr.id}
                  to={scr.url ?? '#'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-teal-soft font-semibold text-navy'
                        : 'text-ink2 hover:bg-panel-alt'
                    }`
                  }
                >
                  <span className="text-ink3">{scr.icon}</span>
                  <span className="truncate">{scr.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
