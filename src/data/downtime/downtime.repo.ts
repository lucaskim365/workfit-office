import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { downtimeSchema, type Downtime } from '@/domain/downtime/schema';
import { DOWNTIME_SEED } from '@/data/seeds/downtime.seed';

/**
 * 설비 비가동 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회전용 로그. Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'downtimes';

export interface DowntimeFilter {
  state?: string;
  category?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: Downtime[] = DOWNTIME_SEED.map((it) => downtimeSchema.parse(it));

function applyFilter(rows: Downtime[], f?: DowntimeFilter): Downtime[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.state || it.state === f.state) &&
      (!f.category || it.category === f.category) &&
      (!kw || it.eq.toLowerCase().includes(kw) || it.reason.toLowerCase().includes(kw)),
  );
}

export const downtimeRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: DowntimeFilter): Promise<Downtime[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => downtimeSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<Downtime | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 비가동 id. */
  async save(item: Downtime): Promise<void> {
    const valid = downtimeSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
