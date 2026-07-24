import { collection, deleteDoc, doc, getDocs, setDoc, query, onSnapshot, type QuerySnapshot } from 'firebase/firestore';
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
  currentApproverIds,
} from '@/domain/approvalDoc/engine';
import { formatDocNo, yymmdd } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { APPROVAL_DOC_SEED } from '@/data/seeds/approvalDoc.seed';
import { userRepo } from '@/data/user/user.repo';
import { departmentRepo } from '@/data/department/department.repo';

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
    preservationPeriod: data.preservationPeriod ?? null,
    steps: Array.isArray(data.steps) ? data.steps.map((s: any) => ({
      ...s,
      kind: s.kind === '합의' ? '결재' : s.kind,
    })) : [],
  };
}

let memory: ApprovalDoc[] = APPROVAL_DOC_SEED.map((d) => approvalDocSchema.parse(migrateDoc(d)));

const listeners = new Set<() => void>();
function notifyListeners() {
  listeners.forEach((l) => l());
}

async function loadAll(): Promise<ApprovalDoc[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    const list: ApprovalDoc[] = [];
    for (const d of snap.docs) {
      try {
        const parsed = approvalDocSchema.parse(migrateDoc(d.data()));
        list.push(parsed);
      } catch (err) {
        console.error(`Failed to parse approval document (ID: ${d.id}):`, err);
      }
    }
    return list;
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
  notifyListeners();
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
  /** 첨부 파일 목록 */
  attachments?: ApprovalDoc['attachments'];
  /** 수신(시행)처 목록 */
  recipients?: ApprovalDoc['recipients'];
  /** 보존연한 */
  preservationPeriod?: string | null;
  /** 시행 정보 */
  execution?: ApprovalDoc['execution'];
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
    const users = await userRepo.list();
    const user = users.find((u) => u.id === userId);
    
    const depts = await departmentRepo.list();
    const userDeptObj = depts.find((d) => d.name === user?.dept);
    const userDeptNameOrId = userDeptObj ? `${user?.dept}||${userDeptObj.id}` : user?.dept;

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

  /** 승인 — 활성 단계 결재자만(엔진 위임). */
  async approve(id: string, seq: number, userId: string, comment = ''): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!isActiveApprover(cur, userId) || !stepBelongsTo(cur, seq, userId)) {
      throw new Error('결재 권한이 없습니다(본인 차례 아님)');
    }
    const users = await userRepo.list();
    const approverUser = users.find((u) => u.id === userId);

    const next = applyDecision(cur, seq, '승인', { at: now(), comment });
    next.steps = next.steps.map((s) => {
      if (s.seq === seq && s.approverId === userId) {
        return {
          ...s,
          signUrl: approverUser?.signUrl ?? null,
          sealUrl: approverUser?.sealUrl ?? null,
          signType: approverUser?.signType ?? null,
          approverName: approverUser?.name ?? null,
          approverPos: approverUser?.position ?? null,
          approverDept: approverUser?.dept ?? null,
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

        // 수신처 알림
        for (const rec of next.recipients || []) {
          if (rec.type === 'user') {
            await notificationRepo.create({
              userId: rec.id,
              type: '결재',
              title: '수신 문서 알림',
              text: `[${next.title}] 수신/시행 문서가 배달되었습니다.`,
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
                text: `[${next.title}] 부서 수신/시행 문서가 배달되었습니다.`,
                senderName: '시스템',
                linkUrl: `/gw/approval?doc=${next.id}`,
              });
            }
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

  /** 반려 — 활성 단계 결재자만, 사유 필수(엔진 위임). */
  async reject(id: string, seq: number, userId: string, comment: string): Promise<ApprovalDoc> {
    const cur = await getOrThrow(id);
    if (!isActiveApprover(cur, userId) || !stepBelongsTo(cur, seq, userId)) {
      throw new Error('결재 권한이 없습니다(본인 차례 아님)');
    }
    const next = applyDecision(cur, seq, '반려', { at: now(), comment });
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
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
    notifyListeners();
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

  subscribe(callback: (docs: ApprovalDoc[]) => void): () => void {
    if (isFirebaseConfigured && db) {
      const q = query(collection(db, COLL));
      return onSnapshot(q, (snapshot: QuerySnapshot) => {
        const list: ApprovalDoc[] = [];
        for (const d of snapshot.docs) {
          try {
            const parsed = approvalDocSchema.parse(migrateDoc(d.data()));
            list.push(parsed);
          } catch (err) {
            console.error(`Failed to parse approval document (ID: ${d.id}):`, err);
          }
        }
        callback(list);
      }, (err: Error) => {
        console.warn('Firestore approvalDocs subscription failed:', err);
        callback([]);
      });
    } else {
      const listener = () => {
        callback(memory);
      };
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    }
  },
};
