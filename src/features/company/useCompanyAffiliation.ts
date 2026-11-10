import { useMemo } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { companyByAffiliation, userCompanies, type Company } from '@/domain/company/affiliation';

/**
 * 회사 소속 — 부서에 정한 회사로 사람의 회사를 정한다([[company-affiliation]]).
 * byAffiliation: 회사를 정한 부서가 있나(없으면 예전처럼 서식 선택의 '[루미팹] …'으로 고름)
 */
export function useCompanyAffiliation(user: { id: string; dept?: string | null } | null | undefined) {
  const org = useOrgTree();
  return useMemo(() => {
    const byAffiliation = companyByAffiliation(org.depts);
    const companies: Company[] = user ? userCompanies(user, org.depts, org.deptMembers) : [null];
    return { byAffiliation, companies, isLoading: org.isLoading };
  }, [org.depts, org.deptMembers, org.isLoading, user]);
}
