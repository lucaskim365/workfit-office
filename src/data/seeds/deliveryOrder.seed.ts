import type { DeliveryOrder } from '@/domain/deliveryOrder/schema';

/**
 * 자재 출하지시 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-2.jsx MatShippingScreen 인라인 ROWS 이관)
 */
export const DELIVERY_ORDER_SEED: DeliveryOrder[] = [
  { no: 'DO-260611-08', so: 'SO-26-1102', cust: '삼성전자', code: 'WF-300-B', qty: '2,000', status: '상차중', urgent: true },
  { no: 'DO-260611-07', so: 'SO-26-1099', cust: 'SK하이닉스', code: 'PKG-BGA-14', qty: '1,500', status: '출하완료' },
  { no: 'DO-260611-05', so: 'SO-26-1095', cust: 'LG이노텍', code: 'MOD-CAM-02', qty: '1,200', status: '출하완료' },
  { no: 'DO-260611-09', so: 'SO-26-1105', cust: '삼성전자', code: 'WF-200-A', qty: '3,000', status: '출하대기' },
];
