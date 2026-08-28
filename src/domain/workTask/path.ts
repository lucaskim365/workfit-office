import { WORK_TASK_MAX_LEVEL } from './schema';

/**
 * 과업 트리의 경로(`path`) 계산 — 생성·이동·재계산.
 * ([[프로젝트관리_고도화_계획서.md]] §3)
 *
 * **왜 경로를 문자열로 굳히는가**: Appwrite에는 재귀 쿼리도 조인도 없다. "이 대과업 밑
 * 전부"를 가져오려면 단계마다 쿼리를 날려야 하고 그러면 N+1로 터진다. 조상 순번을
 * `"0002.0005.0001"` 처럼 이어 붙여 두면 하위 전체 조회가 prefix 검색 한 번이고,
 * 트리 정렬도 `path` 오름차순 하나로 끝난다.
 *
 * **`parentId`가 진실의 원천이고 `path`는 파생값이다.** 서브트리 이동은 여러 문서를
 * 갱신하는데 Appwrite에는 트랜잭션이 없어 도중에 실패할 수 있다. 그때 `path`는 깨져도
 * `parentId`는 남으므로 `rebuildPaths()` 로 되살린다.
 */

/** 한 마디 자릿수. 형제가 9999를 넘으면 정렬이 깨진다(현실적으로 도달하지 않는다). */
const SEGMENT_WIDTH = 4;
const MAX_ORDER = 10 ** SEGMENT_WIDTH - 1;

export class WorkTaskTreeError extends Error {
  constructor(
    public readonly code: 'DEPTH_EXCEEDED' | 'CYCLE' | 'ORDER_OVERFLOW' | 'PARENT_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'WorkTaskTreeError';
  }
}

/**
 * 트리 계산에 필요한 최소 형태. `WorkTask` 전체를 받지 않아 테스트가 가볍다.
 *
 * `path`·`level`은 현재 저장값이다 — 이동 시 "무엇이 실제로 바뀌었는지" 가려내는 데만
 * 쓰고, 계산은 언제나 `parentId`·`sortOrder`에서 다시 한다.
 */
export interface TreeNode {
  id: string;
  trackId: string | null;
  parentId: string | null;
  sortOrder: number;
  path?: string;
  level?: number;
}

/** 형제 순번 → 경로 한 마디. `3` → `"0003"` */
export function segment(order: number): string {
  if (!Number.isInteger(order) || order < 0 || order > MAX_ORDER) {
    throw new WorkTaskTreeError('ORDER_OVERFLOW', `형제 순번이 범위를 벗어났습니다: ${order}`);
  }
  return String(order).padStart(SEGMENT_WIDTH, '0');
}

/** 부모 경로 + 형제 순번 → 자식 경로. 부모가 없으면(대과업) 마디 하나짜리. */
export function joinPath(parentPath: string | null, order: number): string {
  const seg = segment(order);
  return parentPath ? `${parentPath}.${seg}` : seg;
}

/** 경로의 마디 수 = 그 과업의 level. */
export function pathLevel(path: string): number {
  return path.split('.').length;
}

/**
 * `path`가 `ancestorPath`의 **하위**인가. 자기 자신은 하위가 아니다.
 *
 * 마디 경계를 지키려고 `.`를 붙여 비교한다. 그냥 `startsWith("0001")` 로 하면
 * `"00010"`(존재할 수 없지만) 같은 값이나 형제 경로를 잘못 잡을 여지가 생긴다.
 */
export function isDescendantPath(path: string, ancestorPath: string): boolean {
  return path.startsWith(`${ancestorPath}.`);
}

/**
 * 하위 전체 조회에 쓸 prefix. 저장소는 `startsWith(path, descendantPrefix(p))` 로 던진다.
 */
export function descendantPrefix(ancestorPath: string): string {
  return `${ancestorPath}.`;
}

/** 같은 부모(같은 트랙) 아래 다음 형제 순번. 비어 있으면 0. */
export function nextSortOrder(nodes: TreeNode[], trackId: string | null, parentId: string | null): number {
  const siblings = nodes.filter((n) => n.trackId === trackId && n.parentId === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((n) => n.sortOrder)) + 1;
}

/**
 * 전체 노드의 `path`·`level`을 `parentId`·`sortOrder`에서 다시 계산한다.
 *
 * 이동 후 갱신, 이관, 그리고 **`path`가 깨졌을 때의 복구**에 모두 쓴다.
 * 부모를 못 찾는 고아 노드는 대과업으로 끌어올리지 않고 결과에서 뺀다 — 조용히 위치를
 * 바꾸면 트리가 사람 몰래 재배치된다. 호출부가 빠진 id를 보고 판단한다.
 */
export function rebuildPaths(nodes: TreeNode[]): Map<string, { path: string; level: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, TreeNode[]>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }
    if (!byId.has(node.parentId)) continue; // 고아 — 결과에서 제외
    const list = childrenOf.get(node.parentId);
    if (list) list.push(node);
    else childrenOf.set(node.parentId, [node]);
  }

  const result = new Map<string, { path: string; level: number }>();
  const byOrder = (a: TreeNode, b: TreeNode) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

  // 트랙별로 대과업 순번을 따로 매긴다 — path는 같은 trackId 그룹 안에서만 유일하다.
  const rootsByTrack = new Map<string, TreeNode[]>();
  for (const root of roots) {
    const key = root.trackId ?? '';
    const list = rootsByTrack.get(key);
    if (list) list.push(root);
    else rootsByTrack.set(key, [root]);
  }

  const walk = (node: TreeNode, parentPath: string | null, order: number, level: number, seen: Set<string>): void => {
    if (level > WORK_TASK_MAX_LEVEL) {
      throw new WorkTaskTreeError('DEPTH_EXCEEDED', `과업 깊이가 ${WORK_TASK_MAX_LEVEL}단을 넘습니다.`);
    }
    if (seen.has(node.id)) {
      throw new WorkTaskTreeError('CYCLE', `과업 트리에 순환이 있습니다: ${node.id}`);
    }
    seen.add(node.id);

    const path = joinPath(parentPath, order);
    result.set(node.id, { path, level });

    const children = (childrenOf.get(node.id) ?? []).slice().sort(byOrder);
    children.forEach((child, index) => walk(child, path, index, level + 1, seen));
    seen.delete(node.id);
  };

  for (const list of rootsByTrack.values()) {
    list.slice().sort(byOrder).forEach((root, index) => walk(root, null, index, 1, new Set()));
  }
  return result;
}

/**
 * 서브트리 이동 — 과업 하나를 다른 부모(또는 다른 트랙)로 옮기고 하위 전체를 따라 옮긴다.
 *
 * 반환값은 **바뀐 노드만** 담은 갱신 목록이다. 호출부가 이걸 하나씩 저장한다.
 * 저장 도중 실패하면 `path`가 어긋나지만 `parentId`는 맞으므로 `rebuildPaths()`로 복구된다.
 *
 * 자기 자신이나 자기 하위로는 옮길 수 없다(순환). 옮긴 뒤 가장 깊은 자손이
 * `WORK_TASK_MAX_LEVEL`을 넘으면 거부한다 — 옮기고 나서 터지면 되돌릴 방법이 없다.
 */
export function moveSubtree(
  nodes: TreeNode[],
  taskId: string,
  target: { trackId: string | null; parentId: string | null },
): Array<{ id: string; trackId: string | null; parentId: string | null; sortOrder: number; path: string; level: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const moving = byId.get(taskId);
  if (!moving) throw new WorkTaskTreeError('PARENT_NOT_FOUND', '옮길 과업을 찾을 수 없습니다.');

  if (target.parentId !== null) {
    const parent = byId.get(target.parentId);
    if (!parent) throw new WorkTaskTreeError('PARENT_NOT_FOUND', '상위 과업을 찾을 수 없습니다.');
    if (target.parentId === taskId) {
      throw new WorkTaskTreeError('CYCLE', '자기 자신을 상위로 지정할 수 없습니다.');
    }
    // 조상 사슬을 거슬러 올라가며 자기 하위로 들어가는지 본다.
    for (let cursor = parent; cursor.parentId !== null; ) {
      if (cursor.parentId === taskId) {
        throw new WorkTaskTreeError('CYCLE', '자기 하위 과업으로는 옮길 수 없습니다.');
      }
      const next = byId.get(cursor.parentId);
      if (!next) break;
      cursor = next;
    }
    // 부모가 다른 트랙이면 트랙도 부모를 따른다 — 한 트리가 두 트랙에 걸칠 수 없다.
    if (parent.trackId !== target.trackId) {
      throw new WorkTaskTreeError('PARENT_NOT_FOUND', '상위 과업과 트랙이 다릅니다.');
    }
  }

  // 옮긴 뒤 모습을 만들어 한 번에 재계산한다.
  const descendants = collectDescendants(nodes, taskId);
  const movedIds = new Set([taskId, ...descendants.map((n) => n.id)]);
  const next: TreeNode[] = nodes.map((n) => {
    if (n.id === taskId) {
      return {
        ...n,
        trackId: target.trackId,
        parentId: target.parentId,
        sortOrder: nextSortOrder(nodes.filter((x) => !movedIds.has(x.id)), target.trackId, target.parentId),
      };
    }
    return movedIds.has(n.id) ? { ...n, trackId: target.trackId } : n;
  });

  const rebuilt = rebuildPaths(next); // 깊이 초과·순환은 여기서 잡힌다

  const changed: Array<{ id: string; trackId: string | null; parentId: string | null; sortOrder: number; path: string; level: number }> = [];
  for (const node of next) {
    const before = byId.get(node.id);
    const after = rebuilt.get(node.id);
    if (!before || !after) continue;
    // 옮긴 서브트리, 그리고 형제 순번이 밀려 경로가 바뀐 이웃만 저장 대상이다.
    // 트리 전체를 돌려보내면 과업 하나 옮길 때마다 프로젝트 전 문서를 쓰게 된다.
    const moved = movedIds.has(node.id);
    const shifted = before.path !== undefined && before.path !== after.path;
    const unknown = before.path === undefined; // 저장값을 안 넘겨줬으면 판단 못 하니 포함
    if (!moved && !shifted && !unknown) continue;
    changed.push({
      id: node.id,
      trackId: node.trackId,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      path: after.path,
      level: after.level,
    });
  }
  return changed;
}

/** 어떤 과업의 자손 전부(자기 자신 제외). `parentId`를 타고 내려간다. */
export function collectDescendants(nodes: TreeNode[], taskId: string): TreeNode[] {
  const childrenOf = new Map<string, TreeNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = childrenOf.get(node.parentId);
    if (list) list.push(node);
    else childrenOf.set(node.parentId, [node]);
  }
  const out: TreeNode[] = [];
  const seen = new Set<string>([taskId]);
  const stack = [...(childrenOf.get(taskId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node.id)) continue; // 순환 방어 — 깨진 데이터에서 무한 루프 방지
    seen.add(node.id);
    out.push(node);
    stack.push(...(childrenOf.get(node.id) ?? []));
  }
  return out;
}
