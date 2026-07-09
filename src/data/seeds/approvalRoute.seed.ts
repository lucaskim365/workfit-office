import type { ApprovalRouteRule, RouteStep, Resolver, RouteStepKind } from '@/domain/approvalRoute/schema';
import type { DeptType } from '@/domain/department/schema';

/**
 * 동적 결재선 룰 시드 — Firebase 미설정 시 폴백 + 초기 seed(예제 룰셋).
 * priority 작을수록 먼저 매칭(구체적 룰이 앞). 단계는 이름이 아닌 관계형 resolver 라
 * 조직 개편에도 대체로 그대로 동작한다. Workfit Office 조직 기준의 다양한 예제 모음.
 *
 * 실무 참고(현 조직 특성):
 *   - 직급 rank: 대표이사 1, 상무이사 2, 이사/소장 3, 부장 4, 차장 5, 과장 6, 대리 7, 연구원 8, 사원 9.
 *   - 트리 최상위가 '대표이사'라 ROLE_CEO/ROLE_DIVISION_HEAD 는 대표(박영미)로 해석된다.
 *     '본부장(손승원)'이 필요하면 PARENT_DEPT_HEAD(level 1) 또는 SPECIFIC_DEPT_HEAD('D200').
 *   - DEPT_HEAD 를 연속 배치하면 소속 부서장 → 상위 부서장으로 자동 승격(팀장→본부장→대표).
 *   - '합의'는 route 엔진에서 순차 합의로 생성된다(병렬 그룹은 수동 결재선에서만).
 *   - 현재 사업장은 본사 하나뿐 → 모든 부서 deptType='본사'. 부서유형으로는 개별 팀을
 *     못 가리므로 부서별 특례는 '부서/서브트리'(부서ID)로 지정한다. deptType(공장/영업소/연구소)
 *     기반 매칭은 향후 사업장 확장 대비 예제로만 남김(RR-EX-FACTORY, active:false).
 *   - 시뮬레이터는 룰을 하나씩 독립 실행하므로, priority가 겹치는 예제도 각각 미리보기 가능.
 *   - 주요 부서 ID: D100 대표이사 · D200 AX사업본부 · D210 품질관리팀 · D220 영업팀 ·
 *     D230 사업관리팀 · D240 S/W 개발팀 · D250 부설기술연구소. 재경이사 류지광=U002.
 */

/** 결재 단계 축약 생성기(dedupeSelf 기본 true). */
const s = (resolver: Resolver, kind: RouteStepKind, arg: string | number | null = null, optional = false): RouteStep => ({
  resolver, arg, kind, dedupeSelf: true, optional,
});

/** 부서범위 축약. */
const scAll = { kind: '전체', deptId: null, deptType: null } as const;
const scDept = (deptId: string) => ({ kind: '부서' as const, deptId, deptType: null });
const scSub = (deptId: string) => ({ kind: '서브트리' as const, deptId, deptType: null });
const scType = (deptType: DeptType) => ({ kind: '부서유형' as const, deptId: null, deptType });

const 만 = 10_000;
const 억 = 100_000_000;

export const APPROVAL_ROUTE_SEED: ApprovalRouteRule[] = [
  // ───────────────────────── 지출결의 (금액 사다리) ─────────────────────────
  {
    id: 'RR-EXP-SALES', name: '지출결의·영업팀: 팀장→재경이사 합의→대표 전결', priority: 6, active: true,
    docType: '지출결의', deptScope: scDept('D220'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('SPECIFIC_USER', '합의', 'U002'), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXP-IT', name: '지출결의·S/W개발팀 고가 IT장비(300만↑): 팀장→본부장→재경이사 합의→대표 전결', priority: 7, active: true,
    docType: '지출결의', deptScope: scDept('D240'), positionFromRank: null, positionToRank: null, amountFrom: 300 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('SPECIFIC_USER', '합의', 'U002'), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXP-MGR', name: '지출결의·책임자(이사↑) 기안: 본부장→대표 전결', priority: 8, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: 3, amountFrom: null, amountTo: null,
    steps: [s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXP-XL', name: '지출결의·초고액(1억↑): 팀장→본부장→재경이사 합의→대표 전결', priority: 10, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 억, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('SPECIFIC_USER', '합의', 'U002'), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXP-L', name: '지출결의·고액(2천만~1억): 팀장→본부장→대표 전결', priority: 12, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 2000 * 만, amountTo: 억,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXP-M2', name: '지출결의·준고액(500만~2천만): 팀장→재경이사 합의→본부장 전결', priority: 14, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 500 * 만, amountTo: 2000 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('SPECIFIC_USER', '합의', 'U002'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-EXP-M1', name: '지출결의·중액(100만~500만): 팀장→본부장 전결', priority: 16, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 100 * 만, amountTo: 500 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-EXP-S', name: '지출결의·소액(~100만): 팀장 전결', priority: 18, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 100 * 만,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // ───────────────────────── 품의 ─────────────────────────
  {
    id: 'RR-PUR-QC', name: '품의·품질관리팀: 팀장→본부장 전결(대표 참조)', priority: 28, active: true,
    docType: '품의', deptScope: scSub('D210'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('ROLE_CEO', '참조'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-PUR-L', name: '품의·고액(1천만↑): 팀장→본부장→대표 전결', priority: 30, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 1000 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-PUR-M', name: '품의·중액(100만~1천만): 팀장→본부장 전결(재경이사 참조)', priority: 32, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 100 * 만, amountTo: 1000 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('SPECIFIC_USER', '참조', 'U002'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-PUR-S', name: '품의·소액(~100만): 팀장 전결', priority: 34, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 100 * 만,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // ───────────────────────── 기안 ─────────────────────────
  {
    id: 'RR-DRAFT-POLICY', name: '기안·사업관리팀 정책(합의형): 팀장→품질 합의→대표', priority: 38, active: true,
    docType: '기안', deptScope: scDept('D230'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('SPECIFIC_DEPT_HEAD', '합의', 'D210'), s('ROLE_CEO', '결재')],
  },
  {
    id: 'RR-DRAFT-HQ', name: '기안·본부 직속: 대표 결재', priority: 40, active: true,
    docType: '기안', deptScope: scDept('D200'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('ROLE_CEO', '결재')],
  },
  {
    id: 'RR-DRAFT-MGR', name: '기안·책임자(이사↑) 기안: 본부장 결재', priority: 42, active: true,
    docType: '기안', deptScope: scAll, positionFromRank: null, positionToRank: 3, amountFrom: null, amountTo: null,
    steps: [s('PARENT_DEPT_HEAD', '결재', 1)],
  },
  {
    id: 'RR-DRAFT-GEN', name: '기안·일반: 팀장 결재', priority: 44, active: true,
    docType: '기안', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재')],
  },

  // ───────────────────────── 휴가 ─────────────────────────
  {
    id: 'RR-LEAVE-EXEC', name: '휴가·임원(상무↑): 대표 전결', priority: 48, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: null, positionToRank: 2, amountFrom: null, amountTo: null,
    steps: [s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-LEAVE-MGR', name: '휴가·팀장 본인(이사↑): 본부장 전결', priority: 50, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: null, positionToRank: 3, amountFrom: null, amountTo: null,
    steps: [s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-LEAVE-GEN', name: '휴가·일반: 팀장 전결', priority: 52, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // ─────────────────── 부서/유형 스코프 (전 문서유형) ───────────────────
  {
    id: 'RR-SCOPE-QC', name: '품질관리팀·전 문서: 팀장 결재(대표 참조)', priority: 60, active: true,
    docType: '전체', deptScope: scSub('D210'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('ROLE_CEO', '참조')],
  },
  {
    id: 'RR-SCOPE-COMMITTEE', name: 'AX Committee(위원회): 대표 직접 결재', priority: 62, active: true,
    docType: '전체', deptScope: scDept('D120'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('ROLE_CEO', '결재')],
  },
  {
    id: 'RR-SCOPE-RND', name: '부설기술연구소·전 문서: 소장→본부장 전결', priority: 64, active: true,
    docType: '전체', deptScope: scSub('D250'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재', null, true), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-SCOPE-SALES', name: '영업팀·전 문서: 팀장→대표 전결', priority: 66, active: true,
    docType: '전체', deptScope: scDept('D220'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('ROLE_CEO', '전결')],
  },

  // ─────────────────── resolver 활용 예제 ───────────────────
  {
    id: 'RR-EX-MANAGER', name: '예제·직속 상급자 라인: 직속 상급자 전결', priority: 70, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('MANAGER', '전결')],
  },
  {
    id: 'RR-EX-POSATLEAST', name: '예제·직급 이상(이사↑) 최초 상급자 전결', priority: 72, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('POSITION_AT_LEAST', '전결', 3)],
  },
  {
    id: 'RR-EX-SPECIFIC-USER', name: '예제·재경이사(류지광) 필수 합의 라인', priority: 74, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('SPECIFIC_USER', '합의', 'U002'), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EX-SPECIFIC-DEPT', name: '예제·특정 부서장(S/W개발팀장) 지정 결재', priority: 76, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('SPECIFIC_DEPT_HEAD', '결재', 'D240'), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EX-LADDER', name: '예제·부서 계층 사다리: 팀장→본부장→대표 전결', priority: 78, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('PARENT_DEPT_HEAD', '전결', 2)],
  },
  {
    id: 'RR-EX-FACTORY', name: '(휴면 예제) 공장 지출: 팀장 검토→공장장 전결 — 현재 공장 조직 없음', priority: 80, active: false,
    docType: '지출결의', deptScope: scType('공장'), positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '검토', null, true), s('ROLE_FACTORY_HEAD', '전결')],
  },

  // ───────────────────────── 전역 폴백 ─────────────────────────
  {
    id: 'RR-FALLBACK', name: '전역 폴백·부서장 전결(모든 유형)', priority: 95, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },
];
