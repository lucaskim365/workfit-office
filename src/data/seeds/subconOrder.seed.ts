import type { SubconOrder } from '@/domain/subconOrder/schema';

/**
 * 외주 발주 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 subcon-order.jsx 인라인 mock 이관)
 */
export const SUBCON_ORDER_SEED: SubconOrder[] = [
  { no: 'SC-2606-018', vendor: '동양프레스', proc: '프레스 가공', code: 'BR-MNT-2T', name: '브래킷 본체', qty: 8000, unit: 'EA', price: 320, due: '06-25', dday: 4, mat: 'SS400 코일', matType: '무상', matQty: '2.4 ton', status: '생산중' },
  { no: 'SC-2606-017', vendor: '한빛도금', proc: '표면처리(도금)', code: 'BR-KIT-2T', name: '브래킷 키트', qty: 6000, unit: 'EA', price: 180, due: '06-23', dday: 2, mat: '브래킷 반제품', matType: '무상', matQty: '6,000 EA', status: '입고대기' },
  { no: 'SC-2606-016', vendor: '정밀가공', proc: '하우징 후가공', code: 'CN-HSG-08P', name: '커넥터 하우징', qty: 4000, unit: 'EA', price: 240, due: '06-22', dday: 1, mat: '하우징 사출품', matType: '무상', matQty: '4,000 EA', status: '생산중' },
  { no: 'SC-2606-015', vendor: '대성몰드', proc: '코어 정밀가공', code: 'TM-PIN-16', name: '터미널 핀', qty: 20000, unit: 'EA', price: 95, due: '06-20', dday: -1, mat: '동합금 스트립', matType: '유상', matQty: '85 kg', status: '완료' },
  { no: 'SC-2606-014', vendor: '동양프레스', proc: '프레스 가공', code: 'BR-MNT-2T', name: '브래킷 본체', qty: 5000, unit: 'EA', price: 320, due: '06-28', dday: 7, mat: 'SS400 코일', matType: '무상', matQty: '1.5 ton', status: '지시' },
];
