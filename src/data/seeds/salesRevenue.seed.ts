import type { SalesRevenue } from '@/domain/salesRevenue/schema';

/**
 * 매출 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관, do_→doNo)
 */
export const SALES_REVENUE_SEED: SalesRevenue[] = [
  { no: 'SL-2606-098', doNo: 'DO-2606-120', cust: '대륭산업', date: '2026-06-23', supply: 12750000, vat: 1275000, total: 14025000, status: '확정' },
  { no: 'SL-2606-097', doNo: 'DO-2606-121', cust: '동진정밀', date: '2026-06-23', supply: 1920000, vat: 192000, total: 2112000, status: '확정' },
  { no: 'SL-2606-096', doNo: 'DO-2606-118', cust: '세진테크', date: '2026-06-22', supply: 15840000, vat: 1584000, total: 17424000, status: '확정' },
  { no: 'SL-2606-095', doNo: 'DO-2606-115', cust: '한빛전자', date: '2026-06-21', supply: 47520000, vat: 4752000, total: 52272000, status: '전표대기' },
];
