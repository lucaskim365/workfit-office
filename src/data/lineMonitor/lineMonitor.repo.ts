import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { lineMonitorSchema, type LineMonitor } from '@/domain/lineMonitor/schema';
import { LINE_MONITOR_SEED } from '@/data/seeds/lineMonitor.seed';

/**
 * 생산 라인 모니터 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade. 조회전용 마스터.
 */
const COLL = 'lineMonitors';

export interface LineMonitorFilter {
  eq?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: LineMonitor[] = LINE_MONITOR_SEED.map((it) => lineMonitorSchema.parse(it));

function applyFilter(rows: LineMonitor[], f?: LineMonitorFilter): LineMonitor[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.eq || it.eq === f.eq) &&
      (!kw || it.line.toLowerCase().includes(kw) || it.item.toLowerCase().includes(kw)),
  );
}

export const lineMonitorRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: LineMonitorFilter): Promise<LineMonitor[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => lineMonitorSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(line: string): Promise<LineMonitor | null> {
    const rows = await this.list();
    return rows.find((it) => it.line === line) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 라인명. */
  async save(item: LineMonitor): Promise<void> {
    const valid = lineMonitorSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.line), valid);
      return;
    }
    const i = memory.findIndex((m) => m.line === valid.line);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(line: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, line));
      return;
    }
    memory = memory.filter((m) => m.line !== line);
  },
};
