import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { wipStatusSchema, type WipStatus } from '@/domain/wipStatus/schema';
import { WIP_STATUS_SEED } from '@/data/seeds/wipStatus.seed';

/**
 * 재공 현황 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회전용 마스터. Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'wipStatus';

export interface WipStatusFilter {
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: WipStatus[] = WIP_STATUS_SEED.map((it) => wipStatusSchema.parse(it));

function applyFilter(rows: WipStatus[], f?: WipStatusFilter): WipStatus[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.status || it.status === f.status) &&
      (!kw || it.lot.toLowerCase().includes(kw) || it.item.toLowerCase().includes(kw)),
  );
}

export const wipStatusRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: WipStatusFilter): Promise<WipStatus[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => wipStatusSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<WipStatus | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = id. */
  async save(item: WipStatus): Promise<void> {
    const valid = wipStatusSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
