import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { approvalRuleRepo } from '@/data/approvalRule/approvalRule.repo';
import { matchRule, type ApprovalRule, type FinalApproverKey } from '@/domain/approvalRule/schema';
import type { ApprovalStep, DocType } from '@/domain/approvalDoc/schema';
import { useOrgTree } from '@/features/gw/useOrgTree';

/**
 * 자동 결재선 도출 훅 — 상급자 체인(useOrgTree) + 전결규정(approvalRules)을 조합해
 * `steps[]` 를 프리필한다(§4.1 ②③). 순수 도출이며, 사용자가 결재선 빌더에서
 * 이어서 수정할 수 있다(수동과 합성).
 */
const RULES_KEY = 'approvalRules';

/** 전결권자 키 → 상급자 체인 깊이(1=직속). 데모용 단순 매핑. */
const KEY_DEPTH: Record<FinalApproverKey, number> = { 팀장: 1, 부서장: 2, 본부장: 3, 대표: 99 };

export function useApprovalRules() {
  return useQuery({ queryKey: [RULES_KEY], queryFn: () => approvalRuleRepo.list() });
}

export interface AutoLineInput {
  drafterId: string;
  docType: DocType;
  amount: number | null;
}

/** 결재선 노드 생성기(기본값 채움). */
function step(seq: number, approverId: string, kind: ApprovalStep['kind']): ApprovalStep {
  return { seq, parallelGroup: null, kind, approverId, delegatedFromId: null, decision: '대기', decidedAt: null, comment: '' };
}

/**
 * 순수 빌더 — 상급자 체인 id 배열 + 전결규정 → steps[].
 * 전결규정이 있으면 전결권자(체인 깊이)까지 절단하고 마지막 노드를 '전결'로,
 * 없으면 체인 전체를 '결재'로 구성한다.
 */
export function buildAutoLine(chainIds: string[], rule: ApprovalRule | null): ApprovalStep[] {
  if (chainIds.length === 0) return [];
  const depth = rule ? Math.min(KEY_DEPTH[rule.finalApproverKey], chainIds.length) : chainIds.length;
  const picked = chainIds.slice(0, depth);
  return picked.map((id, i) => {
    const isFinal = rule != null && i === picked.length - 1;
    return step(i + 1, id, isFinal ? '전결' : '결재');
  });
}

export function useAutoLine() {
  const org = useOrgTree();
  const rulesQ = useApprovalRules();

  const build = useCallback(
    ({ drafterId, docType, amount }: AutoLineInput): ApprovalStep[] => {
      const chain = org.managerChain(drafterId).map((u) => u.id);
      const rule = matchRule(rulesQ.data ?? [], docType, amount);
      return buildAutoLine(chain, rule);
    },
    [org, rulesQ.data],
  );

  return { build, isLoading: org.isLoading || rulesQ.isLoading };
}
