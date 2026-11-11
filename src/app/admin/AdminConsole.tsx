import { Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, NavLink, Routes, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, FileSignature, LayoutDashboard, Server, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { MENU_TREE } from '../menu-tree';
import { ADMIN_URL, adminPath } from '../shell/screens';
import { ReloginDialog } from '../auth/ReloginDialog';
import { useAuth } from '../auth/AuthProvider';
import { applyTheme, loadUserTheme } from '@/shared/lib/theme';
import { usePermission } from '@/features/auth/usePermission';
import { useAdminConsoleAccess } from '@/features/auth/useAdminConsoleAccess';
import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import defaultLogo from '@/assets/logo.png';

/** 콘솔 머리 높이 — 화면들의 고정(sticky) 요소가 이 바로 아래에 붙는다 */
const HEADER_H = 56;

/** 영역(그룹)별 아이콘 */
const GROUP_ICON: Record<string, LucideIcon> = {
  G_ADM_MEMBER: Users,
  G_ADM_AUTH: ShieldCheck,
  G_ADM_APPROVAL: FileSignature,
  G_ADM_COMPANY: Building2,
  G_ADM_SYSTEM: Server,
};

/** 콘솔 왼쪽 메뉴 — area: 'admin' 모듈의 그룹·화면(쓰는 화면만, 볼 수 있는 화면만) */
export function useAdminMenu() {
  const { canAccess } = usePermission();
  return MENU_TREE.filter((m) => m.area === 'admin' && m.use)
    .flatMap((m) => m.children ?? [])
    .filter((g) => g.use)
    .map((g) => ({ ...g, children: (g.children ?? []).filter((s) => s.use && s.url && canAccess(s.url)) }))
    .filter((g) => g.children.length > 0);
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
 * 헤더의 '관리자 콘솔' 단추가 새 창으로 연다(로그인은 같은 브라우저 저장소를 써서 그대로 이어진다).
 * 들어올 수 있는 사람은 useAdminConsoleAccess 한 곳에서 정한다.
 */
export default function AdminConsole({ routes }: { routes: ReactNode }) {
  const { user } = useAuth();
  const { canUse, isLoading } = useAdminConsoleAccess();
  const menu = useAdminMenu();
  const { data: companyInfo } = useCompanyInfo();
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen flex-col bg-bg" style={{ minHeight: 'calc(100vh / var(--font-scale, 1))' }}>
      <ReloginDialog />
      <header
        className="sticky top-0 z-50 flex shrink-0 items-center gap-3 px-4"
        style={{ height: HEADER_H, backgroundColor: 'var(--color-header-bg)', color: 'var(--color-header-text)' }}
      >
        <NavLink to={ADMIN_URL} end className="flex items-center gap-2.5 hover:opacity-85">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-[7px] border border-black/5 bg-white p-0.5">
            <img src={companyInfo?.logoUrl || defaultLogo} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="text-[14px] font-extrabold tracking-tight">WorkFit</span>
          <span className="rounded border border-current/30 px-1.5 py-px text-[11px] font-bold opacity-85">관리자</span>
        </NavLink>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          {user && <span className="opacity-80">{user.name}</span>}
          <button
            type="button"
            onClick={toWorkspace}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 font-semibold hover:bg-white/[0.12]"
          >
            사용자 화면<ArrowUpRight size={13} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="관리자 메뉴"
          className="sticky shrink-0 self-start overflow-y-auto border-r border-border bg-panel px-3 py-4"
          style={{ top: HEADER_H, width: 210, height: `calc(100vh / var(--font-scale, 1) - ${HEADER_H}px)` }}
        >
          <NavLink
            to={ADMIN_URL}
            end
            className={({ isActive }) =>
              `mb-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold ${isActive ? 'bg-panel-alt text-ink' : 'text-ink2 hover:bg-panel-alt'}`
            }
          >
            <LayoutDashboard size={15} className="text-ink3" />콘솔 홈
          </NavLink>
          {menu.map((g) => {
            const Icon = GROUP_ICON[g.id] ?? LayoutDashboard;
            return (
              <div key={g.id} className="mb-3">
                <div className="flex items-center gap-2 px-2.5 pb-1 text-[11.5px] font-bold text-ink3">
                  <Icon size={13} />{g.name}
                </div>
                <ul className="m-0 list-none p-0">
                  {g.children.map((s) => (
                    <li key={s.id}>
                      <NavLink
                        to={adminPath(s.url!)}
                        className={({ isActive }) =>
                          `block rounded-lg py-1.5 pr-2.5 pl-[30px] text-[13px] ${isActive ? 'bg-panel-alt font-semibold text-ink' : 'text-ink2 hover:bg-panel-alt'}`
                        }
                      >
                        {s.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 p-[18px]">
          <Suspense fallback={<Loading />}>
            <Routes>{routes}</Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
