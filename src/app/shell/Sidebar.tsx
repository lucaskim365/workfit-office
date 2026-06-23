import type { FlatScreen, MenuNode } from '@/shared/types/menu';
import { MenuGlyph } from '@/shared/ui/MenuGlyph';
import { SCREENS, SCREEN_BY_NAME } from './screens';

interface SidebarProps {
  module: MenuNode;
  activeUrl: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  railOpen: Record<string, boolean>;
  setRailOpen: (fn: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  favs: string[];
  toggleFav: (name: string) => void;
  openTab: (s: FlatScreen) => void;
}

export function Sidebar(props: SidebarProps) {
  const { module, activeUrl, collapsed, setCollapsed, query, setQuery, railOpen, setRailOpen, favs, toggleFav, openTab } = props;
  const railW = collapsed ? 64 : 210;
  const q = query.trim().toLowerCase();
  const searchResults = q ? SCREENS.filter((x) => x.name.toLowerCase().includes(q) || x.groupName.toLowerCase().includes(q)) : [];
  const favScreens = favs.map((n) => SCREEN_BY_NAME[n]).filter(Boolean) as FlatScreen[];

  const FavStar = ({ name, white }: { name: string; white?: boolean }) => {
    const on = favs.includes(name);
    return (
      <span
        role="button"
        onClick={(e) => { e.stopPropagation(); toggleFav(name); }}
        title={on ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        className={`grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-[12px] leading-none ${
          on ? 'text-[#f5b301]' : white ? 'text-white/70' : 'text-ink3 opacity-50'
        }`}
      >
        {on ? '★' : '☆'}
      </span>
    );
  };

  const screenOf = (s: MenuNode, m: MenuNode, g: MenuNode): FlatScreen => ({
    id: s.id, name: s.name, url: s.url!, icon: s.icon, moduleId: m.id, moduleName: m.name, groupId: g.id, groupName: g.name,
  });

  return (
    <aside
      style={{ width: railW }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-panel transition-[width] duration-200"
    >
      {/* 헤더 */}
      <div className={`flex h-[46px] shrink-0 items-center border-b border-border ${collapsed ? 'justify-center' : 'justify-between pl-3.5 pr-2.5'}`}>
        {!collapsed && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-extrabold text-navy">
            <MenuGlyph glyph={module.icon} size={15} color="var(--color-teal)" /> {module.name}
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '펼치기' : '접기'}
          className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-panel-alt text-[12px] text-ink2 hover:bg-bg-deep"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <div className="flex flex-col gap-px overflow-y-auto p-2">
        {/* 검색 */}
        {!collapsed && (
          <div className="relative mb-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메뉴 검색"
              className="h-[34px] w-full rounded-lg border border-border-hi bg-panel-alt pl-[30px] pr-7 text-[11.5px] text-ink outline-none focus:border-teal"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink3">⌕</span>
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-md text-[12px] text-ink3">×</button>
            )}
          </div>
        )}

        {/* 즐겨찾기 */}
        {favScreens.length > 0 && !collapsed && !q && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-[12px] text-[#f5b301]">★</span>
              <span className="flex-1 text-[10.5px] font-extrabold tracking-wide text-ink2">즐겨찾기</span>
              <span className="text-[9.5px] text-ink3">{favScreens.length}</span>
            </div>
            {favScreens.map((s) => {
              const a = s.url === activeUrl;
              return (
                <button
                  key={'fav' + s.id}
                  onClick={() => openTab(s)}
                  className={`flex w-full items-center gap-2.5 rounded-lg py-[7px] pl-3 pr-1.5 text-left transition-colors ${a ? 'bg-teal' : 'hover:bg-panel-alt'}`}
                >
                  <span className="flex w-4 shrink-0 justify-center">
                    <MenuGlyph glyph={s.icon} size={15} color={a ? '#fff' : 'var(--color-ink2)'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11.5px] ${a ? 'font-bold text-white' : 'font-semibold text-ink'}`}>{s.name}</span>
                    <span className={`block truncate text-[9px] ${a ? 'text-white/80' : 'text-ink3'}`}>{s.moduleName} › {s.groupName}</span>
                  </span>
                  <FavStar name={s.name} white={a} />
                </button>
              );
            })}
            <div className="mx-1 mt-1.5 h-px bg-border" />
          </div>
        )}

        {/* 본문: 검색 결과 / 접힘 아이콘 / 그룹 트리 */}
        {collapsed ? (
          (module.children ?? []).flatMap((g) => (g.children ?? []).filter((s) => s.use !== false && s.url).map((s) => ({ s, g }))).map(({ s, g }) => {
            const a = s.url === activeUrl;
            return (
              <button
                key={s.id}
                onClick={() => openTab(screenOf(s, module, g))}
                title={s.name}
                className={`flex flex-col items-center gap-[3px] rounded-[9px] py-2.5 transition-colors ${a ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
              >
                <MenuGlyph glyph={s.icon} size={18} color={a ? 'var(--color-teal)' : 'var(--color-ink3)'} />
                <span className={`text-[8px] font-bold ${a ? 'text-teal' : 'text-ink3'}`}>{s.name.slice(0, 4)}</span>
              </button>
            );
          })
        ) : q ? (
          searchResults.length ? (
            searchResults.map((s) => {
              const a = s.url === activeUrl;
              return (
                <button
                  key={s.id}
                  onClick={() => openTab(s)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${a ? 'bg-teal' : 'hover:bg-panel-alt'}`}
                >
                  <span className="flex w-4 shrink-0 justify-center">
                    <MenuGlyph glyph={s.icon} size={15} color={a ? '#fff' : 'var(--color-ink3)'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11.5px] ${a ? 'font-bold text-white' : 'font-semibold text-ink'}`}>{s.name}</span>
                    <span className={`block truncate text-[9.5px] ${a ? 'text-white/80' : 'text-ink3'}`}>{s.moduleName} › {s.groupName}</span>
                  </span>
                  <FavStar name={s.name} white={a} />
                </button>
              );
            })
          ) : (
            <div className="px-2.5 py-5 text-center text-[11px] text-ink3">검색 결과 없음</div>
          )
        ) : (
          (module.children ?? []).map((g) => {
            const containsActive = (g.children ?? []).some((s) => s.url === activeUrl);
            const open = containsActive || railOpen[g.id] !== false;
            return (
              <div key={g.id} className="mb-0.5">
                <button
                  onClick={() => setRailOpen((o) => ({ ...o, [g.id]: o[g.id] === false }))}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${containsActive ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
                >
                  <span className="flex w-4 shrink-0 justify-center">
                    <MenuGlyph glyph={g.icon} size={15} color="var(--color-teal)" />
                  </span>
                  <span className="flex-1 truncate text-[11.5px] font-extrabold text-navy">{g.name}</span>
                  <span className="text-[8px] text-ink3">{open ? '▾' : '▸'}</span>
                </button>
                {open &&
                  (g.children ?? [])
                    .filter((s) => s.use !== false && s.url)
                    .map((s) => {
                      const a = s.url === activeUrl;
                      return (
                        <button
                          key={s.id}
                          onClick={() => openTab(screenOf(s, module, g))}
                          className={`flex w-full items-center gap-2.5 rounded-lg py-2 pl-[30px] pr-1.5 text-left transition-colors ${a ? 'bg-teal' : 'hover:bg-panel-alt'}`}
                        >
                          <span className={`flex w-4 shrink-0 justify-center ${a ? '' : 'opacity-60'}`}>
                            <MenuGlyph glyph={s.icon} size={15} color={a ? '#fff' : 'var(--color-ink2)'} />
                          </span>
                          <span className={`flex-1 truncate text-[11.5px] ${a ? 'font-bold text-white' : 'font-medium text-ink2'}`}>{s.name}</span>
                          <FavStar name={s.name} white={a} />
                        </button>
                      );
                    })}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
