import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { materialRequestSchema, type MaterialRequest } from '@/domain/materialRequest/schema';
import { MATERIAL_REQUEST_SEED } from '@/data/seeds/materialRequest.seed';

/**
 * 자재 요청 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'materialRequests';

export interface MaterialRequestFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: MaterialRequest[] = MATERIAL_REQUEST_SEED.map((it) => materialRequestSchema.parse(it));

function applyFilter(rows: MaterialRequest[], f?: MaterialRequestFilter): MaterialRequest[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      !kw || it.wo.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw),
  );
}

export const materialRequestRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: MaterialRequestFilter): Promise<MaterialRequest[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => materialRequestSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(wo: string): Promise<MaterialRequest | null> {
    const rows = await this.list();
    return rows.find((it) => it.wo === wo) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 작업지시번호(wo). */
  async save(item: MaterialRequest): Promise<void> {
    const valid = materialRequestSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.wo), valid);
      return;
    }
    const i = memory.findIndex((m) => m.wo === valid.wo);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
