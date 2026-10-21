import { useMemo } from 'react';
import { useAllWorkPlans } from './useWorkPlans';

/** 업무계획의 전사 공통 중요 일정 주인 ID */
export const COMPANY_PLAN_OWNER = '__COMPANY__';

/**
 * 업무계획의 전사 공통 중요 일정 — 날짜 → 내용 (웹·PWA 캘린더 공통).
 * 범위가 없으면 조회하지 않는다.
 */
export function useCompanyImportantByDate(range: { from: string; to: string } | undefined): Map<string, string> {
  const query = useAllWorkPlans(range, Boolean(range));
  return useMemo(() => {
    const map = new Map<string, string>();
    (query.data ?? []).forEach((plan) => {
      const content = plan.content?.trim();
      if (plan.ownerUserId === COMPANY_PLAN_OWNER && content) map.set(plan.date, content);
    });
    return map;
  }, [query.data]);
}
