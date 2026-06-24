import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { pqcPatrolSchema, type PqcPatrol } from '@/domain/pqcPatrol/schema';
import { PQC_PATROL_SEED } from '@/data/seeds/pqcPatrol.seed';

/**
 * PQC 공정 순회(Patrol) 검사 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회전용 마스터. Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'pqcPatrols';

export interface PqcPatrolFilter {
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: PqcPatrol[] = PQC_PATROL_SEED.map((r) => pqcPatrolSchema.parse(r));

function applyFilter(rows: PqcPatrol[], f?: PqcPatrolFilter): PqcPatrol[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (r) =>
      (!f.status || r.status === f.status) &&
      (!kw ||
        r.id.toLowerCase().includes(kw) ||
        r.route.toLowerCase().includes(kw) ||
        r.pic.toLowerCase().includes(kw)),
  );
}

export const pqcPatrolRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: PqcPatrolFilter): Promise<PqcPatrol[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => pqcPatrolSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<PqcPatrol | null> {
    const rows = await this.list();
    return rows.find((r) => r.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 순회 ID. */
  async save(round: PqcPatrol): Promise<void> {
    const valid = pqcPatrolSchema.parse(round);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
