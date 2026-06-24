import type { Quote } from '@/domain/quote/schema';

/**
 * 영업 견적 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관)
 */
export const QUOTE_SEED: Quote[] = [
  { no: 'QT-2606-041', cust: '한빛전자', item: 'MX-200 외 2종', qty: 12, amt: '48,600,000', sent: '발송', progress: '검토중' },
  { no: 'QT-2606-040', cust: '대륭산업', item: 'PKG-BGA-14', qty: 5, amt: '21,250,000', sent: '발송', progress: '수주전환' },
  { no: 'QT-2606-038', cust: '세진테크', item: 'MX-310', qty: 8, amt: '15,840,000', sent: '작성중', progress: '—' },
  { no: 'QT-2606-035', cust: '한빛전자', item: 'MX-200', qty: 20, amt: '79,200,000', sent: '발송', progress: '실주' },
  { no: 'QT-2606-031', cust: '동진정밀', item: 'CMP-CON-14 외', qty: 50, amt: '6,400,000', sent: '발송', progress: '수주전환' },
];
