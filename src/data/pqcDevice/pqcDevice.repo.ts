import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { pqcDeviceSchema, type PqcDevice } from '@/domain/pqcDevice/schema';
import { PQC_DEVICE_SEED } from '@/data/seeds/pqcDevice.seed';

/**
 * PQC 설비·계측 인터페이스 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회 마스터(상태머신 없음). Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'pqcDevices';

export interface PqcDeviceFilter {
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: PqcDevice[] = PQC_DEVICE_SEED.map((d) => pqcDeviceSchema.parse(d));

function applyFilter(rows: PqcDevice[], f?: PqcDeviceFilter): PqcDevice[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (d) =>
      (!f.status || d.status === f.status) &&
      (!kw || d.id.toLowerCase().includes(kw) || d.name.toLowerCase().includes(kw)),
  );
}

export const pqcDeviceRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: PqcDeviceFilter): Promise<PqcDevice[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => pqcDeviceSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<PqcDevice | null> {
    const rows = await this.list();
    return rows.find((d) => d.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 디바이스 ID. */
  async save(device: PqcDevice): Promise<void> {
    const valid = pqcDeviceSchema.parse(device);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
