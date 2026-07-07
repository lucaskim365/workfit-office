import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { approvalRouteRuleSchema, type ApprovalRouteRule } from '@/domain/approvalRoute/schema';
import { APPROVAL_ROUTE_SEED } from '@/data/seeds/approvalRoute.seed';

/**
 * 동적 결재선 룰 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'approvalRouteRules';
let memory: ApprovalRouteRule[] = APPROVAL_ROUTE_SEED.map((r) => approvalRouteRuleSchema.parse(r));

export const approvalRouteRepo = {
  /** 전체 조회(우선순위 순). */
  async list(): Promise<ApprovalRouteRule[]> {
    let rows: ApprovalRouteRule[];
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      rows = snap.docs.map((d) => approvalRouteRuleSchema.parse(d.data()));
    } else {
      rows = memory;
    }
    return [...rows].sort((a, b) => a.priority - b.priority);
  },

  async get(id: string): Promise<ApprovalRouteRule | null> {
    const rows = await this.list();
    return rows.find((r) => r.id === id) ?? null;
  },

  /** 등록/수정(upsert). */
  async save(item: ApprovalRouteRule): Promise<void> {
    const valid = approvalRouteRuleSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },
};
