import { taxInvoiceSchema, type TaxInvoice } from '@/domain/taxInvoice/schema';
import { TAX_INVOICE_SEED } from '@/data/seeds/taxInvoice.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 세금계산서 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<TaxInvoice>({
  coll: 'taxInvoices',
  parse: (raw) => {
    const p = taxInvoiceSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse taxInvoice:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.no,
  seed: TAX_INVOICE_SEED.map((x) => taxInvoiceSchema.parse(x)),
});

export interface TaxInvoiceFilter {
  status?: string;
  q?: string;
}

function applyFilter(rows: TaxInvoice[], f?: TaxInvoiceFilter): TaxInvoice[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.status || it.status === f.status) &&
      (!kw ||
        it.no.toLowerCase().includes(kw) ||
        it.sale.toLowerCase().includes(kw) ||
        it.cust.toLowerCase().includes(kw)),
  );
}

export const taxInvoiceRepo = {
  /** 전체 조회 + 클라이언트 필터(증빙 규모상 적합). */
  async list(filter?: TaxInvoiceFilter): Promise<TaxInvoice[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(no: string): Promise<TaxInvoice | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 증빙번호(no). */
  async save(item: TaxInvoice): Promise<void> {
    await backend.save(taxInvoiceSchema.parse(item));
  },

  async remove(no: string): Promise<void> {
    await backend.remove(no);
  },
};
