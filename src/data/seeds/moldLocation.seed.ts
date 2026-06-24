import type { MoldLocation } from '@/domain/moldLocation/schema';

/**
 * 금형 위치 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 mold-location.jsx 의 인라인 LOC_ROWS 이관)
 */
export const MOLD_LOCATION_SEED: MoldLocation[] = [
  { code: 'MD-PRS-210', name: '브래킷 프레스 금형', cat: '프레스금형', home: '2-B-01', cur: '프레스 01호기', holder: '생산1팀', state: '대출중', since: '06-01' },
  { code: 'MD-INJ-103', name: '하우징 캡 금형', cat: '사출금형', home: '1-C-02', cur: '1-C-02', holder: '금형창고', state: '보관중', since: '04-13' },
  { code: 'MD-PRS-211', name: '터미널 단자 금형', cat: '프레스금형', home: '2-B-02', cur: '동양프레스(외주)', holder: '동양프레스', state: '외부수리', since: '04-20' },
  { code: 'MD-INJ-101', name: '커넥터 하우징 금형', cat: '사출금형', home: '1-A-03', cur: '사출 03호기', holder: '생산2팀', state: '대출중', since: '05-22' },
  { code: 'MD-INJ-102', name: '센서 커버 금형', cat: '사출금형', home: '1-A-04', cur: '이동중', holder: '물류', state: '이동중', since: '06-10' },
  { code: 'JG-WLD-051', name: '용접 고정 지그', cat: '지그', home: 'J-01', cur: '용접 02호기', holder: '생산3팀', state: '대출중', since: '03-15' },
  { code: 'GG-PLG-014', name: '플러그 게이지 세트', cat: '게이지', home: 'G-04', cur: 'G-04', holder: '계측실', state: '보관중', since: '06-01' },
];
