import { z } from 'zod';

/**
 * 매입 결제 — 발주서 지급 조건의 한 번(선금·중도금·잔금)이 한 줄. `purchasePayments` 컬렉션(새 컬렉션).
 *
 * 결재가 끝난 발주서(시트 서식, 연동 기능 '발주')에서 이름 붙은 칸 값을 **한 번 복사해** 만든다(fromDoc.ts).
 * 결재 문서는 읽기만 한다(CLAUDE.md §2) — 그 뒤 세금계산서 발행·결제·구축일은 이 줄에만 적는다.
 * $id = `${docId}__${줄 순번}` 이라 같은 발주서로 두 번 만들어지지 않는다.
 */
export const purchasePaymentSchema = z.object({
  id: z.string().min(1),
  /** 발주서 결재 문서 id */
  docId: z.string().min(1),
  /** 발주서 문서번호 */
  docNo: z.string().default(''),
  /** 발주서 지급 조건의 몇 번째 줄(1부터) */
  seq: z.number().int().min(1),
  bizType: z.string().default(''),
  /** 도입기업 */
  client: z.string().default(''),
  /** 발주처(매입처) */
  vendor: z.string().default(''),
  /** 발주 품목 이름 */
  items: z.array(z.string()).default([]),
  /** 지급 구분 — 선금·중도금·잔금·일시(발주서에 적힌 글자 그대로) */
  term: z.string().default(''),
  /** 지급 비율(%) */
  rate: z.number().default(0),
  /** 매입 공급가액(이번 지급분, 원) */
  supply: z.number().int().default(0),
  /** (예정) 매입 세금계산서 발행일 — 'YYYY-MM-DD' 또는 빈 글자 */
  planTaxDate: z.string().default(''),
  /** (예정) 매입 결제일 */
  planPayDate: z.string().default(''),
  /** 매출 부가세 수금 여부 — 경영기획팀 */
  salesVatCollected: z.boolean().default(false),
  /** 구축일(기간) — 인프라팀 */
  buildFrom: z.string().default(''),
  buildTo: z.string().default(''),
  /** 이 줄로 기안한 지출결의서 결재 문서 id — 진행 상태는 그 문서를 따라간다 */
  expenseDocId: z.string().default(''),
  /** 세금계산서 발행을 요청함(아직 발행 전) — 경영기획팀 */
  taxRequested: z.boolean().default(false),
  /** (확정) 매입 세금계산서 발행일 — 경영기획팀 */
  taxDate: z.string().default(''),
  /** (확정) 매입 결제일 — 경영기획팀 */
  payDate: z.string().default(''),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
  updatedBy: z.string().default(''),
});
export type PurchasePaymentRecord = z.infer<typeof purchasePaymentSchema>;

export const purchasePaymentId = (docId: string, seq: number) => `${docId}__${seq}`;

/** 대장에서 고칠 수 있는 칸 — 발주서에서 온 값(도입기업·금액 등)은 여기 없다 */
export type PurchasePaymentPatch = Partial<
  Pick<PurchasePaymentRecord, 'salesVatCollected' | 'buildFrom' | 'buildTo' | 'expenseDocId' | 'taxRequested' | 'taxDate' | 'payDate'>
>;
