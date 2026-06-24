import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { prodLotTraceSchema, type ProdLotTrace } from '@/domain/prodLotTrace/schema';
import { PROD_LOT_TRACE_SEED } from '@/data/seeds/prodLotTrace.seed';

/**
 * 생산 LOT 추적(투입자재) Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade. 조회전용 마스터.
 */
const COLL = 'prodLotTraces';

export interface ProdLotTraceFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: ProdLotTrace[] = PROD_LOT_TRACE_SEED.map((it) => prodLotTraceSchema.parse(it));

function applyFilter(rows: ProdLotTrace[], f?: ProdLotTraceFilter): ProdLotTrace[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      !kw ||
      it.mat.toLowerCase().includes(kw) ||
      it.name.toLowerCase().includes(kw) ||
      it.lot.toLowerCase().includes(kw),
  );
}

export const prodLotTraceRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: ProdLotTraceFilter): Promise<ProdLotTrace[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => prodLotTraceSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<ProdLotTrace | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = id. */
  async save(item: ProdLotTrace): Promise<void> {
    const valid = prodLotTraceSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
