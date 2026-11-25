import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { PM_MENUS, resolvePmRoute } from './menu';
import { PmScreenTabs, PmViewSwitch } from './ui/PmTabs';
import { PmPlaceholder } from './views/PmPlaceholder';
import { WbsListView } from './views/wbs/WbsListView';
import { GanttView } from './views/wbs/GanttView';
import { VarianceView } from './views/wbs/VarianceView';
import { TicketListView } from './views/ticket/TicketListView';
import { OverviewView } from './views/dash/OverviewView';
import { SiteView } from './views/dash/SiteView';
import { TeamHoursView, TeamLoadView, TeamTodayView } from './views/dash/TeamView';

/** 옮긴 보기 → 화면. 없는 보기는 '옮기는 중' 자리 */
const VIEWS: Record<string, ComponentType> = {
  'task/wbs': WbsListView,
  'sched/gantt': GanttView,
  'risk/delay': VarianceView,
  'task/ticket': TicketListView,
  'dash/overview': OverviewView,
  'dash/site': SiteView,
  'dash/team': TeamTodayView,
  'sched/load': TeamLoadView,
  'dash/hours': TeamHoursView,
};

/**
 * 그룹웨어 › 프로젝트 (`/gw/task`) — 프관 PM 데모를 옮긴 프로젝트 관리.
 *
 * 주소 `?v=<보기 id>` 하나로 메뉴·화면·보기를 정한다 (데모의 `#/p/t`).
 * 새로 고침·즐겨찾기·뒤로 가기가 그대로 동작한다.
 * ([[2026-11-24-pms-port-design]])
 */
export default function PmScreen() {
  const [params, setParams] = useSearchParams();
  const route = resolvePmRoute(params.get('v'));

  const go = (viewId: string) => {
    const next = new URLSearchParams(params);
    next.set('v', viewId);
    // 화면을 바꾸면 업무 목록 사업 선택(k)·단계(stage)는 그 화면 것만 — 업무 목록 안에서만 유지
    if (!viewId.startsWith('task/wbs')) { next.delete('k'); next.delete('stage'); next.delete('period'); next.delete('who'); next.delete('st'); }
    setParams(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="task" name="프로젝트" desc={route.menu.desc} />

      <GwSplit
        nav={(
          <GwSideNav
            title="프로젝트 관리"
            desc="사업 · 업무 · 점검 · 손익을 한 곳에서 관리합니다."
            items={PM_MENUS.map((m) => ({ id: m.id, icon: m.icon, label: m.label }))}
            activeId={route.menu.id}
            onSelect={go}
          />
        )}
      >
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          <PmScreenTabs
            items={route.menu.screens.map((s) => ({ id: s.id, label: s.label }))}
            activeId={route.screen.id}
            onSelect={go}
          />
          <div className="p-5 sm:p-6">
            {route.screen.views && (
              <div className="mb-4">
                <PmViewSwitch items={route.screen.views} activeId={route.view} onSelect={go} />
              </div>
            )}
            {(() => { const V = VIEWS[route.view]; return V ? <V /> : <PmPlaceholder viewId={route.view} />; })()}
          </div>
        </section>
      </GwSplit>
    </div>
  );
}
