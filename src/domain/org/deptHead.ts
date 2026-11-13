/**
 * 부서장 미지정 부서의 부서장 고르기(조직도 '직속 상급자' 계산용).
 * 1) 직책이 팀장·본부장·소장·대표인 사람(겸직이면 그 부서에서의 직책) 2) 없으면 본직 소속원 중 직급 최상위.
 * 겸직자는 직급만으로는 고르지 않는다 — 다른 부서 임원이 겸직으로 들어와 있다고 그 부서장이 되면 안 된다.
 */
export interface DeptMemberLike {
  id: string;
  position: string;
  jobTitle?: string;
  isConcurrent?: boolean;
}

const LEADER_TITLES = ['팀장', '본부장', '소장', '대표'];

export function pickDeptHeadId(members: DeptMemberLike[], rankOf: (position: string) => number): string | null {
  const leader = members.find((m) => LEADER_TITLES.some((t) => m.jobTitle?.includes(t)));
  if (leader) return leader.id;
  const primary = members.filter((m) => !m.isConcurrent);
  if (primary.length === 0) return null;
  return primary.slice().sort((a, b) => rankOf(a.position) - rankOf(b.position))[0].id;
}
