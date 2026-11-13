import { DocumentExistsError, createCrudBackend } from '@/data/_backend/crudBackend';
import { purchasePaymentSchema, type PurchasePaymentPatch, type PurchasePaymentRecord } from '@/domain/purchasePayment/schema';

/**
 * 매입 결제 Repository — `purchasePayments` 컬렉션만 읽고 쓴다.
 * 결재 문서(approvalDocs)는 여기서 건드리지 않는다 — 발주서 값은 한 번 복사해 온 것이다.
 */
const backend = createCrudBackend<PurchasePaymentRecord>({
  coll: 'purchasePayments',
  parse: (raw) => {
    const parsed = purchasePaymentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

export interface AddMissingResult {
  /** 새로 올린 줄 수 */
  added: number;
  /** 올리지 못한 줄 id — 다른 줄은 계속 올린다 */
  failed: string[];
}

export const purchasePaymentRepo = {
  async list(): Promise<PurchasePaymentRecord[]> {
    return backend.loadAll();
  },

  /**
   * 발주서에서 만든 줄을 올린다 — 이미 있는 줄은 그대로 둔다(덮어쓰지 않음).
   * 두 사람이 동시에 대장을 열어도 같은 줄이 두 번 생기거나, 먼저 적어 둔 결제일이 지워지지 않는다.
   * 한 줄이 실패해도 멈추지 않는다 — 멈추면 그 뒤 발주서가 모두 대장에서 빠진다.
   */
  async addMissing(rows: PurchasePaymentRecord[]): Promise<AddMissingResult> {
    const result: AddMissingResult = { added: 0, failed: [] };
    for (const row of rows) {
      try {
        await backend.insert(purchasePaymentSchema.parse(row));
        result.added += 1;
      } catch (e) {
        if (e instanceof DocumentExistsError) continue;
        console.error(`매입 결제 줄 ${row.id} 을(를) 올리지 못했습니다:`, e);
        result.failed.push(row.id);
      }
    }
    return result;
  },

  /** 대장에서 고치는 칸만 바꾼다(발주서에서 온 값은 못 바꿈) */
  async patch(id: string, change: PurchasePaymentPatch, actorId: string): Promise<void> {
    await backend.patch(id, { ...change, updatedAt: new Date().toISOString(), updatedBy: actorId });
  },
};
