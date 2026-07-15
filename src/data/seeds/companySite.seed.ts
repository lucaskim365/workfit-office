import type { CompanySite } from '@/domain/companySite/schema';

/**
 * 회사 사업장 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (CompanyScreen.tsx 의 인라인 SITES 이관)
 */
export const COMPANY_SITE_SEED: CompanySite[] = [
  { name: '본사', kind: '본점', addr: '경기도 화성시 동탄첨단산업1로 27, 메가센터 7층', tel: '031-8000-1200', mgr: '김경영', active: true },
];
