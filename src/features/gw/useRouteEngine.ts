import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { approvalRouteRepo } from '@/data/approvalRoute/approvalRoute.repo';
import { resolveRoute, type RouteResult } from '@/domain/approvalRoute/engine';
import type { ApprovalStep } from '@/domain/approvalDoc/schema';
import { useOrgTree } from '@/features/gw/useOrgTree';

/**
 * 동적 결재선 룰 엔진 훅 — 조직도(users·depts·positions) + 룰(approvalRouteRules)을
 * 모아 `resolveRoute`(순수 엔진)를 호출한다. 기존 useAutoLine 을 대체하며,
 * 상신 모달·결재선 빌더·룰 관리 시뮬레이터가 공유한다.
 * ([[dynamic-route-engine]] · docs/동적_결재선_룰엔진_개발_계획서.md §6·§7.5)
 */
const RULES_KEY = 'approvalRouteRules';

export interface RouteInput {
  drafterId: string;
  docType: string;
  amount: number | null;
  docData?: Record<string, any> | null;
}

export function useApprovalRouteRules() {
  return useQuery({ queryKey: [RULES_KEY], queryFn: () => approvalRouteRepo.list() });
}

export function useRouteEngine() {
  const org = useOrgTree();
  const rulesQ = useApprovalRouteRules();

  /** 상세 결과(steps + 매칭 룰) — 시뮬레이터용. */
  const resolve = useCallback(
    ({ drafterId, docType, amount, docData }: RouteInput): RouteResult => {
      const drafter = org.users.find((u) => u.id === drafterId);
      if (!drafter) return { steps: [], rule: null };
      return resolveRoute({
        drafter,
        docType,
        amount,
        users: org.users,
        depts: org.depts,
        positions: org.positions,
        rules: rulesQ.data ?? [],
        docData,
      });
    },
    [org.users, org.depts, org.positions, rulesQ.data],
  );

  /** 결재선 steps 만 — 상신 프리필용. */
  const build = useCallback((input: RouteInput): ApprovalStep[] => resolve(input).steps, [resolve]);

  return { build, resolve, isLoading: org.isLoading || rulesQ.isLoading };
}
