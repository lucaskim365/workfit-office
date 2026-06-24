import type { SpareSafety } from '@/domain/spareSafety/schema';

/**
 * 예비품 안전재고 미달 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 spare-safety.jsx 의 인라인 SAFE_ROWS 이관)
 */
export const SPARE_SAFETY_SEED: SpareSafety[] = [
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', cat: '소모성', unit: 'EA', price: 680000, stock: 0, safe: 3, opt: 6, lead: 28, maker: 'AMAT', eqs: ['Implant 02호기'], po: '미발주', lastReq: '–', state: '결품' },
  { code: 'SP-PAD-IC', name: '연마 패드', cat: '소모성', unit: 'EA', price: 210000, stock: 4, safe: 10, opt: 24, lead: 7, maker: 'DuPont', eqs: ['CMP 02호기'], po: '미발주', lastReq: '–', state: '부족' },
  { code: 'SP-MB-200', name: '캐리어 멤브레인', cat: '소모성', unit: 'EA', price: 480000, stock: 6, safe: 8, opt: 12, lead: 14, maker: 'AMAT', eqs: ['CMP 02호기', 'CMP 03호기'], po: '발주중', lastReq: '06-09', state: '부족' },
  { code: 'SP-SEN-PT', name: '백금 측온센서(Pt100)', cat: '전장부품', unit: 'EA', price: 88000, stock: 3, safe: 5, opt: 10, lead: 12, maker: 'WIKA', eqs: ['Thermal 05호기'], po: '미발주', lastReq: '–', state: '부족' },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', cat: '전장부품', unit: 'EA', price: 1850000, stock: 2, safe: 2, opt: 3, lead: 30, maker: 'ASM', eqs: ['Thermal 05호기'], po: '입고예정', lastReq: '06-07', state: '주의' },
  { code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', unit: 'EA', price: 3200000, stock: 1, safe: 1, opt: 2, lead: 45, maker: 'Adv. Energy', eqs: ['Etch 01호기'], po: '미발주', lastReq: '–', state: '주의' },
];
