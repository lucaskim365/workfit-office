import { issueSchema, type Issue, type IssueStatus } from '@/domain/issue/schema';
import { ISSUE_SEED } from '@/data/seeds/issue.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 불출 Repository — header(materials 임베드) + 상태 전이. 재고 반영은 services/issuing.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<Issue>({
  coll: 'issues',
  parse: (raw) => {
    const p = issueSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse issue:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (i) => i.no,
  seed: ISSUE_SEED.map((i) => issueSchema.parse(i)),
  jsonFields: ['materials'],
});

async function persist(x: Issue): Promise<void> {
  await backend.save(x);
}

export const issueRepo = {
  async list(): Promise<Issue[]> {
    return backend.loadAll();
  },

  async get(no: string): Promise<Issue | null> {
    return (await this.list()).find((i) => i.no === no) ?? null;
  },

  async setStatus(no: string, status: IssueStatus): Promise<void> {
    const x = await this.get(no);
    if (!x) throw new Error(`불출 없음: ${no}`);
    await persist(issueSchema.parse({ ...x, status }));
  },
};
