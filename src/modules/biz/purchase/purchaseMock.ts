/**
 * 매입 결제 관리 — 보여주기용 목업 데이터와 계산.
 *
 * 화면 모양과 흐름을 먼저 확인받기 위한 것이라 저장소(DB)와 이어져 있지 않다. 회사·계좌·사업자번호는 모두 지어낸 값이다.
 * 한 줄 = 발주서 지급 조건의 한 번(선금·중도금·잔금). 실제 화면에서는
 *   - 발주서 값(사업구분~매입 합계)은 결재 끝난 발주서에서 오고
 *   - 구축일은 인프라팀, 매출 부가세 수금·확정일은 경영기획팀이 넣고
 *   - 지출결의서 상태는 이 줄에서 기안한 지출결의서 문서를 따라간다.
 */

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
  term: PayTerm;
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

/** 발주처 계좌·사업자 정보 — 실제 화면에서는 거래처 정보에서 온다(줄마다 따로 적지 않는다) */
export const MOCK_VENDOR_ACCOUNTS: Record<string, VendorAccount> = {
  '(주)미르시스템': { bank: '가나은행', account: '000-000000-01-001', holder: '(주)미르시스템', ceo: '홍길동', bizNo: '000-00-00001' },
  다온네트웍스: { bank: '다라은행', account: '000-000-000002', holder: '주식회사 다온네트웍스', ceo: '김철수', bizNo: '000-00-00002' },
  푸른자동화: { bank: '가나은행', account: '000-000000-01-003', holder: '푸른자동화(주)', ceo: '이영희', bizNo: '000-00-00003' },
  누리소프트: { bank: '마바은행', account: '0000-000-000004', holder: '누리소프트 주식회사', ceo: '박민수', bizNo: '000-00-00004' },
  한결계측: { bank: '다라은행', account: '000-000-000005', holder: '한결계측', ceo: '최지우', bizNo: '000-00-00005' },
};

type Seed = Omit<PurchasePayment, 'id'>;
const row = (s: Seed): PurchasePayment => ({ ...s, id: `${s.no}-${s.term}` });

export const MOCK_PURCHASE_PAYMENTS: PurchasePayment[] = [
  row({ no: 1, bizType: '부처협업형', client: '새솔테크', vendor: '(주)미르시스템', poDocNo: 'AP-261005-003', items: ['데이터 수집 시스템 구축(PLC 연동)', '현장 단말기 4대'], term: '선금', rate: 50, planTaxDate: '2026-10-20', planPayDate: '2026-10-30', supply: 40_000_000, salesVatCollected: true, buildFrom: '2026-11-03', buildTo: '2026-11-21', expense: 'approved', taxRequested: true, taxDate: '2026-10-21', payDate: '2026-10-30' }),
  row({ no: 1, bizType: '부처협업형', client: '새솔테크', vendor: '(주)미르시스템', poDocNo: 'AP-261005-003', items: ['데이터 수집 시스템 구축(PLC 연동)', '현장 단말기 4대'], term: '잔금', rate: 50, planTaxDate: '2026-12-10', planPayDate: '2026-12-24', supply: 40_000_000, salesVatCollected: true, buildFrom: '2026-11-03', buildTo: '2026-11-21', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 2, bizType: '부처협업형', client: '새솔테크', vendor: '다온네트웍스', poDocNo: 'AP-261005-004', items: ['공장 유·무선 네트워크 공사'], term: '선금', rate: 50, planTaxDate: '2026-10-20', planPayDate: '2026-10-30', supply: 15_000_000, salesVatCollected: true, buildFrom: '2026-11-10', buildTo: '2026-11-14', expense: 'approved', taxRequested: true, taxDate: '2026-10-22', payDate: '2026-10-30' }),
  row({ no: 3, bizType: '정부일반형', client: '가람정밀 제2공장', vendor: '푸른자동화', poDocNo: 'AP-261012-007', items: ['조립 검사기 1식', '검사 지그', '설치·시운전'], term: '선금', rate: 30, planTaxDate: '2026-10-26', planPayDate: '2026-10-30', supply: 36_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'inProgress', taxRequested: true, taxDate: '2026-10-27', payDate: '' }),
  row({ no: 3, bizType: '정부일반형', client: '가람정밀 제2공장', vendor: '푸른자동화', poDocNo: 'AP-261012-007', items: ['조립 검사기 1식', '검사 지그', '설치·시운전'], term: '중도금', rate: 40, planTaxDate: '2026-11-20', planPayDate: '2026-11-30', supply: 48_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 3, bizType: '정부일반형', client: '가람정밀 제2공장', vendor: '푸른자동화', poDocNo: 'AP-261012-007', items: ['조립 검사기 1식', '검사 지그', '설치·시운전'], term: '잔금', rate: 30, planTaxDate: '2027-01-15', planPayDate: '2027-01-29', supply: 36_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 4, bizType: '정부일반형', client: '두리메디칼', vendor: '누리소프트', poDocNo: 'AP-261014-002', items: ['MES 추가 개발 용역'], term: '선금', rate: 50, planTaxDate: '2026-10-28', planPayDate: '2026-11-10', supply: 10_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'drafting', taxRequested: true, taxDate: '', payDate: '' }),
  row({ no: 4, bizType: '정부일반형', client: '두리메디칼', vendor: '누리소프트', poDocNo: 'AP-261014-002', items: ['MES 추가 개발 용역'], term: '잔금', rate: 50, planTaxDate: '2026-12-18', planPayDate: '2026-12-30', supply: 10_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 5, bizType: '제조AI', client: '한빛식품', vendor: '한결계측', poDocNo: 'AP-261019-011', items: ['비전 검사 카메라 6대', '조명·브래킷'], term: '선금', rate: 50, planTaxDate: '2026-11-05', planPayDate: '2026-11-20', supply: 27_000_000, salesVatCollected: false, buildFrom: '', buildTo: '', expense: 'rejected', taxRequested: true, taxDate: '', payDate: '' }),
  row({ no: 6, bizType: '제조AI', client: '한빛식품', vendor: '(주)미르시스템', poDocNo: 'AP-261019-012', items: ['엣지 서버 2대', '설치'], term: '일시', rate: 100, planTaxDate: '2026-11-12', planPayDate: '2026-11-27', supply: 10_170_000, salesVatCollected: false, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 7, bizType: '자율형공장', client: '가람정밀 본사', vendor: '다온네트웍스', poDocNo: 'AP-261023-005', items: ['서버실 네트워크 증설'], term: '선금', rate: 50, planTaxDate: '2026-11-06', planPayDate: '2026-11-20', supply: 5_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
  row({ no: 8, bizType: '부처협업형', client: '한빛식품', vendor: '누리소프트', poDocNo: 'AP-261026-001', items: ['미들웨어 설치 3식', '전처리 3식'], term: '선금', rate: 50, planTaxDate: '2026-11-10', planPayDate: '2026-11-25', supply: 6_000_000, salesVatCollected: true, buildFrom: '', buildTo: '', expense: 'none', taxRequested: false, taxDate: '', payDate: '' }),
];

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
