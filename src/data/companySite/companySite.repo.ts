import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { companySiteSchema, type CompanySite } from '@/domain/companySite/schema';
import { COMPANY_SITE_SEED } from '@/data/seeds/companySite.seed';

/**
 * 회사 사업장 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'companySites';

export interface CompanySiteFilter {
  kind?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: CompanySite[] = COMPANY_SITE_SEED.map((it) => companySiteSchema.parse(it));

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
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => companySiteSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(name: string): Promise<CompanySite | null> {
    const rows = await this.list();
    return rows.find((it) => it.name === name) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 사업장명. */
  async save(item: CompanySite): Promise<void> {
    const valid = companySiteSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.name), valid);
      return;
    }
    const i = memory.findIndex((m) => m.name === valid.name);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
