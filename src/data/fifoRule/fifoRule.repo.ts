import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { fifoRuleSchema, type FifoRule } from '@/domain/fifoRule/schema';
import { FIFO_RULE_SEED } from '@/data/seeds/fifoRule.seed';

/**
 * FIFO 출고규칙 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade. 조회전용 마스터.
 */
const COLL = 'fifoRules';

export interface FifoRuleFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: FifoRule[] = FIFO_RULE_SEED.map((it) => fifoRuleSchema.parse(it));

function applyFilter(rows: FifoRule[], f?: FifoRuleFilter): FifoRule[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      !kw || it.category.toLowerCase().includes(kw) || it.rule.toLowerCase().includes(kw),
  );
}

export const fifoRuleRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: FifoRuleFilter): Promise<FifoRule[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => fifoRuleSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(category: string): Promise<FifoRule | null> {
    const rows = await this.list();
    return rows.find((it) => it.category === category) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 품목군(category). */
  async save(item: FifoRule): Promise<void> {
    const valid = fifoRuleSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.category), valid);
      return;
    }
    const i = memory.findIndex((m) => m.category === valid.category);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
