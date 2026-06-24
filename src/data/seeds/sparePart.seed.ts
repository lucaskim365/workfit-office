import type { SparePart } from '@/domain/sparePart/schema';

/**
 * 예비품 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 spare-master.jsx 의 인라인 mock 이관)
 */
export const SPARE_PART_SEED: SparePart[] = [
  { code: 'SP-MB-200', name: '캐리어 멤브레인', cat: '소모성', spec: 'AM-MB-200 / φ300mm', maker: 'AMAT', unit: 'EA', price: 480000, lead: 14, stock: 6, safe: 8, opt: 12, loc: 'A-03-2', warranty: '–', alt: ['SP-MB-200K'], eqs: ['CMP 02호기', 'CMP 03호기'], state: '부족' },
  { code: 'SP-RR-300', name: '리테이너 링', cat: '소모성', spec: 'AM-RR-300 / PPS', maker: 'AMAT', unit: 'EA', price: 320000, lead: 14, stock: 18, safe: 8, opt: 16, loc: 'A-03-3', warranty: '–', alt: [], eqs: ['CMP 02호기', 'CMP 03호기'], state: '정상' },
  { code: 'SP-PAD-IC', name: '연마 패드', cat: '소모성', spec: 'IC1000 / k-groove', maker: 'DuPont', unit: 'EA', price: 210000, lead: 7, stock: 4, safe: 10, opt: 24, loc: 'A-04-1', warranty: '–', alt: ['SP-PAD-IC2'], eqs: ['CMP 02호기'], state: '부족' },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', cat: '전장부품', spec: 'HTR-TC-3000 / SiC', maker: 'ASM', unit: 'EA', price: 1850000, lead: 30, stock: 2, safe: 2, opt: 3, loc: 'C-01-1', warranty: '6개월', alt: [], eqs: ['Thermal 05호기'], state: '주의' },
  { code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', spec: 'AE-MN-30 / 13.56MHz', maker: 'Adv. Energy', unit: 'EA', price: 3200000, lead: 45, stock: 1, safe: 1, opt: 2, loc: 'A-05-2', warranty: '12개월', alt: [], eqs: ['Etch 01호기'], state: '주의' },
  { code: 'SP-ORK-A', name: 'O-Ring 키트', cat: '기구부품', spec: 'AM-OR-KIT / Viton', maker: 'AMAT', unit: 'SET', price: 95000, lead: 10, stock: 24, safe: 6, opt: 12, loc: 'B-02-4', warranty: '–', alt: ['SP-ORK-B'], eqs: ['Etch 01호기', 'Depo 03호기'], state: '정상' },
  { code: 'SP-BRG-SP', name: '스핀들 베어링', cat: '정밀부품', spec: 'NSK-7014 / P4급', maker: 'NSK', unit: 'EA', price: 540000, lead: 21, stock: 5, safe: 4, opt: 8, loc: 'A-06-1', warranty: '6개월', alt: ['SP-BRG-SP2'], eqs: ['CMP 02호기'], state: '정상' },
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', cat: '소모성', spec: 'VST-FIL-9 / W', maker: 'AMAT', unit: 'EA', price: 680000, lead: 28, stock: 0, safe: 3, opt: 6, loc: 'B-04-2', warranty: '–', alt: [], eqs: ['Implant 02호기'], state: '결품' },
  { code: 'SP-PMP-DM', name: '다이어프램 펌프', cat: '기구부품', spec: 'IWK-LK-25', maker: 'IWAKI', unit: 'EA', price: 420000, lead: 18, stock: 7, safe: 3, opt: 6, loc: 'C-03-1', warranty: '12개월', alt: [], eqs: ['Clean 04호기'], state: '정상' },
];
