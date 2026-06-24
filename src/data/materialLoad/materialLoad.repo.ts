import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { materialLoadSchema, type MaterialLoad } from '@/domain/materialLoad/schema';
import { MATERIAL_LOAD_SEED } from '@/data/seeds/materialLoad.seed';

/**
 * 자재 투입 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'materialLoads';

export interface MaterialLoadFilter {
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: MaterialLoad[] = MATERIAL_LOAD_SEED.map((it) => materialLoadSchema.parse(it));

function applyFilter(rows: MaterialLoad[], f?: MaterialLoadFilter): MaterialLoad[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.state || it.state === f.state) &&
      (!kw || it.mat.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const materialLoadRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: MaterialLoadFilter): Promise<MaterialLoad[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => materialLoadSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<MaterialLoad | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = id. */
  async save(item: MaterialLoad): Promise<void> {
    const valid = materialLoadSchema.parse(item);
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
