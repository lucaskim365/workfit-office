import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { spareMovementSchema, type SpareMovement } from '@/domain/spareMovement/schema';
import { SPARE_MOVEMENT_SEED } from '@/data/seeds/spareMovement.seed';

/**
 * 예비품 입출고 원장 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'spareMovements';

export interface SpareMovementFilter {
  type?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: SpareMovement[] = SPARE_MOVEMENT_SEED.map((it) => spareMovementSchema.parse(it));

function applyFilter(rows: SpareMovement[], f?: SpareMovementFilter): SpareMovement[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!kw || it.no.toLowerCase().includes(kw) || it.code.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const spareMovementRepo = {
  /** 전체 조회 + 클라이언트 필터(원장 규모상 적합). */
  async list(filter?: SpareMovementFilter): Promise<SpareMovement[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => spareMovementSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<SpareMovement | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 전표번호(no). */
  async save(mv: SpareMovement): Promise<void> {
    const valid = spareMovementSchema.parse(mv);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
