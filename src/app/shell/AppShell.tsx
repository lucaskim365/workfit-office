import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { FlatScreen } from '@/shared/types/menu';
import { MENU_TREE } from '../menu-tree';
import { SCREEN_BY_URL, HOME_URL } from './screens';
import { gwScreen } from './gw-screens';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { QuickDock } from './QuickDock';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function NoTab() {
  return (
    <div className="grid h-full place-items-center text-ink3">
      <div className="text-center">
        <div className="mb-2 text-[27px] opacity-40">▦</div>
        <div className="text-[12.5px] font-semibold">열린 화면이 없습니다. 좌측 메뉴에서 선택하세요.</div>
      </div>
    </div>
  );
}

function ScreenLoading() {
  return (
    <div className="grid h-full place-items-center text-ink3">
      <div className="flex items-center gap-2.5 text-[12.5px] font-semibold">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-hi border-t-teal" />
        화면을 불러오는 중…
      </div>
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeUrl = location.pathname;

  // 라우트(URL) → 탭용 화면. MES 메뉴 화면 우선, 없으면 그룹웨어(도크 전용) 합성.
  const resolveScreen = (url: string) => SCREEN_BY_URL[url] ?? gwScreen(url);
  const initialScreen = resolveScreen(activeUrl) ?? SCREEN_BY_URL[HOME_URL];
  const [tabs, setTabs] = useState<FlatScreen[]>(initialScreen ? [initialScreen] : []);
  const [collapsed, setCollapsed] = useState(false);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<string[]>(() => loadJSON('mes_favs', []));
  const [railOpen, setRailOpen] = useState<Record<string, boolean>>(() => loadJSON('mes_rail_open', {}));

  // 본문 스크롤 중에는 우측 퀵 도크를 비켜나게(yield) 한다 — 멈추면 650ms 뒤 복귀.
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMainScroll = () => {
    setScrolling(true);
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setScrolling(false), 650);
  };
  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  useEffect(() => { try { localStorage.setItem('mes_favs', JSON.stringify(favs)); } catch { /* noop */ } }, [favs]);
  useEffect(() => { try { localStorage.setItem('mes_rail_open', JSON.stringify(railOpen)); } catch { /* noop */ } }, [railOpen]);

  // 현재 라우트에 해당하는 탭이 없으면 자동으로 연다 — 도크(그룹웨어)·딥링크·뒤로가기 모두 커버.
  // MES 화면은 openTab 이 먼저 추가하므로 여기선 no-op, 그룹웨어는 여기서 탭이 생긴다.
  useEffect(() => {
    const s = SCREEN_BY_URL[activeUrl] ?? gwScreen(activeUrl);
    if (s) setTabs((prev) => (prev.some((t) => t.url === s.url) ? prev : [...prev, s]));
  }, [activeUrl]);

  const activeScreen = resolveScreen(activeUrl);
  const activeModuleId = activeScreen?.moduleId ?? MENU_TREE[0].id;
  const activeModule = MENU_TREE.find((m) => m.id === activeModuleId) ?? MENU_TREE[0];

  const openTab = (s: FlatScreen) => {
    setTabs((prev) => (prev.some((t) => t.url === s.url) ? prev : [...prev, s]));
    setOpenModule(null);
    if (s.url !== activeUrl) navigate(s.url);
  };
  const closeTab = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.url === url);
      const next = prev.filter((t) => t.url !== url);
      if (url === activeUrl) {
        const nb = next[idx] ?? next[idx - 1];
        if (nb) navigate(nb.url);
      }
      return next;
    });
  };
  const toggleFav = (name: string) =>
    setFavs((f) => (f.includes(name) ? f.filter((x) => x !== name) : [...f, name]));

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg">
      <Topbar
        activeModuleId={activeModuleId}
        activeUrl={activeUrl}
        openModule={openModule}
        setOpenModule={setOpenModule}
        userOpen={userOpen}
        setUserOpen={setUserOpen}
        onPick={openTab}
      />

      {/* 모듈 드롭다운 딤 */}
      {openModule && <div onClick={() => setOpenModule(null)} className="absolute inset-x-0 bottom-0 top-[58px] z-40 bg-navy-deep/30" />}

      <div className="flex min-h-0 flex-1">
        <Sidebar
          module={activeModule}
          activeUrl={activeUrl}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          query={query}
          setQuery={setQuery}
          railOpen={railOpen}
          setRailOpen={setRailOpen}
          favs={favs}
          toggleFav={toggleFav}
          openTab={openTab}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar
            tabs={tabs}
            activeUrl={activeUrl}
            onSelect={(url) => navigate(url)}
            onClose={closeTab}
            menuOpen={tabMenuOpen}
            setMenuOpen={setTabMenuOpen}
          />
          <main onScroll={onMainScroll} className="content-scroll min-h-0 flex-1 overflow-auto bg-bg pr-3">
            {tabs.length === 0 ? (
              <NoTab />
            ) : (
              <div className="p-[18px]">
                <Suspense fallback={<ScreenLoading />}>
                  <Outlet />
                </Suspense>
              </div>
            )}
          </main>
        </div>
      </div>

      <QuickDock scrolling={scrolling} />
      {/* 실시간 알림 토스트 피드 중지 — 필요 시 <ToastFeed /> 복원 */}
    </div>
  );
}
