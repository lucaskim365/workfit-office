import { createCrudBackend } from '@/data/_backend/crudBackend';
import { authAssignmentSchema, authRoleSchema } from '@/domain/authz/schema';
import type { AuthAssignment, AuthRole } from '@/domain/authz/types';

/**
 * 새 권한 체계 저장소 — authRoles(역할) · authAssignments(지정).
 * 옛 roleGroups·roleMappings 와 따로 있다(읽지도 쓰지도 않는다).
 */
const roleBackend = createCrudBackend<AuthRole>({
  coll: 'authRoles',
  parse: (raw) => {
    const p = authRoleSchema.safeParse({ ...(raw as object), id: (raw as { $id?: string; id?: string }).id ?? (raw as { $id?: string }).$id });
    return p.success ? (p.data as AuthRole) : null;
  },
  idOf: (x) => x.id,
  seed: [],
  jsonFields: ['permissions'],
});

const assignmentBackend = createCrudBackend<AuthAssignment>({
  coll: 'authAssignments',
  parse: (raw) => {
    const p = authAssignmentSchema.safeParse({ ...(raw as object), id: (raw as { $id?: string; id?: string }).id ?? (raw as { $id?: string }).$id });
    return p.success ? (p.data as AuthAssignment) : null;
  },
  idOf: (x) => x.id,
  seed: [],
  jsonFields: ['scopeDeptIds'],
});

const rid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const authzRepo = {
  listRoles: () => roleBackend.loadAll(),
  listAssignments: () => assignmentBackend.loadAll(),
  newRoleId: () => rid('ROLE'),
  newAssignmentId: () => rid('ASG'),
  saveRole: (r: AuthRole) => roleBackend.save(r),
  insertRole: (r: AuthRole) => roleBackend.insert(r),
  removeRole: (id: string) => roleBackend.remove(id),
  saveAssignment: (a: AuthAssignment) => assignmentBackend.save(a),
  insertAssignment: (a: AuthAssignment) => assignmentBackend.insert(a),
  removeAssignment: (id: string) => assignmentBackend.remove(id),
};
