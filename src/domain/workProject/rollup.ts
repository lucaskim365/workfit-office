import type { WorkTaskStatus } from '@/domain/workTask/schema';

/**
 * 진행률 자동 집계 — 리프에 입력된 값에서 상위 과업과 트랙의 진행률을 만든다.
 * ([[프로젝트관리_고도화_계획서.md]] §4)
 *
 * **상위 진행률을 DB에 저장하지 않는다.** 저장하면 리프가 바뀔 때마다 조상 전부를
 * 갱신해야 하고, Appwrite에는 트랜잭션이 없어 그 중 한 번만 실패해도 영구히 어긋난다.
 * 트리를 읽은 뒤 여기서 계산하면 화면과 리포트가 같은 함수를 쓴다.
 *
 * **기간 가중 평균인 이유**: 단순 평균은 3개월짜리 과업과 하루짜리를 같은 무게로 취급해
 * 숫자를 왜곡한다.
 */

export interface RollupInput {
  id: string;
  parentId: string | null;
  /** 저장값. 리프에서만 의미가 있고 상위에서는 무시된다. */
  progress: number;
  /** 저장값. 상위에서는 자식들로부터 다시 계산된다. */
  status: WorkTaskStatus;
  startAt: string | null;
  dueAt: string | null;
}

export interface RollupResult {
  /** 리프면 저장값, 상위면 자식들의 기간 가중 평균(정수 반올림). */
  progress: number;
  status: WorkTaskStatus;
  /** 자식이 없으면 true. 화면이 "여기가 입력 지점"을 표시하는 데 쓴다. */
  isLeaf: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 가중치 = 기간(일). 기간이 없거나 뒤집혔으면 1로 본다.
 *
 * 0을 반환하지 않는다 — 형제가 전부 기간 미지정이면 분모가 0이 되어 NaN이 나온다.
 */
export function weightOf(task: { startAt: string | null; dueAt: string | null }): number {
  if (!task.startAt || !task.dueAt) return 1;
  const start = Date.parse(task.startAt);
  const due = Date.parse(task.dueAt);
  if (Number.isNaN(start) || Number.isNaN(due)) return 1;
  const days = Math.floor((due - start) / DAY_MS) + 1;
  return days > 0 ? days : 1;
}

/** 가중 평균. 항목이 없으면 0. */
export function aggregateProgress(items: Array<{ progress: number; weight: number }>): number {
  if (items.length === 0) return 0;
  let weighted = 0;
  let total = 0;
  for (const item of items) {
    weighted += item.progress * item.weight;
    total += item.weight;
  }
  if (total === 0) return 0;
  return Math.round(weighted / total);
}

/**
 * 자식들의 결과로 상위 상태를 정한다.
 *
 * 저장된 상위 status는 쓰지 않는다 — 하위가 다 끝났는데 상위가 '할 일'로 남는 상황을
 * 만들지 않기 위해서다.
 */
function deriveStatus(children: RollupResult[]): WorkTaskStatus {
  if (children.length === 0) return 'TODO';
  if (children.every((c) => c.status === 'DONE')) return 'DONE';
  if (children.some((c) => c.status !== 'TODO' || c.progress > 0)) return 'IN_PROGRESS';
  return 'TODO';
}

/**
 * 트리 전체의 표시용 진행률·상태를 한 번에 계산한다.
 *
 * 부모를 못 찾는 고아 노드는 뿌리처럼 취급해 계산에서 빠뜨리지 않는다 — 데이터가
 * 깨졌을 때 화면에서 과업이 통째로 사라지는 편이 더 나쁘다.
 * 순환이 있으면 그 마디에서 멈춘다(무한 재귀 방지).
 */
export function rollupTasks(nodes: RollupInput[]): Map<string, RollupResult> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, RollupInput[]>();
  for (const node of nodes) {
    if (node.parentId === null || !byId.has(node.parentId)) continue;
    const list = childrenOf.get(node.parentId);
    if (list) list.push(node);
    else childrenOf.set(node.parentId, [node]);
  }

  const result = new Map<string, RollupResult>();
  const visiting = new Set<string>();

  const resolve = (node: RollupInput): RollupResult => {
    const cached = result.get(node.id);
    if (cached) return cached;

    const children = childrenOf.get(node.id) ?? [];
    if (children.length === 0) {
      const leaf: RollupResult = { progress: node.progress, status: node.status, isLeaf: true };
      result.set(node.id, leaf);
      return leaf;
    }
    if (visiting.has(node.id)) {
      // 순환 — 자기 저장값으로 끊는다. 여기서 멈추지 않으면 스택이 터진다.
      const cut: RollupResult = { progress: node.progress, status: node.status, isLeaf: false };
      result.set(node.id, cut);
      return cut;
    }

    visiting.add(node.id);
    const resolved = children.map((child) => ({ child, out: resolve(child) }));
    visiting.delete(node.id);

    const rolled: RollupResult = {
      progress: aggregateProgress(resolved.map(({ child, out }) => ({ progress: out.progress, weight: weightOf(child) }))),
      status: deriveStatus(resolved.map(({ out }) => out)),
      isLeaf: false,
    };
    result.set(node.id, rolled);
    return rolled;
  };

  for (const node of nodes) resolve(node);
  return result;
}

/**
 * 트랙 진행률 — 그 트랙에 직속된 대과업들의 기간 가중 평균.
 *
 * 트랙은 과업이 아니라서 트리에 노드가 없다. 그래서 별도로 낸다.
 * 대과업이 하나도 없는 트랙은 0%다.
 */
export function rollupTrack(
  rootTasks: Array<{ id: string; startAt: string | null; dueAt: string | null }>,
  results: Map<string, RollupResult>,
): number {
  return aggregateProgress(
    rootTasks.map((task) => ({
      progress: results.get(task.id)?.progress ?? 0,
      weight: weightOf(task),
    })),
  );
}
