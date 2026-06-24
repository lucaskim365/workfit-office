import type { SalesOrder } from '@/domain/salesOrder/schema';

/** 수주 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 sales-screens.jsx) */
export const SALES_ORDER_SEED: SalesOrder[] = [
  {
    no: 'SO-2606-088', customer: '한빛전자', orderDate: '2026-06-23', reqDeliveryDate: '2026-07-05',
    paymentTerms: '월말 마감 / 익월 30일', salesperson: '김영업',
    lines: [
      { code: 'MX-200', name: '메모리 모듈', qty: 12, price: 3960000, due: '2026-07-05', deliveredQty: 0 },
      { code: 'CMP-CON-14', name: '보드 커넥터', qty: 200, price: 12800, due: '2026-07-05', deliveredQty: 0 },
      { code: 'PKG-BGA-14', name: 'BGA 기판', qty: 5, price: 4250000, due: '2026-07-12', deliveredQty: 0 },
    ],
  },
  {
    no: 'SO-2606-082', customer: '대륭산업', orderDate: '2026-06-18', reqDeliveryDate: '2026-06-30',
    paymentTerms: '현금 결제', salesperson: '이세일',
    lines: [{ code: 'MX-310', name: '메모리 모듈', qty: 50, price: 880000, due: '2026-06-30', deliveredQty: 30 }],
  },
  {
    no: 'SO-2606-077', customer: '세진테크', orderDate: '2026-06-15', reqDeliveryDate: '2026-06-28',
    paymentTerms: '월말 마감 / 익월 30일', salesperson: '박거래',
    lines: [{ code: 'PKG-BGA-14', name: 'BGA 기판', qty: 80, price: 4250000, due: '2026-06-28', deliveredQty: 80 }],
  },
  {
    no: 'SO-2606-071', customer: '동진정밀', orderDate: '2026-06-12', reqDeliveryDate: '2026-06-25',
    paymentTerms: '어음 60일', salesperson: '최수주',
    lines: [{ code: 'CMP-CON-14', name: '보드 커넥터', qty: 500, price: 12800, due: '2026-06-25', deliveredQty: 350 }],
  },
  {
    no: 'SO-2606-064', customer: '한빛전자', orderDate: '2026-06-08', reqDeliveryDate: '2026-06-20',
    paymentTerms: '월말 마감 / 익월 30일', salesperson: '김영업',
    lines: [{ code: 'MX-200', name: '메모리 모듈', qty: 120, price: 3960000, due: '2026-06-20', deliveredQty: 120 }],
  },
];
