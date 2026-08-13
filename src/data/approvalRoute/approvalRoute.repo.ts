import { approvalRouteRuleSchema, type ApprovalRouteRule } from '@/domain/approvalRoute/schema';
import { APPROVAL_ROUTE_SEED } from '@/data/seeds/approvalRoute.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 동적 결재선 룰 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<ApprovalRouteRule>({
  coll: 'approvalRouteRules',
  parse: (raw) => {
    const p = approvalRouteRuleSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse approvalRouteRule:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: APPROVAL_ROUTE_SEED.map((r) => approvalRouteRuleSchema.parse(r)),
  jsonFields: ['steps', 'deptScope'],
});

export const approvalRouteRepo = {
  /** 전체 조회(우선순위 순). */
  async list(): Promise<ApprovalRouteRule[]> {
    const rows = await backend.loadAll();
    return [...rows].sort((a, b) => a.priority - b.priority);
  },

  async get(id: string): Promise<ApprovalRouteRule | null> {
    const rows = await this.list();
    return rows.find((r) => r.id === id) ?? null;
  },

  /** 등록/수정(upsert). */
  async save(item: ApprovalRouteRule): Promise<void> {
    await backend.save(approvalRouteRuleSchema.parse(item));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
