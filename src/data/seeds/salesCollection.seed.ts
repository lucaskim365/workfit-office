import type { SalesCollection } from '@/domain/salesCollection/schema';

/**
 * 수금 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관)
 */
export const SALES_COLLECTION_SEED: SalesCollection[] = [
  { no: 'RC-2606-055', cust: '대륭산업', date: '2026-06-23', method: '계좌이체', amt: 14025000, doc: 'TI-2606-072', match: '소진' },
  { no: 'RC-2606-054', cust: '세진테크', date: '2026-06-22', method: '어음', amt: 17424000, doc: 'TI-2606-068', match: '소진' },
  { no: 'RC-2606-053', cust: '한빛전자', date: '2026-06-20', method: '계좌이체', amt: 30000000, doc: '선입금', match: '미소진' },
  { no: 'RC-2606-051', cust: '동진정밀', date: '2026-06-18', method: '카드', amt: 2112000, doc: 'TI-2606-065', match: '소진' },
];
