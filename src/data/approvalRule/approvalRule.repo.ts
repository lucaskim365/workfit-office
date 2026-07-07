import { collection, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { approvalRuleSchema, type ApprovalRule } from '@/domain/approvalRule/schema';
import { APPROVAL_RULE_SEED } from '@/data/seeds/approvalRule.seed';

/**
 * 전결규정 Repository — Firestore 접근을 캡슐화하는 유일한 계층(읽기 전용 마스터).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'approvalRules';
const memory: ApprovalRule[] = APPROVAL_RULE_SEED.map((r) => approvalRuleSchema.parse(r));

export const approvalRuleRepo = {
  async list(): Promise<ApprovalRule[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => approvalRuleSchema.parse(d.data()));
    }
    return memory;
  },

  async get(id: string): Promise<ApprovalRule | null> {
    const rows = await this.list();
    return rows.find((r) => r.id === id) ?? null;
  },
};
