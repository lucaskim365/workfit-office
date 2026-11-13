import { createCrudBackend, DocumentExistsError, type InsertableCrudBackend } from '@/data/_backend/crudBackend';
import { createSharedListStore } from '@/data/_backend/sharedListStore';
import { isHolidayWorkDoc, missingLedgerEntries, substituteLedgerEntrySchema, type SubstituteLedgerEntry } from '@/domain/leave/substituteLedger';

/**
 * 대체휴무 원장 저장소(substituteHolidayLedger) — 결재 문서는 읽기만 하고 원장에만 쓴다.
 * 줄 id 가 근거 문서로 정해져 있어 같은 문서로 두 번 들어가지 않는다(insert 가 409 면 건너뜀).
 */
export const SUBSTITUTE_LEDGER_UPDATED_EVENT = 'workfit-substitute-ledger-updated';

type BreakPolicy = { breakStartTime: string; breakEndTime: string };
type DocLike = Parameters<typeof missingLedgerEntries>[0][number];

export const substituteLedgerBackend = createCrudBackend<SubstituteLedgerEntry>({
  coll: 'substituteHolidayLedger',
  parse: (raw) => {
    const p = substituteLedgerEntrySchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (x) => x.id,
  seed: [],
});

/** 전 임직원 공용 — 잔여 계산이 동기로 읽으므로 앱 시작 때 불러 캐시한다. */
export const substituteLedgerStore = createSharedListStore<SubstituteLedgerEntry>({
  backend: substituteLedgerBackend,
  idOf: (x) => x.id,
  event: SUBSTITUTE_LEDGER_UPDATED_EVENT,
});

/** 저장 상태 → 원장 판단용 상태 ('시행대기'는 결재 완료) */
const statusOf = (s: string) => (s === '시행대기' ? '완료' : s);

export function createSubstituteLedgerRecorder(
  backend: Pick<InsertableCrudBackend<SubstituteLedgerEntry>, 'loadAll' | 'insert'>,
  loadPolicy: () => Promise<BreakPolicy>,
) {
  /** 빠진 줄을 넣는다. 이미 있으면 건너뛴다. @returns 새로 넣은 줄 수 */
  async function insertAll(entries: SubstituteLedgerEntry[]): Promise<number> {
    let n = 0;
    for (const e of entries) {
      try {
        await backend.insert(e);
        n++;
      } catch (err) {
        if (!(err instanceof DocumentExistsError)) throw err;
      }
    }
    return n;
  }

  return {
    /** 결재 완료·취소완료된 휴일근로 문서 한 건을 원장에 반영한다. @returns 새로 넣은 줄 수 */
    async recordForDoc(doc: DocLike): Promise<number> {
      if (!isHolidayWorkDoc(doc)) return 0;
      const status = statusOf(doc.status);
      if (status !== '완료' && status !== '취소완료') return 0;
      const [ledger, policy] = await Promise.all([backend.loadAll(), loadPolicy()]);
      return insertAll(missingLedgerEntries([{ ...doc, status }], ledger, policy, new Date().toISOString()));
    },
    /** 전체 대조 — 결재 문서 목록과 원장을 비교해 빠진 줄만 넣는다. dryRun 이면 넣지 않고 돌려준다. */
    async reconcile(docs: DocLike[], opts: { dryRun?: boolean } = {}): Promise<SubstituteLedgerEntry[]> {
      const [ledger, policy] = await Promise.all([backend.loadAll(), loadPolicy()]);
      const missing = missingLedgerEntries(docs.map((d) => ({ ...d, status: statusOf(d.status) })), ledger, policy, new Date().toISOString());
      if (!opts.dryRun) await insertAll(missing);
      return missing;
    },
  };
}

/** 결재 처리 뒤 호출 — 실패해도 결재는 그대로(대조 스크립트가 나중에 메운다). */
export async function recordSubstituteLedgerSafely(doc: DocLike): Promise<void> {
  try {
    const { commutePolicyRepo } = await import('@/data/commutePolicy/commutePolicy.repo');
    const rec = createSubstituteLedgerRecorder(substituteLedgerBackend, () => commutePolicyRepo.getDefault());
    if ((await rec.recordForDoc(doc)) > 0) await substituteLedgerStore.hydrate();
  } catch (e) {
    console.warn('[대체휴무 원장] 기록 실패 — 대조로 보충 필요', doc.id, e);
  }
}
