import { commonCodeSchema, groupCommonCodes, type CommonCode, type CodeGroup } from '@/domain/commonCode/schema';
import { COMMON_CODE_SEED } from '@/data/seeds/commonCode.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 공통코드 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 문서 ID = `${groupCode}__${code}` (복합 PK). 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임.
 */
const backend = createCrudBackend<CommonCode>({
  coll: 'commonCodes',
  parse: (raw) => {
    const p = commonCodeSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse commonCode:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (c) => `${c.groupCode}__${c.code}`,
  seed: COMMON_CODE_SEED.map((c) => commonCodeSchema.parse(c)),
});

export const commonCodeRepo = {
  /** 전체 코드(flat). enum 소비자용. */
  async list(): Promise<CommonCode[]> {
    return backend.loadAll();
  },

  /** 특정 그룹의 사용중 코드만(enum 옵션 생성용). */
  async listByGroup(groupCode: string): Promise<CommonCode[]> {
    const rows = await this.list();
    return rows.filter((c) => c.groupCode === groupCode && c.use).sort((a, b) => a.order - b.order);
  },

  /** 그룹 뷰(화면 표시용). */
  async listGroups(): Promise<CodeGroup[]> {
    return groupCommonCodes(await this.list());
  },

  async save(code: CommonCode): Promise<void> {
    await backend.save(commonCodeSchema.parse(code));
  },

  async remove(groupCode: string, code: string): Promise<void> {
    await backend.remove(`${groupCode}__${code}`);
  },
};
