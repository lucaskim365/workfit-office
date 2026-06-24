import type { Gage } from '@/domain/gage/schema';

/**
 * 계측기·검사장비 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-gage-master.jsx 의 인라인 mock QG_LIST 이관)
 */
export const GAGE_SEED: Gage[] = [
  { id: 'QG-CMM-01', name: '3차원 측정기(CMM)', cat: '좌표측정', maker: 'ZEISS', model: 'CONTURA G2', range: '700×1000×600 mm', res: '0.5 ㎛', loc: '품질실', dept: '품질팀', cal: '2026-03-15', calNext: '2027-03-15', grr: 6.8, grrDate: '2026-03', state: '사용중', items: ['외경(O.D)', '내경(I.D)', '평면도', '진원도', 'PCD'] },
  { id: 'QG-VIS-02', name: '영상 측정 시스템', cat: '영상측정', maker: 'KEYENCE', model: 'IM-7000', range: '100×100 mm', res: '1 ㎛', loc: '2라인 #4', dept: '품질팀', cal: '2026-02-20', calNext: '2027-02-20', grr: 9.2, grrDate: '2026-02', state: '사용중', items: ['외형 치수', '핀 피치', '표면 결함'] },
  { id: 'QG-HRC-03', name: '로크웰 경도계', cat: '경도', maker: 'Mitutoyo', model: 'HR-530', range: '20–88 HRC', res: '0.1 HRC', loc: '시험실', dept: '품질팀', cal: '2025-12-05', calNext: '2026-06-05', grr: 12.5, grrDate: '2026-01', state: '사용중', items: ['표면 경도', '심부 경도'] },
  { id: 'QG-TEN-04', name: '만능재료시험기(UTM)', cat: '물성', maker: 'Instron', model: '5967', range: '0–30 kN', res: '0.01 N', loc: '시험실', dept: '품질팀', cal: '2026-04-10', calNext: '2027-04-10', grr: 7.5, grrDate: '2026-04', state: '사용중', items: ['인장강도', '연신율'] },
  { id: 'QG-RGH-05', name: '표면조도 측정기', cat: '조도', maker: 'Mitutoyo', model: 'SJ-410', range: 'Ra 0.01–16 ㎛', res: '0.001 ㎛', loc: '계측실', dept: '품질팀', cal: '2026-05-22', calNext: '2027-05-22', grr: 8.9, grrDate: '2026-05', state: '사용중', items: ['표면 거칠기'] },
  { id: 'QG-PRO-06', name: '윤곽 투영기', cat: '윤곽', maker: 'Nikon', model: 'V-12B', range: 'Ø300 mm', res: '1 ㎛', loc: '계측실', dept: '품질팀', cal: '2025-11-18', calNext: '2026-05-18', grr: 14.8, grrDate: '2025-12', state: '검교정중', items: ['치형', '윤곽 형상'] },
  { id: 'QG-VIS-07', name: '영상 측정 시스템 #2', cat: '영상측정', maker: 'KEYENCE', model: 'IM-6145', range: '50×50 mm', res: '1 ㎛', loc: '품질실', dept: '품질팀', cal: '2025-10-30', calNext: '2026-04-30', grr: 33.2, grrDate: '2025-11', state: '사용중지', items: ['소형 부품 치수'] },
];
