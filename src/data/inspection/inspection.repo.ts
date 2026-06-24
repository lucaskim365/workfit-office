import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  inspectionSchema,
  type Inspection,
  type InspectionLine,
} from '@/domain/inspection/schema';
import { canTransition } from '@/domain/inspection/status';
import { INSPECTION_SEED } from '@/data/seeds/inspection.seed';

/**
 * 검사 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * 상태 전이는 status.ts의 canTransition으로 검증한다(허용 전이만).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'inspections';

export interface InspectionFilter {
  stage?: string;
  status?: string;
  q?: string;
}

let memory: Inspection[] = INSPECTION_SEED.map((x) => inspectionSchema.parse(x));

function applyFilter(rows: Inspection[], f?: InspectionFilter): Inspection[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (r) =>
      (!f.stage || r.stage === f.stage) &&
      (!f.status || r.status === f.status) &&
      (!kw ||
        r.recv.toLowerCase().includes(kw) ||
        r.code.toLowerCase().includes(kw) ||
        r.name.includes(kw) ||
        r.vendor.includes(kw)),
  );
}

async function loadAll(): Promise<Inspection[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => inspectionSchema.parse(d.data()));
  }
  return memory;
}

async function persist(insp: Inspection): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, insp.recv), insp);
    return;
  }
  const i = memory.findIndex((m) => m.recv === insp.recv);
  if (i >= 0) memory[i] = insp;
  else memory = [...memory, insp];
}

export const inspectionRepo = {
  async list(filter?: InspectionFilter): Promise<Inspection[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(recv: string): Promise<Inspection | null> {
    const rows = await loadAll();
    return rows.find((r) => r.recv === recv) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = recv. */
  async save(insp: Inspection): Promise<void> {
    await persist(inspectionSchema.parse(insp));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(recv: string, to: Inspection['status']): Promise<void> {
    const cur = await this.get(recv);
    if (!cur) throw new Error(`검사 건을 찾을 수 없습니다: ${recv}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },

  /**
   * 판정 등록 — 측정 실적(items) + 최종 판정 저장 후 '판정완료'로 전이.
   * 검사중 상태에서만 가능. ([[데이터_모델_설계서.md]] inspections 판정)
   */
  async judge(
    recv: string,
    judgement: NonNullable<Inspection['judgement']>,
    items: InspectionLine[],
  ): Promise<void> {
    const cur = await this.get(recv);
    if (!cur) throw new Error(`검사 건을 찾을 수 없습니다: ${recv}`);
    if (!canTransition(cur.status, '판정완료')) {
      throw new Error(`판정할 수 없는 상태입니다: ${cur.status}`);
    }
    await persist(inspectionSchema.parse({ ...cur, items, judgement, status: '판정완료' }));
  },
};
