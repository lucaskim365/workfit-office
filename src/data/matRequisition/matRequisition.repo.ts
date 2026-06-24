import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { matRequisitionSchema, type MatRequisition } from '@/domain/matRequisition/schema';
import { MAT_REQUISITION_SEED } from '@/data/seeds/matRequisition.seed';

/**
 * 자재 청구 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'matRequisitions';

export interface MatRequisitionFilter {
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: MatRequisition[] = MAT_REQUISITION_SEED.map((it) => matRequisitionSchema.parse(it));

function applyFilter(rows: MatRequisition[], f?: MatRequisitionFilter): MatRequisition[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.status || it.status === f.status) &&
      (!kw ||
        it.no.toLowerCase().includes(kw) ||
        it.wo.toLowerCase().includes(kw) ||
        it.code.toLowerCase().includes(kw)),
  );
}

export const matRequisitionRepo = {
  /** 전체 조회 + 클라이언트 필터. */
  async list(filter?: MatRequisitionFilter): Promise<MatRequisition[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => matRequisitionSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<MatRequisition | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 청구번호(no). */
  async save(item: MatRequisition): Promise<void> {
    const valid = matRequisitionSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(no: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, no));
      return;
    }
    memory = memory.filter((m) => m.no !== no);
  },
};
