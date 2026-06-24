import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { scheduleEntrySchema, type ScheduleEntry } from '@/domain/scheduleEntry/schema';
import { SCHEDULE_ENTRY_SEED } from '@/data/seeds/scheduleEntry.seed';

/**
 * 생산 일정 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * (DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'scheduleEntries';

export interface ScheduleEntryFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: ScheduleEntry[] = SCHEDULE_ENTRY_SEED.map((it) => scheduleEntrySchema.parse(it));

function applyFilter(rows: ScheduleEntry[], f?: ScheduleEntryFilter): ScheduleEntry[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) => !kw || it.wo.toLowerCase().includes(kw) || it.prod.toLowerCase().includes(kw),
  );
}

export const scheduleEntryRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: ScheduleEntryFilter): Promise<ScheduleEntry[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => scheduleEntrySchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(wo: string): Promise<ScheduleEntry | null> {
    const rows = await this.list();
    return rows.find((it) => it.wo === wo) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 작업지시 번호. */
  async save(item: ScheduleEntry): Promise<void> {
    const valid = scheduleEntrySchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.wo), valid);
      return;
    }
    const i = memory.findIndex((m) => m.wo === valid.wo);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(wo: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, wo));
      return;
    }
    memory = memory.filter((m) => m.wo !== wo);
  },
};
