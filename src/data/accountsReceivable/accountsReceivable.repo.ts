import { accountsReceivableSchema, type AccountsReceivable } from '@/domain/accountsReceivable/schema';
import { ACCOUNTS_RECEIVABLE_SEED } from '@/data/seeds/accountsReceivable.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 채권(미수금) Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<AccountsReceivable>({
  coll: 'accountsReceivable',
  parse: (raw) => {
    const p = accountsReceivableSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse accountsReceivable:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.cust,
  seed: ACCOUNTS_RECEIVABLE_SEED.map((x) => accountsReceivableSchema.parse(x)),
});

export interface AccountsReceivableFilter {
  status?: string;
  q?: string;
}

function applyFilter(rows: AccountsReceivable[], f?: AccountsReceivableFilter): AccountsReceivable[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.status || it.status === f.status) &&
      (!kw || it.cust.toLowerCase().includes(kw)),
  );
}

export const accountsReceivableRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: AccountsReceivableFilter): Promise<AccountsReceivable[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(cust: string): Promise<AccountsReceivable | null> {
    const rows = await this.list();
    return rows.find((it) => it.cust === cust) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 거래처명. */
  async save(item: AccountsReceivable): Promise<void> {
    await backend.save(accountsReceivableSchema.parse(item));
  },

  async remove(cust: string): Promise<void> {
    await backend.remove(cust);
  },
};
