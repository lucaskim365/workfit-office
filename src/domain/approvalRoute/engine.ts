import type { ApprovalStep, DocType, StepKind } from '@/domain/approvalDoc/schema';
import type { Department } from '@/domain/department/schema';
import type { User } from '@/domain/user/schema';
import type { Position } from '@/domain/position/schema';
import type { ApprovalRouteRule, DeptScope, RouteStep } from './schema';

/**
 * 동적 결재선 룰 엔진 — **순수함수**. UI·DB·React 를 모른다.
 *
 * 기안자 위치(부서·부서유형·직급) + 문서유형 + 금액으로 우선순위 첫 매칭 룰을 고르고,
 * 룰의 관계형 단계(RouteStep)를 조직도로 실인물 해석한다. 상향 추적·셀프 결재 제외·
 * 중복 병합·전결 절단 후 ApprovalStep[] 를 돌려준다.
 * ([[dynamic-route-engine]] · docs/동적_결재선_룰엔진_개발_계획서.md §6)
 */

/** 직급 폴백 서열(positions 마스터 미제공 시). useOrgTree 와 동일. */
const RANK_FALLBACK: Record<string, number> = { 대표: 1, 본부장: 2, 공장장: 2, 관리자: 3, 팀장: 3, 파트장: 4, 반장: 5, 담당: 6, 사원: 7 };

export interface RouteContext {
  drafter: User;
  docType: DocType;
  amount: number | null;
  users: User[];
  depts: Department[];
  positions: Position[];
  rules: ApprovalRouteRule[];
}

export interface RouteResult {
  steps: ApprovalStep[];
  rule: ApprovalRouteRule | null;
}

/** 조직 조회 헬퍼(순수) — 룰 매칭·resolver 해석에 공유. */
function buildOrg(ctx: RouteContext) {
  const userById = new Map(ctx.users.map((u) => [u.id, u]));
  const deptById = new Map(ctx.depts.map((d) => [d.id, d]));
  const deptByName = new Map(ctx.depts.map((d) => [d.name, d]));
  const rankByName = new Map(ctx.positions.map((p) => [p.name, p.rank]));
  const rankOf = (position: string) => rankByName.get(position) ?? RANK_FALLBACK[position] ?? 9;

  const deptOfUser = (u: User): Department | undefined => deptByName.get(u.dept);
  /** 부서 조상 체인(자기 포함, 상향). */
  const deptAncestors = (dept: Department | undefined): Department[] => {
    const chain: Department[] = [];
    let cur = dept;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      chain.push(cur);
      seen.add(cur.id);
      cur = cur.parentId ? deptById.get(cur.parentId) : undefined;
    }
    return chain;
  };
  const headOf = (dept: Department | undefined): string | null =>
    dept?.headUserId && userById.has(dept.headUserId) ? dept.headUserId : null;

  /** 상급자 체인(managerId 우선, 없으면 소속 부서장 폴백). */
  const managerChain = (userId: string, depth = 8): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>([userId]);
    let cur = userById.get(userId);
    while (cur && chain.length < depth) {
      let mgrId = cur.managerId ?? null;
      if (!mgrId) {
        // 폴백: 소속(또는 상위) 부서장.
        for (const d of deptAncestors(deptOfUser(cur))) {
          const h = headOf(d);
          if (h && h !== cur.id && !seen.has(h)) { mgrId = h; break; }
        }
      }
      if (!mgrId || seen.has(mgrId)) break;
      const mgr = userById.get(mgrId);
      if (!mgr) break;
      chain.push(mgr.id);
      seen.add(mgr.id);
      cur = mgr;
    }
    return chain;
  };

  return { userById, deptById, deptByName, rankOf, deptOfUser, deptAncestors, headOf, managerChain };
}

type Org = ReturnType<typeof buildOrg>;

/** 부서 범위가 기안자에게 적용되는가. */
function scopeMatches(scope: DeptScope, drafter: User, org: Org): boolean {
  const dept = org.deptOfUser(drafter);
  const ancestors = org.deptAncestors(dept);
  switch (scope.kind) {
    case '전체':
      return true;
    case '부서':
      return !!dept && dept.id === scope.deptId;
    case '서브트리':
      return ancestors.some((d) => d.id === scope.deptId);
    case '부서유형':
      return ancestors.some((d) => d.deptType === scope.deptType);
  }
}

/** 룰이 기안자·문서에 매칭되는가. */
function ruleMatches(rule: ApprovalRouteRule, ctx: RouteContext, org: Org): boolean {
  if (!rule.active) return false;
  if (rule.docType !== '전체' && rule.docType !== ctx.docType) return false;
  if (!scopeMatches(rule.deptScope, ctx.drafter, org)) return false;
  const rank = org.rankOf(ctx.drafter.position);
  if (rule.positionFromRank != null && rank < rule.positionFromRank) return false;
  if (rule.positionToRank != null && rank > rule.positionToRank) return false;
  const amt = ctx.amount ?? 0;
  if (rule.amountFrom != null && amt < rule.amountFrom) return false;
  if (rule.amountTo != null && amt >= rule.amountTo) return false;
  return true;
}

/**
 * resolver → 후보 결재자 id 목록(가장 구체적 → 상위로 승격 순).
 * 엔진이 이 중 기안자·중복이 아닌 첫 후보를 채택(셀프 결재 제외).
 */
function resolveCandidates(step: RouteStep, drafter: User, org: Org): string[] {
  const arg = step.arg;
  const dept = org.deptOfUser(drafter);
  const ancestors = org.deptAncestors(dept); // [self, parent, ...]
  const headsUp = ancestors.map((d) => org.headOf(d)).filter((x): x is string => !!x);

  switch (step.resolver) {
    case 'MANAGER': {
      const n = typeof arg === 'number' ? arg : 1;
      const chain = org.managerChain(drafter.id);
      return chain.slice(Math.max(0, n - 1)); // n차부터 위로(승격)
    }
    case 'DEPT_HEAD':
      return headsUp; // 소속 부서장 → 상위 부서장 → …
    case 'PARENT_DEPT_HEAD': {
      const level = typeof arg === 'number' ? arg : 1;
      return ancestors.slice(level).map((d) => org.headOf(d)).filter((x): x is string => !!x);
    }
    case 'ROLE_FACTORY_HEAD': {
      const factories = ancestors.filter((d) => d.deptType === '공장');
      const top = factories[factories.length - 1]; // 최상위 공장
      const h = org.headOf(top);
      return h ? [h, ...headsUp] : [];
    }
    case 'ROLE_DIVISION_HEAD': {
      const root = ancestors[ancestors.length - 1]; // 최상위(본부)
      const h = org.headOf(root);
      return h ? [h] : [];
    }
    case 'ROLE_CEO': {
      const chain = org.managerChain(drafter.id);
      const top = chain[chain.length - 1];
      return top ? [top] : headsUp.slice(-1);
    }
    case 'POSITION_AT_LEAST': {
      const need = typeof arg === 'number' ? arg : 3;
      return org.managerChain(drafter.id).filter((id) => {
        const u = org.userById.get(id);
        return u ? org.rankOf(u.position) <= need : false;
      });
    }
    case 'SPECIFIC_USER':
      return typeof arg === 'string' && org.userById.has(arg) ? [arg] : [];
    case 'SPECIFIC_DEPT_HEAD': {
      if (typeof arg !== 'string') return [];
      const d = org.deptById.get(arg);
      return org.headOf(d) ? [org.headOf(d)!] : [];
    }
  }
}

/** RouteStep.kind → ApprovalStep.kind (검토=결재의 표시변형). */
const toStepKind = (k: RouteStep['kind']): StepKind => (k === '검토' ? '결재' : k);

/** 매칭 룰의 관계형 단계를 실인물로 해석해 ApprovalStep[] 생성. */
function buildSteps(rule: ApprovalRouteRule, drafter: User, org: Org): ApprovalStep[] {
  const steps: ApprovalStep[] = [];
  const used = new Set<string>([drafter.id]);
  let seq = 1;
  for (const rs of rule.steps) {
    const candidates = resolveCandidates(rs, drafter, org);
    const pick = candidates.find((id) => !used.has(id) && (!rs.dedupeSelf || id !== drafter.id) && org.userById.has(id));
    if (!pick) {
      if (rs.optional) continue;
      continue; // 해석 불가 → 스킵(폴백은 상위에서 처리)
    }
    used.add(pick);
    const kind = toStepKind(rs.kind);
    steps.push({ seq: seq++, parallelGroup: null, kind, approverId: pick, delegatedFromId: null, decision: '대기', decidedAt: null, comment: '' });
    if (kind === '전결') break; // 전결 이후 절단
  }
  return steps;
}

/** 룰 미매칭·해석 실패 시 폴백 — 소속 부서장 전결(없으면 첫 상급자 결재). */
function fallbackSteps(drafter: User, org: Org): ApprovalStep[] {
  const dept = org.deptOfUser(drafter);
  const heads = org.deptAncestors(dept).map((d) => org.headOf(d)).filter((x): x is string => !!x);
  const head = heads.find((id) => id !== drafter.id);
  const pick = head ?? org.managerChain(drafter.id)[0];
  if (!pick) return [];
  return [{ seq: 1, parallelGroup: null, kind: '전결', approverId: pick, delegatedFromId: null, decision: '대기', decidedAt: null, comment: '' }];
}

/**
 * 동적 결재선 해석 — 우선순위 첫 매칭 룰로 결재선을 생성한다.
 * 매칭 룰이 없거나 해석 결과가 비면 폴백(부서장 전결).
 */
export function resolveRoute(ctx: RouteContext): RouteResult {
  const org = buildOrg(ctx);
  const rules = [...ctx.rules].sort((a, b) => a.priority - b.priority);
  const rule = rules.find((r) => ruleMatches(r, ctx, org)) ?? null;

  const steps = rule ? buildSteps(rule, ctx.drafter, org) : [];
  if (steps.length > 0) return { steps, rule };
  return { steps: fallbackSteps(ctx.drafter, org), rule: null };
}
