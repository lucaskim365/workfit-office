import { collection, deleteDoc, doc, getDocs, setDoc, query, onSnapshot, type QuerySnapshot } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { client as appwriteClient, databases, APPWRITE_DATABASE_ID, Query, assertAppwriteId } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';
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
  activeSteps,
  matchesBox,
  recall as recallDoc,
  submit as submitDoc,
  currentApproverIds,
} from '@/domain/approvalDoc/engine';
import { formatDocNo, yymmdd } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { APPROVAL_DOC_SEED } from '@/data/seeds/approvalDoc.seed';
import { userRepo } from '@/data/user/user.repo';
import { departmentRepo } from '@/data/department/department.repo';
import { absenceRepo } from '@/data/absence/absence.repo';
import { approvalProcessRepo } from '@/data/approvalProcess/approvalProcess.repo';

/**
 * 전자결재 문서 Repository — 채번(counters) + **순수 엔진**(domain/approvalDoc/engine)
 * 을 호출해 상태전이를 강제한다. 권한(활성 단계 결재자·기안자)도 여기서 검증한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * steps 는 배열-of-맵이라 Firestore 중첩배열 제약에 걸리지 않아 코덱이 불필요하다.
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'approvalDocs';

function migrateDoc(data: any): any {
  if (!data) return data;
  let form = data.form;
  if (data.docType !== '휴가' || !form || !form.leaveType) {
    form = null;
  }
  return {
    ...data,
    form,
    attachments: data.attachments ?? [],
    execution: data.execution ?? null,
    executionsSnapshot: data.executionsSnapshot ?? [],
    executionDepts: data.executionDepts ?? [],
    preservationPeriod: data.preservationPeriod ?? null,
    relatedDocs: data.relatedDocs ?? [],
    visibility: data.visibility ?? '부서',
    isPostApproval: data.isPostApproval ?? false,
    postApprovalReason: data.postApprovalReason ?? null,
    postApprovalActionTaken: data.postApprovalActionTaken ?? null,
    postApprovalNecessity: data.postApprovalNecessity ?? null,
    postApprovalCostDetails: data.postApprovalCostDetails ?? null,
    postApprovalFollowup: data.postApprovalFollowup ?? null,
    postApprovedAt: data.postApprovedAt ?? null,
    postApprovedById: data.postApprovedById ?? null,
    postApprovedByName: data.postApprovedByName ?? null,
    steps: Array.isArray(data.steps) ? data.steps.map((s: any) => ({
      ...s,
      kind: s.kind === '합의' ? '결재' : s.kind,
    })) : [],
  };
}

// ─────────────────────────────────────────────────────────────
// 저장 백엔드 어댑터 (VITE_DB_DRIVER) — DB 접근 격리.
// Appwrite: 필드 40여개·깊은 중첩이라 **전체 문서를 payload(JSON) 통짜 저장**
// + 쿼리/표시용 스칼라 컬럼(docNo·drafterId·status·docType·title·drafterName).
// ─────────────────────────────────────────────────────────────
interface ApprovalDocBackend {
  loadAll(): Promise<ApprovalDoc[]>;
  persist(item: ApprovalDoc): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(callback: (docs: ApprovalDoc[]) => void): () => void;
}

/** 저장소 무관 파싱 — migrateDoc(하위호환) 적용 후 안전 파싱, 불량은 건너뜀. */
function parseDoc(raw: unknown): ApprovalDoc | null {
  try {
    return approvalDocSchema.parse(migrateDoc(raw));
  } catch (err) {
    console.error('Failed to parse approval document:', err);
    return null;
  }
}

class MemoryBackend implements ApprovalDocBackend {
  private rows: ApprovalDoc[] = APPROVAL_DOC_SEED.map((d) => approvalDocSchema.parse(migrateDoc(d)));
  private listeners = new Set<() => void>();
  private notify() {
    this.listeners.forEach((l) => l());
  }
  async loadAll() {
    return this.rows;
  }
  async persist(item: ApprovalDoc) {
    const i = this.rows.findIndex((m) => m.id === item.id);
    if (i >= 0) this.rows[i] = item;
    else this.rows = [item, ...this.rows];
    this.notify();
  }
  async remove(id: string) {
    this.rows = this.rows.filter((m) => m.id !== id);
    this.notify();
  }
  subscribe(cb: (docs: ApprovalDoc[]) => void) {
    const l = () => cb(this.rows);
    this.listeners.add(l);
    l();
    return () => {
      this.listeners.delete(l);
    };
  }
}

class FirestoreBackend implements ApprovalDocBackend {
  async loadAll() {
    const snap = await getDocs(collection(db!, COLL));
    const out: ApprovalDoc[] = [];
    for (const d of snap.docs) {
      const m = parseDoc(d.data());
      if (m) out.push(m);
    }
    return out;
  }
  async persist(item: ApprovalDoc) {
    await setDoc(doc(db!, COLL, item.id), item);
  }
  async remove(id: string) {
    await deleteDoc(doc(db!, COLL, id));
  }
  subscribe(cb: (docs: ApprovalDoc[]) => void) {
    return onSnapshot(
      query(collection(db!, COLL)),
      (snap: QuerySnapshot) => {
        const out: ApprovalDoc[] = [];
        for (const d of snap.docs) {
          const m = parseDoc(d.data());
          if (m) out.push(m);
        }
        cb(out);
      },
      (err: Error) => {
        console.warn('Firestore approvalDocs subscription failed:', err);
        cb([]);
      },
    );
  }
}

type ApRow = Record<string, unknown> & { $id: string; payload?: string };
class AppwriteBackend implements ApprovalDocBackend {
  private get dbs() {
    return databases!;
  }
  private toAttrs(d: ApprovalDoc): Record<string, unknown> {
    return {
      id: d.id,
      docNo: d.docNo,
      docType: d.docType,
      title: d.title,
      drafterId: d.drafterId,
      status: d.status,
      drafterName: d.drafterName ?? null,
      payload: JSON.stringify(d), // 전체 문서(SSOT)
    };
  }
  private fromRow(row: ApRow): ApprovalDoc | null {
    if (!row.payload) return null;
    try {
      return parseDoc(JSON.parse(row.payload));
    } catch (err) {
      console.error('Failed to parse approval document payload JSON:', err);
      return null;
    }
  }
  async loadAll() {
    const out: ApprovalDoc[] = [];
    const PAGE = 100;
    for (let offset = 0; ; offset += PAGE) {
      const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [Query.limit(PAGE), Query.offset(offset)]);
      for (const row of res.documents as unknown as ApRow[]) {
        const m = this.fromRow(row);
        if (m) out.push(m);
      }
      if (res.documents.length < PAGE) break;
    }
    return out;
  }
  async persist(item: ApprovalDoc) {
    const id = assertAppwriteId(item.id);
    const attrs = this.toAttrs(item);
    try {
      await this.dbs.updateDocument(APPWRITE_DATABASE_ID, COLL, id, attrs);
    } catch (e) {
      if ((e as { code?: number })?.code === 404) {
        await this.dbs.createDocument(APPWRITE_DATABASE_ID, COLL, id, attrs);
      } else {
        throw e;
      }
    }
  }
  async remove(id: string) {
    await this.dbs.deleteDocument(APPWRITE_DATABASE_ID, COLL, id);
  }
  subscribe(cb: (docs: ApprovalDoc[]) => void) {
    void this.loadAll().then(cb); // 초기 1회
    const dbId = APPWRITE_DATABASE_ID;
    const channels = [`databases.${dbId}.collections.${COLL}.documents`, `databases.${dbId}.tables.${COLL}.rows`];
    return appwriteClient!.subscribe(channels, () => {
      void this.loadAll().then(cb);
    });
  }
}

function selectBackend(): ApprovalDocBackend {
  switch (dbDriver) {
    case 'appwrite':
      return new AppwriteBackend();
    case 'firestore':
      return new FirestoreBackend();
    default:
      return new MemoryBackend();
  }
}
const backend: ApprovalDocBackend = selectBackend();

async function loadAll(): Promise<ApprovalDoc[]> {
  return backend.loadAll();
}

async function persist(item: ApprovalDoc): Promise<void> {
  await backend.persist(approvalDocSchema.parse(item));
}

async function getOrThrow(id: string): Promise<ApprovalDoc> {
  const rows = await loadAll();
  const found = rows.find((d) => d.id === id);
  if (!found) throw new Error(`결재 문서를 찾을 수 없습니다: ${id}`);
  return found;
}

const now = () => new Date().toISOString();


/** 동시성 락 및 결재자/대결자 권한 검증. */
async function verifyApproverOrDelegate(
  doc: ApprovalDoc,
  seq: number,
  userId: string
): Promise<{ isDirect: boolean; isDelegate: boolean; originalApproverId: string }> {
  const target = doc.steps.find((s) => s.seq === seq);
  if (!target) {
    throw new Error('결재선 노드를 찾을 수 없습니다.');
  }
  // Concurrency Lock: 이미 승인/반려/처리 완료된 경우
  if (target.decision !== '대기' && target.decision !== '보류') {
    throw new Error('이미 승인되거나 처리된 결재 단계입니다.');
  }
  const isCurrentActive = activeSteps(doc).some((s) => s.seq === seq);
  if (!isCurrentActive) {
    throw new Error('현재 활성 상태인 결재 단계가 아닙니다.');
  }

  // 1. 직접 본인이 결재자인 경우
  if (target.approverId === userId) {
    return { isDirect: true, isDelegate: false, originalApproverId: userId };
  }

  // 2. 본인이 부재 중인 원 결재자의 활성 대결자로 지정되어 있는 경우 (Proxy - 서식 범위 및 금액 제한 검증 포함)
  const isProxyEnabled = await approvalProcessRepo.isOptionEnabled('proxy_approval');
  if (isProxyEnabled) {
    const absenceCheck = await absenceRepo.isCurrentlyAbsent(target.approverId, doc.docType, doc.amount);
    if (absenceCheck.isAbsent && absenceCheck.delegateUserId === userId) {
      return { isDirect: false, isDelegate: true, originalApproverId: target.approverId };
    } else if (absenceCheck.blockReason) {
      throw new Error(`대결 결재 불가: ${absenceCheck.blockReason}`);
    }
  }

  throw new Error('결재 권한이 없습니다 (본인 차례이거나 지정 대결자가 아닙니다).');
}

/** 임시저장 신규 문서 초안(시스템 필드 제외). */
export interface ApprovalDraftInput {
  docType: ApprovalDoc['docType'];
  title: string;
  drafterId: string;
  drafterDept?: string;
  drafterDeptId?: string;
  steps: ApprovalStep[];
  amount?: number | null;
  body?: string;
  form?: ApprovalDoc['form'];
  /** 결재서식 동적 필드값. */
  fieldValues?: ApprovalDoc['fieldValues'];
  /** 첨부 파일 목록 */
  attachments?: ApprovalDoc['attachments'];
  /** 수신(시행)처 목록 */
  recipients?: ApprovalDoc['recipients'];
  /** 보존연한 */
  preservationPeriod?: string | null;
  /** 시행 정보 */
  execution?: ApprovalDoc['execution'];
  /** 시행 부서 목록 */
  executionDepts?: ApprovalDoc['executionDepts'];
  /** 관련 문서 목록 */
  relatedDocs?: ApprovalDoc['relatedDocs'];
  /** 문서 보안 등급 ('일반' | '대외비' | '극비') */
  securityLevel?: '일반' | '대외비' | '극비';
  /** 문서 공개 범위 ('전사' | '부서' | '비공개') */
  visibility?: '전사' | '부서' | '비공개';
  /** 긴급 선조치 사후 승인(후결) 여부 */
  isPostApproval?: boolean;
  /** 후결 긴급 사유 (종합) */
  postApprovalReason?: string | null;
  /** 후결 1. 선조치(긴급 조치) 내용 및 결과 */
  postApprovalActionTaken?: string | null;
  /** 후결 2. 긴급성 및 불가피성 소명 (Why?) */
  postApprovalNecessity?: string | null;
  /** 후결 3. 소요 비용 및 내역 */
  postApprovalCostDetails?: string | null;
  /** 후결 4. 후속 조치 및 재발 방지 대책 */
  postApprovalFollowup?: string | null;
  /** 후결 선조치 일시 */
  postApprovedAt?: string | null;
  /** 후결 선조치 승인자 ID */
  postApprovedById?: string | null;
  /** 후결 선조치 승인자 성명 */
  postApprovedByName?: string | null;
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

  async getById(id: string): Promise<ApprovalDoc | null> {
    return this.get(id);
  },

  /**
   * 시행(documentExecution) 결과에 따른 부모 문서 상태 반영 — driver 무관(어댑터 경유).
   * 전체 문서를 읽어 status(+completedAt)만 바꿔 저장하므로 웹 전용 필드는 보존된다.
   */
  async applyExecutionStatus(id: string, status: ApprovalDoc['status'], completedAt?: string): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    await persist({ ...cur, status, ...(completedAt ? { completedAt } : {}) });
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
    const users = await userRepo.list();
    const user = users.find((u) => u.id === userId);
    
    const depts = await departmentRepo.list();
    const userDeptObj = depts.find((d) => d.name === user?.dept);
    const userDeptNameOrId = userDeptObj ? `${user?.dept}||${userDeptObj.id}` : user?.dept;

    // 대기함 조회 시: 본인을 대결자로 지정해둔 활성 부재자 ID 목록 도출 (Dual-Routing - 서식 범위 검증 포함)
    const isProxyEnabled = await approvalProcessRepo.isOptionEnabled('proxy_approval');
    if (box === '대기' && isProxyEnabled) {
      const allAbsences = await Promise.all(users.map((u) => absenceRepo.get(u.id)));
      const now = new Date();

      return rows
        .filter((d) => {
          const docAbsentApproverIds = allAbsences
            .filter((cfg) => {
              if (!cfg.isAbsent || cfg.delegateUserId !== userId) return false;
              if (cfg.startDate && now < new Date(cfg.startDate)) return false;
              if (cfg.endDate && now > new Date(cfg.endDate)) return false;
              // 서식 범위 검증
              if (cfg.scope === 'SPECIFIC_FORMS' && (!cfg.allowedDocTypes || !cfg.allowedDocTypes.includes(d.docType))) {
                return false;
              }
              // 최고 금액 제한 검증
              if (d.amount != null && cfg.maxDelegateAmount != null && cfg.maxDelegateAmount > 0) {
                if (d.amount > cfg.maxDelegateAmount) return false;
              }
              return true;
            })
            .map((cfg) => cfg.userId);

          return matchesBox(d, userId, box, userDeptNameOrId, docAbsentApproverIds);
        })
        .sort(byRecent);
    }

    return rows.filter((d) => matchesBox(d, userId, box, userDeptNameOrId)).sort(byRecent);
  },

  /** 임시저장 신규 작성 — 채번 + status='임시저장'. */
  async createDraft(input: ApprovalDraftInput): Promise<ApprovalDoc> {
    const dateKey = yymmdd(new Date());
    const seq = await counterRepo.next(`AP-${dateKey}`);
    const docNo = formatDocNo('AP', dateKey, seq);
    const users = await userRepo.list();
    const drafterUser = users.find((u) => u.id === input.drafterId);
    
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
      attachments: input.attachments ?? [],
      recipients: input.recipients ?? [],
      currentSeq: 0,
      createdAt: now(),
      submittedAt: null,
      completedAt: null,
      drafterSignUrl: drafterUser?.signUrl ?? null,
      drafterSealUrl: drafterUser?.sealUrl ?? null,
      drafterSignType: drafterUser?.signType ?? null,
      drafterName: drafterUser?.name ?? null,
      drafterPos: drafterUser?.position ?? null,
      preservationPeriod: input.preservationPeriod ?? null,
      execution: input.execution ?? null,
      executionDepts: input.executionDepts ?? [],
      relatedDocs: input.relatedDocs ?? [],
      securityLevel: input.securityLevel ?? '일반',
      visibility: input.visibility ?? '부서',
      isPostApproval: input.isPostApproval ?? false,
      postApprovalReason: input.postApprovalReason ?? null,
      postApprovalActionTaken: input.postApprovalActionTaken ?? null,
      postApprovalNecessity: input.postApprovalNecessity ?? null,
      postApprovalCostDetails: input.postApprovalCostDetails ?? null,
      postApprovalFollowup: input.postApprovalFollowup ?? null,
      postApprovedAt: input.postApprovedAt ?? null,
      postApprovedById: input.postApprovedById ?? null,
      postApprovedByName: input.postApprovedByName ?? null,
    });

    await persist(created);
    return created;
  },

  /** 문서 편집 — 임시저장(상신 전) 또는 반려·회수(재상신 전 수정). 진행중·완료는 불가. */
  async saveDraft(id: string, patch: Partial<ApprovalDraftInput>): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!['임시저장', '반려', '긴급 조치 사후 검토 반려', '회수'].includes(cur.status)) {
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
    const users = await userRepo.list();
    const drafterUser = users.find((u) => u.id === userId);
    
    const next = submitDoc(cur, now());
    next.drafterSignUrl = drafterUser?.signUrl ?? null;
    next.drafterSealUrl = drafterUser?.sealUrl ?? null;
    next.drafterSignType = drafterUser?.signType ?? null;
    next.drafterName = drafterUser?.name ?? null;
    next.drafterPos = drafterUser?.position ?? null;
    
    // 결재선의 기안 노드(seq === 1)에도 당시의 서명/인장 스냅샷 정보를 박제
    next.steps = next.steps.map((s) => {
      if (s.seq === 1 && s.approverId === userId) {
        return {
          ...s,
          signUrl: drafterUser?.signUrl ?? null,
          sealUrl: drafterUser?.sealUrl ?? null,
          signType: drafterUser?.signType ?? null,
          approverName: drafterUser?.name ?? null,
          approverPos: drafterUser?.position ?? null,
          approverDept: drafterUser?.dept ?? null,
        };
      }
      return s;
    });

    await persist(next);

    // 알림 생성 연동
    try {
      const activeApprovers = currentApproverIds(next);
      const { notificationRepo } = await import('@/data/notification/notification.repo');
      for (const appUserId of activeApprovers) {
        await notificationRepo.create({
          userId: appUserId,
          type: '결재',
          title: '결재 요청',
          text: `[${next.title}] 결재선에 본인의 차례가 되었습니다.`,
          senderName: drafterUser?.name ?? '기안자',
          linkUrl: `/gw/approval?doc=${next.id}`,
        });
      }
    } catch (e) {
      console.error('상신 알림 전송 실패:', e);
    }

    return next;
  },

  /** 승인 — 활성 단계 결재자 또는 대결자 (동시성 락 & 대결 처리). */
  async approve(id: string, seq: number, userId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    const auth = await verifyApproverOrDelegate(cur, seq, userId);

    const users = await userRepo.list();
    const actingUser = users.find((u) => u.id === userId);

    let docToProcess = cur;
    // 대결자인 경우: approverId를 대결자로 교체하고 delegatedFromId에 원결재자 기록
    if (auth.isDelegate) {
      docToProcess = {
        ...cur,
        steps: cur.steps.map((s) =>
          s.seq === seq ? { ...s, approverId: userId, delegatedFromId: auth.originalApproverId } : s
        ),
      };
    }

    const next = applyDecision(docToProcess, seq, '승인', { at: now(), comment });
    next.steps = next.steps.map((s) => {
      if (s.seq === seq && s.approverId === userId) {
        return {
          ...s,
          signUrl: actingUser?.signUrl ?? null,
          sealUrl: actingUser?.sealUrl ?? null,
          signType: actingUser?.signType ?? null,
          approverName: actingUser?.name ?? null,
          approverPos: actingUser?.position ?? null,
          approverDept: actingUser?.dept ?? null,
        };
      }
      return s;
    });

    await persist(next);

    // 알림 생성 연동
    try {
      const { notificationRepo } = await import('@/data/notification/notification.repo');
      const users = await userRepo.list();
      const approverUser = users.find((u) => u.id === userId);

      if (next.status === '완료') {
        // 복수 시행처용 documentExecutions 레코드 생성 및 Snapshot 매핑
        try {
          const { documentExecutionRepo } = await import('@/data/documentExecution/documentExecution.repo');
          await documentExecutionRepo.dispatchExecutions(next);
          const execs = await documentExecutionRepo.getByDocumentId(next.id);
          next.executionsSnapshot = execs.map(e => ({
            executionId: e.id,
            deptId: e.targetDeptId,
            deptName: e.targetDeptNameSnapshot
          }));
          await persist(next);
        } catch (e) {
          console.error('시행처 이관 처리 실패:', e);
        }

        // 기안자에게 완료 알림
        await notificationRepo.create({
          userId: next.drafterId,
          type: '결재',
          title: '결재 완료',
          text: `[${next.title}] 결재가 최종 승인(완료)되었습니다.`,
          senderName: approverUser?.name ?? '결재자',
          linkUrl: `/gw/approval?doc=${next.id}`,
        });

        // 전결자(최종 결재자)에게 완료 알림
        await notificationRepo.create({
          userId: userId,
          type: '결재',
          title: '결재 완료',
          text: `[${next.title}] 문서 결재를 최종 승인(전결) 처리하였습니다.`,
          senderName: '시스템',
          linkUrl: `/gw/approval?doc=${next.id}`,
        });

        // 수신처 알림 (시행처가 없을 때만 즉시 발송)
        const hasExecution = (next.executionDepts && next.executionDepts.length > 0) || (next.execution && next.execution.targetId);
        if (!hasExecution) {
          for (const rec of next.recipients || []) {
            if (rec.type === 'user') {
              await notificationRepo.create({
                userId: rec.id,
                type: '결재',
                title: '수신 문서 알림',
                text: `[${next.title}] 수신 문서가 배달되었습니다.`,
                senderName: '시스템',
                linkUrl: `/gw/approval?doc=${next.id}`,
              });
            } else if (rec.type === 'dept') {
              const deptUsers = users.filter((u) => u.dept === rec.name);
              for (const du of deptUsers) {
                await notificationRepo.create({
                  userId: du.id,
                  type: '결재',
                  title: '수신 문서 알림',
                  text: `[${next.title}] 부서 수신 문서가 배달되었습니다.`,
                  senderName: '시스템',
                  linkUrl: `/gw/approval?doc=${next.id}`,
                });
              }
            }
          }
        }

        // 시행처 알림
        for (const execDept of next.executionDepts || []) {
          const deptUsers = users.filter((u) => u.dept === execDept.name);
          for (const du of deptUsers) {
            await notificationRepo.create({
              userId: du.id,
              type: '결재',
              title: '시행 업무 알림',
              text: `[${next.title}] 부서 시행 업무(실무 집행)가 이관되었습니다.`,
              senderName: '시스템',
              linkUrl: `/gw/approval?doc=${next.id}`,
            });
          }
        }
      } else if (next.status === '진행중') {
        // 다음 결재자들에게 알림
        const activeApprovers = currentApproverIds(next);
        for (const appUserId of activeApprovers) {
          await notificationRepo.create({
            userId: appUserId,
            type: '결재',
            title: '결재 요청',
            text: `[${next.title}] 결재선에 본인의 차례가 되었습니다.`,
            senderName: approverUser?.name ?? '이전 결재자',
            linkUrl: `/gw/approval?doc=${next.id}`,
          });
        }
      }
    } catch (e) {
      console.error('승인 알림 전송 실패:', e);
    }

    return next;
  },

  /** 반려 — 활성 단계 결재자 또는 대결자 (사유 필수). */
  async reject(id: string, seq: number, userId: string, comment: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    const auth = await verifyApproverOrDelegate(cur, seq, userId);

    let docToProcess = cur;
    if (auth.isDelegate) {
      docToProcess = {
        ...cur,
        steps: cur.steps.map((s) =>
          s.seq === seq ? { ...s, approverId: userId, delegatedFromId: auth.originalApproverId } : s
        ),
      };
    }

    const next = applyDecision(docToProcess, seq, '반려', { at: now(), comment });
    await persist(next);

    // 알림 생성 연동
    try {
      const { notificationRepo } = await import('@/data/notification/notification.repo');
      const users = await userRepo.list();
      const approverUser = users.find((u) => u.id === userId);

      await notificationRepo.create({
        userId: next.drafterId,
        type: '결재',
        title: '결재 반려',
        text: `[${next.title}] 결재가 반려되었습니다. (사유: ${comment})`,
        senderName: approverUser?.name ?? '결재자',
        linkUrl: `/gw/approval?doc=${next.id}`,
      });
      await notificationRepo.removePendingRequests(next.id);
    } catch (e) {
      console.error('반려 알림 전송 실패:', e);
    }

    return next;
  },

  /** 보류 — 활성 단계 결재자 또는 대결자. */
  async hold(id: string, seq: number, userId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    await verifyApproverOrDelegate(cur, seq, userId);
    const next = applyDecision(cur, seq, '보류', { at: now(), comment });
    await persist(next);
    return next;
  },

  /** 후열 확인 — 원결재자가 대결 처리된 문서에 대해 사후 후열 확인 시각(postReadAt)을 기록. */
  async confirmPostRead(id: string, seq: number, userId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    const target = cur.steps.find((s) => s.seq === seq);
    if (!target) throw new Error('결재선 노드를 찾을 수 없습니다.');
    if (target.delegatedFromId !== userId) {
      throw new Error('원결재자만 후열 확인을 완료할 수 있습니다.');
    }

    const next: ApprovalDoc = {
      ...cur,
      steps: cur.steps.map((s) =>
        s.seq === seq ? { ...s, postReadAt: now() } : s
      ),
    };
    await persist(next);
    return next;
  },

  /** 회수 — 승인 전 진행중 문서를 기안자가 상신 취소(엔진 위임). */
  async recall(id: string, userId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (cur.drafterId !== userId) throw new Error('기안자만 회수할 수 있습니다');
    const next = recallDoc(cur);
    await persist(next);

    try {
      const { notificationRepo } = await import('@/data/notification/notification.repo');
      await notificationRepo.removePendingRequests(next.id);
    } catch (e) {
      console.error('회수 알림 정리 실패:', e);
    }

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
    const users = await userRepo.list();
    const delegateUser = users.find((u) => u.id === delegateUserId);

    // 원 결재자를 대결자로 교체하고(실제 결정자) 원 결재자를 위임 기록으로 남긴다.
    const delegated: ApprovalDoc = {
      ...cur,
      steps: cur.steps.map((s) =>
        s.seq === seq ? { ...s, approverId: delegateUserId, delegatedFromId: target.approverId } : s,
      ),
    };
    const next = applyDecision(delegated, seq, '승인', { at: now(), comment });
    next.steps = next.steps.map((s) => {
      if (s.seq === seq && s.approverId === delegateUserId) {
        return {
          ...s,
          signUrl: delegateUser?.signUrl ?? null,
          sealUrl: delegateUser?.sealUrl ?? null,
          signType: delegateUser?.signType ?? null,
          approverName: delegateUser?.name ?? null,
          approverPos: delegateUser?.position ?? null,
          approverDept: delegateUser?.dept ?? null,
        };
      }
      return s;
    });

    if (next.status === '완료') {
      try {
        const { documentExecutionRepo } = await import('@/data/documentExecution/documentExecution.repo');
        await documentExecutionRepo.dispatchExecutions(next);
        const execs = await documentExecutionRepo.getByDocumentId(next.id);
        next.executionsSnapshot = execs.map(e => ({
          executionId: e.id,
          deptId: e.targetDeptId,
          deptName: e.targetDeptNameSnapshot
        }));
      } catch (e) {
        console.error('대결 결재 완료 후 시행처 이관 실패:', e);
      }
    }

    await persist(next);
    return next;
  },

  /** 휴지통으로 보내기 (임시저장만 가능) */
  async deleteToTrash(id: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (cur.status !== '임시저장') throw new Error('임시저장 문서만 휴지통으로 보낼 수 있습니다');
    const next = { ...cur, status: '삭제' as const };
    await persist(next);
    return next;
  },

  /** 휴지통에서 복구 */
  async restoreFromTrash(id: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (cur.status !== '삭제') throw new Error('휴지통에 있는 문서가 아닙니다');
    const next = { ...cur, status: '임시저장' as const };
    await persist(next);
    return next;
  },

  /** 영구 삭제 (휴지통 내 문서만 가능) */
  async permanentlyDelete(id: string): Promise<void> {
    const cur = await getOrThrow(id);
    if (cur.status !== '삭제') throw new Error('휴지통에 있는 문서만 영구 삭제할 수 있습니다');
    await backend.remove(id);
  },

  async listExecutions(userId: string, status?: '대기중' | '처리중' | '시행완료'): Promise<ApprovalDoc[]> {
    const rows = await loadAll();
    const users = await userRepo.list();
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) return [];

    const depts = await departmentRepo.list();
    const currentUserDept = depts.find((d) => d.name === currentUser.dept);

    return rows.filter((d) => {
      if (!d.execution) return false;
      if (status && d.execution.status !== status) return false;

      const targetId = d.execution.targetId;
      const targetType = d.execution.targetType;

      if (targetType === 'USER') {
        return targetId === userId;
      } else if (targetType === 'DEPT') {
        const isDeptIdMatch = currentUserDept && currentUserDept.id === targetId;
        const isDeptNameMatch = currentUser.dept === targetId;
        return !!(isDeptIdMatch || isDeptNameMatch);
      }
      return false;
    }).sort(byRecent);
  },

  async assignExecutor(docId: string, executorId: string, assignerId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(docId);
    if (!cur.execution) throw new Error('시행 대상 문서가 아닙니다');

    if (cur.execution.targetType === 'DEPT') {
      const depts = await departmentRepo.list();
      const targetDept = depts.find((d) => d.id === cur.execution!.targetId || d.name === cur.execution!.targetId);
      if (!targetDept) throw new Error('시행 부서를 찾을 수 없습니다');
      if (targetDept.headUserId !== assignerId) {
        throw new Error('시행 담당자를 지정/변경할 권한이 없습니다 (부서장만 가능)');
      }
    } else {
      throw new Error('개인 시행 문서는 담당자를 임의로 지정/변경할 수 없습니다');
    }

    const users = await userRepo.list();
    const executor = users.find((u) => u.id === executorId);
    if (!executor) throw new Error('지정된 담당자 정보를 찾을 수 없습니다');
    
    const targetDept = cur.execution.targetId;
    const depts = await departmentRepo.list();
    const deptObj = depts.find((d) => d.id === targetDept || d.name === targetDept);
    
    if (deptObj && executor.dept !== deptObj.name) {
      throw new Error('담당자는 해당 시행 부서의 소속 부서원이어야 합니다');
    }

    const next: ApprovalDoc = {
      ...cur,
      execution: {
        ...cur.execution,
        executorId,
        status: '처리중',
        startedAt: cur.execution.startedAt || now(),
      },
    };
    await persist(next);
    return next;
  },

  async selfAssignExecutor(docId: string, userId: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(docId);
    if (cur.status !== '완료') throw new Error('결재가 완료된 문서만 시행을 처리할 수 있습니다');
    if (!cur.execution) throw new Error('시행 대상 문서가 아닙니다');
    if (cur.execution.executorId) throw new Error('이미 담당자가 지정되어 있습니다');

    if (cur.execution.targetType === 'DEPT') {
      const users = await userRepo.list();
      const currentUser = users.find((u) => u.id === userId);
      if (!currentUser) throw new Error('사용자 정보를 찾을 수 없습니다');
      
      const targetDept = cur.execution.targetId;
      const depts = await departmentRepo.list();
      const deptObj = depts.find((d) => d.id === targetDept || d.name === targetDept);
      
      if (deptObj && currentUser.dept !== deptObj.name) {
        throw new Error('본인의 소속 부서 업무만 담당할 수 있습니다');
      }
    } else {
      if (cur.execution.targetId !== userId) {
        throw new Error('본인 앞으로 온 시행 문서만 담당할 수 있습니다');
      }
    }

    const next: ApprovalDoc = {
      ...cur,
      execution: {
        ...cur.execution,
        executorId: userId,
        status: '처리중',
        startedAt: now(),
      },
    };
    await persist(next);
    return next;
  },

  async completeExecution(docId: string, userId: string, completedAt: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(docId);
    if (cur.status !== '완료') throw new Error('결재가 완료된 문서만 시행을 처리할 수 있습니다');
    if (!cur.execution) throw new Error('시행 대상 문서가 아닙니다');
    
    const depts = await departmentRepo.list();
    const isDeptHead = cur.execution.targetType === 'DEPT' && depts.some((d) => (d.id === cur.execution!.targetId || d.name === cur.execution!.targetId) && d.headUserId === userId);

    if (cur.execution.executorId && cur.execution.executorId !== userId && !isDeptHead) {
      throw new Error('지정된 담당자 또는 부서장만 시행을 완료할 수 있습니다');
    }

    const next: ApprovalDoc = {
      ...cur,
      execution: {
        ...cur.execution,
        status: '시행완료',
        completedAt,
        comment,
        executorId: cur.execution.executorId || userId,
      },
    };
    await persist(next);
    return next;
  },

  async searchCompletedDocs(params: {
    userId: string;
    userDept?: string;
    userDeptId?: string;
    keyword?: string;
  }): Promise<ApprovalDoc[]> {
    const docs = await loadAll();
    const { userId, userDept, userDeptId, keyword } = params;

    // 1. 완료 상태 문서만 필터링
    let completedList = docs.filter((d) => d.status === '완료');

    // 2. 열람 권한 검증: 기안자, 결재선 참여자, 수신/참조처, 시행자/시행부서
    completedList = completedList.filter((doc) => {
      // 기안자
      if (doc.drafterId === userId) return true;
      // 결재선
      if (doc.steps.some((s) => s.approverId === userId)) return true;
      // 수신/참조처(recipients)
      if (
        doc.recipients?.some((r) => {
          if (r.type === 'user') return r.id === userId;
          if (r.type === 'dept') return r.id === userDeptId || r.name === userDept || r.id === userDept;
          if (r.type === 'drafter') return doc.drafterId === userId;
          return false;
        })
      ) {
        return true;
      }
      // 시행자/시행부서(execution)
      if (doc.execution) {
        if (doc.execution.targetType === 'USER' && doc.execution.targetId === userId) return true;
        if (
          doc.execution.targetType === 'DEPT' &&
          (doc.execution.targetId === userDeptId || doc.execution.targetId === userDept)
        ) {
          return true;
        }
      }
      return false;
    });

    // 3. 키워드 검색 (문서제목, 문서번호, 기안자명)
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      completedList = completedList.filter(
        (d) =>
          d.title.toLowerCase().includes(kw) ||
          d.docNo.toLowerCase().includes(kw) ||
          (d.drafterName && d.drafterName.toLowerCase().includes(kw))
      );
    }

    return completedList.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  },

  subscribe(callback: (docs: ApprovalDoc[]) => void): () => void {
    return backend.subscribe(callback);
  },
};
