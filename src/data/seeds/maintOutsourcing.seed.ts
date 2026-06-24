import type { MaintOutsourcing } from '@/domain/maintOutsourcing/schema';

/**
 * 보전 외주 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-outsource.jsx 인라인 OS_ROWS 이관)
 */
export const MAINT_OUTSOURCING_SEED: MaintOutsourcing[] = [
  { no: 'OS-2606-009', eq: 'Thermal 05호기', item: '히터 어셈블리 정밀 재생', vendor: '한국히팅시스템', date: '06-09', dur: '3일', cost: 8200000, state: '진행중', warranty: '6개월', sev: '중대' },
  { no: 'OS-2606-008', eq: 'Photo 05호기', item: '노광 렌즈 모듈 캘리브레이션', vendor: 'ASML Korea', date: '06-05', dur: '5일', cost: 24500000, state: '입고대기', warranty: '12개월', sev: '중대' },
  { no: 'OS-2605-021', eq: 'Etch 01호기', item: 'RF 제너레이터 오버홀', vendor: 'AMAT 서비스', date: '05-28', dur: '7일', cost: 15800000, state: '완료', warranty: '12개월', sev: '중대' },
  { no: 'OS-2605-019', eq: 'CMP 02호기', item: '연마 헤드 스핀들 재생', vendor: '정밀기공(주)', date: '05-22', dur: '4일', cost: 6400000, state: '완료', warranty: '6개월', sev: '주의' },
  { no: 'OS-2605-014', eq: 'Implant 02호기', item: '이온소스 챔버 클리닝', vendor: 'AMAT 서비스', date: '05-15', dur: '3일', cost: 9100000, state: '완료', warranty: '3개월', sev: '주의' },
  { no: 'OS-2605-008', eq: 'Depo 03호기', item: '진공펌프 오버홀', vendor: '에드워드코리아', date: '05-08', dur: '6일', cost: 7300000, state: '완료', warranty: '12개월', sev: '주의' },
  { no: 'OS-2604-022', eq: 'Clean 04호기', item: '케미컬 펌프 교체', vendor: '정밀기공(주)', date: '04-26', dur: '2일', cost: 3200000, state: '완료', warranty: '6개월', sev: '경미' },
];
