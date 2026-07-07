import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  approvalDocSchema,
  type ApprovalBox,
  type ApprovalDoc,
  type ApprovalStep,
} from '@/domain/approvalDoc/schema';
import {
  applyDecision,
  byRecent,
  isActiveApprover,
  matchesBox,
  recall as recallDoc,
  submit as submitDoc,
} from '@/domain/approvalDoc/engine';
import { formatDocNo, yymmdd } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { APPROVAL_DOC_SEED } from '@/data/seeds/approvalDoc.seed';

/**
 * 전자결재 문서 Repository — 채번(counters) + **순수 엔진**(domain/approvalDoc/engine)
 * 을 호출해 상태전이를 강제한다. 권한(활성 단계 결재자·기안자)도 여기서 검증한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * steps 는 배열-of-맵이라 Firestore 중첩배열 제약에 걸리지 않아 코덱이 불필요하다.
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'approvalDocs';

let memory: ApprovalDoc[] = APPROVAL_DOC_SEED.map((d) => approvalDocSchema.parse(d));

async function loadAll(): Promise<ApprovalDoc[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => approvalDocSchema.parse(d.data()));
  }
  return memory;
}

async function persist(item: ApprovalDoc): Promise<void> {
  const valid = approvalDocSchema.parse(item);
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, valid.id), valid);
    return;
  }
  const i = memory.findIndex((m) => m.id === valid.id);
  if (i >= 0) memory[i] = valid;
  else memory = [valid, ...memory];
}

async function getOrThrow(id: string): Promise<ApprovalDoc> {
  const rows = await loadAll();
  const found = rows.find((d) => d.id === id);
  if (!found) throw new Error(`결재 문서를 찾을 수 없습니다: ${id}`);
  return found;
}

const now = () => new Date().toISOString();

/** 결재선 노드 seq 의 결재자가 userId 인지(권한 검증용). */
function stepBelongsTo(d: ApprovalDoc, seq: number, userId: string): boolean {
  return d.steps.some((s) => s.seq === seq && s.approverId === userId);
}

/** 임시저장 신규 문서 초안(시스템 필드 제외). */
export interface ApprovalDraftInput {
  docType: ApprovalDoc['docType'];
  title: string;
  drafterId: string;
  drafterDept?: string;
  steps: ApprovalStep[];
  amount?: number | null;
  body?: string;
  form?: ApprovalDoc['form'];
  /** 결재서식 동적 필드값. */
  fieldValues?: ApprovalDoc['fieldValues'];
}

export const approvalDocRepo = {
  /** 전체 조회. */
  async list(): Promise<ApprovalDoc[]> {
    return loadAll();
  },

  async get(id: string): Promise<ApprovalDoc | null> {
    const rows = await loadAll();
    return rows.find((d) => d.id === id) ?? null;
  },

  /**
   * 결재함별 조회(§7.2). userId 관점의 5개 탭.
   * - 대기: 진행중 + 내가 현재 활성 결재자
   * - 상신: 내가 기안(임시 제외, 진행/완료/반려/회수)
   * - 완료: 내가 관여(기안 또는 결재자)한 완료 문서
   * - 참조: 내가 참조(kind='참조')로 지정된 문서
   * - 임시: 내 임시저장
   */
  async listByBox(userId: string, box: ApprovalBox): Promise<ApprovalDoc[]> {
    const rows = await loadAll();
    return rows.filter((d) => matchesBox(d, userId, box)).sort(byRecent);
  },

  /** 임시저장 신규 작성 — 채번 + status='임시저장'. */
  async createDraft(input: ApprovalDraftInput): Promise<ApprovalDoc> {
    const dateKey = yymmdd(new Date());
    const seq = await counterRepo.next(`AP-${dateKey}`);
    const docNo = formatDocNo('AP', dateKey, seq);
    const created = approvalDocSchema.parse({
      id: docNo,
      docNo,
      docType: input.docType,
      title: input.title,
      drafterId: input.drafterId,
      drafterDept: input.drafterDept ?? '',
      status: '임시저장',
      steps: input.steps,
      amount: input.amount ?? null,
      body: input.body ?? '',
      form: input.form ?? null,
      fieldValues: input.fieldValues ?? {},
      currentSeq: 0,
      createdAt: now(),
      submittedAt: null,
      completedAt: null,
    });
    await persist(created);
    return created;
  },

  /** 문서 편집 — 임시저장(상신 전) 또는 반려·회수(재상신 전 수정). 진행중·완료는 불가. */
  async saveDraft(id: string, patch: Partial<ApprovalDraftInput>): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!['임시저장', '반려', '회수'].includes(cur.status)) {
      throw new Error('임시저장·반려·회수 상태에서만 수정할 수 있습니다');
    }
    const merged = approvalDocSchema.parse({ ...cur, ...patch });
    await persist(merged);
    return merged;
  },

  /** 상신/재상신 — 임시저장|반려|회수 → 진행중(엔진 위임). 기안자만. */
  async submit(id: string, userId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (cur.drafterId !== userId) throw new Error('기안자만 상신할 수 있습니다');
    const next = submitDoc(cur, now());
    await persist(next);
    return next;
  },

  /** 승인 — 활성 단계 결재자만(엔진 위임). */
  async approve(id: string, seq: number, userId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!isActiveApprover(cur, userId) || !stepBelongsTo(cur, seq, userId)) {
      throw new Error('결재 권한이 없습니다(본인 차례 아님)');
    }
    const next = applyDecision(cur, seq, '승인', { at: now(), comment });
    await persist(next);
    return next;
  },

  /** 반려 — 활성 단계 결재자만, 사유 필수(엔진 위임). */
  async reject(id: string, seq: number, userId: string, comment: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!isActiveApprover(cur, userId) || !stepBelongsTo(cur, seq, userId)) {
      throw new Error('결재 권한이 없습니다(본인 차례 아님)');
    }
    const next = applyDecision(cur, seq, '반려', { at: now(), comment });
    await persist(next);
    return next;
  },

  /** 보류 — 활성 단계 결재자만, 진행 일시정지(엔진 위임). */
  async hold(id: string, seq: number, userId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!isActiveApprover(cur, userId) || !stepBelongsTo(cur, seq, userId)) {
      throw new Error('결재 권한이 없습니다(본인 차례 아님)');
    }
    const next = applyDecision(cur, seq, '보류', { at: now(), comment });
    await persist(next);
    return next;
  },

  /** 회수 — 승인 전 진행중 문서를 기안자가 상신 취소(엔진 위임). */
  async recall(id: string, userId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (cur.drafterId !== userId) throw new Error('기안자만 회수할 수 있습니다');
    const next = recallDoc(cur);
    await persist(next);
    return next;
  },

  /**
   * 대결(위임 승인) — 부재중 원 결재자를 대신해 delegateUserId 가 승인.
   * delegatedFromId 에 원 결재자를 기록한다(§4.2 대결).
   */
  async delegate(id: string, seq: number, delegateUserId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    const target = cur.steps.find((s) => s.seq === seq);
    if (!target) throw new Error('결재선 노드를 찾을 수 없습니다');
    if (!isActiveApprover(cur, target.approverId)) throw new Error('현재 활성 단계가 아닙니다');
    // 원 결재자를 대결자로 교체하고(실제 결정자) 원 결재자를 위임 기록으로 남긴다.
    const delegated: ApprovalDoc = {
      ...cur,
      steps: cur.steps.map((s) =>
        s.seq === seq ? { ...s, approverId: delegateUserId, delegatedFromId: target.approverId } : s,
      ),
    };
    const next = applyDecision(delegated, seq, '승인', { at: now(), comment });
    await persist(next);
    return next;
  },
};
