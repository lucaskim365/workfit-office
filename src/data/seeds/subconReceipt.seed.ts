import type { SubconReceipt } from '@/domain/subconReceipt/schema';

/**
 * 외주 입고(외주 지시) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 subcon-receipt.jsx 의 인라인 ORDERS 이관)
 */
export const SUBCON_RECEIPT_SEED: SubconReceipt[] = [
  { no: 'SC-2606-016', vendor: '정밀가공', name: '커넥터 하우징', proc: '하우징 후가공', price: 240, ordered: 4000, received: 2000 },
  { no: 'SC-2606-018', vendor: '동양프레스', name: '브래킷 본체', proc: '프레스 가공', price: 320, ordered: 8000, received: 0 },
  { no: 'SC-2606-017', vendor: '한빛도금', name: '브래킷 키트', proc: '표면처리(도금)', price: 180, ordered: 6000, received: 0 },
];
