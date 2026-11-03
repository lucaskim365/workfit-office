import type { StepKind } from '@/domain/approvalDoc/schema';

/** 결재선 편집 표현 — 병렬 그룹/단독 결재자 */
export interface EditStep {
  approverId: string;
  kind: StepKind;
  linkedPrev: boolean;
  groupId?: string | null; // 독립 병렬 그룹 ID (예: 'G1', 'G_1700000000000')
}

/** 아직 결재자가 없는 병렬 그룹 — before: 이 그룹 앞에 오는 결재자 수(결재선 안 위치) */
export interface EmptyGroup {
  id: string;
  before: number;
}

export interface LineGroup {
  id: string;
  isParallel: boolean;
  items: { edit: EditStep; originalIndex: number }[];
}

/** 결재자 목록 + 빈 그룹 위치 → 화면에 그릴 그룹 목록 (병렬 그룹은 한 덩어리) */
export function buildLineGroups(approvers: EditStep[], empties: EmptyGroup[]): LineGroup[] {
  const groups: LineGroup[] = [];
  const placed = new Set<string>();
  const placeEmpties = (count: number) => {
    empties.forEach((e) => {
      if (placed.has(e.id) || Math.min(e.before, approvers.length) > count) return;
      placed.add(e.id);
      groups.push({ id: e.id, isParallel: true, items: [] });
    });
  };

  approvers.forEach((edit, index) => {
    const last = groups[groups.length - 1];
    const joinsLast = last && last.items.length > 0 && (edit.groupId ? last.id === edit.groupId : edit.linkedPrev);
    if (joinsLast) {
      last.isParallel = true;
      last.items.push({ edit, originalIndex: index });
      return;
    }
    placeEmpties(index);
    groups.push({
      id: edit.groupId ?? `seq-${index}`,
      isParallel: !!edit.groupId,
      items: [{ edit, originalIndex: index }],
    });
  });
  placeEmpties(approvers.length);
  return groups;
}

/** 그룹(병렬 그룹 또는 단독 결재자) 하나를 위/아래 한 칸 — 병렬 그룹은 통째로 움직이고 건너뛴다 */
export function moveLineGroup(groups: LineGroup[], idx: number, dir: -1 | 1): { approvers: EditStep[]; empties: EmptyGroup[] } {
  const order = [...groups];
  const to = idx + dir;
  if (to >= 0 && to < order.length) [order[idx], order[to]] = [order[to], order[idx]];

  const approvers: EditStep[] = [];
  const empties: EmptyGroup[] = [];
  order.forEach((g) => {
    if (g.items.length === 0) {
      empties.push({ id: g.id, before: approvers.length });
      return;
    }
    g.items.forEach(({ edit }, k) => {
      approvers.push({
        ...edit,
        linkedPrev: g.isParallel && k > 0,
        groupId: g.isParallel ? edit.groupId ?? null : null,
      });
    });
  });
  return { approvers, empties };
}
