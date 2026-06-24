import type { UrgentOrder } from '@/domain/urgentOrder/schema';

/**
 * 긴급오더 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 UrgentScreen 의 인라인 TX 이관)
 */
export const URGENT_ORDER_SEED: UrgentOrder[] = [
  { no: 'UR-2606-009', type: '긴급', date: '06-21 13:20', name: '커넥터 어셈블리', qty: 2000, prio: '최우선', reason: 'VIP 납기 단축 대응', line: '조립셀 A', by: '김반장', state: '진행중' },
  { no: 'RW-2606-031', type: '재작업', date: '06-21 11:40', name: '센서 모듈', qty: 320, prio: '높음', reason: 'AOI 납땜 불량 (LOT B-0619)', line: 'SMT 라인 2', by: '이검사', state: '발령' },
  { no: 'UR-2606-008', type: '긴급', date: '06-21 10:05', name: '브래킷 키트', qty: 1500, prio: '높음', reason: '결품 긴급 대응', line: '프레스 01호기', by: '박계획', state: '진행중' },
  { no: 'RW-2606-030', type: '재작업', date: '06-21 09:15', name: '커넥터 하우징', qty: 180, prio: '보통', reason: '치수 NG / 외관 불량', line: '사출 03호기', by: '김품질', state: '완료' },
  { no: 'UR-2606-007', type: '긴급', date: '06-21 08:30', name: '하우징 캡', qty: 800, prio: '보통', reason: '특별 주문 (샘플)', line: '사출 03호기', by: '박계획', state: '완료' },
  { no: 'RW-2606-029', type: '재작업', date: '06-20 16:50', name: '터미널 핀', qty: 640, prio: '높음', reason: '압착 강도 불량', line: '프레스 01호기', by: '이검사', state: '완료' },
];
