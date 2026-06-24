import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { calPlanSchema, type CalPlan } from '@/domain/calPlan/schema';
import { CAL_PLAN_SEED } from '@/data/seeds/calPlan.seed';

/**
 * 검교정 주기·계획 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'calPlans';

export interface CalPlanFilter {
  /** 계측기 분류. */
  cat?: string;
  /** 일련번호·계측기명 키워드. */
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: CalPlan[] = CAL_PLAN_SEED.map((it) => calPlanSchema.parse(it));

function applyFilter(rows: CalPlan[], f?: CalPlanFilter): CalPlan[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.cat || it.cat === f.cat) &&
      (!kw || it.sn.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const calPlanRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: CalPlanFilter): Promise<CalPlan[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => calPlanSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(sn: string): Promise<CalPlan | null> {
    const rows = await this.list();
    return rows.find((it) => it.sn === sn) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 계측기 일련번호(sn). */
  async save(item: CalPlan): Promise<void> {
    const valid = calPlanSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.sn), valid);
      return;
    }
    const i = memory.findIndex((m) => m.sn === valid.sn);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
