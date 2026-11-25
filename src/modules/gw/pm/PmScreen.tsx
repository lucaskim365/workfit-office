import { useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { shortName } from '@/domain/pm/rules';
import type { AlertGo } from '@/domain/pm/alerts';
import { usePmDerived, usePmMutations, usePmSiteMutations } from '@/features/pm/usePm';
import { PM_MENUS, resolvePmRoute } from './menu';
import { usePmPeople } from './usePmPeople';
import { PmScreenTabs, PmViewSwitch } from './ui/PmTabs';
import { FavBox, FavStar, PmBell, PmSearch, PmShellProvider, type Fav } from './ui/PmShell';
import { PmPlaceholder } from './views/PmPlaceholder';
import { WbsListView } from './views/wbs/WbsListView';
import { GanttView } from './views/wbs/GanttView';
import { VarianceView } from './views/wbs/VarianceView';
import { TicketListView } from './views/ticket/TicketListView';
import { usePmModals } from './views/ticket/usePmModals';
import { OverviewView } from './views/dash/OverviewView';
import { SiteView } from './views/dash/SiteView';
import { TeamHoursView, TeamLoadView, TeamTodayView } from './views/dash/TeamView';
import { MyView } from './views/dash/MyView';
import { KpiView } from './views/dash/KpiView';
import { LogView } from './views/dash/LogView';
import { PlanView } from './views/plan/PlanView';
import { DocView } from './views/doc/DocView';

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
  'dash/my': MyView,
  'dash/plan': PlanView,
  'doc/log': LogView,
  'site/kpi': KpiView,
  'doc/audit': DocView,
};

const NO_TITLE = new Set(['sched/gantt', 'risk/delay']);

/**
 * 그룹웨어 › 프로젝트 (`/gw/task`) — 프관 PM 데모를 옮긴 프로젝트 관리.
 *
 * 주소 `?v=<보기 id>` 하나로 메뉴·화면·보기를 정한다 (데모의 `#/p/t`).
 * 새로 고침·즐겨찾기·뒤로 가기가 그대로 동작한다.
 * 위쪽 검색칸(Ctrl+K) · 🔔 알림 · 왼쪽 ★ 즐겨찾기는 모든 화면 공통 (3-7).
 * ([[2026-11-24-pms-port-design]])
 */
export default function PmScreen() {
  const [params, setParams] = useSearchParams();
  const route = resolvePmRoute(params.get('v'));
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  // 알림 · 검색 · 즐겨찾기로 옮기면 화면을 새로 그림 (같은 화면이어도 ?board · ?inbox 같은 시작 값을 다시 읽게)
  const [nav, setNav] = useState(0);

  const go = (viewId: string) => {
    const next = new URLSearchParams(params);
    next.set('v', viewId);
    // 화면을 바꾸면 업무 목록 사업 선택(k)·단계(stage)는 그 화면 것만 — 업무 목록 안에서만 유지
    if (!viewId.startsWith('task/wbs')) { next.delete('k'); next.delete('stage'); next.delete('period'); next.delete('who'); next.delete('st'); }
    for (const x of ['q', 'board', 'inbox', 'pop', 'side', 'fix']) next.delete(x);
    setParams(next);
  };
  /** 알림 · 검색 · 즐겨찾기에서 갈 곳 */
  const goTo = (g: AlertGo) => {
    if (g.kind === 'task') { modals.openTask(g.id); return; }
    if (g.kind === 'ticket') { modals.openTicket(g.no); return; }
    setParams(new URLSearchParams({ v: g.v, ...(g.params ?? {}) }));
    setNav((n) => n + 1);
    window.scrollTo(0, 0);
  };
  const cur: Fav = { v: route.view, k: route.view === 'dash/site' ? params.get('k') ?? '' : '' };
  const favs = d?.snap.favs.find((r) => r.id === people.me)?.items ?? [];
  const shell = { cur, favs, toggleFav: () => smut.toggleFav.mutate(cur), go: goTo };
  const tabs = route.menu.screens.filter((s) => !s.hidden);

  return (
    <PmShellProvider value={shell}>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
        <GwHead icon="task" name="프로젝트" desc={route.menu.desc} />

        <GwSplit
          nav={(
            <div>
              {people.me && <FavBox projects={d?.snap.projects ?? []} onRemove={(f) => smut.toggleFav.mutate(f)} />}
              <GwSideNav
                title="프로젝트 관리"
                desc="사업 · 업무 · 점검 · 손익을 한 곳에서 관리합니다."
                items={PM_MENUS.map((m) => ({ id: m.id, icon: m.icon, label: m.label }))}
                activeId={route.menu.id}
                onSelect={go}
              />
            </div>
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <PmSearch people={people} />
            <span className="flex-1" />
            {people.me && <PmBell people={people} />}
          </div>
          <section className="rounded-xl border border-border bg-panel shadow-sm">
            <PmScreenTabs
              items={tabs.map((s) => ({ id: s.id, label: s.label }))}
              activeId={route.screen.id}
              onSelect={go}
            />
            <div className="p-5 sm:p-6">
              {route.screen.views && route.screen.id !== 'dash/overview' && (
                <div className="mb-4 flex items-center gap-2">
                  <PmViewSwitch items={route.screen.views} activeId={route.view} onSelect={go} />
                  {/* 제목이 없는 보기(간트 · 일정 변동)는 보기 전환 옆에 ☆ */}
                  {NO_TITLE.has(route.view) && <FavStar />}
                </div>
              )}
              {(() => { const V = VIEWS[route.view]; return V ? <V key={nav} /> : <PmPlaceholder viewId={route.view} />; })()}
            </div>
          </section>
        </GwSplit>
      </div>
      {modals.node}
    </PmShellProvider>
  );
}
