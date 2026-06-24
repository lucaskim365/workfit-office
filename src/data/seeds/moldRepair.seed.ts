import type { MoldRepair } from '@/domain/moldRepair/schema';

/**
 * 금형 수리/세척 이력 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 mold-repair.jsx 의 인라인 REP_ROWS 이관)
 */
export const MOLD_REPAIR_SEED: MoldRepair[] = [
  { no: 'MR-2606-018', date: '06-10 14:20', code: 'MD-PRS-210', name: '브래킷 프레스 금형', type: '정기세척', detail: '슬라이드부 이물 제거·방청', shotAt: 940000, hrs: 1.5, cost: 80000, vendor: '자체정비', who: '박정비', state: '완료' },
  { no: 'MR-2606-017', date: '06-09 10:05', code: 'MD-INJ-103', name: '하우징 캡 금형', type: '수리', detail: '게이트 부싱 마모 교체', shotAt: 978500, hrs: 6.0, cost: 1250000, vendor: '대성몰드', who: '대성몰드', state: '완료' },
  { no: 'MR-2606-016', date: '06-08 16:40', code: 'MD-INJ-101', name: '커넥터 하우징 금형', type: '정기세척', detail: '캐비티 폴리싱·이젝터 윤활', shotAt: 408900, hrs: 2.0, cost: 95000, vendor: '자체정비', who: '김설비', state: '완료' },
  { no: 'MR-2606-015', date: '06-07 09:30', code: 'MD-PRS-211', name: '터미널 단자 금형', type: '수리', detail: '펀치 파손 — 입고 후 분해 점검', shotAt: 1480000, hrs: 0, cost: 0, vendor: '동양프레스', who: '동양프레스', state: '진행중' },
  { no: 'MR-2606-014', date: '06-05 11:10', code: 'MD-INJ-102', name: '센서 커버 금형', type: '세척', detail: '가스 벤트 청소·표면 처리', shotAt: 184200, hrs: 1.0, cost: 60000, vendor: '자체정비', who: '김설비', state: '완료' },
  { no: 'MR-2606-013', date: '06-03 13:55', code: 'MD-INJ-103', name: '하우징 캡 금형', type: '개조', detail: '냉각 채널 추가 가공', shotAt: 962000, hrs: 12.0, cost: 2400000, vendor: '대성몰드', who: '대성몰드', state: '완료' },
  { no: 'MR-2606-012', date: '06-02 08:20', code: 'MD-PRS-210', name: '브래킷 프레스 금형', type: '점검', detail: '클리어런스 측정·기록', shotAt: 920400, hrs: 0.5, cost: 0, vendor: '자체정비', who: '박정비', state: '완료' },
];
