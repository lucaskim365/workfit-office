import type { ApprovalDoc, ApprovalStep, StepDecision, StepKind } from '@/domain/approvalDoc/schema';

/**
 * 전자결재 문서 시드 — Firebase 미설정 시 폴백 + 초기 seed + 결재함 시연 데이터.
 * 각 상태(임시저장·진행중·완료·반려)와 각 방식(순차·병렬 합의·전결·참조)을
 * 최소 1건씩 덮어 UI·엔진을 육안 검증할 수 있게 구성한다.
 *
 * 사용자 id 는 user.seed 기준:
 *   U001 김승기(관리자) · U002 문성민(생산1팀 파트장, mgr U008) · U008 박민준(생산1팀 관리자)
 *   U003 이서연(품질보증팀, mgr U007) · U007 윤채원(품질 파트장) · U004 정하윤 · U009 신유진(mgr U004)
 *   U005 임건우 · U012 서준호(자재관리팀 관리자)
 */

/** 결재선 노드 축약 생성기 — 스키마 기본값을 채워 반복을 줄인다. */
function step(
  seq: number,
  approverId: string,
  kind: StepKind,
  decision: StepDecision = '대기',
  extra: Partial<ApprovalStep> = {},
): ApprovalStep {
  return {
    seq,
    parallelGroup: null,
    kind,
    approverId,
    delegatedFromId: null,
    decision,
    decidedAt: decision === '대기' ? null : '2026-07-02T09:00:00.000Z',
    comment: '',
    ...extra,
  };
}

export const APPROVAL_DOC_SEED: ApprovalDoc[] = [
  // 1) 임시저장 — 상신 전(임시저장함).
  {
    id: 'AP-260703-001',
    docNo: 'AP-260703-001',
    docType: '기안',
    title: '생산1팀 하계 워크숍 계획(안)',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '임시저장',
    steps: [step(1, 'U008', '결재'), step(2, 'U001', '결재')],
    amount: null,
    body: '하계 팀 워크숍 일정·예산 초안입니다. 결재선 확정 후 상신 예정.',
    form: null,
    currentSeq: 0,
    createdAt: '2026-07-03T01:20:00.000Z',
    submittedAt: null,
    completedAt: null,
  },

  // 2) 진행중(순차 + 참조) — 첫 결재자 U008 박민준 대기(받은결재함), U007 참조.
  {
    id: 'AP-260702-002',
    docNo: 'AP-260702-002',
    docType: '품의',
    title: '생산1팀 공구 구매 품의',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '진행중',
    steps: [
      step(1, 'U008', '결재'),
      step(2, 'U001', '결재'),
      step(3, 'U007', '참조'),
    ],
    amount: 3_000_000,
    body: '노후 공구 교체를 위한 구매 품의(3,000,000원).',
    form: null,
    currentSeq: 1,
    createdAt: '2026-07-02T00:30:00.000Z',
    submittedAt: '2026-07-02T00:35:00.000Z',
    completedAt: null,
  },

  // 3) 진행중(중간 진행) — 1단계 승인 완료, 현재 U001 김승기 대기(받은결재함).
  {
    id: 'AP-260702-003',
    docNo: 'AP-260702-003',
    docType: '지출결의',
    title: '생산2팀 소모품 지출결의',
    drafterId: 'U009',
    drafterDept: '생산2팀',
    status: '진행중',
    steps: [
      step(1, 'U004', '결재', '승인'),
      step(2, 'U001', '결재'),
    ],
    amount: 500_000,
    body: '현장 소모품 구매 지출결의(500,000원).',
    form: null,
    currentSeq: 2,
    createdAt: '2026-07-02T02:00:00.000Z',
    submittedAt: '2026-07-02T02:05:00.000Z',
    completedAt: null,
  },

  // 4) 완료 — 전 단계 승인 완료(완료함).
  {
    id: 'AP-260701-004',
    docNo: 'AP-260701-004',
    docType: '기안',
    title: '품질보증팀 검사 표준 개정 기안',
    drafterId: 'U003',
    drafterDept: '품질보증팀',
    status: '완료',
    steps: [
      step(1, 'U007', '결재', '승인'),
      step(2, 'U001', '결재', '승인'),
    ],
    amount: null,
    body: '수입검사 표준서 개정(Rev.3) 승인 요청.',
    form: null,
    currentSeq: 2,
    createdAt: '2026-07-01T03:00:00.000Z',
    submittedAt: '2026-07-01T03:10:00.000Z',
    completedAt: '2026-07-01T06:20:00.000Z',
  },

  // 5) 반려 — 최종 결재자 반려(상신함, 재상신 가능).
  {
    id: 'AP-260701-005',
    docNo: 'AP-260701-005',
    docType: '지출결의',
    title: '설비 부품 긴급 구매 지출결의',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '반려',
    steps: [
      step(1, 'U008', '결재', '승인'),
      step(2, 'U001', '결재', '반려', { comment: '견적서 3사 비교 첨부 후 재상신 바랍니다.' }),
    ],
    amount: 15_000_000,
    body: '라인 정지 방지용 긴급 부품 구매(15,000,000원).',
    form: null,
    currentSeq: 2,
    createdAt: '2026-07-01T01:00:00.000Z',
    submittedAt: '2026-07-01T01:05:00.000Z',
    completedAt: null,
  },

  // 6) 진행중(병렬 합의) — 같은 parallelGroup 'G1' 동시 활성: U007·U012 합의 대기.
  {
    id: 'AP-260703-006',
    docNo: 'AP-260703-006',
    docType: '기안',
    title: '전사 안전점검 캠페인 시행 기안',
    drafterId: 'U005',
    drafterDept: '현장관리팀',
    status: '진행중',
    steps: [
      step(1, 'U007', '합의', '대기', { parallelGroup: 'G1' }),
      step(2, 'U012', '합의', '대기', { parallelGroup: 'G1' }),
      step(3, 'U001', '결재'),
    ],
    amount: null,
    body: '분기 안전점검 캠페인 시행(품질·자재 합의 후 대표 결재).',
    form: null,
    currentSeq: 1,
    createdAt: '2026-07-03T02:00:00.000Z',
    submittedAt: '2026-07-03T02:10:00.000Z',
    completedAt: null,
  },

  // 7) 휴가 완료 — 연차 3일(U002). 잔여 도출에서 차감. 결재선=자동 상신선(팀장 전결).
  {
    id: 'AP-260620-007',
    docNo: 'AP-260620-007',
    docType: '휴가',
    title: '연차 휴가 신청(6/23~6/25)',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '완료',
    steps: [step(1, 'U008', '전결', '승인')],
    amount: null,
    body: '개인 사유 연차 3일 신청합니다.',
    form: { leaveType: '연차', startDate: '2026-06-23', endDate: '2026-06-25', days: 3 },
    currentSeq: 1,
    createdAt: '2026-06-20T00:30:00.000Z',
    submittedAt: '2026-06-20T00:35:00.000Z',
    completedAt: '2026-06-20T05:00:00.000Z',
  },

  // 8) 휴가 진행중 — 반차 0.5일(U002). 진행중 집계 + U008 대기함.
  {
    id: 'AP-260705-008',
    docNo: 'AP-260705-008',
    docType: '휴가',
    title: '반차 신청(7/10 오후)',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '진행중',
    steps: [step(1, 'U008', '전결', '대기')],
    amount: null,
    body: '7/10 오후 반차 신청합니다.',
    form: { leaveType: '반차', startDate: '2026-07-10', endDate: '2026-07-10', days: 0.5 },
    currentSeq: 1,
    createdAt: '2026-07-05T01:00:00.000Z',
    submittedAt: '2026-07-05T01:05:00.000Z',
    completedAt: null,
  },

  // 9) 휴가 완료 — 병가 2일(U002). 연차 잔여와 별도(otherUsed) 집계.
  {
    id: 'AP-260610-009',
    docNo: 'AP-260610-009',
    docType: '휴가',
    title: '병가 신청(6/11~6/12)',
    drafterId: 'U002',
    drafterDept: '생산1팀',
    status: '완료',
    steps: [step(1, 'U008', '전결', '승인')],
    amount: null,
    body: '병원 진료로 병가 2일 신청합니다.',
    form: { leaveType: '병가', startDate: '2026-06-11', endDate: '2026-06-12', days: 2 },
    currentSeq: 1,
    createdAt: '2026-06-10T00:30:00.000Z',
    submittedAt: '2026-06-10T00:35:00.000Z',
    completedAt: '2026-06-10T04:00:00.000Z',
  },
];
