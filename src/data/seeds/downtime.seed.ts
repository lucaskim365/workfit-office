import type { Downtime } from '@/domain/downtime/schema';

/**
 * 설비 비가동 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (화면 equip-downtime 의 인라인 DT_LOG 이관, id 는 인덱스순 결정적 부여)
 */
export const DOWNTIME_SEED: Downtime[] = [
  { id: 'DT-01', eq: 'Thermal 05호기', start: '06-10 13:20', end: '— (진행중)', dur: '2.4', category: '고장(BM)', reason: 'AL-6003 튜브 과승온 — 히터 점검중', worker: '박보전', state: '진행중' },
  { id: 'DT-02', eq: 'Depo 03호기', start: '06-09 22:10', end: '06-10 02:40', dur: '4.5', category: '고장(BM)', reason: '챔버 누설 — O-Ring 교체', worker: '이정비', state: '완료' },
  { id: 'DT-03', eq: 'CMP 02호기', start: '06-09 14:00', end: '06-09 16:00', dur: '2.0', category: '계획보전(PM)', reason: '월간 예방점검 — 소모품 교체', worker: '김설비', state: '완료' },
  { id: 'DT-04', eq: 'Etch 01호기', start: '06-09 09:30', end: '06-09 12:00', dur: '2.5', category: '준비·교체', reason: '제품 전환 레시피 셋업', worker: '박보전', state: '완료' },
  { id: 'DT-05', eq: 'Implant 02호기', start: '06-08 20:00', end: '06-08 21:15', dur: '1.25', category: '자재 대기', reason: '웨이퍼 공급 지연', worker: '—', state: '완료' },
  { id: 'DT-06', eq: 'Photo 05호기', start: '06-08 11:00', end: '06-08 11:40', dur: '0.67', category: '품질·검사', reason: '오버레이 재측정', worker: '김설비', state: '완료' },
  { id: 'DT-07', eq: 'Clean 04호기', start: '06-07 16:30', end: '06-07 18:00', dur: '1.5', category: '고장(BM)', reason: '필터 차압 초과 — 필터 교체', worker: '이정비', state: '완료' },
];
