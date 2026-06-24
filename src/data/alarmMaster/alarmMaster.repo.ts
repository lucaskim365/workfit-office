import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { alarmMasterSchema, type AlarmMaster } from '@/domain/alarmMaster/schema';
import { ALARM_MASTER_SEED } from '@/data/seeds/alarmMaster.seed';

/**
 * 알람·에러 코드 마스터 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회 마스터(type별 1 도큐먼트). 문서 ID = type.
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'alarmMasters';

export interface AlarmMasterFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: AlarmMaster[] = ALARM_MASTER_SEED.map((m) => alarmMasterSchema.parse(m));

function applyFilter(rows: AlarmMaster[], f?: AlarmMasterFilter): AlarmMaster[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  if (!kw) return rows;
  return rows.filter((m) => m.type.toLowerCase().includes(kw));
}

export const alarmMasterRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: AlarmMasterFilter): Promise<AlarmMaster[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => alarmMasterSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(type: string): Promise<AlarmMaster | null> {
    const rows = await this.list();
    return rows.find((m) => m.type === type) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비 유형(type). */
  async save(master: AlarmMaster): Promise<void> {
    const valid = alarmMasterSchema.parse(master);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.type), valid);
      return;
    }
    const i = memory.findIndex((m) => m.type === valid.type);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
