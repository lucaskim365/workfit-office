import { useMemo } from 'react';
import { useSecurityContext } from '@/features/auth/useSecurityContext';
import { useUsers } from '@/features/user/useUsers';
import { commutePolicy } from '@/domain/security/policy/commutePolicy';
import { approvedLeavesInMonth, type MonthLeave } from '@/domain/leave/monthLeaves';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 한 달 승인 휴가 중 내가 볼 수 있는 것 — 웹 근태 '휴가 현황'·PWA 근태 관제 공용.
 * 임원·인사담당자는 전사, 팀장은 자기 부서(기안자의 지금 부서로 판정, 사용자 목록에 없으면 기안 당시 부서), 그 밖은 본인.
 */
export function useScopedMonthLeaves(approvals: readonly ApprovalDoc[], month: string): MonthLeave[] {
  const ctx = useSecurityContext();
  const { data: users } = useUsers();
  const scope = commutePolicy.getScope(ctx);
  return useMemo(() => {
    const deptOf = new Map((users ?? []).map((u) => [u.id, u.dept]));
    return approvedLeavesInMonth(approvals, month).filter(({ doc }) =>
      commutePolicy.canViewEmployee(ctx, { name: (doc.drafterName || '').trim(), dept: deptOf.get(doc.drafterId) ?? doc.drafterDept })
    );
    // ctx 는 렌더마다 새 객체 — 판정에 쓰는 범위·이름·부서가 바뀔 때만 다시 거른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvals, month, users, scope, ctx.name, ctx.dept]);
}
