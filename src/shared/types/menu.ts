/** 3단계 메뉴 트리 노드 (모듈 → 그룹 → 화면). 와이어프레임 menu-tree.js 정본. */
export interface MenuNode {
  id: string;
  name: string;
  url?: string;
  icon?: string;
  order: number;
  use: boolean;
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
}
