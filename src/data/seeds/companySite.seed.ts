import type { CompanySite } from '@/domain/companySite/schema';

/**
 * 회사 사업장 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (CompanyScreen.tsx 의 인라인 SITES 이관)
 */
export const COMPANY_SITE_SEED: CompanySite[] = [
  { name: '본사', kind: '본점', addr: '경기도 화성시 동탄첨단산업1로 27, 메가센터 7층', tel: '031-8000-1200', mgr: '김경영', active: true },
  { name: 'Fab1 (제1공장)', kind: '제조장', addr: '경기도 평택시 고덕산업단지 245', tel: '031-8000-1300', mgr: '박생산', active: true },
  { name: 'Fab2 (제2공장)', kind: '제조장', addr: '충청남도 아산시 탕정면 삼성로 181', tel: '041-5000-2100', mgr: '이설비', active: true },
  { name: '동탄 물류센터', kind: '물류장', addr: '경기도 화성시 동탄산단6길 15', tel: '031-8000-1450', mgr: '최물류', active: false },
];
