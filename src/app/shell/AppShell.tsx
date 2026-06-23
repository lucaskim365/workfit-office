import { Outlet, useLocation } from 'react-router-dom';
import { MENU_TREE, modulePrefix } from '../menu-tree';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

/** 앱 셸: 상단 모듈 내비 + 좌측 사이드바 + 콘텐츠(Outlet). */
export default function AppShell() {
  const location = useLocation();
  const seg = '/' + (location.pathname.split('/')[1] ?? '');
  const activeModule =
    MENU_TREE.find((m) => modulePrefix(m) === seg) ?? MENU_TREE[0];

  return (
    <div className="flex h-screen flex-col">
      <Topbar modules={MENU_TREE} activeModuleId={activeModule.id} />
      <div className="flex min-h-0 flex-1">
        <Sidebar module={activeModule} />
        <main className="flex-1 overflow-y-auto bg-bg p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
