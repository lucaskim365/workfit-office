import { roleGroupAuditSchema, type RoleGroupAudit } from '@/domain/roleGroupAudit/schema';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 역할 그룹 권한 변경 감사 로그 Repository (roleGroupAuditLogs)
 * 
 * 사후 감사 및 컴플라이언스 준수를 위해 백엔드 DB 또는 메모리 저장소에 diff 스냅샷을 영구 보존합니다.
 */
const backend = createCrudBackend<RoleGroupAudit>({
  coll: 'roleGroupAuditLogs',
  parse: (raw) => {
    const p = roleGroupAuditSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse roleGroupAuditLog:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: [],
  jsonFields: ['diff', 'performedBy'],
});

export const roleGroupAuditRepo = {
  /** 최근 변경 감사 로그 목록 조회 (최신순) */
  async list(limit = 100): Promise<RoleGroupAudit[]> {
    const rows = await backend.loadAll();
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },

  /** 감사 로그 기록 */
  async record(audit: Omit<RoleGroupAudit, 'id' | 'at'> & { id?: string; at?: string }): Promise<void> {
    const fullAudit: RoleGroupAudit = {
      ...audit,
      id: audit.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: audit.at || new Date().toISOString(),
    };
    try {
      await backend.save(roleGroupAuditSchema.parse(fullAudit));
    } catch (err) {
      console.warn('[roleGroupAuditRepo] Failed to save audit log:', err);
    }
  },
};
