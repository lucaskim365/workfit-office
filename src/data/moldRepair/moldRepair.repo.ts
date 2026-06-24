import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { moldRepairSchema, type MoldRepair } from '@/domain/moldRepair/schema';
import { MOLD_REPAIR_SEED } from '@/data/seeds/moldRepair.seed';

/**
 * 금형 수리/세척 이력 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'moldRepairs';

export interface MoldRepairFilter {
  type?: string;
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: MoldRepair[] = MOLD_REPAIR_SEED.map((it) => moldRepairSchema.parse(it));

function applyFilter(rows: MoldRepair[], f?: MoldRepairFilter): MoldRepair[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!f.state || it.state === f.state) &&
      (!kw ||
        it.no.toLowerCase().includes(kw) ||
        it.code.toLowerCase().includes(kw) ||
        it.name.toLowerCase().includes(kw)),
  );
}

export const moldRepairRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: MoldRepairFilter): Promise<MoldRepair[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => moldRepairSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<MoldRepair | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 작업번호(no). */
  async save(item: MoldRepair): Promise<void> {
    const valid = moldRepairSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
