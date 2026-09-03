import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { SYSTEM_SCREENS, roleGroupSchema, roleMappingSchema, type RoleGroup, type RoleMapping } from '@/domain/roleGroup/schema';
import { ROLE_GROUP_SEED, getDefaultPermissionsForGroup } from '@/data/seeds/roleGroup.seed';
import { userRepo } from '@/data/user/user.repo';
import { departmentRepo } from '@/data/department/department.repo';
import { positionRepo } from '@/data/position/position.repo';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 역할그룹 Repository — DB 접근을 캡슐화하는 계층.
 * roleGroups 마스터 + roleMappings 관계(Junction) 컬렉션 통합 관리.
 */
const groupBackend = createCrudBackend<RoleGroup>({
  coll: 'roleGroups',
  parse: (raw) => {
    const p = roleGroupSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse roleGroup:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.code,
  seed: ROLE_GROUP_SEED.map((g) => roleGroupSchema.parse(g)),
  jsonFields: ['members', 'menuPermissions'],
  firestoreEncode: encodeForFirestore,
  firestoreDecode: decodeFromFirestore,
});

const mappingBackend = createCrudBackend<RoleMapping>({
  coll: 'roleMappings',
  parse: (raw) => {
    const p = roleMappingSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse roleMapping:', p.error);
      return null;
    }
    return {
      ...p.data,
      id: (raw as any).$id || (raw as any).id,
    };
  },
  idOf: (x) => x.id || (x as any).$id || `map_${x.roleCode}_${x.targetType}_${x.targetId}`,
  seed: [],
  jsonFields: [],
});

export const roleGroupRepo = {
  /** 역할 그룹 목록 조회 (관계 컬렉션 roleMappings가 대상자 바인딩의 Single Source of Truth) */
  async list(): Promise<RoleGroup[]> {
    const [dbGroups, dbMappings] = await Promise.all([
      groupBackend.loadAll().catch((err) => {
        console.warn('Failed to load roleGroups from DB, using fallback:', err);
        return [];
      }),
      mappingBackend.loadAll().catch((err) => {
        console.warn('Failed to load roleMappings from DB, using fallback:', err);
        return [];
      }),
    ]);

    const sourceList = (dbGroups && dbGroups.length > 0)
      ? dbGroups
      : ROLE_GROUP_SEED.map((g) => roleGroupSchema.parse(g));

    const mapped = sourceList.map((g) => {
      // 1. 관계 테이블(roleMappings)에서 해당 그룹의 매핑 항목들 추출 (SSOT, ROLE_ 접두사 유연 매칭)
      const normGroupCode = g.code.replace(/^ROLE_/, '').toUpperCase();
      const groupMappings = dbMappings.filter(
        (m) => m.roleCode.replace(/^ROLE_/, '').toUpperCase() === normGroupCode
      );
      let userIds = groupMappings.filter((m) => m.targetType === 'USER').map((m) => m.targetId);
      let deptIds = groupMappings.filter((m) => m.targetType === 'DEPT').map((m) => m.targetId);
      let positionRanks = groupMappings
        .filter((m) => m.targetType === 'POSITION')
        .map((m) => Number(m.targetId))
        .filter((n) => !Number.isNaN(n));

      // DB의 roleMappings에 아직 매핑이 없는 경우(초기 상태), 시드의 기본 대상자(ADMIN: D240 등)를 기본값으로 자동 주입
      if (groupMappings.length === 0) {
        const seedGroup = ROLE_GROUP_SEED.find((s) => s.code === g.code);
        if (seedGroup) {
          userIds = seedGroup.userIds || [];
          deptIds = seedGroup.deptIds || [];
          positionRanks = seedGroup.positionRanks || [];
        }
      }

      // 2. 권한 매트릭스 복원 및 단일 표준 Screen ID 키로 정규화
      let rawPermMap: Record<string, any> | null = null;
      if (g.menuPermissions && typeof g.menuPermissions === 'object' && Object.keys(g.menuPermissions).length > 0) {
        rawPermMap = g.menuPermissions;
      } else if ((g as any).permissions) {
        if (typeof (g as any).permissions === 'object' && Object.keys((g as any).permissions).length > 0) {
          rawPermMap = (g as any).permissions;
        } else if (typeof (g as any).permissions === 'string' && (g as any).permissions.startsWith('{')) {
          try {
            rawPermMap = JSON.parse((g as any).permissions);
          } catch { }
        }
      }

      const defaultPerms = getDefaultPermissionsForGroup(g.code, g.name);
      const menuPermissions: Record<string, any> = {};

      SYSTEM_SCREENS.forEach((s) => {
        const foundPerm = rawPermMap?.[s.id] ?? rawPermMap?.[s.url] ?? defaultPerms[s.id];
        menuPermissions[s.id] = foundPerm;
      });

      return {
        ...g,
        userIds,
        deptIds,
        positionRanks,
        menuPermissions,
      };
    });

    // 중복 그룹 코드 제거 (DB에 동일 코드 다중 문서가 있더라도 단 1개로 정규화)
    const seen = new Set<string>();
    const uniqueGroups: RoleGroup[] = [];
    for (const item of mapped) {
      const norm = item.code.toUpperCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        uniqueGroups.push(item);
      }
    }
    return uniqueGroups;
  },

  /** 매핑 관계 목록 전체 조회 */
  async listMappings(): Promise<RoleMapping[]> {
    return mappingBackend.loadAll();
  },

  /** 등록/수정(upsert) - 그룹 마스터(메타) 및 관계 매핑(SSOT) 원자적 분리 저장 */
  async save(group: RoleGroup): Promise<void> {
    const parsed = roleGroupSchema.parse(group);

    // 1. 35개 단일 표준 Screen ID 키로만 정규화하여 저장
    const normalizedPerms: Record<string, any> = {};
    const inputPerms = parsed.menuPermissions ?? {};
    SYSTEM_SCREENS.forEach((s) => {
      normalizedPerms[s.id] = inputPerms[s.id] ?? inputPerms[s.url] ?? { access: false, create: false, update: false, delete: false };
    });
    const menuPermJson = JSON.stringify(normalizedPerms);
    const basePayload: any = {
      code: parsed.code,
      name: parsed.name,
      desc: parsed.desc ?? '',
      use: parsed.use ?? true,
      isSystem: parsed.isSystem ?? false,
      members: [],
      menuPermissions: menuPermJson,
    };

    await groupBackend.save(basePayload);

    // 2. 대상자 관계(USER/DEPT/POSITION)는 roleMappings 컬렉션에만 단독 저장/관리 (SSOT)
    try {
      const [allMappings, liveUsers, liveDepts, livePositions] = await Promise.all([
        mappingBackend.loadAll(),
        userRepo.list().catch(() => []),
        departmentRepo.list().catch(() => []),
        positionRepo.list().catch(() => []),
      ]);

      const currentGroupMappings = allMappings.filter((m) => m.roleCode === parsed.code);

      // 1) 기존 그룹 매핑 항목 정리
      for (const m of currentGroupMappings) {
        const id = m.id || (m as any).$id;
        if (id) await mappingBackend.remove(id);
      }

      // 2) 신규 매핑 항목 생성 (실제 Appwrite DB 마스터에서 이름 및 부서 동적 매핑)
      const newMappings: RoleMapping[] = [];
      (parsed.userIds ?? []).forEach((uid) => {
        const u = liveUsers.find((user) => user.id === uid);
        const targetName = u ? `${u.name} (${u.position}, ${u.dept})` : `사원 (${uid})`;
        newMappings.push({
          id: `map_${parsed.code}_USER_${uid}`,
          roleCode: parsed.code,
          targetType: 'USER',
          targetId: uid,
          targetName,
        });
      });
      (parsed.deptIds ?? []).forEach((did) => {
        const d = liveDepts.find((dept) => dept.id === did);
        const targetName = d?.name || (did === 'D240' ? '데이터플랫폼 개발팀' : `부서 (${did})`);
        newMappings.push({
          id: `map_${parsed.code}_DEPT_${did}`,
          roleCode: parsed.code,
          targetType: 'DEPT',
          targetId: did,
          targetName,
        });
      });
      (parsed.positionRanks ?? []).forEach((rank) => {
        const p = livePositions.find((pos) => pos.rank === rank);
        const targetName = p?.name || `직급 (${rank})`;
        newMappings.push({
          id: `map_${parsed.code}_POS_${rank}`,
          roleCode: parsed.code,
          targetType: 'POSITION',
          targetId: String(rank),
          targetName,
        });
      });

      for (const mapItem of newMappings) {
        await mappingBackend.save(mapItem);
      }
    } catch (err) {
      console.warn('Failed to sync roleMappings relation table:', err);
    }
  },

  async remove(code: string): Promise<void> {
    await groupBackend.remove(code);
    try {
      const allMappings = await mappingBackend.loadAll();
      const targetMappings = allMappings.filter((m) => m.roleCode === code);
      for (const m of targetMappings) {
        const id = m.id || (m as any).$id;
        if (id) await mappingBackend.remove(id);
      }
    } catch (err) {
      console.warn('Failed to clean up roleMappings on remove:', err);
    }
  },
};
