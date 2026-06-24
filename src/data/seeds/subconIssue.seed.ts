import type { SubconIssue } from '@/domain/subconIssue/schema';

/**
 * 외주 자재불출 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 subcon-issue.jsx 의 인라인 ORDERS 이관)
 */
export const SUBCON_ISSUE_SEED: SubconIssue[] = [
  { no: 'SC-2606-018', vendor: '동양프레스', mats: [{ code: 'STL-SS400', name: 'SS400 코일', type: '무상', qty: '2.4', unit: 'ton', price: 0 }] },
  { no: 'SC-2606-017', vendor: '한빛도금', mats: [{ code: 'BR-SEMI', name: '브래킷 반제품', type: '무상', qty: '6,000', unit: 'EA', price: 0 }] },
  { no: 'SC-2606-016', vendor: '정밀가공', mats: [{ code: 'CN-HSG-RAW', name: '하우징 사출품', type: '무상', qty: '4,000', unit: 'EA', price: 0 }] },
  { no: 'SC-2606-015', vendor: '대성몰드', mats: [{ code: 'CU-C2680', name: '동합금 스트립', type: '유상', qty: '85', unit: 'kg', price: 22000 }] },
];
