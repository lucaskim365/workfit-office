import type { ApprovalRouteRule } from '@/domain/approvalRoute/schema';

/**
 * 동적 결재선 룰 시드 — Firebase 미설정 시 폴백 + 초기 seed(데모 룰셋).
 * priority 작을수록 먼저 매칭(구체적 룰 우선). 현재 조직 기준:
 *   생산본부·산하 팀 = deptType '공장'(공장장=생산본부장 U008), 나머지 = '본사'.
 *   직급 rank: 관리자/팀장 3, 파트장 4, 반장 5, 담당 6, 사원 7.
 */
export const APPROVAL_ROUTE_SEED: ApprovalRouteRule[] = [
  // ① 공장 지출결의 — 부서유형=공장이면 금액·직급 무관, 팀장 검토 후 공장장 전결
  {
    id: 'RR-FACTORY-EXP',
    name: '공장 지출결의(팀장 검토→공장장 전결)',
    priority: 10,
    active: true,
    docType: '지출결의',
    deptScope: { kind: '부서유형', deptId: null, deptType: '공장' },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: null,
    amountTo: null,
    steps: [
      { resolver: 'DEPT_HEAD', arg: null, kind: '검토', dedupeSelf: true, optional: true },
      { resolver: 'ROLE_FACTORY_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false },
    ],
  },
  // ② 부서책임자(rank≤3)가 올린 지출결의 — 본인 부서장 건너뛰고 본부장 전결
  {
    id: 'RR-MGR-EXP',
    name: '책임자 지출결의(본부장 전결)',
    priority: 15,
    active: true,
    docType: '지출결의',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: 3,
    amountFrom: null,
    amountTo: null,
    steps: [{ resolver: 'ROLE_DIVISION_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
  },
  // ③ 일반 지출결의 소액(~100만) — 부서장 전결
  {
    id: 'RR-EXP-SMALL',
    name: '지출결의 소액(부서장 전결)',
    priority: 30,
    active: true,
    docType: '지출결의',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: 0,
    amountTo: 1_000_000,
    steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
  },
  // ④ 지출결의 중액(~1000만) — 부서장 결재 → 본부장 전결
  {
    id: 'RR-EXP-MID',
    name: '지출결의 중액(부서장→본부장 전결)',
    priority: 31,
    active: true,
    docType: '지출결의',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: 1_000_000,
    amountTo: 10_000_000,
    steps: [
      { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: true },
      { resolver: 'ROLE_DIVISION_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false },
    ],
  },
  // ⑤ 지출결의 고액(1000만~) — 부서장→본부장→대표 전결
  {
    id: 'RR-EXP-LARGE',
    name: '지출결의 고액(대표 전결)',
    priority: 32,
    active: true,
    docType: '지출결의',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: 10_000_000,
    amountTo: null,
    steps: [
      { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: true },
      { resolver: 'ROLE_DIVISION_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: true },
      { resolver: 'ROLE_CEO', arg: null, kind: '전결', dedupeSelf: true, optional: false },
    ],
  },
  // ⑥ 품의 — 부서장 결재 → 본부장 전결
  {
    id: 'RR-PURCHASE',
    name: '품의(부서장→본부장 전결)',
    priority: 40,
    active: true,
    docType: '품의',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: null,
    amountTo: null,
    steps: [
      { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: true },
      { resolver: 'ROLE_DIVISION_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false },
    ],
  },
  // ⑦ 휴가 — 부서장 전결
  {
    id: 'RR-LEAVE',
    name: '휴가(부서장 전결)',
    priority: 40,
    active: true,
    docType: '휴가',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: null,
    amountTo: null,
    steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
  },
  // ⑧ 전 유형 폴백(기안 등) — 부서장 결재
  {
    id: 'RR-GENERAL',
    name: '일반 문서(부서장 결재)',
    priority: 90,
    active: true,
    docType: '전체',
    deptScope: { kind: '전체', deptId: null, deptType: null },
    positionFromRank: null,
    positionToRank: null,
    amountFrom: null,
    amountTo: null,
    steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: false }],
  },
];
