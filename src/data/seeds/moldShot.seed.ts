import type { MoldShot } from '@/domain/moldShot/schema';

/**
 * 금형 타수 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (화면 mold-shot 의 인라인 SHOT_ROWS 이관)
 */
export const MOLD_SHOT_SEED: MoldShot[] = [
  { code: 'MD-PRS-210', name: '브래킷 프레스 금형', asset: 'A2021-0212', eq: '프레스 01호기', cum: 940000, life: 1000000, today: 4200, avg: 4100, item: 'BR-MNT-2T' },
  { code: 'MD-INJ-103', name: '하우징 캡 금형', asset: 'A2019-0078', eq: '사출 02호기', cum: 980000, life: 1000000, today: 1850, avg: 1900, item: 'HS-CAP-06' },
  { code: 'MD-PRS-211', name: '터미널 단자 금형', asset: 'A2020-0150', eq: '프레스 02호기', cum: 1480000, life: 1500000, today: 0, avg: 6200, item: 'TM-PIN-16' },
  { code: 'MD-INJ-101', name: '커넥터 하우징 금형', asset: 'A2023-0451', eq: '사출 03호기', cum: 412000, life: 500000, today: 3100, avg: 2950, item: 'CN-HSG-08P' },
  { code: 'MD-INJ-102', name: '센서 커버 금형', asset: 'A2022-0388', eq: '사출 05호기', cum: 188000, life: 400000, today: 2400, avg: 2300, item: 'SN-CVR-04' },
];
