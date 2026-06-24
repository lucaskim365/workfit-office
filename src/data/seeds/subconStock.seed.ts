import type { SubconStock } from '@/domain/subconStock/schema';

/**
 * 외주 보유재고 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 VENDORS 이관, 색상은 리터럴 hex 보존)
 */
export const SUBCON_STOCK_SEED: SubconStock[] = [
  { name: '대성테크', item: 'PCB-A1 외 2종', issued: 4200, used: 3100, ret: 0, c: '#17a89a' },
  { name: '한울가공', item: 'EMI 쉴드캔 외 1종', issued: 2800, used: 2400, ret: 50, c: '#3a6ee0' },
  { name: '동진정밀', item: '200mm 웨이퍼', issued: 1500, used: 900, ret: 0, c: '#e6960c' },
  { name: '서원SMT', item: '보드 커넥터 외 3종', issued: 9000, used: 7200, ret: 120, c: '#1f2f55' },
];
