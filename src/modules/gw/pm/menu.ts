/**
 * 프로젝트 관리(PMS) 메뉴 구성 — 프관 PM 데모(`FactoryFlow_PM_데모.html`)의 `MENU_P1` 을 그대로 옮긴다.
 *
 * 3단 구조: 메뉴(왼쪽 카드) → 화면(위쪽 탭) → 보기(화면 안 전환 버튼).
 * 화면 id 는 데모의 `p/t` 주소(`dash/overview` 등)를 그대로 써서, 데모 코드와 대조하기 쉽게 둔다.
 * ([[2026-11-24-pms-port-design]] §1.1)
 */

export interface PmView {
  /** 데모 주소 `p/t` */
  id: string;
  label: string;
}

export interface PmScreenDef {
  /** 데모 주소 `p/t` (보기가 있으면 첫 보기와 같다) */
  id: string;
  label: string;
  /** 화면 안 전환 버튼 (데모의 3단). 없으면 화면 하나 */
  views?: PmView[];
  /** 메뉴 탭에 없는 화면 (데모 HIDDEN_PARENT) — 다른 화면 버튼 · 검색 · 즐겨찾기로만 들어옴 */
  hidden?: boolean;
}

export interface PmMenuDef {
  id: string;
  label: string;
  /** `MenuGlyph` 글리프 */
  icon: string;
  desc: string;
  screens: PmScreenDef[];
}

export const PM_MENUS: PmMenuDef[] = [
  {
    id: 'dash',
    label: '대시보드',
    icon: '▦',
    desc: '사업 전체 현황과 팀 · 내 업무, 업무계획을 한 곳에서 확인합니다.',
    screens: [
      { id: 'dash/overview', label: '통합 사업 현황', views: [{ id: 'dash/overview', label: '전체 사업' }, { id: 'dash/site', label: '사업별' }] },
      { id: 'dash/team', label: '팀 현황', views: [{ id: 'dash/team', label: '오늘' }, { id: 'sched/load', label: '앞으로 4주' }, { id: 'dash/hours', label: '투입 시간' }] },
      { id: 'dash/my', label: '내 업무' },
      { id: 'dash/plan', label: '업무계획' },
      // 탭에 없는 화면 (데모 HIDDEN_PARENT: doc/log · site/kpi → 대시보드)
      { id: 'doc/log', label: '업무 기록 · 과제 수행일지', hidden: true },
      { id: 'site/kpi', label: '성과지표 실측', hidden: true },
    ],
  },
  {
    id: 'task',
    label: '업무 목록 · 티켓',
    icon: '☑',
    desc: '사업별 업무 목록을 보고 세부 작업을 티켓으로 발행 · 관리합니다.',
    screens: [
      { id: 'task/wbs', label: '업무 목록', views: [{ id: 'task/wbs', label: '목록' }, { id: 'sched/gantt', label: '간트' }, { id: 'risk/delay', label: '일정 변동' }] },
      { id: 'task/ticket', label: '티켓 목록' },
    ],
  },
  {
    id: 'doc',
    label: '점검 · 요구사항 · 산출물',
    icon: '📋',
    desc: '점검 · 감리 일정에 대비하고 요구사항 변경과 산출물 제출을 관리합니다.',
    screens: [
      { id: 'doc/insp', label: '점검 · 감리 대비' },
      { id: 'site/cr', label: '요구사항(CR)' },
      { id: 'doc/audit', label: '산출물' },
    ],
  },
  {
    id: 'risk',
    label: '이슈 · 회의 · 보고',
    icon: '💬',
    desc: '현장 · 개발 이슈와 회의록, 주간 진행률 보고를 관리합니다.',
    screens: [
      { id: 'risk/issue', label: '이슈' },
      { id: 'doc/meet', label: '회의록 · 액션 아이템' },
      { id: 'doc/check', label: '주간 진행률 · 보고서', views: [{ id: 'doc/check', label: '진행률 갱신' }, { id: 'doc/report', label: '주간 보고서' }] },
    ],
  },
  {
    id: 'money',
    label: '사업 · 손익',
    icon: '📊',
    desc: '사업별 매출 · 원가 · 이익과 월별 · 연간 손익을 확인합니다.',
    screens: [
      { id: 'money/site', label: '사업별 수익' },
      { id: 'money/pl', label: '월별 · 연간 손익' },
    ],
  },
  {
    id: 'master',
    label: '기준정보',
    icon: '⚙',
    desc: '사업 · 인력 · 코드와 지원 기준, 품목 단가를 관리합니다.',
    screens: [
      { id: 'master/base', label: '사업 · 인력 · 코드' },
      { id: 'money/rules', label: '지원 기준 · 단가' },
      { id: 'money/items', label: '품목 · 단가' },
      { id: 'master/log', label: '활동 기록' },
    ],
  },
];

export interface PmRoute {
  menu: PmMenuDef;
  screen: PmScreenDef;
  /** 보기 id (보기 없는 화면은 화면 id) */
  view: string;
}

/**
 * 주소의 보기 id → 메뉴·화면·보기. 모르는 id 면 첫 메뉴 첫 화면.
 * 메뉴 id 만 오면 그 메뉴의 첫 화면 (데모: 메뉴를 누르면 첫 화면이 열림).
 */
export function resolvePmRoute(viewId: string | null | undefined): PmRoute {
  for (const menu of PM_MENUS) {
    for (const screen of menu.screens) {
      if (screen.id === viewId || screen.views?.some((v) => v.id === viewId)) {
        return { menu, screen, view: viewId as string };
      }
    }
  }
  const menu = PM_MENUS.find((m) => m.id === viewId) ?? PM_MENUS[0];
  const screen = menu.screens[0];
  return { menu, screen, view: screen.id };
}
