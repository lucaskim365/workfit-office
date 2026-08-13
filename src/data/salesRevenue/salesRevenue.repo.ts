import { salesRevenueSchema, type SalesRevenue } from '@/domain/salesRevenue/schema';
import { SALES_REVENUE_SEED } from '@/data/seeds/salesRevenue.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 매출 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<SalesRevenue>({
  coll: 'salesRevenues',
  parse: (raw) => {
    const p = salesRevenueSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse salesRevenue:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.no,
  seed: SALES_REVENUE_SEED.map((x) => salesRevenueSchema.parse(x)),
});

export interface SalesRevenueFilter {
  status?: string;
  q?: string;
}

function applyFilter(rows: SalesRevenue[], f?: SalesRevenueFilter): SalesRevenue[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.status || it.status === f.status) &&
      (!kw ||
        it.no.toLowerCase().includes(kw) ||
        it.doNo.toLowerCase().includes(kw) ||
        it.cust.toLowerCase().includes(kw)),
  );
}

export const salesRevenueRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: SalesRevenueFilter): Promise<SalesRevenue[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(no: string): Promise<SalesRevenue | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 매출번호(no). */
  async save(item: SalesRevenue): Promise<void> {
    await backend.save(salesRevenueSchema.parse(item));
  },
};
