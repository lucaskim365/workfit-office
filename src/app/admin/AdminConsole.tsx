import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { FlatScreen, MenuNode } from '@/shared/types/menu';
import { MenuGlyph } from '@/shared/ui/MenuGlyph';
import { MENU_TREE } from '../menu-tree';
import { ADMIN_SCREENS, ADMIN_URL, adminPath } from '../shell/screens';
import { Sidebar } from '../shell/Sidebar';
import { ScrollTopButton } from '../shell/ScrollTopButton';
import { ReloginDialog } from '../auth/ReloginDialog';
import { useAuth } from '../auth/AuthProvider';
import { applyTheme, loadUserTheme } from '@/shared/lib/theme';
import { usePermission } from '@/features/auth/usePermission';
import { useAdminConsoleAccess } from '@/features/auth/useAdminConsoleAccess';
import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import defaultLogo from '@/assets/logo.png';

/** 콘솔 머리 높이 — 업무 화면 상단바와 같다. 화면들의 고정(sticky) 요소가 이 바로 아래에 붙는다 */
const HEADER_H = 58;

/** 관리자 콘솔 모듈(menu-tree 의 area: 'admin') */
const ADMIN_MODULE: MenuNode = MENU_TREE.find((m) => m.area === 'admin')!;

/** 콘솔 메뉴 — 쓰는 화면 중 볼 수 있는 화면만, 영역(그룹)별로 */
export function useAdminMenu() {
  const { canAccess } = usePermission();
  return (ADMIN_MODULE.children ?? [])
    .filter((g) => g.use)
    .map((g) => ({ ...g, children: (g.children ?? []).filter((s) => s.use && s.url && canAccess(s.url)) }))
    .filter((g) => g.children.length > 0);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function Loading() {
  return (
    <div className="grid h-60 place-items-center text-ink3">
      <div className="flex items-center gap-2.5 text-[12.5px] font-semibold">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-hi border-t-teal" />
        화면을 불러오는 중…
      </div>
    </div>
  );
}

/**
 * 관리자 콘솔 — 업무 화면(상단 메뉴·탭·도크)과 따로 된 페이지.
 * 틀은 업무 화면과 같다: 58px 상단바 · 왼쪽 사이드바(같은 Sidebar, 접기·검색·즐겨찾기) · 안에서 스크롤하는 본문 · 푸터.
 * 헤더의 '관리자 콘솔' 단추가 새 창으로 연다(로그인은 같은 브라우저 저장소를 써서 그대로 이어진다).
 * 들어올 수 있는 사람은 useAdminConsoleAccess 한 곳에서 정한다.
 */
export default function AdminConsole({ routes }: { routes: ReactNode }) {
  const { user } = useAuth();
  const { canUse, isLoading } = useAdminConsoleAccess();
  const { data: companyInfo } = useCompanyInfo();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /** 콘솔 안 화면 주소(/admin 을 뗀 /base/user …) — 사이드바의 '지금 화면' 표시용 */
  const activeUrl = pathname.startsWith(ADMIN_URL) ? pathname.slice(ADMIN_URL.length) || '/' : pathname;
  const atHome = activeUrl === '/' || activeUrl === '';

  const [collapsed, setCollapsed] = useState<boolean>(() => readJson('admin_rail_collapsed', false));
  const [query, setQuery] = useState('');
  const [railOpen, setRailOpen] = useState<Record<string, boolean>>(() => readJson('admin_rail_open', {}));
  const [favs, setFavs] = useState<string[]>(() => readJson('admin_favs', []));
  useEffect(() => { try { localStorage.setItem('admin_rail_collapsed', JSON.stringify(collapsed)); } catch { /* noop */ } }, [collapsed]);
  useEffect(() => { try { localStorage.setItem('admin_rail_open', JSON.stringify(railOpen)); } catch { /* noop */ } }, [railOpen]);
  useEffect(() => { try { localStorage.setItem('admin_favs', JSON.stringify(favs)); } catch { /* noop */ } }, [favs]);
  const toggleFav = (name: string) => setFavs((f) => (f.includes(name) ? f.filter((x) => x !== name) : [...f, name]));

  useEffect(() => {
    const t = loadUserTheme(user?.id);
    applyTheme(t.headerBg, t.pointColor, t.btnColor, t.fontScale);
  }, [user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--shell-top', `${HEADER_H}px`);
    const title = document.title;
    document.title = '관리자 콘솔 - WorkFit';
    return () => {
      root.style.removeProperty('--shell-top');
      document.title = title;
    };
  }, []);

  const screens = useMemo<FlatScreen[]>(() => ADMIN_SCREENS, []);

  if (isLoading) return null;
  if (!canUse) return <Navigate to="/exec" replace />;

  /** 사용자 화면 — 콘솔을 연 창이 살아 있으면 그 창으로, 아니면 이 창에서 연다 */
  const toWorkspace = () => {
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      try {
        opener.focus();
        return;
      } catch {
        /* 다른 창에 접근 못 하면 이 창에서 연다 */
      }
    }
    navigate('/exec');
  };

  const openScreen = (s: FlatScreen) => navigate(adminPath(s.url));

  // 콘솔 홈 — 사이드바 그룹 칸과 같은 모양
  const homeSlot = collapsed ? (
    <button
      type="button"
      onClick={() => navigate(ADMIN_URL)}
      title="콘솔 홈"
      className={`flex flex-col items-center gap-[3px] rounded-[9px] py-2.5 transition-colors ${atHome ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
    >
      <MenuGlyph glyph="▦" size={18} color={atHome ? 'var(--color-teal)' : 'var(--color-ink3)'} />
      <span className={`text-[8px] font-bold ${atHome ? 'text-teal' : 'text-ink3'}`}>콘솔 홈</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => navigate(ADMIN_URL)}
      className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${atHome ? 'bg-teal' : 'hover:bg-panel-alt'}`}
    >
      <span className="flex w-4 shrink-0 justify-center">
        <MenuGlyph glyph="▦" size={15} color={atHome ? '#fff' : 'var(--color-teal)'} />
      </span>
      <span className={`flex-1 truncate text-[11.5px] font-extrabold ${atHome ? 'text-white' : 'text-navy'}`}>콘솔 홈</span>
    </button>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg" style={{ height: 'calc(100vh / var(--font-scale, 1))' }}>
      <ReloginDialog />
      {/* 상단바 — 업무 화면 상단바와 같은 높이·색 */}
      <header
        className="flex shrink-0 items-center gap-2.5 px-3.5"
        style={{ height: HEADER_H, backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
      >
        <button type="button" onClick={() => navigate(ADMIN_URL)} className="flex items-center gap-2.5 transition-opacity hover:opacity-80" title="콘솔 홈">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-[7px] border border-black/5 bg-white p-0.5 shadow-sm">
            <img src={companyInfo?.logoUrl || defaultLogo} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="text-left leading-[1.1]">
            <span className="block text-sm font-extrabold tracking-tight">
              WorkFit<span className="text-teal">Admin</span>
            </span>
            <span className="block text-[8.5px] font-semibold opacity-70">관리자 콘솔</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {user && <span className="px-2 text-[12px] opacity-80">{user.name}</span>}
          <button
            type="button"
            onClick={toWorkspace}
            title="업무 화면으로"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold opacity-85 transition-all hover:bg-white/[0.08] hover:opacity-100"
          >
            사용자 화면<ArrowUpRight size={14} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          module={ADMIN_MODULE}
          activeUrl={activeUrl}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          query={query}
          setQuery={setQuery}
          railOpen={railOpen}
          setRailOpen={setRailOpen}
          favs={favs}
          toggleFav={toggleFav}
          openTab={openScreen}
          screens={screens}
          topSlot={homeSlot}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg">
          <div className="p-[18px]">
            <Suspense fallback={<Loading />}>
              <Routes>{routes}</Routes>
            </Suspense>
          </div>
        </main>
      </div>

      <ScrollTopButton />
      <footer
        style={{ backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
        className="flex shrink-0 items-center justify-center gap-2 px-4 py-1.5 text-[10px] opacity-70"
      >
        <span>© {new Date().getFullYear()} WorkFit</span>
        <span>·</span>
        <span>관리자 콘솔</span>
      </footer>
    </div>
  );
}
