import { companySiteSchema, type CompanySite } from '@/domain/companySite/schema';
import { COMPANY_SITE_SEED } from '@/data/seeds/companySite.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 회사 사업장 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<CompanySite>({
  coll: 'companySites',
  parse: (raw) => {
    const p = companySiteSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse companySite:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.name,
  seed: COMPANY_SITE_SEED.map((it) => companySiteSchema.parse(it)),
});

export interface CompanySiteFilter {
  kind?: string;
  q?: string;
}

function applyFilter(rows: CompanySite[], f?: CompanySiteFilter): CompanySite[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.kind || it.kind === f.kind) &&
      (!kw || it.name.toLowerCase().includes(kw) || it.addr.toLowerCase().includes(kw)),
  );
}

export const companySiteRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: CompanySiteFilter): Promise<CompanySite[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(name: string): Promise<CompanySite | null> {
    return (await backend.loadAll()).find((it) => it.name === name) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 사업장명. */
  async save(item: CompanySite): Promise<void> {
    await backend.save(companySiteSchema.parse(item));
  },

  /** 삭제. 문서 ID = 사업장명. */
  async remove(name: string): Promise<void> {
    await backend.remove(name);
  },
};
