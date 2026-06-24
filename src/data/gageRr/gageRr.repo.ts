import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { gageRrSchema, type GageRr } from '@/domain/gageRr/schema';
import { GAGE_RR_SEED } from '@/data/seeds/gageRr.seed';

/**
 * Gage R&R(MSA) Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'gageRrStudies';

export interface GageRrFilter {
  method?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: GageRr[] = GAGE_RR_SEED.map((it) => gageRrSchema.parse(it));

function applyFilter(rows: GageRr[], f?: GageRrFilter): GageRr[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.method || it.method === f.method) &&
      (!kw || it.id.toLowerCase().includes(kw) || it.char.toLowerCase().includes(kw) || it.gage.toLowerCase().includes(kw)),
  );
}

export const gageRrRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: GageRrFilter): Promise<GageRr[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => gageRrSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<GageRr | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = MSA 분석 ID. */
  async save(item: GageRr): Promise<void> {
    const valid = gageRrSchema.parse(item);
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
