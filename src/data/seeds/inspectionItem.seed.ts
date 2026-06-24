import type { InspectionItem } from '@/domain/inspectionItem/schema';

/**
 * 검사항목 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-insp-item.jsx 의 인라인 mock 이관)
 */
export const INSPECTION_ITEM_SEED: InspectionItem[] = [
  { code: 'QI-DIM-001', name: '외경(O.D)', group: '치수', type: '계량', unit: 'mm', method: '버니어캘리퍼스', gage: 'CAL-2401-001', nominal: 25.0, usl: 25.05, lsl: 24.95, digits: 2, judge: '', sampling: '샘플링', severity: '주요', stages: ['수입', '공정', '출하'], defect: 'D-DIM-OS', state: '사용', updated: '2026-05-18' },
  { code: 'QI-DIM-002', name: '내경(I.D)', group: '치수', type: '계량', unit: 'mm', method: '외측 마이크로미터', gage: 'CAL-2403-019', nominal: 12.0, usl: 12.02, lsl: 11.98, digits: 2, judge: '', sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-DIM-US', state: '사용', updated: '2026-05-18' },
  { code: 'QI-DIM-003', name: '전장(Length)', group: '치수', type: '계량', unit: 'mm', method: '하이트게이지', gage: 'CAL-2208-003', nominal: 150.0, usl: 150.3, lsl: 149.7, digits: 1, judge: '', sampling: '샘플링', severity: '경미', stages: ['공정'], defect: 'D-DIM-LN', state: '사용', updated: '2026-04-30' },
  { code: 'QI-WT-001', name: '제품 중량', group: '중량', type: '계량', unit: 'g', method: '정밀 전자저울', gage: 'CAL-2312-014', nominal: 320.0, usl: 325.0, lsl: 315.0, digits: 1, judge: '', sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-WT-OV', state: '사용', updated: '2026-06-02' },
  { code: 'QI-AP-001', name: '표면 스크래치', group: '외관', type: '계수', unit: '-', method: '육안검사', gage: '-', nominal: null, usl: null, lsl: null, digits: 0, judge: '길이 0.5mm 초과 스크래치 無', sampling: '전수', severity: '치명', stages: ['공정', '출하'], defect: 'D-AP-SC', state: '사용', updated: '2026-06-10' },
  { code: 'QI-AP-002', name: '도장 색상/광택', group: '외관', type: '계수', unit: '-', method: '색차계 / 한도견본', gage: 'CAL-2406-030', nominal: null, usl: null, lsl: null, digits: 0, judge: '한도견본 대비 ΔE ≤ 1.5', sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-AP-CL', state: '사용', updated: '2026-05-22' },
  { code: 'QI-AP-003', name: '버(Burr)·이물', group: '외관', type: '계수', unit: '-', method: '육안검사', gage: '-', nominal: null, usl: null, lsl: null, digits: 0, judge: '버·이물·오염 無 (한도견본 기준)', sampling: '전수', severity: '치명', stages: ['수입', '공정', '출하'], defect: 'D-AP-BR', state: '사용', updated: '2026-06-10' },
  { code: 'QI-TMP-001', name: '사출 수지온도', group: '온도', type: '계량', unit: '℃', method: '표면 온도센서', gage: 'CAL-2402-022', nominal: 230, usl: 235, lsl: 225, digits: 0, judge: '', sampling: '샘플링', severity: '주요', stages: ['공정'], defect: 'D-PR-TMP', state: '사용', updated: '2026-03-14' },
  { code: 'QI-PRP-001', name: '인장강도', group: '물성', type: '계량', unit: 'MPa', method: '만능재료시험기', gage: 'UTM-01', nominal: null, usl: null, lsl: 45.0, digits: 1, judge: '', sampling: '샘플링', severity: '치명', stages: ['수입', '출하'], defect: 'D-PR-TS', state: '사용', updated: '2026-02-28' },
  { code: 'QI-PRP-002', name: '표면 경도', group: '물성', type: '계량', unit: 'HRC', method: '로크웰 경도계', gage: 'HRD-02', nominal: 58, usl: 60, lsl: 56, digits: 0, judge: '', sampling: '샘플링', severity: '주요', stages: ['수입', '공정'], defect: 'D-PR-HD', state: '사용', updated: '2026-01-20' },
  { code: 'QI-EL-001', name: '절연저항', group: '전기', type: '계량', unit: 'MΩ', method: '절연저항계', gage: 'IR-01', nominal: null, usl: null, lsl: 10, digits: 0, judge: '', sampling: '전수', severity: '치명', stages: ['출하'], defect: 'D-EL-IR', state: '사용', updated: '2026-04-05' },
  { code: 'QI-WT-002', name: '충전량', group: '중량', type: '계량', unit: 'ml', method: '정량 측정기', gage: 'VOL-01', nominal: 500, usl: 503, lsl: 497, digits: 0, judge: '', sampling: '샘플링', severity: '주요', stages: ['공정'], defect: 'D-WT-FL', state: '미사용', updated: '2025-12-11' },
];
