import { creditLimitSchema, type CreditLimit } from '@/domain/creditLimit/schema';
import { CREDIT_LIMIT_SEED } from '@/data/seeds/creditLimit.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 여신한도 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 조회 마스터(creditLimits). PK=cust. 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임.
 */
const backend = createCrudBackend<CreditLimit>({
  coll: 'creditLimits',
  parse: (raw) => {
    const p = creditLimitSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse creditLimit:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (it) => it.cust,
  seed: CREDIT_LIMIT_SEED.map((it) => creditLimitSchema.parse(it)),
});

export interface CreditLimitFilter {
  grade?: string;
  q?: string;
}

function applyFilter(rows: CreditLimit[], f?: CreditLimitFilter): CreditLimit[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.grade || it.grade === f.grade) &&
      (!kw || it.cust.toLowerCase().includes(kw)),
  );
}

export const creditLimitRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: CreditLimitFilter): Promise<CreditLimit[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(cust: string): Promise<CreditLimit | null> {
    return (await backend.loadAll()).find((it) => it.cust === cust) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 거래처명(cust). */
  async save(item: CreditLimit): Promise<void> {
    await backend.save(creditLimitSchema.parse(item));
  },
};
