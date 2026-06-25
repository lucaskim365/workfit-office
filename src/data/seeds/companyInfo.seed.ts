import type { CompanyInfo } from '@/domain/companyInfo/schema';

/**
 * 회사 기본정보 시드 — 단일 문서(id='main').
 * Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (CompanyScreen.tsx 의 인라인 기본정보 폼 이관)
 */
export const COMPANY_INFO_SEED: CompanyInfo[] = [
  {
    id: 'main',
    name: '워크핏테크놀로지(주)',
    nameEn: 'WorkFit Technology Co., Ltd.',
    bizNo: '142-81-04567',
    corpNo: '110111-3456789',
    ceo: '김경영',
    foundedDate: '2011-03-02',
    bizType: '제조업',
    bizItem: '반도체 모듈 · 전자부품 제조',
    companyType: '법인',
    fiscalStart: '1',
    active: true,
    tel: '031-8000-1200',
    fax: '031-8000-1209',
    email: 'contact@workfit.co.kr',
    homepage: 'https://www.workfit.co.kr',
    address: '경기도 화성시 동탄첨단산업1로 27, 메가센터 7층 (우 18469)',
    sysName: 'WorkFit MES',
    reportHeader: 'WorkFitMES',
    docFooter: '본 문서는 WorkFitMES에서 발행되었습니다.',
    mask: true,
  },
];
