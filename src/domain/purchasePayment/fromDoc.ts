/**
 * 결재가 끝난 발주서 → 매입 결제 줄.
 *
 * 발주서(시트 서식, 연동 기능 '발주')는 상신할 때 이름 붙은 칸 값을 문서 fieldValues.__named 에 남긴다
 * (approvalSheet.ts PO_LINK_TYPE, relatedImport.ts). 한 값짜리 이름은 글자, 지급 조건 열은 줄마다 값이 든 목록이다.
 * 지급 조건 줄 하나가 대장 한 줄이 된다 — 지급 조건을 적지 않은 발주서는 한 번에 지급(일시 100%)으로 본다.
 */
import { parseNumber } from '@/lib/sheet/core';
import { docLinkType } from '@/domain/approvalDoc/linkType';
import { PO_LINK } from '@/domain/approvalForm/sheet/approvalSheet';
import { SHEET_NAMED_KEY, readNamed, type NamedValues } from '@/domain/approvalForm/sheet/relatedImport';
import { purchasePaymentId, type PurchasePaymentRecord } from './schema';

/** 발주서 문서에서 읽는 것만 */
export interface PoDocLike {
  id: string;
  docNo?: string | null;
  docType: string;
  status: string;
  fieldValues?: Record<string, unknown> | null;
}

/**
 * 저장 칸의 글자 길이 — 컬렉션 속성 크기(scripts/appwrite-schema.ts purchasePayments)와 같게.
 * 넘는 글자는 잘라 넣는다 — 한 줄이 길이로 거부되면 그 발주서가 대장에서 빠진다
 */
const MAX = { docNo: 64, bizType: 100, client: 200, vendor: 200, item: 200, term: 50 } as const;
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

const text = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => x.trim());
/** 금액(원) — 숫자가 아니거나 너무 큰 값은 0 */
const won = (v: string | undefined) => {
  const n = Math.round(parseNumber(v ?? '') ?? 0);
  return Number.isSafeInteger(n) ? n : 0;
};

/** 지급 비율 → %(반올림 안 함) — 시트의 % 칸은 0.5 로 저장되고, 글자 칸에 '50%'·'50' 이라 적었을 수도 있다. 음수는 0 */
function rateExact(raw: string | undefined): number {
  const n = parseNumber((raw ?? '').replace('%', ''));
  if (n === null || !Number.isFinite(n) || n < 0) return 0;
  return !(raw ?? '').includes('%') && n > 0 && n <= 1 ? n * 100 : n;
}

/** 지급 비율 → % — 대장에 보이는 값(소수 둘째 자리까지) */
export function ratePercent(raw: string | undefined): number {
  return Math.round(rateExact(raw) * 100) / 100;
}

/** 'YYYY-MM-DD' 로 시작하고 실제로 있는 날짜만 — 아니면 빈 글자 */
function dateOf(raw: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((raw ?? '').trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? m[0] : '';
}

/**
 * 결재가 끝난 발주서를 대장에 올리기 — 지금은 끔(2026-11-23 사용자 결정).
 * 매입 결제 관리는 기업 정보(도입 기업·사업 구분 등)·프로젝트 정보가 들어온 뒤에 발주서와 잇는다. 그 전에 시트 발주서를 써도 대장에 줄이 생기지 않게 한다.
 * 줄을 만드는 규칙(paymentsFromDoc)과 화면은 그대로 두었으니, 이을 때 true 로 바꾸면 그때까지 결재가 끝난 발주서가 한꺼번에 올라온다 — 켜기 전에 사용자에게 확인할 것
 */
export const PURCHASE_LEDGER_SYNC_ENABLED = false;

/** 대장에 올릴 발주서인가 — 결재가 끝났고, 발주 연동으로 쓴 시트 문서 */
export function isLedgerPurchaseOrder(doc: PoDocLike): boolean {
  return doc.status === '완료' && docLinkType(doc) === PO_LINK && typeof doc.fieldValues?.[SHEET_NAMED_KEY] === 'string';
}

interface PlanLine {
  term: string;
  /** 비율(%, 반올림 전) */
  rate: number;
  /** 줄에 직접 적은 금액 — 없으면 null */
  amount: number | null;
  taxDate: string;
  payDate: string;
}

/**
 * 지급 조건 줄 — 다섯 열(구분·비율·금액·예정 발행일·예정 결제일) 가운데 가장 긴 열만큼.
 * 열마다 끝의 빈 값이 잘려 저장되므로(relatedImport.ts) 구분 열 하나로만 세면 구분을 비운 줄이 사라진다.
 * 구분·비율·금액이 모두 빈 줄은 뺀다(기안자가 안 쓴 줄)
 */
function planLines(named: NamedValues): PlanLine[] {
  const cols = [named.poTerm, named.poTermRate, named.poTermSupply, named.poTermTaxDate, named.poTermPayDate].map(list);
  const [terms, rates, amounts, taxDates, payDates] = cols;
  const count = Math.max(...cols.map((c) => c.length));
  const lines: PlanLine[] = [];
  for (let i = 0; i < count; i++) {
    const amount = amounts[i] && parseNumber(amounts[i]) !== null ? won(amounts[i]) : null;
    const line = { term: terms[i] ?? '', rate: rateExact(rates[i]), amount, taxDate: dateOf(taxDates[i]), payDate: dateOf(payDates[i]) };
    if (line.term || line.rate || line.amount !== null) lines.push(line);
  }
  return lines;
}

/**
 * 줄마다의 공급가액 — 줄에 적은 금액이 있으면 그 값, 없으면 공급가액 × 비율.
 * 비율로만 나눈 발주서에서 비율 합이 100% 면 마지막 줄을 '공급가액 − 앞 줄 합'으로 맞춘다(1/3 씩 나눠도 합이 공급가액과 같게)
 */
function lineSupplies(lines: PlanLine[], supply: number): number[] {
  const out = lines.map((x) => x.amount ?? Math.round((supply * x.rate) / 100));
  const byRateOnly = lines.every((x) => x.amount === null);
  const rateSum = lines.reduce((a, x) => a + x.rate, 0);
  if (byRateOnly && lines.length > 1 && Math.abs(rateSum - 100) < 0.01) {
    out[out.length - 1] = supply - out.slice(0, -1).reduce((a, n) => a + n, 0);
  }
  return out;
}

/** 발주서 한 건의 매입 결제 줄들 — 대장에 올릴 문서가 아니면 빈 목록 */
export function paymentsFromDoc(doc: PoDocLike, now: string): PurchasePaymentRecord[] {
  if (!isLedgerPurchaseOrder(doc)) return [];
  const named = readNamed(doc.fieldValues?.[SHEET_NAMED_KEY]);
  const supply = won(text(named.poSupply));
  const planned = planLines(named);
  const lines: PlanLine[] = planned.length ? planned : [{ term: '일시', rate: 100, amount: null, taxDate: '', payDate: '' }];
  const supplies = lineSupplies(lines, supply);
  const base = {
    docId: doc.id,
    docNo: clip(doc.docNo ?? '', MAX.docNo),
    bizType: clip(text(named.poBizType), MAX.bizType),
    client: clip(text(named.poClient), MAX.client),
    vendor: clip(text(named.poVendor), MAX.vendor),
    items: list(named.poSummary)
      .filter(Boolean)
      .map((x) => clip(x, MAX.item)),
    salesVatCollected: false,
    buildFrom: '',
    buildTo: '',
    expenseDocId: '',
    taxRequested: false,
    taxDate: '',
    payDate: '',
    createdAt: now,
    updatedAt: now,
    updatedBy: '',
  };
  return lines.map((x, i) => ({
    ...base,
    id: purchasePaymentId(doc.id, i + 1),
    seq: i + 1,
    term: clip(x.term, MAX.term),
    rate: Math.round(x.rate * 100) / 100,
    supply: supplies[i],
    planTaxDate: x.taxDate,
    planPayDate: x.payDate,
  }));
}
