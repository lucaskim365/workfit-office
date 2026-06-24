import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { moveWipSchema, type MoveWip } from '@/domain/moveWip/schema';
import { MOVE_WIP_SEED } from '@/data/seeds/moveWip.seed';

/**
 * 공정이동 재공 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'moveWip';

export interface MoveWipFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: MoveWip[] = MOVE_WIP_SEED.map((it) => moveWipSchema.parse(it));

function applyFilter(rows: MoveWip[], f?: MoveWipFilter): MoveWip[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) => !kw || it.lot.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw),
  );
}

export const moveWipRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: MoveWipFilter): Promise<MoveWip[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => moveWipSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(lot: string): Promise<MoveWip | null> {
    const rows = await this.list();
    return rows.find((it) => it.lot === lot) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 재공 LOT 번호. */
  async save(item: MoveWip): Promise<void> {
    const valid = moveWipSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.lot), valid);
      return;
    }
    const i = memory.findIndex((m) => m.lot === valid.lot);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(lot: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, lot));
      return;
    }
    memory = memory.filter((m) => m.lot !== lot);
  },
};
