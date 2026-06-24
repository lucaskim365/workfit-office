import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { pmPlanSchema, type PmPlan } from '@/domain/pmPlan/schema';
import { PM_PLAN_SEED } from '@/data/seeds/pmPlan.seed';

/**
 * 예방보전(PM) 계획 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'pmPlans';

export interface PmPlanFilter {
  eq?: string;
  pmType?: string;
  mgr?: string;
  status?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: PmPlan[] = PM_PLAN_SEED.map((p) => pmPlanSchema.parse(p));

function applyFilter(rows: PmPlan[], f?: PmPlanFilter): PmPlan[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (p) =>
      (!f.eq || p.eq === f.eq) &&
      (!f.pmType || p.pmType === f.pmType) &&
      (!f.mgr || p.mgr === f.mgr) &&
      (!f.status || p.status === f.status) &&
      (!kw || p.eq.toLowerCase().includes(kw) || p.item.toLowerCase().includes(kw)),
  );
}

export const pmPlanRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: PmPlanFilter): Promise<PmPlan[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => pmPlanSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<PmPlan | null> {
    const rows = await this.list();
    return rows.find((p) => p.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 합성 id. */
  async save(plan: PmPlan): Promise<void> {
    const valid = pmPlanSchema.parse(plan);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },
};
