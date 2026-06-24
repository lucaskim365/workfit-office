import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { creditLimitSchema, type CreditLimit } from '@/domain/creditLimit/schema';
import { CREDIT_LIMIT_SEED } from '@/data/seeds/creditLimit.seed';

/**
 * 여신한도 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회 마스터(creditLimits). PK=cust. Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'creditLimits';

export interface CreditLimitFilter {
  grade?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: CreditLimit[] = CREDIT_LIMIT_SEED.map((it) => creditLimitSchema.parse(it));

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
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => creditLimitSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(cust: string): Promise<CreditLimit | null> {
    const rows = await this.list();
    return rows.find((it) => it.cust === cust) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 거래처명(cust). */
  async save(item: CreditLimit): Promise<void> {
    const valid = creditLimitSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.cust), valid);
      return;
    }
    const i = memory.findIndex((m) => m.cust === valid.cust);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
