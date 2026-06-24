import type { Mold } from '@/domain/mold/schema';

/**
 * 금형/치공구 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 mold-master.jsx 의 인라인 mock 이관)
 */
export const MOLD_SEED: Mold[] = [
  { code: 'MD-INJ-101', name: '커넥터 하우징 금형', cat: '사출금형', asset: 'A2023-0451', maker: '한국정밀금형', cav: 8, loc: '금형창고 1-A-03', shot: 412000, life: 500000, item: 'CN-HSG-08P', eqs: ['사출 03호기'], lastChk: '06-05', repairs: 3, state: '사용중' },
  { code: 'MD-INJ-102', name: '센서 커버 금형', cat: '사출금형', asset: 'A2022-0388', maker: '대성몰드', cav: 4, loc: '금형창고 1-A-04', shot: 188000, life: 400000, item: 'SN-CVR-04', eqs: ['사출 05호기'], lastChk: '06-08', repairs: 1, state: '사용중' },
  { code: 'MD-PRS-210', name: '브래킷 프레스 금형', cat: '프레스금형', asset: 'A2021-0212', maker: '동양프레스', cav: 2, loc: '금형창고 2-B-01', shot: 940000, life: 1000000, item: 'BR-MNT-2T', eqs: ['프레스 01호기'], lastChk: '05-30', repairs: 6, state: '수명임박' },
  { code: 'MD-PRS-211', name: '터미널 단자 금형', cat: '프레스금형', asset: 'A2020-0150', maker: '동양프레스', cav: 16, loc: '금형창고 2-B-02', shot: 1480000, life: 1500000, item: 'TM-PIN-16', eqs: ['프레스 02호기'], lastChk: '04-20', repairs: 9, state: '수리중' },
  { code: 'JG-WLD-051', name: '용접 고정 지그', cat: '지그/Fixture', asset: 'A2023-0502', maker: '정밀지그', cav: 0, loc: '치공구실 J-01', shot: 0, life: 0, item: 'ASSY-FRM-A', eqs: ['용접 02호기'], lastChk: '06-10', repairs: 0, state: '사용중' },
  { code: 'GG-PLG-014', name: '플러그 게이지 세트', cat: '게이지/검구', asset: 'A2024-0033', maker: 'Mitutoyo', cav: 0, loc: '계측실 G-04', shot: 0, life: 0, item: '–', eqs: ['수입검사실'], lastChk: '06-01', repairs: 0, state: '보관' },
  { code: 'MD-INJ-103', name: '하우징 캡 금형', cat: '사출금형', asset: 'A2019-0078', maker: '한국정밀금형', cav: 6, loc: '금형창고 1-C-02', shot: 980000, life: 1000000, item: 'HS-CAP-06', eqs: ['사출 02호기'], lastChk: '03-15', repairs: 11, state: '폐기예정' },
  { code: 'CT-END-220', name: '엔드밀 공구 세트', cat: '절삭공구', asset: 'A2024-0119', maker: 'Sandvik', cav: 0, loc: '공구실 C-07', shot: 0, life: 0, item: '–', eqs: ['CNC 04호기'], lastChk: '06-09', repairs: 0, state: '사용중' },
];
