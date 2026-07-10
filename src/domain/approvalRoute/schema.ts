import { z } from 'zod';
import { DEPT_TYPES } from '@/domain/department/schema';

/**
 * 동적 결재선 룰(approvalRouteRules) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * `[문서유형 × 부서범위 × 직급범위 × 금액구간]` → **관계형 결재 단계**를 저장하는
 * 매트릭스 룰 테이블. 결재자를 사람 이름이 아니라 "기안자 기준 관계(resolver)"로 저장해,
 * 상신 시점에 조직도로 실시간 해석한다(인사변동 무영향).
 * ([[dynamic-route-engine]] · docs/동적_결재선_룰엔진_개발_계획서.md §5.3~5.5)
 *
 * steps·deptScope 는 배열-of-맵/맵이라 Firestore 중첩배열 제약 무관(코덱 불필요).
 */

/** 결재자 해석 규칙(§5.5). */
export const RESOLVERS = [
  'DRAFTER', // 기안자 본인
  'MANAGER', // 직속 상급자(무조건 1차)
  'DEPT_HEAD', // 소속 부서장(막히면 상위 부서장으로 승격)
  'PARENT_DEPT_HEAD', // 상위 level 단계 부서의 부서장(arg=level)
  'ROLE_FACTORY_HEAD', // 공장장 = 상위 부서 중 deptType='공장' 최상위의 부서장
  'ROLE_CEO', // 대표 = 조직 최상위
  'POSITION_AT_LEAST', // rank arg 이상인 최초 상급자(arg=rank)
  'SPECIFIC_USER', // 고정 지정(arg=userId)
  'SPECIFIC_DEPT_HEAD', // 특정 부서장(arg=deptId)
] as const;
export type Resolver = (typeof RESOLVERS)[number];

/** 결재 단계 구분(ApprovalStep.kind 로 매핑, 검토=결재의 표시변형). */
export const ROUTE_STEP_KINDS = ['결재', '검토', '참조', '전결'] as const;
export type RouteStepKind = (typeof ROUTE_STEP_KINDS)[number];

/** 부서 적용 범위(§5.4). */
export const deptScopeSchema = z.object({
  kind: z.enum(['전체', '부서', '서브트리', '부서유형']).default('전체'),
  /** kind='부서'|'서브트리' 일 때 대상 부서 ID. */
  deptId: z.string().nullable().default(null),
  /** kind='부서유형' 일 때 대상 유형. */
  deptType: z.enum(DEPT_TYPES).nullable().default(null),
});
export type DeptScope = z.infer<typeof deptScopeSchema>;

/** 관계형 결재 단계(§5.5). */
export const routeStepSchema = z.object({
  resolver: z.enum(RESOLVERS),
  /** 해석 인자(직급 rank·부서ID·역할키·n차 등). 문자열/숫자 겸용. */
  arg: z.union([z.string(), z.number()]).nullable().default(null),
  kind: z.enum(ROUTE_STEP_KINDS).default('결재'),
  /** 기안자로 해석되면 제외하고 상위로 승격. */
  dedupeSelf: z.boolean().default(true),
  /** 해석 실패(체인 끊김) 시 skip 허용. */
  optional: z.boolean().default(false),
});
export type RouteStep = z.infer<typeof routeStepSchema>;

export const approvalRouteRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '룰 이름은 필수입니다'),
  /** 우선순위 — 작을수록 먼저 매칭(구체적 룰을 앞에). */
  priority: z.number().int().default(100),
  active: z.boolean().default(true),
  // 적용 조건
  /** 문서유형(전체=모든 유형). */
  /** 문서유형 = 서식 code(자유 문자열) 또는 '전체'. */
  docType: z.string().default('전체'),
  deptScope: deptScopeSchema.default({ kind: '전체', deptId: null, deptType: null }),
  /** 기안자 직급 범위(rank, null=무한). from=상위(작은값)·to=하위(큰값). */
  positionFromRank: z.number().nullable().default(null),
  positionToRank: z.number().nullable().default(null),
  /** 금액 구간(null=무한). */
  amountFrom: z.number().nullable().default(null),
  amountTo: z.number().nullable().default(null),
  /** 결재 단계(관계형, 임베드). */
  steps: z.array(routeStepSchema).default([]),
});
export type ApprovalRouteRule = z.infer<typeof approvalRouteRuleSchema>;
