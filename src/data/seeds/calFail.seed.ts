import type { CalFail } from '@/domain/calFail/schema';

/**
 * 검교정 불합격 자산 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 cal-fail.jsx 의 인라인 FAIL_ROWS 이관)
 */
export const CAL_FAIL_SEED: CalFail[] = [
  { no: 'CR-2606-022', sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', failDate: '06-18', err: '+0.42 %FS', tol: '±0.25 %FS', dept: '설비팀', dispo: '미조치', note: '드리프트 과다 — 센서 모듈 점검 필요' },
  { no: 'CR-2604-009', sn: 'CAL-2310-099', name: '구형 토크렌치', cat: '토크렌치', failDate: '04-22', err: '+5.4 %', tol: '±3 %', dept: '설비팀', dispo: '수리신청', note: '교정 조정 한계 초과 — 외주 수리 의뢰' },
  { no: 'CR-2603-014', sn: 'CAL-2105-040', name: '노후 다이얼게이지', cat: '다이얼게이지', failDate: '03-30', err: '+0.08 mm', tol: '±0.01 mm', dept: '품질팀', dispo: '폐기', note: '스핀들 마모 — 수리 불가 판정' },
  { no: 'CR-2602-007', sn: 'CAL-2208-077', name: '소형 전자저울', cat: '저울', failDate: '02-14', err: '+0.6 g', tol: '±0.1 g', dept: '품질팀', dispo: '사용중지', note: '로드셀 이상 — 사용 중지 후 재검 대기' },
];
