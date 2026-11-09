/** 좌측 메뉴를 잠시 접어 달라는 요청 — detail true 접기 / false 원래대로(AppShell 이 듣는다) */
export const COLLAPSE_SIDEBAR_EVENT = 'workfit:collapse-sidebar';

export function requestSidebarCollapse(on: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(COLLAPSE_SIDEBAR_EVENT, { detail: on }));
}
