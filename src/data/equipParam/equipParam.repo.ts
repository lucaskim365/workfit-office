import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { equipParamSchema, type EquipParam } from '@/domain/equipParam/schema';
import { EQUIP_PARAM_SEED } from '@/data/seeds/equipParam.seed';

/**
 * 설비 파라미터 현황 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회전용 마스터(설비별 1 도큐먼트). Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'equipParams';

export interface EquipParamFilter {
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: EquipParam[] = EQUIP_PARAM_SEED.map((it) => equipParamSchema.parse(it));

function applyFilter(rows: EquipParam[], f?: EquipParamFilter): EquipParam[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.state || it.state === f.state) &&
      (!kw || it.code.toLowerCase().includes(kw) || it.recipe.toLowerCase().includes(kw)),
  );
}

export const equipParamRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: EquipParamFilter): Promise<EquipParam[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => equipParamSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(code: string): Promise<EquipParam | null> {
    const rows = await this.list();
    return rows.find((it) => it.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비코드. */
  async save(item: EquipParam): Promise<void> {
    const valid = equipParamSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), valid);
      return;
    }
    const i = memory.findIndex((m) => m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
