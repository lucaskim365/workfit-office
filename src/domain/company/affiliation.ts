import type { ApprovalCompany } from '@/domain/approvalDoc/company';
import { parseCompany } from '@/domain/approvalDoc/company';

/*
  회사 소속 — 워크핏·루미팹이 한 프로그램·한 DB를 같이 쓰면서, 사람·문서·화면을 회사별로 나눈다.

  - 부서마다 회사를 정한다(부서관리). 정하지 않은 부서는 상위 부서의 회사를 따르고, 끝까지 없으면 워크핏(null).
  - 사람의 회사 = 본직 부서의 회사 + 겸직 부서의 회사들. 둘 이상이면 겸직자(문서를 쓸 때 회사를 고른다).
  - 새 문서의 회사 = 기안자 소속으로 저절로. 겸직자는 접속한 주소의 회사가 기본, 바꿀 수 있다.
  - 회사를 정한 부서가 하나도 없으면(설정 전) 예전 방식 그대로 — 서식 선택의 '[루미팹] …'으로 고른다.

  워크핏은 null 로 둔다 — 기존 문서·부서는 모두 회사 값이 없고, 그게 워크핏이다.
*/

/** 회사 — null 은 워크핏 */
export type Company = ApprovalCompany | null;

export interface DeptLike {
  id: string;
  name: string;
  parentId: string | null;
  company?: string | null;
}

export interface MemberLike {
  userId: string;
  deptId: string;
  deptName?: string;
  isPrimary: boolean;
}

/** 부서의 회사 — 자기 또는 가장 가까운 상위 부서에 정한 회사(없으면 워크핏) */
export function deptCompanyOf(deptId: string | null | undefined, depts: readonly DeptLike[]): Company {
  const byId = new Map(depts.map((d) => [d.id, d]));
  const seen = new Set<string>();
  let cur = deptId ? byId.get(deptId) : undefined;
  while (cur && !seen.has(cur.id)) {
    const c = parseCompany(cur.company);
    if (c) return c;
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return null;
}

/** 회사를 정한 부서가 하나라도 있나 — 있으면 소속으로 회사를 정한다, 없으면 예전 방식(서식 선택에서 고름) */
export function companyByAffiliation(depts: readonly DeptLike[]): boolean {
  return depts.some((d) => parseCompany(d.company) !== null);
}

/**
 * 사람의 회사들 — 본직 부서의 회사가 맨 앞, 겸직 부서의 회사가 뒤(겹치면 하나).
 * 본직 부서는 사람의 부서 이름(users.dept)으로 찾는다(조직도와 같은 기준).
 */
export function userCompanies(
  user: { id: string; dept?: string | null },
  depts: readonly DeptLike[],
  members: readonly MemberLike[],
): Company[] {
  const primaryDept = depts.find((d) => d.name === user.dept);
  const out: Company[] = [deptCompanyOf(primaryDept?.id, depts)];
  for (const m of members) {
    if (m.userId !== user.id || m.isPrimary) continue;
    const dept = depts.find((d) => d.id === m.deptId) ?? depts.find((d) => d.name === m.deptName);
    const c = deptCompanyOf(dept?.id, depts);
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** 새 문서의 기본 회사 — 접속한 주소의 회사가 그 사람 회사 중에 있으면 그것, 아니면 본직 회사 */
export function defaultDocCompany(companies: readonly Company[], host: Company): Company {
  if (companies.includes(host)) return host;
  return companies[0] ?? null;
}

/** 조직도 회사 보기 — 부서가 그 회사인가('all' 은 모두) */
export function deptInCompanyView(deptId: string, depts: readonly DeptLike[], view: 'all' | 'workfit' | 'lumefab'): boolean {
  if (view === 'all') return true;
  const c = deptCompanyOf(deptId, depts);
  return view === 'lumefab' ? c === 'lumefab' : c === null;
}

/** 회사 이름 */
export const COMPANY_NAME: Record<'workfit' | ApprovalCompany, string> = { workfit: '워크핏', lumefab: '루미팹' };
export const companyName = (c: Company) => COMPANY_NAME[c ?? 'workfit'];
