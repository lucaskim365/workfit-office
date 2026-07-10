import type { ApprovalRouteRule, RouteStep, Resolver, RouteStepKind } from '@/domain/approvalRoute/schema';

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

const 만 = 10_000;

export const APPROVAL_ROUTE_SEED: ApprovalRouteRule[] = [
  // ==========================================
  // 1. 인사 분류 (휴가, 연장근로, 외근)
  // ==========================================

  // --- 휴가원 ---
  {
    id: 'RR-LEAVE-MEMBER', name: '휴가·팀원 기안: 팀장 전결', priority: 1, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: 5, positionToRank: 9, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },
  {
    id: 'RR-LEAVE-LEADER', name: '휴가·팀장 기안: 본부장 전결 (대표 참조)', priority: 2, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: 4, positionToRank: 4, amountFrom: null, amountTo: null,
    steps: [s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },
  {
    id: 'RR-LEAVE-EXEC', name: '휴가·임원 기안: 대표이사 전결', priority: 3, active: true,
    docType: '휴가', deptScope: scAll, positionFromRank: 3, positionToRank: 3, amountFrom: null, amountTo: null,
    steps: [s('ROLE_CEO', '전결')],
  },

  // --- 외근 신청서 ---
  {
    id: 'RR-OUTSIDE-MEMBER', name: '외근·팀원 기안: 팀장 전결 (본부장 참조)', priority: 4, active: true,
    docType: '외근', deptScope: scAll, positionFromRank: 5, positionToRank: 9, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결'), s('PARENT_DEPT_HEAD', '참조', 1)],
  },
  {
    id: 'RR-OUTSIDE-LEADER', name: '외근·팀장 기안: 본부장 전결 (대표 참조)', priority: 5, active: true,
    docType: '외근', deptScope: scAll, positionFromRank: 4, positionToRank: 4, amountFrom: null, amountTo: null,
    steps: [s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },

  // --- 연장근로 신청서 ---
  {
    id: 'RR-OVERTIME-ALL', name: '연장근로·공통: 팀장 거쳐 본부장 전결 (대표 참조)', priority: 6, active: true,
    docType: '연장근로', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },

  // ==========================================
  // 2. 총무 분류 (출장, 지출결의, 비용청구, 보험신청, 운반비청구, 인장날인, 공문발송, 접대비품의)
  // ==========================================

  // --- 출장 신청/비용 정산서 ---
  {
    id: 'RR-TRIP-L', name: '출장·고액(300만 이상): 팀장➔본부장➔대표이사 전결', priority: 10, active: true,
    docType: '출장', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 300 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-TRIP-S', name: '출장·소액(300만 미만): 팀장➔본부장 전결 (해외 출장은 대표 참조)', priority: 11, active: true,
    docType: '출장', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 300 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조', null, true)], // 대표이사 optional 참조
  },

  // --- 지출결의서 ---
  {
    id: 'RR-EXPENSE-L', name: '지출결의·고액(300만 이상): 팀장➔본부장➔대표이사 전결', priority: 12, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 300 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-EXPENSE-S', name: '지출결의·소액(300만 미만): 팀장➔본부장 전결', priority: 13, active: true,
    docType: '지출결의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 300 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },

  // --- 비용 청구서 ---
  {
    id: 'RR-COST-ALL', name: '비용청구·공통: 팀장 전결 (본부장 참조)', priority: 14, active: true,
    docType: '비용청구', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결'), s('PARENT_DEPT_HEAD', '참조', 1)],
  },

  // --- 보험 관련 신청서 ---
  {
    id: 'RR-INSURANCE-ALL', name: '보험신청·공통: 팀장➔본부장➔대표이사 전결', priority: 15, active: true,
    docType: '보험신청', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },

  // --- 운반비 청구서 ---
  {
    id: 'RR-DELIVERY-ALL', name: '운반비청구·공통: 팀장 전결', priority: 16, active: true,
    docType: '운반비청구', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // --- 인장 날인 요청서 ---
  {
    id: 'RR-SEAL-ALL', name: '인장날인·공통: 팀장➔본부장➔대표이사 전결', priority: 17, active: true,
    docType: '인장날인', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },

  // --- 공문 발송 신청서 ---
  {
    id: 'RR-PUBLISH-ALL', name: '공문발송·공통: 팀장➔본부장➔대표이사 전결', priority: 18, active: true,
    docType: '공문발송', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },

  // --- 접대비 품의서 ---
  {
    id: 'RR-RECEPTION-ALL', name: '접대비품의·공통: 팀장➔본부장➔대표이사 전결', priority: 19, active: true,
    docType: '접대비품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },

  // ==========================================
  // 3. 품의 분류 (품의, 원자재품의, 외주개발용역, 소모품신청)
  // ==========================================

  // --- 일반 품의서 (자산 / 비품 / 일반경비) ---
  {
    id: 'RR-PURCHASE-XL', name: '품의·고액(500만 이상): 팀장➔본부장➔대표이사 전결', priority: 30, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 500 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-PURCHASE-M', name: '품의·중액(10만 이상 500만 미만): 팀장➔본부장 전결 (대표이사 참조)', priority: 31, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 10 * 만, amountTo: 500 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },
  {
    id: 'RR-PURCHASE-S', name: '품의·소액(10만 미만): 팀장 전결', priority: 32, active: true,
    docType: '품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 10 * 만,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // --- 원자재 품의서 ---
  {
    id: 'RR-MATERIAL-L', name: '원자재품의·고액(1000만 이상): 팀장➔본부장➔대표이사 전결', priority: 33, active: true,
    docType: '원자재품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 1000 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },
  {
    id: 'RR-MATERIAL-S', name: '원자재품의·소액(1000만 미만): 팀장➔본부장 전결 (대표이사 참조)', priority: 34, active: true,
    docType: '원자재품의', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 1000 * 만,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },

  // --- 외주개발/용역비 품의서 ---
  {
    id: 'RR-OUTSOURCE-ALL', name: '외주개발용역·공통: 팀장➔본부장➔대표이사 전결', priority: 35, active: true,
    docType: '외주개발용역', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '결재', 1), s('ROLE_CEO', '전결')],
  },

  // --- 소모품 신청서 ---
  {
    id: 'RR-OFFICE-SUPPLY-L', name: '소모품신청·고액(10만 이상): 팀장➔본부장 전결', priority: 36, active: true,
    docType: '소모품신청', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 10 * 만, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1)],
  },
  {
    id: 'RR-OFFICE-SUPPLY-S', name: '소모품신청·소액(10만 미만): 팀장 전결', priority: 37, active: true,
    docType: '소모품신청', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: 0, amountTo: 10 * 만,
    steps: [s('DEPT_HEAD', '전결')],
  },

  // ==========================================
  // 4. 경조사 분류 (경조지원)
  // ==========================================

  // --- 경조 지원 신청서 ---
  {
    id: 'RR-CONDOLENCE-ALL', name: '경조지원·공통: 팀장➔본부장 전결 (대표이사 참조)', priority: 40, active: true,
    docType: '경조지원', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '결재'), s('PARENT_DEPT_HEAD', '전결', 1), s('ROLE_CEO', '참조')],
  },

  // ==========================================
  // 5. 공통 기안서 & 전역 폴백 룰
  // ==========================================
  {
    id: 'RR-GENERAL-DRAFT', name: '기안서·공통: 팀장 전결', priority: 90, active: true,
    docType: '기안', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },
  {
    id: 'RR-FALLBACK', name: '전역 폴백·부서장 전결(모든 유형)', priority: 99, active: true,
    docType: '전체', deptScope: scAll, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [s('DEPT_HEAD', '전결')],
  },
];
