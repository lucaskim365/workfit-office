/**
 * 은행 목록 — 공통코드 `BANK` 그룹(시스템 기준정보). code 는 금융결제원 은행 코드 3자리.
 * 아래는 처음 넣는 값(scripts/seed-bank-codes.ts). 이후 추가·끄기는 관리자 콘솔 › 공통코드에서.
 */
export const BANK_GROUP_CODE = 'BANK';
export const BANK_GROUP_NAME = '은행';

export const INITIAL_BANKS: ReadonlyArray<{ code: string; name: string }> = [
  { code: '002', name: 'KDB산업은행' },
  { code: '003', name: 'IBK기업은행' },
  { code: '004', name: 'KB국민은행' },
  { code: '007', name: '수협은행' },
  { code: '011', name: 'NH농협은행' },
  { code: '020', name: '우리은행' },
  { code: '023', name: 'SC제일은행' },
  { code: '027', name: '한국씨티은행' },
  { code: '031', name: 'iM뱅크(대구)' },
  { code: '032', name: '부산은행' },
  { code: '034', name: '광주은행' },
  { code: '035', name: '제주은행' },
  { code: '037', name: '전북은행' },
  { code: '039', name: '경남은행' },
  { code: '045', name: '새마을금고' },
  { code: '048', name: '신협' },
  { code: '071', name: '우체국' },
  { code: '081', name: '하나은행' },
  { code: '088', name: '신한은행' },
  { code: '089', name: '케이뱅크' },
  { code: '090', name: '카카오뱅크' },
  { code: '092', name: '토스뱅크' },
];
