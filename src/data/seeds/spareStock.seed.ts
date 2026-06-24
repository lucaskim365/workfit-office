import type { SpareStock } from '@/domain/spareStock/schema';

/**
 * 예비품 재고현황 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 spare-stock.jsx 의 인라인 SPS_ROWS 이관)
 */
export const SPARE_STOCK_SEED: SpareStock[] = [
  { code: 'SP-MB-200', name: '캐리어 멤브레인', cat: '소모성', loc: 'A-03-2', wh: 'A구역', unit: 'EA', price: 480000, stock: 6, safe: 8, opt: 12, turn: 2.4, lastIn: '06-02', lastOut: '06-09', idle: 12, state: '부족' },
  { code: 'SP-RR-300', name: '리테이너 링', cat: '소모성', loc: 'A-03-3', wh: 'A구역', unit: 'EA', price: 320000, stock: 18, safe: 8, opt: 16, turn: 1.8, lastIn: '05-28', lastOut: '06-07', idle: 14, state: '정상' },
  { code: 'SP-PAD-IC', name: '연마 패드', cat: '소모성', loc: 'A-04-1', wh: 'A구역', unit: 'EA', price: 210000, stock: 4, safe: 10, opt: 24, turn: 3.6, lastIn: '06-10', lastOut: '06-06', idle: 5, state: '부족' },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', cat: '전장부품', loc: 'C-01-1', wh: 'C구역', unit: 'EA', price: 1850000, stock: 2, safe: 2, opt: 3, turn: 0.6, lastIn: '06-07', lastOut: '06-10', idle: 11, state: '주의' },
  { code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', loc: 'A-05-2', wh: 'A구역', unit: 'EA', price: 3200000, stock: 1, safe: 1, opt: 2, turn: 0.3, lastIn: '03-14', lastOut: '04-02', idle: 80, state: '주의' },
  { code: 'SP-ORK-A', name: 'O-Ring 키트', cat: '기구부품', loc: 'B-02-4', wh: 'B구역', unit: 'SET', price: 95000, stock: 24, safe: 6, opt: 12, turn: 1.2, lastIn: '06-09', lastOut: '06-08', idle: 9, state: '정상' },
  { code: 'SP-BRG-SP', name: '스핀들 베어링', cat: '정밀부품', loc: 'A-06-1', wh: 'A구역', unit: 'EA', price: 540000, stock: 5, safe: 4, opt: 8, turn: 0.9, lastIn: '05-20', lastOut: '05-30', idle: 22, state: '정상' },
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', cat: '소모성', loc: 'B-04-2', wh: 'B구역', unit: 'EA', price: 680000, stock: 0, safe: 3, opt: 6, turn: 1.4, lastIn: '05-12', lastOut: '06-09', idle: 12, state: '결품' },
  { code: 'SP-PMP-DM', name: '다이어프램 펌프', cat: '기구부품', loc: 'C-03-1', wh: 'C구역', unit: 'EA', price: 420000, stock: 7, safe: 3, opt: 6, turn: 0.4, lastIn: '02-08', lastOut: '03-15', idle: 98, state: '정상' },
  { code: 'SP-VLV-PN', name: '공압 밸브', cat: '기구부품', loc: 'B-01-3', wh: 'B구역', unit: 'EA', price: 165000, stock: 11, safe: 4, opt: 10, turn: 1.1, lastIn: '06-04', lastOut: '06-05', idle: 16, state: '정상' },
  { code: 'SP-SEN-PT', name: '백금 측온센서(Pt100)', cat: '전장부품', loc: 'C-02-2', wh: 'C구역', unit: 'EA', price: 88000, stock: 3, safe: 5, opt: 10, turn: 1.6, lastIn: '05-30', lastOut: '06-08', idle: 13, state: '부족' },
  { code: 'SP-GSK-CF', name: 'CF 가스켓 세트', cat: '소모성', loc: 'B-03-1', wh: 'B구역', unit: 'SET', price: 42000, stock: 36, safe: 12, opt: 30, turn: 2.1, lastIn: '06-08', lastOut: '06-09', idle: 10, state: '정상' },
];
