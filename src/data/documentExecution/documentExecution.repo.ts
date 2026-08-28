import { collection, doc, getDocs, setDoc, runTransaction, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import {
  client as appwriteClient,
  databases,
  APPWRITE_DATABASE_ID,
  ID,
  Query,
  assertAppwriteId,
} from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';
import { documentExecutionSchema, type DocumentExecution } from '@/domain/documentExecution/schema';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 문서 시행(실행) Repository — DB 접근 캡슐화 유일 계층.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 2 격리영역)
 *
 * 저장 백엔드는 `VITE_DB_DRIVER` 로 결정(Memory/Firestore/Appwrite). 격리 포인트:
 *  - **원자 claim**: Firestore=runTransaction / Appwrite=claimVersion 원자증가 낙관적 락 / memory=단일스레드
 *  - **실시간**: Firestore=onSnapshot / Appwrite=client.subscribe(Realtime) / memory=listeners
 *  - **history 서브컬렉션**(documentExecutions/{id}/history)은 Appwrite에서 top-level
 *    `executionHistory`(executionId FK)로 평탄화.
 * 나머지 read-modify-write 메서드는 backend.persist/addHistory 만 쓰고 로직은 공개 계층에 유지.
 */
const COLL = 'documentExecutions';
const HIST_COLL = 'executionHistory';

export interface ExecutionHistoryEvent {
  eventId: string;
  type: 'DISPATCHED' | 'ASSIGNED' | 'RELEASED' | 'COMPLETED' | 'RETURNED' | 'CANCELLED' | 'REASSIGNED';
  actorId: string;
  actorName: string;
  comment?: string;
  createdAt: string;
}

/** 부분 이벤트 → eventId·createdAt 채운 완성 이벤트. */
function makeEvent(partial: Omit<ExecutionHistoryEvent, 'eventId' | 'createdAt'>): ExecutionHistoryEvent {
  return { ...partial, eventId: Math.random().toString(36).substring(2, 9), createdAt: new Date().toISOString() };
}

/** 안전 파싱 — 불량 문서 하나가 전체 조회를 깨지 않도록. */
function safeParseExec(raw: Record<string, unknown>): DocumentExecution | null {
  const p = documentExecutionSchema.safeParse(raw);
  if (!p.success) {
    console.error('Failed to parse document execution:', p.error);
    return null;
  }
  return p.data;
}

// ─────────────────────────────────────────────────────────────
// 백엔드 어댑터
// ─────────────────────────────────────────────────────────────
interface DocExecBackend {
  loadAll(): Promise<DocumentExecution[]>;
  persist(item: DocumentExecution): Promise<void>;
  addHistory(executionId: string, event: ExecutionHistoryEvent): Promise<void>;
  getHistory(executionId: string): Promise<ExecutionHistoryEvent[]>;
  subscribe(callback: () => void): () => void;
  /** 원자적 담당 배정 — 승자만 assignee 세팅, 경합 패자는 throw. */
  claim(executionId: string, userId: string, userName: string, nowIso: string): Promise<DocumentExecution>;
}

// 1) In-memory
class MemoryBackend implements DocExecBackend {
  private execs: DocumentExecution[] = [];
  private history: Record<string, ExecutionHistoryEvent[]> = {};
  private listeners = new Set<() => void>();
  private notify() {
    this.listeners.forEach((l) => l());
  }
  async loadAll() {
    return this.execs;
  }
  async persist(item: DocumentExecution) {
    const i = this.execs.findIndex((e) => e.id === item.id);
    if (i >= 0) this.execs[i] = item;
    else this.execs = [item, ...this.execs];
    this.notify();
  }
  async addHistory(id: string, ev: ExecutionHistoryEvent) {
    (this.history[id] ??= []).push(ev);
  }
  async getHistory(id: string) {
    return [...(this.history[id] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async claim(id: string, userId: string, userName: string, nowIso: string) {
    const t = this.execs.find((e) => e.id === id);
    if (!t) throw new Error('존재하지 않는 시행 임무입니다.');
    if (t.status !== 'UNASSIGNED' || t.assigneeId !== null) {
      throw new Error(`이미 업무가 배정되어 처리 중입니다. (담당자: ${t.assigneeNameSnapshot})`);
    }
    t.assigneeId = userId;
    t.assigneeNameSnapshot = userName;
    t.status = 'IN_PROGRESS';
    t.assignedAt = nowIso;
    t.updatedAt = nowIso;
    this.notify();
    return t;
  }
}

// 2) Firestore (현행)
class FirestoreBackend implements DocExecBackend {
  async loadAll() {
    const snap = await getDocs(collection(db!, COLL));
    const out: DocumentExecution[] = [];
    for (const d of snap.docs) {
      const m = safeParseExec(d.data());
      if (m) out.push(m);
    }
    return out;
  }
  async persist(item: DocumentExecution) {
    await setDoc(doc(db!, COLL, item.id), item);
  }
  async addHistory(id: string, ev: ExecutionHistoryEvent) {
    await setDoc(doc(collection(db!, COLL, id, 'history'), ev.eventId), ev);
  }
  async getHistory(id: string) {
    const snap = await getDocs(collection(db!, COLL, id, 'history'));
    const list: ExecutionHistoryEvent[] = [];
    snap.forEach((d) => list.push(d.data() as ExecutionHistoryEvent));
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  subscribe(cb: () => void) {
    return onSnapshot(
      query(collection(db!, COLL)),
      () => cb(),
      (err) => {
        console.warn('Firestore documentExecutions subscription failed:', err);
        cb();
      },
    );
  }
  async claim(id: string, userId: string, userName: string, nowIso: string) {
    const execRef = doc(db!, COLL, id);
    await runTransaction(db!, async (tx) => {
      const d = await tx.get(execRef);
      if (!d.exists()) throw new Error('존재하지 않는 시행 임무입니다.');
      const data = d.data() as DocumentExecution;
      if (data.status !== 'UNASSIGNED' || data.assigneeId !== null) {
        throw new Error(`이미 업무가 배정되어 처리 중입니다. (담당자: ${data.assigneeNameSnapshot})`);
      }
      tx.update(execRef, {
        assigneeId: userId,
        assigneeNameSnapshot: userName,
        status: 'IN_PROGRESS',
        assignedAt: nowIso,
        updatedAt: nowIso,
      });
    });
    const updated = (await this.loadAll()).find((e) => e.id === id);
    if (!updated) throw new Error('시행 정보를 불러올 수 없습니다.');
    return updated;
  }
}

// 3) Appwrite — 원자 claim(claimVersion 낙관적 락) + Realtime + executionHistory 평탄화
type Row = Record<string, unknown> & { $id: string };

class AppwriteBackend implements DocExecBackend {
  private get dbs() {
    return databases!;
  }
  private toAttrs(e: DocumentExecution): Record<string, unknown> {
    return {
      id: e.id,
      documentId: e.documentId,
      docNo: e.docNo,
      docTitle: e.docTitle,
      docType: e.docType,
      drafterId: e.drafterId,
      drafterName: e.drafterName,
      targetDeptId: e.targetDeptId,
      targetDeptNameSnapshot: e.targetDeptNameSnapshot,
      assigneeId: e.assigneeId,
      assigneeNameSnapshot: e.assigneeNameSnapshot,
      status: e.status,
      visibility: e.visibility,
      dispatchedAt: e.dispatchedAt,
      receivedAt: e.receivedAt,
      assignedAt: e.assignedAt,
      completedAt: e.completedAt,
      updatedAt: e.updatedAt,
      comment: e.comment,
      returnReasonType: e.returnReasonType,
      // claimVersion 은 저장전용(원자증가) — 여기서 건드리지 않는다(default/increment 관리).
    };
  }
  private fromRow(row: Row): DocumentExecution | null {
    return safeParseExec({ ...row, id: row.$id });
  }
  async loadAll() {
    const out: DocumentExecution[] = [];
    const PAGE = 100;
    for (let offset = 0; ; offset += PAGE) {
      const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [Query.limit(PAGE), Query.offset(offset)]);
      for (const row of res.documents as unknown as Row[]) {
        const m = this.fromRow(row);
        if (m) out.push(m);
      }
      if (res.documents.length < PAGE) break;
    }
    return out;
  }
  async persist(item: DocumentExecution) {
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
  async addHistory(executionId: string, ev: ExecutionHistoryEvent) {
    await this.dbs.createDocument(APPWRITE_DATABASE_ID, HIST_COLL, ID.unique(), {
      eventId: ev.eventId,
      executionId,
      type: ev.type,
      actorId: ev.actorId,
      actorName: ev.actorName,
      comment: ev.comment ?? null,
      createdAt: ev.createdAt,
    });
  }
  async getHistory(executionId: string) {
    const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, HIST_COLL, [
      Query.equal('executionId', executionId),
      Query.limit(100),
    ]);
    return (res.documents as unknown as Array<Record<string, unknown>>)
      .map(
        (r) =>
          ({
            eventId: r.eventId,
            type: r.type,
            actorId: r.actorId,
            actorName: r.actorName,
            comment: (r.comment as string | null) ?? undefined,
            createdAt: r.createdAt,
          }) as ExecutionHistoryEvent,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  subscribe(cb: () => void) {
    const d = APPWRITE_DATABASE_ID;
    const channels = [`databases.${d}.collections.${COLL}.documents`, `databases.${d}.tables.${COLL}.rows`];
    // 결재 문서와 같은 이유로 몰림을 합친다([[approvalDoc.repo.ts]]의 subscribe 참고).
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsub = appwriteClient!.subscribe(channels, () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; cb(); }, 150);
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsub();
    };
  }
  async claim(id: string, userId: string, userName: string, nowIso: string) {
    // 1) 원본 조회(claimVersion 포함)
    let raw: Row & { status?: string; assigneeId?: string | null; assigneeNameSnapshot?: string | null; claimVersion?: number };
    try {
      raw = (await this.dbs.getDocument(APPWRITE_DATABASE_ID, COLL, id)) as unknown as typeof raw;
    } catch (e) {
      if ((e as { code?: number })?.code === 404) throw new Error('존재하지 않는 시행 임무입니다.');
      throw e;
    }
    // 2) 사전 상태 확인(빠른 실패)
    if (raw.status !== 'UNASSIGNED' || raw.assigneeId != null) {
      throw new Error(`이미 업무가 배정되어 처리 중입니다. (담당자: ${raw.assigneeNameSnapshot})`);
    }
    // 3) claimVersion 원자 증가 → 승자 판정(낙관적 락). 내가 기대값+1 을 받았을 때만 승자.
    const expected = raw.claimVersion ?? 0;
    const incd = (await this.dbs.incrementDocumentAttribute(APPWRITE_DATABASE_ID, COLL, id, 'claimVersion', 1)) as unknown as {
      claimVersion: number;
    };
    if (incd.claimVersion !== expected + 1) {
      throw new Error('다른 담당자가 동시에 접수했습니다. 다시 시도해 주세요.');
    }
    // 4) 승자만 assignee 세팅
    const upd = await this.dbs.updateDocument(APPWRITE_DATABASE_ID, COLL, id, {
      assigneeId: userId,
      assigneeNameSnapshot: userName,
      status: 'IN_PROGRESS',
      assignedAt: nowIso,
      updatedAt: nowIso,
    });
    const parsed = this.fromRow(upd as unknown as Row);
    if (!parsed) throw new Error('시행 정보를 불러올 수 없습니다.');
    return parsed;
  }
}

function selectBackend(): DocExecBackend {
  switch (dbDriver) {
    case 'appwrite':
      return new AppwriteBackend();
    case 'firestore':
      return new FirestoreBackend();
    default:
      return new MemoryBackend();
  }
}
const backend: DocExecBackend = selectBackend();

/** 시행 변경 실시간 구독(변경 시 callback → 호출측 재조회). */
export function subscribeExecutions(callback: () => void): () => void {
  return backend.subscribe(callback);
}

async function addHistoryEvent(executionId: string, event: Omit<ExecutionHistoryEvent, 'eventId' | 'createdAt'>): Promise<void> {
  await backend.addHistory(executionId, makeEvent(event));
}

export const documentExecutionRepo = {
  async list(): Promise<DocumentExecution[]> {
    return backend.loadAll();
  },

  async get(id: string): Promise<DocumentExecution | null> {
    return (await backend.loadAll()).find((e) => e.id === id) ?? null;
  },

  async getByDocumentId(docId: string): Promise<DocumentExecution[]> {
    return (await backend.loadAll()).filter((e) => e.documentId === docId);
  },

  async getHistory(executionId: string): Promise<ExecutionHistoryEvent[]> {
    return backend.getHistory(executionId);
  },

  /** 최종 승인 시점에 복수 시행처용 documentExecutions 레코드 생성 */
  async dispatchExecutions(doc: ApprovalDoc): Promise<void> {
    const deptExecDepts = doc.executionDepts || [];
    if (deptExecDepts.length === 0) return;
    const nowIso = new Date().toISOString();

    for (const dept of deptExecDepts) {
      const executionId = `${doc.id}_${dept.id}`;
      const newExecution: DocumentExecution = {
        id: executionId,
        documentId: doc.id,
        docNo: doc.docNo,
        docTitle: doc.title,
        docType: doc.docType,
        drafterId: doc.drafterId,
        drafterName: doc.drafterName ?? doc.drafterId,
        targetDeptId: dept.id,
        targetDeptNameSnapshot: dept.name,
        assigneeId: null,
        assigneeNameSnapshot: null,
        status: 'UNASSIGNED',
        visibility: doc.visibility ?? '부서',
        dispatchedAt: nowIso,
        receivedAt: nowIso,
        assignedAt: null,
        completedAt: null,
        updatedAt: nowIso,
        comment: null,
        returnReasonType: null,
      };
      await backend.persist(newExecution);
      await addHistoryEvent(executionId, {
        type: 'DISPATCHED',
        actorId: doc.drafterId,
        actorName: doc.drafterName ?? doc.drafterId,
        comment: '결재 완료에 따른 시행 발송',
      });
    }
  },

  /** 담당 집행자 지정 ("내가 담당하기") — **원자 배정**(경합 시 1명만 성공). */
  async claimExecution(executionId: string, userId: string, userName: string): Promise<DocumentExecution> {
    const nowIso = new Date().toISOString();
    const updated = await backend.claim(executionId, userId, userName, nowIso);
    await addHistoryEvent(executionId, { type: 'ASSIGNED', actorId: userId, actorName: userName });
    return updated;
  },

  /** 담당자 임의 변경/배정 (부서장 권한 등) */
  async assignExecutor(executionId: string, executorId: string, executorName: string, actorId: string, actorName: string): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    const nowIso = new Date().toISOString();
    const isReassigned = cur.assigneeId !== null;
    cur.assigneeId = executorId;
    cur.assigneeNameSnapshot = executorName;
    cur.status = 'IN_PROGRESS';
    cur.assignedAt = nowIso;
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, {
      type: isReassigned ? 'REASSIGNED' : 'ASSIGNED',
      actorId,
      actorName,
      comment: `${executorName} 담당자로 배정`,
    });
    return cur;
  },

  /** 담당 업무 반납 (RELEASED) */
  async releaseExecution(executionId: string, userId: string, userName: string): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    if (cur.assigneeId !== userId) throw new Error('본인이 담당한 시행 업무만 반납할 수 있습니다.');
    const nowIso = new Date().toISOString();
    cur.assigneeId = null;
    cur.assigneeNameSnapshot = null;
    cur.status = 'UNASSIGNED';
    cur.assignedAt = null;
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, { type: 'RELEASED', actorId: userId, actorName: userName, comment: '담당자 업무 접수 반납' });
    return cur;
  },

  /** 시행 완료 보고 */
  async completeExecution(executionId: string, userId: string, userName: string, completedAt: string, comment = ''): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    const nowIso = new Date().toISOString();
    cur.status = 'COMPLETED';
    cur.completedAt = completedAt;
    cur.comment = comment;
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, { type: 'COMPLETED', actorId: userId, actorName: userName, comment: comment || '시행 완료 보고' });

    // 해당 문서의 모든 시행처가 완료되면 부모 결재문서 '완료' + 수신처 알림(driver 무관).
    const allExecs = await this.getByDocumentId(cur.documentId);
    if (allExecs.every((e) => e.status === 'COMPLETED')) {
      const { approvalDocRepo } = await import('@/data/approvalDoc/approvalDoc.repo');
      const parentDoc = await approvalDocRepo.get(cur.documentId);
      if (parentDoc) {
        await approvalDocRepo.applyExecutionStatus(cur.documentId, '완료', nowIso);
        try {
          const { userRepo } = await import('@/data/user/user.repo');
          const { notificationRepo } = await import('@/data/notification/notification.repo');
          const users = await userRepo.list();
          for (const rec of parentDoc.recipients || []) {
            if (rec.type === 'user') {
              await notificationRepo.create({
                userId: rec.id,
                type: '결재',
                title: '수신 문서 알림',
                text: `[${parentDoc.title}] 수신 문서가 배달되었습니다.`,
                senderName: '시스템',
                linkUrl: `/gw/approval?doc=${parentDoc.id}`,
              });
            } else if (rec.type === 'dept') {
              const deptUsers = users.filter((u) => u.dept === rec.name);
              for (const du of deptUsers) {
                await notificationRepo.create({
                  userId: du.id,
                  type: '결재',
                  title: '수신 문서 알림',
                  text: `[${parentDoc.title}] 부서 수신 문서가 배달되었습니다.`,
                  senderName: '시스템',
                  linkUrl: `/gw/approval?doc=${parentDoc.id}`,
                });
              }
            }
          }
        } catch (err) {
          console.error('시행완료 후 수신 알림 전송 실패:', err);
        }
      }
    }

    return cur;
  },

  /** 시행 불가 및 반송 (RETURNED) */
  async returnExecution(
    executionId: string,
    userId: string,
    userName: string,
    comment: string,
    reasonType: 'SUPPLEMENT' | 'APPROVAL_CHANGE',
  ): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    const nowIso = new Date().toISOString();
    cur.status = 'RETURNED';
    cur.returnReasonType = reasonType;
    cur.comment = comment;
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, {
      type: 'RETURNED',
      actorId: userId,
      actorName: userName,
      comment: `반송 사유: [${reasonType === 'SUPPLEMENT' ? '단순보완' : '결재변경 필요'}] ${comment}`,
    });

    // 부모 결재문서 '시행반송' + 기안자 알림(driver 무관).
    {
      const { approvalDocRepo } = await import('@/data/approvalDoc/approvalDoc.repo');
      const parentDoc = await approvalDocRepo.get(cur.documentId);
      if (parentDoc) {
        await approvalDocRepo.applyExecutionStatus(cur.documentId, '시행반송');
        try {
          const { notificationRepo } = await import('@/data/notification/notification.repo');
          await notificationRepo.create({
            userId: parentDoc.drafterId,
            type: '결재',
            title: '시행 반송',
            text: `[${parentDoc.title}] 시행 부서에서 반송 처리하였습니다. (사유: ${comment})`,
            senderName: userName,
            linkUrl: `/gw/approval?doc=${parentDoc.id}`,
          });
        } catch (err) {
          console.error('시행 반송 알림 전송 실패:', err);
        }
      }
    }

    return cur;
  },

  /** 보완 완료 후 재시행 상신 (RETURNED -> UNASSIGNED) */
  async resubmitExecution(executionId: string, userId: string, userName: string, comment = ''): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    if (cur.status !== 'RETURNED') throw new Error('반송된 시행 건만 재상신할 수 있습니다.');
    const nowIso = new Date().toISOString();
    cur.status = 'UNASSIGNED';
    cur.assigneeId = null;
    cur.assigneeNameSnapshot = null;
    cur.comment = null;
    cur.returnReasonType = null;
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, { type: 'DISPATCHED', actorId: userId, actorName: userName, comment: comment || '보완 완료 후 재시행 상신' });

    // 부모 결재문서 '시행대기' 재전환 + 시행 부서원 알림(driver 무관).
    {
      const { approvalDocRepo } = await import('@/data/approvalDoc/approvalDoc.repo');
      const parentDoc = await approvalDocRepo.get(cur.documentId);
      if (parentDoc) {
        await approvalDocRepo.applyExecutionStatus(cur.documentId, '시행대기');
        try {
          const { userRepo } = await import('@/data/user/user.repo');
          const { notificationRepo } = await import('@/data/notification/notification.repo');
          const users = await userRepo.list();
          const deptUsers = users.filter((u) => u.dept === cur.targetDeptNameSnapshot);
          for (const du of deptUsers) {
            await notificationRepo.create({
              userId: du.id,
              type: '결재',
              title: '시행 재상신',
              text: `[${parentDoc.title}] 보완이 완료되어 다시 발송되었습니다.`,
              senderName: userName,
              linkUrl: `/gw/approval?doc=${parentDoc.id}`,
            });
          }
        } catch (err) {
          console.error('시행 재상신 알림 전송 실패:', err);
        }
      }
    }

    return cur;
  },

  /** 기안자/관리자에 의한 강제 시행 취소 */
  async cancelExecution(executionId: string, userId: string, userName: string): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');
    const nowIso = new Date().toISOString();
    cur.status = 'CANCELLED';
    cur.updatedAt = nowIso;
    await backend.persist(cur);
    await addHistoryEvent(executionId, { type: 'CANCELLED', actorId: userId, actorName: userName, comment: '시행 취소 처리됨' });
    return cur;
  },
};
