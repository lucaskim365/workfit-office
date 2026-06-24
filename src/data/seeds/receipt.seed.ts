import type { Receipt } from '@/domain/receipt/schema';

/** 입고 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 wms-screens.jsx) */
export const RECEIPT_SEED: Receipt[] = [
  { po: 'PO-260610-12', item: 'WF-300-B', itemName: '300mm 웨이퍼', vendor: '대성반도체', poQty: 2500, recvQty: 2500, warehouse: 'A-Zone' },
  { po: 'PO-260610-15', item: 'CHM-SL-05', itemName: '슬러리 SL-05', vendor: 'JS머트리얼', poQty: 60, recvQty: 60, warehouse: 'A-Zone' },
  { po: 'PO-260611-02', item: 'RES-PR-22', itemName: '포토레지스트', vendor: '한울케미칼', poQty: 40, recvQty: 38, warehouse: 'A-Zone' },
  { po: 'PO-260611-05', item: 'PKG-BGA-14', itemName: 'BGA 기판', vendor: '동진정밀', poQty: 3000, recvQty: 0, warehouse: 'C-Zone' },
];
