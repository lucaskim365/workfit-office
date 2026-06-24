import type { Vendor } from '@/domain/vendor/schema';

/**
 * 거래처 시드 데이터 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * (와이어프레임 admin-screens.VendorMgmtContent 기준)
 */
export const VENDOR_SEED: Vendor[] = [
  { code: 'V-10021', name: '대성반도체(주)', type: '매입', use: '사용', bizNo: '214-86-01357', ceo: '박정호', manager: '김영업 · 010-2345-6789', addr: '경기도 화성시 동탄첨단산업1로 27, 메가센터 7층' },
  { code: 'V-10044', name: '한울정밀', type: '외주', use: '사용', bizNo: '124-81-44521', ceo: '이정밀', manager: '이외주 · 031-555-1004', addr: '경기도 안산시 단원구 산단로 102' },
  { code: 'V-20310', name: 'SK머티리얼즈', type: '매입', use: '사용', bizNo: '305-81-77810', ceo: '최소재', manager: '정구매 · 041-330-7781', addr: '충남 천안시 서북구 입장면 산업로 55' },
  { code: 'V-30551', name: '동진쎄미켐', type: '매입', use: '사용', bizNo: '128-86-22019', ceo: '강화학', manager: '오자재 · 031-260-2201', addr: '경기도 화성시 향남읍 제약공단로 8' },
  { code: 'V-40712', name: '글로벌로지스', type: '매출', use: '미사용', bizNo: '220-87-90011', ceo: '한물류', manager: '최영업 · 02-3478-9001', addr: '서울 강남구 테헤란로 401', creditLimit: 50000000, grade: 'B' },
  { code: 'V-50880', name: '미래화학', type: '외주', use: '사용', bizNo: '514-81-30022', ceo: '신미래', manager: '서외주 · 053-580-3002', addr: '대구 달서구 성서공단로 200' },
];
