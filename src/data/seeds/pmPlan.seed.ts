import type { PmPlan } from '@/domain/pmPlan/schema';

/**
 * 예방보전(PM) 계획 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-pm-plan.jsx 의 인라인 PM_MASTER 튜플 배열 이관)
 * id = `${eq}__${item}` slug(공백·괄호 등 제거).
 */
export const PM_PLAN_SEED: PmPlan[] = [
  { id: 'cmp-02호기__연마-헤드-정밀점검', eq: 'CMP 02호기', item: '연마 헤드 정밀점검', pmType: '월간', cycle: '30일', last: '05-25', next: '06-25', mgr: '김설비', status: '정상' },
  { id: 'cmp-02호기__구동부-윤활', eq: 'CMP 02호기', item: '구동부 윤활', pmType: '주간', cycle: '7일', last: '06-03', next: '06-10', mgr: '김설비', status: '진행중' },
  { id: 'etch-01호기__rf-매칭-점검', eq: 'Etch 01호기', item: 'RF 매칭 점검', pmType: '주간', cycle: '7일', last: '06-06', next: '06-13', mgr: '박보전', status: '정상' },
  { id: 'etch-01호기__챔버-오버홀', eq: 'Etch 01호기', item: '챔버 오버홀', pmType: '분기', cycle: '90일', last: '03-15', next: '06-13', mgr: '박보전', status: '임박' },
  { id: 'photo-05호기__스테이지-정렬', eq: 'Photo 05호기', item: '스테이지 정렬', pmType: '주간', cycle: '7일', last: '06-09', next: '06-16', mgr: '김설비', status: '정상' },
  { id: 'depo-03호기__히터-캘리브레이션', eq: 'Depo 03호기', item: '히터 캘리브레이션', pmType: '월간', cycle: '30일', last: '05-20', next: '06-20', mgr: '이정비', status: '정상' },
  { id: 'implant-02호기__이온-소스-점검', eq: 'Implant 02호기', item: '이온 소스 점검', pmType: '월간', cycle: '30일', last: '05-18', next: '06-18', mgr: '이정비', status: '정상' },
  { id: 'thermal-05호기__튜브-일상점검', eq: 'Thermal 05호기', item: '튜브 일상점검', pmType: '일상', cycle: '1일', last: '06-09', next: '06-10', mgr: '박보전', status: '지연' },
  { id: 'thermal-05호기__퍼니스-오버홀', eq: 'Thermal 05호기', item: '퍼니스 오버홀', pmType: '연간', cycle: '365일', last: '25-06-23', next: '06-23', mgr: '박보전', status: '임박' },
  { id: 'clean-04호기__케미컬-라인-점검', eq: 'Clean 04호기', item: '케미컬 라인 점검', pmType: '월간', cycle: '30일', last: '05-11', next: '06-11', mgr: '김설비', status: '임박' },
];
