import { createCrudBackend, DocumentExistsError, type InsertableCrudBackend } from '@/data/_backend/crudBackend';
import {
  bizNoDigits,
  companyBankAccountSchema,
  companyFileSchema,
  companySchema,
  newAccountId,
  normalizeDefaultAccount,
  type AccountDraft,
  type Company,
  type CompanyBankAccount,
  type CompanyFile,
} from '@/domain/company/schema';

/** 같은 사업자등록번호가 이미 있다(DB 유일 인덱스가 막음 — 두 사람이 동시에 넣은 경우 포함). */
export class DuplicateBizNoError extends Error {
  constructor() {
    super('이미 등록된 사업자등록번호입니다.');
    this.name = 'DuplicateBizNoError';
  }
}

const safe = <T>(schema: { safeParse: (x: unknown) => { success: boolean; data?: T } }) => (raw: unknown): T | null => {
  const p = schema.safeParse(raw);
  return p.success ? (p.data as T) : null;
};

type Backend<T> = Pick<InsertableCrudBackend<T>, 'loadAll' | 'loadWithQueries' | 'insert' | 'save'>;

export interface CompanyBackends {
  companies: Backend<Company>;
  accounts: Backend<CompanyBankAccount>;
  files: Backend<CompanyFile>;
}

const isConflict = (e: unknown) => e instanceof DocumentExistsError || (e as { code?: number })?.code === 409;

export function createCompanyRepo(b: CompanyBackends) {
  return {
    list: () => b.companies.loadAll(),
    listAccounts: () => b.accounts.loadAll(),
    /** 첨부파일 — 이번엔 자리만(화면 없음). */
    listFiles: async (companyId: string) => (await b.files.loadAll()).filter((f) => f.companyId === companyId),

    /**
     * 기업과 계좌를 함께 저장. 기업 먼저 — 사업자번호가 겹치면(409) DuplicateBizNoError 를 던지고 계좌는 건드리지 않는다.
     * 계좌: 기본 계좌 규칙을 적용하고, 새 줄은 insert, 있던 줄은 save, `existing` 에 있는데 빠진 줄은 지우지 않고 사용 안 함.
     */
    async saveCompanyWithAccounts(input: {
      company: Company;
      isNew: boolean;
      accounts: AccountDraft[];
      existing: CompanyBankAccount[];
      actorId: string;
    }): Promise<Company> {
      const now = new Date().toISOString();
      const { actorId } = input;
      const company: Company = {
        ...input.company,
        name: input.company.name.trim(),
        bizNo: bizNoDigits(input.company.bizNo),
        ...(input.isNew ? { createdBy: actorId, createdAt: now } : {}),
        updatedBy: actorId,
        updatedAt: now,
      };
      try {
        if (input.isNew) await b.companies.insert(company);
        else await b.companies.save(company);
      } catch (e) {
        if (isConflict(e)) throw new DuplicateBizNoError();
        throw e;
      }

      const byId = new Map(input.existing.map((a) => [a.id, a]));
      const kept = new Set(input.accounts.map((a) => a.id).filter(Boolean) as string[]);
      const dropped = input.existing.filter((a) => !kept.has(a.id)).map((a) => ({ ...a, use: false, isDefault: false, updatedBy: actorId, updatedAt: now }));
      const rows = normalizeDefaultAccount(input.accounts).map((d): CompanyBankAccount => {
        const prev = d.id ? byId.get(d.id) : undefined;
        return {
          id: d.id ?? newAccountId(),
          companyId: company.id,
          bankCode: d.bankCode,
          accountNo: d.accountNo.trim(),
          holder: d.holder.trim(),
          isDefault: d.isDefault,
          use: d.use,
          note: d.note.trim(),
          createdBy: prev?.createdBy ?? actorId,
          createdAt: prev?.createdAt ?? now,
          updatedBy: actorId,
          updatedAt: now,
        };
      });
      for (const a of rows) {
        if (byId.has(a.id)) await b.accounts.save(a);
        else await b.accounts.insert(a);
      }
      for (const a of dropped) await b.accounts.save(a);
      return company;
    },
  };
}

export const companyRepo = createCompanyRepo({
  companies: createCrudBackend<Company>({ coll: 'companies', parse: safe(companySchema), idOf: (x) => x.id, seed: [] }),
  accounts: createCrudBackend<CompanyBankAccount>({ coll: 'companyBankAccounts', parse: safe(companyBankAccountSchema), idOf: (x) => x.id, seed: [] }),
  files: createCrudBackend<CompanyFile>({ coll: 'companyFiles', parse: safe(companyFileSchema), idOf: (x) => x.id, seed: [] }),
});
