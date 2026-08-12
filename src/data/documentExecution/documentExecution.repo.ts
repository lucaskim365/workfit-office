import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  runTransaction,
  query,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { 
  documentExecutionSchema, 
  type DocumentExecution, 
} from '@/domain/documentExecution/schema';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

const COLL = 'documentExecutions';

export interface ExecutionHistoryEvent {
  eventId: string;
  type: 'DISPATCHED' | 'ASSIGNED' | 'RELEASED' | 'COMPLETED' | 'RETURNED' | 'CANCELLED' | 'REASSIGNED';
  actorId: string;      // 작업을 수행한 사용자 ID
  actorName: string;    // 작업을 수행한 사용자 이름
  comment?: string;     // 처리 의견 / 반려(반송) 사유
  createdAt: string;    // ISO String
}

// In-Memory fallback cache
let memoryExecutions: DocumentExecution[] = [];
let memoryHistory: Record<string, ExecutionHistoryEvent[]> = {};

const listeners = new Set<() => void>();
function notifyListeners() {
  listeners.forEach((l) => l());
}

export function subscribeExecutions(callback: () => void): () => void {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, COLL));
    return onSnapshot(q, () => {
      callback();
    }, (err) => {
      console.warn('Firestore documentExecutions subscription failed:', err);
      callback();
    });
  } else {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }
}

async function loadAll(): Promise<DocumentExecution[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    const list: DocumentExecution[] = [];
    for (const d of snap.docs) {
      try {
        const parsed = documentExecutionSchema.parse(d.data());
        list.push(parsed);
      } catch (err) {
        console.error(`Failed to parse document execution (ID: ${d.id}):`, err);
      }
    }
    return list;
  }
  return memoryExecutions;
}

async function persist(item: DocumentExecution): Promise<void> {
  const valid = documentExecutionSchema.parse(item);
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, valid.id), valid);
    return;
  }
  const i = memoryExecutions.findIndex((m) => m.id === valid.id);
  if (i >= 0) {
    memoryExecutions[i] = valid;
  } else {
    memoryExecutions = [valid, ...memoryExecutions];
  }
  notifyListeners();
}

async function addHistoryEvent(executionId: string, event: Omit<ExecutionHistoryEvent, 'eventId' | 'createdAt'>): Promise<void> {
  const eventId = Math.random().toString(36).substring(2, 9);
  const createdAt = new Date().toISOString();
  const fullEvent: ExecutionHistoryEvent = {
    ...event,
    eventId,
    createdAt
  };

  if (isFirebaseConfigured && db) {
    const historyDocRef = doc(collection(db, COLL, executionId, 'history'));
    await setDoc(historyDocRef, fullEvent);
    return;
  }

  if (!memoryHistory[executionId]) {
    memoryHistory[executionId] = [];
  }
  memoryHistory[executionId].push(fullEvent);
}

export const documentExecutionRepo = {
  async list(): Promise<DocumentExecution[]> {
    return loadAll();
  },

  async get(id: string): Promise<DocumentExecution | null> {
    const list = await loadAll();
    return list.find((e) => e.id === id) ?? null;
  },

  async getByDocumentId(docId: string): Promise<DocumentExecution[]> {
    const list = await loadAll();
    return list.filter((e) => e.documentId === docId);
  },

  async getHistory(executionId: string): Promise<ExecutionHistoryEvent[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL, executionId, 'history'));
      const list: ExecutionHistoryEvent[] = [];
      snap.forEach((d) => {
        list.push(d.data() as ExecutionHistoryEvent);
      });
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return (memoryHistory[executionId] ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** 
   * 최종 승인 시점에 복수 시행처용 documentExecutions 레코드 생성 
   */
  async dispatchExecutions(doc: ApprovalDoc): Promise<void> {
    // 수신처와 분리된 시행부서(executionDepts) 목록을 기준으로 발송
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
        returnReasonType: null
      };

      await persist(newExecution);
      await addHistoryEvent(executionId, {
        type: 'DISPATCHED',
        actorId: doc.drafterId,
        actorName: doc.drafterName ?? doc.drafterId,
        comment: '결재 완료에 따른 시행 발송'
      });
    }
  },

  /** 
   * 담당 집행자 지정 (내가 담당하기 등 Atomic Transaction 처리)
   */
  async claimExecution(executionId: string, userId: string, userName: string): Promise<DocumentExecution> {
    const nowIso = new Date().toISOString();

    if (isFirebaseConfigured && db) {
      const execRef = doc(db, COLL, executionId);
      const historyColRef = collection(db, COLL, executionId, 'history');
      
      await runTransaction(db, async (transaction) => {
        const execDoc = await transaction.get(execRef);
        if (!execDoc.exists()) throw new Error('존재하지 않는 시행 임무입니다.');
        
        const data = execDoc.data() as DocumentExecution;
        if (data.status !== 'UNASSIGNED' || data.assigneeId !== null) {
          throw new Error(`이미 업무가 배정되어 처리 중입니다. (담당자: ${data.assigneeNameSnapshot})`);
        }
        
        transaction.update(execRef, {
          assigneeId: userId,
          assigneeNameSnapshot: userName,
          status: 'IN_PROGRESS',
          assignedAt: nowIso,
          updatedAt: nowIso
        });

        const newEventRef = doc(historyColRef);
        transaction.set(newEventRef, {
          eventId: newEventRef.id,
          type: 'ASSIGNED',
          actorId: userId,
          actorName: userName,
          createdAt: nowIso
        });
      });

      const updated = await this.get(executionId);
      if (!updated) throw new Error('시행 정보를 불러올 수 없습니다.');
      return updated;
    }

    // In-memory fallback
    const target = memoryExecutions.find((e) => e.id === executionId);
    if (!target) throw new Error('존재하지 않는 시행 임무입니다.');
    if (target.status !== 'UNASSIGNED' || target.assigneeId !== null) {
      throw new Error(`이미 업무가 배정되어 처리 중입니다. (담당자: ${target.assigneeNameSnapshot})`);
    }

    target.assigneeId = userId;
    target.assigneeNameSnapshot = userName;
    target.status = 'IN_PROGRESS';
    target.assignedAt = nowIso;
    target.updatedAt = nowIso;

    await addHistoryEvent(executionId, {
      type: 'ASSIGNED',
      actorId: userId,
      actorName: userName
    });

    notifyListeners();
    return target;
  },

  /** 
   * 담당자 임의 변경/배정 (부서장 권한 등)
   */
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

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: isReassigned ? 'REASSIGNED' : 'ASSIGNED',
      actorId,
      actorName,
      comment: `${executorName} 담당자로 배정`
    });

    return cur;
  },

  /** 
   * 담당 업무 반납 (RELEASED)
   */
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

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: 'RELEASED',
      actorId: userId,
      actorName: userName,
      comment: '담당자 업무 접수 반납'
    });

    return cur;
  },

  /** 
   * 시행 완료 보고
   */
  async completeExecution(executionId: string, userId: string, userName: string, completedAt: string, comment = ''): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');

    const nowIso = new Date().toISOString();
    cur.status = 'COMPLETED';
    cur.completedAt = completedAt;
    cur.comment = comment;
    cur.updatedAt = nowIso;

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: 'COMPLETED',
      actorId: userId,
      actorName: userName,
      comment: comment || '시행 완료 보고'
    });

    // 해당 문서의 모든 시행처가 완료되었는지 검사 후 부모 문서 완료 처리
    const allExecs = await this.getByDocumentId(cur.documentId);
    const isAllCompleted = allExecs.every((e) => e.status === 'COMPLETED');
    
    if (isAllCompleted) {
      let parentDoc: ApprovalDoc | null = null;
      if (isFirebaseConfigured && db) {
        const parentDocRef = doc(db, 'approvalDocs', cur.documentId);
        const parentSnap = await getDoc(parentDocRef);
        if (parentSnap.exists()) {
          const { approvalDocSchema } = await import('@/domain/approvalDoc/schema');
          parentDoc = approvalDocSchema.parse(parentSnap.data()) as ApprovalDoc;
          await updateDoc(parentDocRef, {
            status: '완료',
            completedAt: nowIso
          });
        }
      }

      // 모든 시행 완료에 따른 수신처 알림 발송 연동
      if (parentDoc) {
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

  /** 
   * 시행 불가 및 반송 (RETURNED)
   */
  async returnExecution(
    executionId: string, 
    userId: string, 
    userName: string, 
    comment: string, 
    reasonType: 'SUPPLEMENT' | 'APPROVAL_CHANGE'
  ): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');

    const nowIso = new Date().toISOString();
    cur.status = 'RETURNED';
    cur.returnReasonType = reasonType;
    cur.comment = comment;
    cur.updatedAt = nowIso;

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: 'RETURNED',
      actorId: userId,
      actorName: userName,
      comment: `반송 사유: [${reasonType === 'SUPPLEMENT' ? '단순보완' : '결재변경 필요'}] ${comment}`
    });

    // 부모 결재 문서를 '시행반송' 상태로 변경
    let parentDoc: ApprovalDoc | null = null;
    if (isFirebaseConfigured && db) {
      const parentDocRef = doc(db, 'approvalDocs', cur.documentId);
      const parentSnap = await getDoc(parentDocRef);
      if (parentSnap.exists()) {
        const { approvalDocSchema } = await import('@/domain/approvalDoc/schema');
        parentDoc = approvalDocSchema.parse(parentSnap.data()) as ApprovalDoc;
        await updateDoc(parentDocRef, {
          status: '시행반송'
        });
      }
    }

    // 기안자에게 시행 반송 알림 발송
    if (parentDoc) {
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

    return cur;
  },

  /**
   * 보완 완료 후 재시행 상신 (RETURNED -> UNASSIGNED)
   */
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

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: 'DISPATCHED',
      actorId: userId,
      actorName: userName,
      comment: comment || '보완 완료 후 재시행 상신'
    });

    // 부모 결재 문서를 다시 '시행대기' 상태로 전환
    let parentDoc: ApprovalDoc | null = null;
    if (isFirebaseConfigured && db) {
      const parentDocRef = doc(db, 'approvalDocs', cur.documentId);
      const parentSnap = await getDoc(parentDocRef);
      if (parentSnap.exists()) {
        const { approvalDocSchema } = await import('@/domain/approvalDoc/schema');
        parentDoc = approvalDocSchema.parse(parentSnap.data()) as ApprovalDoc;
        await updateDoc(parentDocRef, {
          status: '시행대기'
        });
      }
    }

    // 시행 부서원들에게 재상신 알림 전송
    if (parentDoc) {
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

    return cur;
  },

  /** 
   * 기안자/관리자에 의한 강제 시행 취소
   */
  async cancelExecution(executionId: string, userId: string, userName: string): Promise<DocumentExecution> {
    const cur = await this.get(executionId);
    if (!cur) throw new Error('존재하지 않는 시행 임무입니다.');

    const nowIso = new Date().toISOString();
    cur.status = 'CANCELLED';
    cur.updatedAt = nowIso;

    await persist(cur);
    await addHistoryEvent(executionId, {
      type: 'CANCELLED',
      actorId: userId,
      actorName: userName,
      comment: '시행 취소 처리됨'
    });

    return cur;
  }
};
