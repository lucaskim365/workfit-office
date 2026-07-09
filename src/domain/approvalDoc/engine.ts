import type { ApprovalBox, ApprovalDoc, ApprovalStep, StepDecision } from './schema';

/**
 * 전자결재 상태전이 엔진 — **순수함수**. UI·DB 를 전혀 모른다.
 *
 * 모든 함수는 입력 문서를 변형하지 않고(불변) **새 문서**를 돌려준다.
 * 시각은 인자(`at`, ISO 문자열)로 주입 — 엔진 내부에서 Date.now 를 쓰지 않아
 * 테스트 재현성과 순수성을 확보한다([[data-layer-pattern]] 파생/순수 원칙).
 * repo·훅이 이 함수를 호출하고, 저장·캐시 무효화만 담당한다.
 * (docs/전자결재_워크플로_개발_계획서.md §4.4 상태머신 · §6 엔진 순수성)
 *
 * 규칙 요약:
 * - 참조(kind='참조')는 열람만 — 진행을 막지 않고 항상 통과 처리.
 * - 순차는 seq 오름차순, 병렬(합의)은 같은 parallelGroup 이 **동시 활성**·전원 승인해야 통과.
 * - 전결(kind='전결') 승인 시 상위 잔여 단계를 생략하고 즉시 완료.
 * - 결정은 **오직 현재 활성 그룹의 본인 차례**에서만.
 */

/** 진행을 막는(=승인이 필요한) 노드인가. 참조만 비차단. */
export function isBlocking(step: ApprovalStep): boolean {
  return step.kind !== '참조';
}

/** 결재선을 실행 그룹으로 분해 — 병렬 그룹은 하나로 묶고, 나머지는 단독. */
interface StepGroup {
  order: number; // 그룹 정렬 기준 = 소속 노드 최소 seq
  members: ApprovalStep[]; // 차단 노드만(참조 제외)
}

function groupsOf(doc: ApprovalDoc): StepGroup[] {
  const blocking = doc.steps.filter(isBlocking);
  const byTag = new Map<string, ApprovalStep[]>();
  for (const s of blocking) {
    // 병렬 그룹 태그가 있으면 태그로, 없으면 seq 를 고유 키로.
    const key = s.parallelGroup ?? `__seq_${s.seq}`;
    const arr = byTag.get(key) ?? [];
    arr.push(s);
    byTag.set(key, arr);
  }
  const groups: StepGroup[] = [...byTag.values()].map((members) => ({
    order: Math.min(...members.map((m) => m.seq)),
    members,
  }));
  return groups.sort((a, b) => a.order - b.order);
}

/** 그룹이 통과됐는가 = 모든 차단 노드가 '승인'. */
const isGroupPassed = (g: StepGroup) => g.members.every((m) => m.decision === '승인');

/** 현재 활성 그룹(아직 통과되지 않은 첫 그룹). 없으면 null(모두 통과=완료 가능). */
function activeGroup(doc: ApprovalDoc): StepGroup | null {
  return groupsOf(doc).find((g) => !isGroupPassed(g)) ?? null;
}

/** 지금 결정 가능한(내 차례) 노드 목록 — 활성 그룹의 '대기'/'보류' 차단 노드. */
export function activeSteps(doc: ApprovalDoc): ApprovalStep[] {
  if (doc.status !== '진행중') return [];
  const g = activeGroup(doc);
  if (!g) return [];
  return g.members.filter((m) => m.decision === '대기' || m.decision === '보류');
}

/** 특정 사용자가 지금 결재할 차례인가(대결 위임 대상 포함은 repo 판단). */
export function isActiveApprover(doc: ApprovalDoc, userId: string): boolean {
  return activeSteps(doc).some((s) => s.approverId === userId);
}

/** 현재 활성 결재자 id 목록(도크 대기 배지·목록 "현재 결재자" 도출). */
export function currentApproverIds(doc: ApprovalDoc): string[] {
  return activeSteps(doc).map((s) => s.approverId);
}

/** 활성 그룹 order 로 currentSeq(도출 캐시) 재계산. 종결이면 마지막 seq. */
function recomputeCurrentSeq(doc: ApprovalDoc): number {
  const g = activeGroup(doc);
  if (g) return g.order;
  const maxSeq = doc.steps.reduce((m, s) => Math.max(m, s.seq), 0);
  return maxSeq;
}

/** steps 의 특정 seq 노드를 patch 로 갱신한 새 배열. */
function patchStep(steps: ApprovalStep[], seq: number, patch: Partial<ApprovalStep>): ApprovalStep[] {
  return steps.map((s) => (s.seq === seq ? { ...s, ...patch } : s));
}

export interface DecisionOptions {
  /** 결정 시각(ISO). */
  at: string;
  /** 의견(반려 시 필수). */
  comment?: string;
  /** 대결 위임 시 원 결재자 id — 이 노드를 대리 승인한 기록. */
  delegatedFromId?: string;
}

export class ApprovalError extends Error {}

/**
 * 결재 결정 적용 — 활성 그룹의 특정 노드에 승인/반려/보류를 반영하고 상태를 전이한다.
 * 반환: 새 문서. 규칙 위반이면 ApprovalError.
 */
export function applyDecision(
  doc: ApprovalDoc,
  seq: number,
  decision: Exclude<StepDecision, '대기'>,
  opts: DecisionOptions,
): ApprovalDoc {
  if (doc.status !== '진행중') throw new ApprovalError('진행중 문서만 결재할 수 있습니다');

  const step = doc.steps.find((s) => s.seq === seq);
  if (!step) throw new ApprovalError('결재선 노드를 찾을 수 없습니다');
  if (!isBlocking(step)) throw new ApprovalError('참조 노드는 결재 대상이 아닙니다');

  const active = activeSteps(doc);
  if (!active.some((s) => s.seq === seq)) throw new ApprovalError('아직 결재할 차례가 아닙니다');
  if (decision === '반려' && !(opts.comment ?? '').trim()) {
    throw new ApprovalError('반려 사유(의견)는 필수입니다');
  }

  const patched = patchStep(doc.steps, seq, {
    decision,
    decidedAt: opts.at,
    comment: opts.comment ?? step.comment,
    delegatedFromId: opts.delegatedFromId ?? step.delegatedFromId,
  });
  let next: ApprovalDoc = { ...doc, steps: patched };

  // 반려 → 종결(반려). 기안자에게 회송.
  if (decision === '반려') {
    return { ...next, status: '반려', currentSeq: seq };
  }
  // 보류 → 진행 일시정지(그룹 미통과 유지). 상태는 진행중.
  if (decision === '보류') {
    return { ...next, currentSeq: recomputeCurrentSeq(next) };
  }

  // 승인
  // 전결 승인 → 상위 잔여 단계 생략하고 즉시 완료.
  if (step.kind === '전결') {
    return { ...next, status: '완료', completedAt: opts.at, currentSeq: seq };
  }

  // 활성 그룹이 전원 승인됐는지 확인 → 다음 그룹으로 진행 또는 완료.
  const stillActive = activeGroup(next);
  if (!stillActive) {
    // 마지막 그룹 통과 → 완료.
    next = { ...next, status: '완료', completedAt: opts.at };
  }
  return { ...next, currentSeq: recomputeCurrentSeq(next) };
}

/**
 * 상신/재상신 — 임시저장|반려|회수 → 진행중. 결재선에 차단 노드 1개 이상 필요.
 * 재상신 시 이전 라운드의 결정을 초기화(대기)해 새 결재 라운드를 시작한다.
 */
export function submit(doc: ApprovalDoc, at: string): ApprovalDoc {
  if (!['임시저장', '반려', '회수'].includes(doc.status)) {
    throw new ApprovalError('임시저장·반려·회수 상태에서만 상신할 수 있습니다');
  }
  if (!doc.steps.some(isBlocking)) throw new ApprovalError('결재자를 1명 이상 지정하세요');

  const steps = doc.steps.map((s) => ({ ...s, decision: '대기' as StepDecision, decidedAt: null, comment: '' }));
  const fresh: ApprovalDoc = {
    ...doc,
    steps,
    status: '진행중',
    submittedAt: at,
    completedAt: null,
  };
  return { ...fresh, currentSeq: recomputeCurrentSeq(fresh) };
}

/**
 * 결재함 분류(§7.2) — 문서가 userId 관점에서 특정 함(box)에 속하는가. 순수 도출.
 * repo(서버측 필터)와 features(클라 도출)가 **공유**해 단일 진실을 유지한다.
 */
export function matchesBox(doc: ApprovalDoc, userId: string, box: ApprovalBox): boolean {
  const involves = doc.drafterId === userId || doc.steps.some((s) => s.approverId === userId);
  if (doc.status === '삭제') {
    return box === '삭제' && doc.drafterId === userId;
  }
  if (doc.status === '완료') {
    return box === '완료' && involves;
  }
  switch (box) {
    case '대기':
      return doc.status === '진행중' && currentApproverIds(doc).includes(userId);
    case '상신':
      return doc.drafterId === userId && doc.status !== '임시저장';
    case '완료':
      return false;
    case '참조':
      return doc.status !== '임시저장' && doc.steps.some((s) => s.kind === '참조' && s.approverId === userId);
    case '임시':
      return doc.drafterId === userId && doc.status === '임시저장';
    case '삭제':
      return false;
  }
}

/** 목록 정렬 기준(최근 상신/생성 우선). */
export function byRecent(a: ApprovalDoc, b: ApprovalDoc): number {
  return (b.submittedAt ?? b.createdAt ?? '').localeCompare(a.submittedAt ?? a.createdAt ?? '');
}

/** 회수 — 아직 아무도 승인하지 않은 진행중 문서를 기안자가 상신 취소. */
export function recall(doc: ApprovalDoc): ApprovalDoc {
  if (doc.status !== '진행중') throw new ApprovalError('진행중 문서만 회수할 수 있습니다');
  const anyApproved = doc.steps.filter(isBlocking).some((s) => s.decision === '승인');
  if (anyApproved) throw new ApprovalError('이미 승인이 진행돼 회수할 수 없습니다');
  return { ...doc, status: '회수', currentSeq: 0 };
}
