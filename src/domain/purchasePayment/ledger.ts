/**
 * 매입 결제 대장 — 화면에 보이는 한 줄과 그 계산(부가세·합계·요약·묶기).
 * 저장된 줄(schema.ts PurchasePaymentRecord)에 지출결의서 진행 상태와 대장 번호를 붙인 것이 화면의 한 줄이다.
 */
import type { PurchasePaymentRecord } from './schema';

export const PAY_TERMS = ['선금', '중도금', '잔금', '일시'] as const;
export type PayTerm = (typeof PAY_TERMS)[number];

/** 지출결의서 진행 — none: 아직 기안 안 함(기안 작성 단추) */
export const EXPENSE_STATUSES = ['none', 'drafting', 'inProgress', 'rejected', 'approved'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export const EXPENSE_LABEL: Record<ExpenseStatus, string> = {
  none: '미작성',
  drafting: '작성중',
  inProgress: '결재중',
  rejected: '반려',
  approved: '승인',
};

export interface PurchasePayment {
  id: string;
  /** 발주 번호(대장 번호) — 같은 발주의 선금·잔금은 번호가 같다 */
  no: number;
  bizType: string;
  /** 도입기업 */
  client: string;
  /** 발주처(매입처) */
  vendor: string;
  poDocNo: string;
  /** 발주 품목 — 목록에는 첫 품목만 줄여 보인다 */
  items: string[];
  /** 지급 구분 — 발주서에 적힌 글자 그대로(선금·중도금·잔금·일시 등) */
  term: string;
  /** 지급 비율(%) */
  rate: number;
  /** (예정) 매입 세금계산서 발행일 */
  planTaxDate: string;
  /** (예정) 매입 결제일 */
  planPayDate: string;
  /** 매입 공급가액(이번 지급분) */
  supply: number;
  /** 매출 부가세 수금 여부 — 경영기획팀 */
  salesVatCollected: boolean;
  /** 구축일(기간) — 인프라팀, 선금 지급 후 */
  buildFrom: string;
  buildTo: string;
  expense: ExpenseStatus;
  /** 세금계산서 발행 요청함(아직 발행 전) — 경영기획팀 */
  taxRequested: boolean;
  /** (확정) 매입 세금계산서 발행일 — 경영기획팀 */
  taxDate: string;
  /** (확정) 매입 결제일 — 경영기획팀 */
  payDate: string;
}

export interface VendorAccount {
  bank: string;
  account: string;
  holder: string;
  ceo: string;
  bizNo: string;
}

/** 부가세 — 공급가액의 10%(원 미만 버림) */
export const vatOf = (supply: number) => Math.floor(supply * 0.1);
export const totalOf = (supply: number) => supply + vatOf(supply);

/** 목록의 발주 내역 — 첫 품목을 10자로 줄이고, 품목이 더 있으면 '외 n건' */
export function shortItems(items: string[], max = 10): string {
  const first = items[0] ?? '';
  const head = first.length > max ? `${first.slice(0, max)}…` : first;
  return items.length > 1 ? `${head} 외 ${items.length - 1}건` : head;
}

/** 결제 예정월 'YYYY-MM' */
export const payMonthOf = (r: Pick<PurchasePayment, 'planPayDate'>) => r.planPayDate.slice(0, 7);

export interface PurchaseSummary {
  count: number;
  supply: number;
  vat: number;
  total: number;
  /** 세금계산서 발행을 마친(확정 발행일이 있는) 줄 */
  issuedCount: number;
  issuedTotal: number;
  /** 결제를 마친(확정 결제일이 있는) 줄 */
  paidCount: number;
  paidTotal: number;
  /** 발행 완료 금액 ÷ 매입 합계 (0~1) */
  progress: number;
}

export function summarize(rows: PurchasePayment[]): PurchaseSummary {
  const sum = (list: PurchasePayment[], f: (n: number) => number) => list.reduce((a, r) => a + f(r.supply), 0);
  const issued = rows.filter((r) => r.taxDate);
  const paid = rows.filter((r) => r.payDate);
  const total = sum(rows, totalOf);
  const issuedTotal = sum(issued, totalOf);
  return {
    count: rows.length,
    supply: sum(rows, (n) => n),
    vat: sum(rows, vatOf),
    total,
    issuedCount: issued.length,
    issuedTotal,
    paidCount: paid.length,
    paidTotal: sum(paid, totalOf),
    progress: total ? issuedTotal / total : 0,
  };
}

/** 구축일을 다 넣었는가(시작·종료 모두) */
export const isBuildDone = (r: Pick<PurchasePayment, 'buildFrom' | 'buildTo'>) => !!(r.buildFrom && r.buildTo);

/** 묶어 보기 — none: 묶지 않음, client: 도입기업·사업구분이 같은 줄끼리, clientVendor: 발주처까지 같은 줄끼리 */
export const GROUP_MODES = ['none', 'client', 'clientVendor'] as const;
export type GroupMode = (typeof GROUP_MODES)[number];
export const GROUP_MODE_LABEL: Record<GroupMode, string> = {
  none: '묶지 않음',
  client: '도입기업·사업구분',
  clientVendor: '도입기업·사업구분·발주처',
};

export interface PaymentGroup {
  key: string;
  client: string;
  bizType: string;
  /** 발주처까지 묶었을 때만 */
  vendor?: string;
  rows: PurchasePayment[];
}

/** 줄을 묶음으로 — 묶음 순서는 처음 나온 순서, 묶음 안 줄 순서는 그대로 */
export function groupPayments(rows: PurchasePayment[], mode: Exclude<GroupMode, 'none'>): PaymentGroup[] {
  const map = new Map<string, PaymentGroup>();
  for (const r of rows) {
    const vendor = mode === 'clientVendor' ? r.vendor : undefined;
    const key = [r.client, r.bizType, vendor ?? ''].join('\u0000');
    const g = map.get(key);
    if (g) g.rows.push(r);
    else map.set(key, { key, client: r.client, bizType: r.bizType, vendor, rows: [r] });
  }
  return [...map.values()];
}

/** 발주처 이름 맞추기 키 — 발주서의 발주처는 글자라 기업 정보와 이름으로 맞춘다. 띄어쓰기는 무시 */
export const vendorKey = (name: string) => name.replace(/\s+/g, '');

/** 대장에서 고칠 수 있는 칸(화면 줄 기준) — 발주서에서 온 값과 지출결의서 진행은 못 고친다 */
export type LedgerPatch = Partial<Pick<PurchasePayment, 'salesVatCollected' | 'buildFrom' | 'buildTo' | 'taxRequested' | 'taxDate' | 'payDate'>>;

/** 지출결의서 문서 상태 → 대장의 진행 — 문서를 못 찾으면(지워짐 등) 미작성으로 */
export function expenseStatusOf(docStatus: string | null | undefined): ExpenseStatus {
  if (!docStatus) return 'none';
  if (docStatus === '임시저장' || docStatus === '회수') return 'drafting';
  if (docStatus.includes('반려') || docStatus === '시행반송') return 'rejected';
  if (docStatus === '완료') return 'approved';
  if (docStatus === '삭제' || docStatus === '취소완료') return 'none';
  return 'inProgress';
}

/** 결재가 끝난 뒤 취소되거나 지워진 발주서의 상태 — 그 발주의 줄은 대장에 보이지 않는다 */
const VOID_PO_STATUSES: ReadonlySet<string> = new Set(['취소완료', '삭제']);

/**
 * 저장된 줄 → 화면 줄. 대장 번호는 발주서마다 하나(문서번호 순) — 같은 발주의 선금·잔금은 번호가 같다.
 * statusOfDoc: 결재 문서 id → 그 문서의 상태(발주서·지출결의서 모두 이걸로 본다)
 *
 * 취소·삭제된 발주서의 줄은 뺀다 — 취소된 발주 금액이 매입 합계·남은 금액에 계속 들어가지 않게.
 * 저장된 줄은 지우지 않는다(적어 둔 결제 기록이 남고, 화면에서만 빠진다). 발주서를 못 찾은 줄은 그대로 보인다
 */
export function toLedgerRows(records: PurchasePaymentRecord[], statusOfDoc: (docId: string) => string | null | undefined): PurchasePayment[] {
  const live = records.filter((r) => !VOID_PO_STATUSES.has(statusOfDoc(r.docId) ?? ''));
  const sorted = [...live].sort((a, b) => a.docNo.localeCompare(b.docNo) || a.docId.localeCompare(b.docId) || a.seq - b.seq);
  const noOf = new Map<string, number>();
  sorted.forEach((r) => !noOf.has(r.docId) && noOf.set(r.docId, noOf.size + 1));
  return sorted.map((r) => ({
    id: r.id,
    no: noOf.get(r.docId) ?? 0,
    bizType: r.bizType,
    client: r.client,
    vendor: r.vendor,
    poDocNo: r.docNo,
    items: r.items,
    term: r.term,
    rate: r.rate,
    planTaxDate: r.planTaxDate,
    planPayDate: r.planPayDate,
    supply: r.supply,
    salesVatCollected: r.salesVatCollected,
    buildFrom: r.buildFrom,
    buildTo: r.buildTo,
    expense: r.expenseDocId ? expenseStatusOf(statusOfDoc(r.expenseDocId)) : 'none',
    taxRequested: r.taxRequested,
    taxDate: r.taxDate,
    payDate: r.payDate,
  }));
}
