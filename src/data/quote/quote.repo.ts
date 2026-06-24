import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { quoteSchema, type Quote } from '@/domain/quote/schema';
import { QUOTE_SEED } from '@/data/seeds/quote.seed';

/**
 * 영업 견적 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'quotes';

export interface QuoteFilter {
  progress?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: Quote[] = QUOTE_SEED.map((it) => quoteSchema.parse(it));

function applyFilter(rows: Quote[], f?: QuoteFilter): Quote[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.progress || it.progress === f.progress) &&
      (!kw || it.no.toLowerCase().includes(kw) || it.item.toLowerCase().includes(kw) || it.cust.toLowerCase().includes(kw)),
  );
}

export const quoteRepo = {
  /** 전체 조회 + 클라이언트 필터. */
  async list(filter?: QuoteFilter): Promise<Quote[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => quoteSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<Quote | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 견적번호(no). */
  async save(item: Quote): Promise<void> {
    const valid = quoteSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
