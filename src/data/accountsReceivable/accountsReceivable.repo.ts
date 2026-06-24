import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { accountsReceivableSchema, type AccountsReceivable } from '@/domain/accountsReceivable/schema';
import { ACCOUNTS_RECEIVABLE_SEED } from '@/data/seeds/accountsReceivable.seed';

/**
 * 채권(미수금) Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'accountsReceivable';

export interface AccountsReceivableFilter {
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: AccountsReceivable[] = ACCOUNTS_RECEIVABLE_SEED.map((it) => accountsReceivableSchema.parse(it));

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
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => accountsReceivableSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(cust: string): Promise<AccountsReceivable | null> {
    const rows = await this.list();
    return rows.find((it) => it.cust === cust) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 거래처명. */
  async save(item: AccountsReceivable): Promise<void> {
    const valid = accountsReceivableSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.cust), valid);
      return;
    }
    const i = memory.findIndex((m) => m.cust === valid.cust);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(cust: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, cust));
      return;
    }
    memory = memory.filter((m) => m.cust !== cust);
  },
};
