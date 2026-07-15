import type { CompanyInfo } from '@/domain/companyInfo/schema';

/**
 * 회사 기본정보 시드 — 단일 문서(id='main').
 * Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (CompanyScreen.tsx 의 인라인 기본정보 폼 이관)
 */
export const COMPANY_INFO_SEED: CompanyInfo[] = [
  {
    id: 'main',
    name: '워크핏 주식회사',
    nameEn: 'WorkFit Co., Ltd.',
    bizNo: '453-88-02979',
    corpNo: '110111-8920434',
    ceo: '백지환',
    foundedDate: '2024-04-17',
    bizType: '정보통신업',
    bizItem: '소프트웨어개발',
    companyType: '법인',
    fiscalStart: '1',
    active: true,
    tel: '031-8000-1200',
    fax: '031-8000-1209',
    email: 'contact@workfit.co.kr',
    homepage: 'https://www.workfit.co.kr',
    address: '서울특별시 강남구 테헤란로 128, 3층 12호(역삼동,성곡빌딩)',
    sysName: 'WorkFit Intranet',
    reportHeader: 'WorkFitIntranet',
    docFooter: '본 문서는 WorkFitIntranet에서 발행되었습니다.',
    logoUrl: '',
    logoPath: '',
    mask: true,
  },
];
