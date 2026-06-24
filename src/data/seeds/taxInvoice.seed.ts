import type { TaxInvoice } from '@/domain/taxInvoice/schema';

/**
 * 세금계산서 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관)
 */
export const TAX_INVOICE_SEED: TaxInvoice[] = [
  { no: 'TI-2606-072', sale: 'SL-2606-098', cust: '대륭산업', type: '전자세금계산서', amt: 14025000, date: '2026-06-23', status: '발행완료', nts: '국세청 전송' },
  { no: 'TI-2606-071', sale: 'SL-2606-097', cust: '동진정밀', type: '전자세금계산서', amt: 2112000, date: '2026-06-23', status: '발행완료', nts: '국세청 전송' },
  { no: 'TI-2606-070', sale: 'SL-2606-096', cust: '세진테크', type: '거래명세서', amt: 17424000, date: '2026-06-22', status: '발행완료', nts: '—' },
  { no: 'TI-2606-069', sale: 'SL-2606-095', cust: '한빛전자', type: '전자세금계산서', amt: 52272000, date: '2026-06-21', status: '발행대기', nts: '—' },
];
