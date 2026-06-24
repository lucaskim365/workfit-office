import type { CreditLimit } from '@/domain/creditLimit/schema';

/**
 * 여신한도 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS mock 이관)
 */
export const CREDIT_LIMIT_SEED: CreditLimit[] = [
  { cust: '한빛전자', limit: 150000000, balance: 124500000, grade: 'A' },
  { cust: '대륭산업', limit: 50000000, balance: 38000000, grade: 'B' },
  { cust: '세진테크', limit: 60000000, balance: 62000000, grade: 'C' },
  { cust: '동진정밀', limit: 20000000, balance: 15000000, grade: 'B' },
  { cust: '한솔머트리얼', limit: 40000000, balance: 28000000, grade: 'A' },
];
