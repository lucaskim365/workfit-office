import type { CalResult } from '@/domain/calResult/schema';

/**
 * 검교정 실적 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 cal-result.jsx 의 인라인 RES_TX 이관)
 */
export const CAL_RESULT_SEED: CalResult[] = [
  { no: 'CR-2606-022', date: '06-18', sn: 'CAL-2305-007', name: '디지털 압력계', org: '한국계량기기', result: '불합격', err: '+0.42 %FS', tol: '±0.25 %FS', cert: 'CERT-26-1182', barcode: '8809-2606-0072', who: '이검교' },
  { no: 'CR-2606-021', date: '06-15', sn: 'CAL-2208-003', name: '하이트게이지', org: '사내 교정실', result: '합격', err: '+0.012 mm', tol: '±0.03 mm', cert: 'CERT-26-1175', barcode: '8809-2606-0061', who: '김품질' },
  { no: 'CR-2606-020', date: '06-12', sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', org: '사내 교정실', result: '합격', err: '−0.008 mm', tol: '±0.02 mm', cert: 'CERT-26-1169', barcode: '8809-2606-0058', who: '김품질' },
  { no: 'CR-2606-019', date: '06-09', sn: 'CAL-2310-011', name: '디지털 토크렌치', org: '사내 교정실', result: '합격(조정)', err: '−1.8 %', tol: '±3 %', cert: 'CERT-26-1160', barcode: '8809-2606-0049', who: '박설비' },
  { no: 'CR-2606-018', date: '06-05', sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', org: 'KOLAS 인정기관', result: '합격', err: '+0.021 ℃', tol: '±0.05 ℃', cert: 'CERT-26-1151', barcode: '8809-2606-0040', who: '이검교' },
  { no: 'CR-2606-017', date: '06-02', sn: 'CAL-2312-014', name: '정밀 전자저울', org: '한국계량기기', result: '합격', err: '+0.04 g', tol: '±0.1 g', cert: 'CERT-26-1144', barcode: '8809-2606-0031', who: '김품질' },
];
