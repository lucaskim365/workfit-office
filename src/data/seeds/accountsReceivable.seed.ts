import type { AccountsReceivable } from '@/domain/accountsReceivable/schema';

/**
 * 채권(미수금) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관)
 */
export const ACCOUNTS_RECEIVABLE_SEED: AccountsReceivable[] = [
  { cust: '한빛전자', limit: 124500000, d30: 52272000, d60: 0, over: 0, status: '정상' },
  { cust: '대륭산업', limit: 38000000, d30: 0, d60: 14025000, over: 0, status: '정상' },
  { cust: '세진테크', limit: 62000000, d30: 17424000, d60: 0, over: 8200000, status: '연체' },
  { cust: '동진정밀', limit: 15000000, d30: 0, d60: 0, over: 4400000, status: '연체' },
  { cust: '한솔머트리얼', limit: 28000000, d30: 9800000, d60: 0, over: 0, status: '정상' },
];
