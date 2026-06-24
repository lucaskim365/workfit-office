import type { EquipVendor } from '@/domain/equipVendor/schema';

/**
 * 설비 보전협력사 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-vendor.jsx 의 인라인 VENDORS 이관)
 */
export const EQUIP_VENDOR_SEED: EquipVendor[] = [
  { code: 'VD-AMAT', name: 'Applied Materials Korea', kind: '제조사', scope: 'CMP · Etch · Depo · Implant', mgr: 'J. Kim', phone: '031-8064-0000', email: 'amat.kr@appliedmaterials.com', start: '2019-05-01', end: '2026-04-30', sla: '4시간(긴급) / 24시간(일반)', fee: '연 1,580', state: '계약중', grade: 'A', delivery: 96, quality: 96, response: 89, jobs: 142 },
  { code: 'VD-NIKON', name: 'Nikon Precision Korea', kind: '제조사', scope: 'Photo', mgr: 'T. Sato', phone: '02-2188-9500', email: 'npk.service@nikon.com', start: '2021-03-01', end: '2027-02-28', sla: '4시간(긴급) / 24시간(일반)', fee: '연 1,250', state: '계약중', grade: 'A', delivery: 97, quality: 98, response: 92, jobs: 76 },
  { code: 'VD-TEL', name: 'Tokyo Electron Korea', kind: '제조사', scope: 'Etch · Clean', mgr: '이도현', phone: '031-739-2000', email: 'tel.kr@tel.com', start: '2020-09-01', end: '2026-08-31', sla: '4시간(긴급) / 24시간(일반)', fee: '연 980', state: '계약중', grade: 'A', delivery: 95, quality: 95, response: 90, jobs: 89 },
  { code: 'VD-HSEMI', name: '한세미텍', kind: '보전외주', scope: '전 설비 일상·정기 보전', mgr: '박정만', phone: '031-555-7820', email: 'service@hansemi.co.kr', start: '2023-01-01', end: '2025-12-31', sla: '2시간(긴급) / 8시간(일반)', fee: '연 2,400', state: '계약중', grade: 'A', delivery: 96, quality: 92, response: 97, jobs: 318 },
  { code: 'VD-MIRAE', name: '미래엔지니어링', kind: '보전외주', scope: 'CMP · Clean 보전', mgr: '최영호', phone: '031-322-4410', email: 'mirae@mr-eng.co.kr', start: '2022-07-01', end: '2025-06-30', sla: '4시간(긴급) / 12시간(일반)', fee: '연 1,150', state: '만료임박', grade: 'B', delivery: 89, quality: 90, response: 86, jobs: 174 },
  { code: 'VD-DWPRC', name: '동우정밀', kind: '부품공급', scope: '연마 패드 · O-Ring · 소모품', mgr: '정수민', phone: '032-811-6300', email: 'sales@dwprecision.kr', start: '2021-11-01', end: '2026-10-31', sla: '납기 3일(재고) / 14일(주문)', fee: '단가계약', state: '계약중', grade: 'B', delivery: 93, quality: 94, response: 90, jobs: 226 },
  { code: 'VD-KCAL', name: '케이씨캘리브레이션', kind: '캘리브레이션', scope: '계측기 교정 · 센서 캘리', mgr: '오현철', phone: '042-934-1180', email: 'cal@kc-lab.co.kr', start: '2022-04-01', end: '2025-03-31', sla: '교정 7일', fee: '건당계약', state: '갱신예정', grade: 'A', delivery: 99, quality: 97, response: 91, jobs: 64 },
];
