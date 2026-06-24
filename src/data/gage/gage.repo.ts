import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { gageSchema, type Gage } from '@/domain/gage/schema';
import { GAGE_SEED } from '@/data/seeds/gage.seed';

/**
 * 계측기·검사장비 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'gages';

export interface GageFilter {
  state?: string;
  cat?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: Gage[] = GAGE_SEED.map((g) => gageSchema.parse(g));

function applyFilter(rows: Gage[], f?: GageFilter): Gage[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (g) =>
      (!f.state || g.state === f.state) &&
      (!f.cat || g.cat === f.cat) &&
      (!kw || g.id.toLowerCase().includes(kw) || g.name.toLowerCase().includes(kw) || g.maker.toLowerCase().includes(kw)),
  );
}

export const gageRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: GageFilter): Promise<Gage[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => gageSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<Gage | null> {
    const rows = await this.list();
    return rows.find((g) => g.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 자산번호 id. */
  async save(item: Gage): Promise<void> {
    const valid = gageSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },
};
