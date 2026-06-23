import { MENU_TREE } from './menu-tree';
import type { FlatScreen, MenuNode } from '@/shared/types/menu';

/** 메뉴 트리를 라우팅 가능한 화면 목록으로 평탄화. use=false 화면은 제외. */
export function flattenScreens(tree: MenuNode[] = MENU_TREE): FlatScreen[] {
  const out: FlatScreen[] = [];
  for (const mod of tree) {
    if (!mod.use) continue;
    for (const grp of mod.children ?? []) {
      if (!grp.use) continue;
      for (const scr of grp.children ?? []) {
        if (!scr.use || !scr.url) continue;
        out.push({
          id: scr.id,
          name: scr.name,
          url: scr.url,
          icon: scr.icon,
          moduleId: mod.id,
          moduleName: mod.name,
          groupId: grp.id,
          groupName: grp.name,
        });
      }
    }
  }
  return out;
}
