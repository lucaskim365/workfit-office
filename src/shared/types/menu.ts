/** 3단계 메뉴 트리 노드 (모듈 → 그룹 → 화면). 와이어프레임 menu-tree.js 정본. */
export interface MenuNode {
  id: string;
  name: string;
  url?: string;
  icon?: string;
  order: number;
  use: boolean;
  /** 'admin' — 관리자 콘솔(/admin)에만 나오는 모듈. 업무 화면의 상단 메뉴·탭·사이드바에는 나오지 않는다 */
  area?: 'admin';
  children?: MenuNode[];
}

/** 라우팅용으로 평탄화된 화면 (모듈/그룹 맥락 포함). */
export interface FlatScreen {
  id: string;
  name: string;
  url: string;
  icon?: string;
  moduleId: string;
  moduleName: string;
  groupId: string;
  groupName: string;
  /** 모듈의 area — 'admin' 이면 관리자 콘솔 화면 */
  area?: 'admin';
}
