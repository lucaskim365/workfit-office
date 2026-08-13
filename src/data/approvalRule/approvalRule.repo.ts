import { approvalRuleSchema, type ApprovalRule } from '@/domain/approvalRule/schema';
import { APPROVAL_RULE_SEED } from '@/data/seeds/approvalRule.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 전결규정 Repository — DB 접근을 캡슐화하는 유일한 계층(읽기 전용 마스터).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<ApprovalRule>({
  coll: 'approvalRules',
  parse: (raw) => {
    const p = approvalRuleSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse approvalRule:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (r) => r.id,
  seed: APPROVAL_RULE_SEED.map((r) => approvalRuleSchema.parse(r)),
});

export const approvalRuleRepo = {
  async list(): Promise<ApprovalRule[]> {
    return backend.loadAll();
  },

  async get(id: string): Promise<ApprovalRule | null> {
    return (await backend.loadAll()).find((r) => r.id === id) ?? null;
  },
};
