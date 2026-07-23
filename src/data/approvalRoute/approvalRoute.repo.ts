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
      
      // 1. 구 버전 규칙 정리 제거 (서버 사이드 reseed 활용)


    } else {
      // 로컬/메모리 모드 갱신
      const seedIds = new Set(APPROVAL_ROUTE_SEED.map((s) => s.id));
      // 사용자가 생성한 룰(RR-숫자-숫자)은 메모리에서 필터 아웃되지 않도록 보존
      memory = memory.filter((r) => {
        const isUserRule = /RR-\d+-\d+/.test(r.id);
        if (isUserRule) return true;
        return !r.id.startsWith('RR-') || seedIds.has(r.id);
      });
      for (const seed of APPROVAL_ROUTE_SEED) {
        const valid = approvalRouteRuleSchema.parse(seed);
        const idx = memory.findIndex((m) => m.id === valid.id);
        if (idx >= 0) memory[idx] = valid;
        else memory.push(valid);
      }
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
