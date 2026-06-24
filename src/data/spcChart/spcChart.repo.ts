import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { spcChartSchema, type SpcChart } from '@/domain/spcChart/schema';
import { SPC_CHART_SEED } from '@/data/seeds/spcChart.seed';

/**
 * SPC 관리도 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회 전용 마스터 — create/transition 없음.
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'spcCharts';

export interface SpcChartFilter {
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: SpcChart[] = SPC_CHART_SEED.map((it) => spcChartSchema.parse(it));

function applyFilter(rows: SpcChart[], f?: SpcChartFilter): SpcChart[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.state || it.state === f.state) &&
      (!kw || it.id.toLowerCase().includes(kw) || it.char.toLowerCase().includes(kw) || it.prod.toLowerCase().includes(kw)),
  );
}

export const spcChartRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: SpcChartFilter): Promise<SpcChart[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => spcChartSchema.parse(decodeFromFirestore(d.data())));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<SpcChart | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 특성 id. */
  async save(item: SpcChart): Promise<void> {
    const valid = spcChartSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), encodeForFirestore(valid));
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
