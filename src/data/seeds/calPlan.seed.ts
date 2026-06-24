import type { CalPlan } from '@/domain/calPlan/schema';

/**
 * 검교정 주기·계획 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 cal-plan.jsx 의 인라인 PLAN_ROWS 이관)
 */
export const CAL_PLAN_SEED: CalPlan[] = [
  { sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', cycle: 12, lastCal: '2025-06-18', nextCal: '2026-06-18', org: '한국계량기기(외부)', dept: '설비팀' },
  { sn: 'CAL-2403-019', name: '외측 마이크로미터', cat: '마이크로미터', cycle: 12, lastCal: '2025-05-20', nextCal: '2026-05-20', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', cat: '온도센서', cycle: 12, lastCal: '2025-07-01', nextCal: '2026-07-01', org: 'KOLAS 인정기관(외부)', dept: '품질팀' },
  { sn: 'CAL-2312-014', name: '정밀 전자저울', cat: '저울', cycle: 6, lastCal: '2026-01-05', nextCal: '2026-07-05', org: '한국계량기기(외부)', dept: '품질팀' },
  { sn: 'CAL-2310-011', name: '디지털 토크렌치', cat: '토크렌치', cycle: 6, lastCal: '2026-02-14', nextCal: '2026-08-14', org: '사내 교정실', dept: '설비팀' },
  { sn: 'CAL-2208-003', name: '하이트게이지', cat: '하이트게이지', cycle: 12, lastCal: '2025-09-12', nextCal: '2026-09-12', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2406-030', name: '다이얼게이지', cat: '다이얼게이지', cycle: 12, lastCal: '2025-10-30', nextCal: '2026-10-30', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', cat: '캘리퍼스', cycle: 12, lastCal: '2025-12-10', nextCal: '2026-12-10', org: '사내 교정실', dept: '품질팀' },
];
