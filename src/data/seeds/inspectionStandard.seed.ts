import type { InspectionStandard } from '@/domain/inspectionStandard/schema';

/** 검사기준 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 qual-insp-spec.jsx) */
export const INSPECTION_STANDARD_SEED: InspectionStandard[] = [
  { code: 'P-1001', name: 'AL 하우징 BR-200', cat: '가공품', procs: [
    { id: 'OP10', step: 10, name: '소재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '501–1,200', n: 80, ac: 2, re: 3, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 경도', code: 'QI-PRP-002', type: '계량', usl: '60', lsl: '56', spec: '58 ±2 HRC', method: '로크웰 경도계', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP30', step: 30, name: 'CNC 가공', stage: 'PQC', aql: 0.65, level: 'II', lot: '281–500', n: 50, ac: 1, re: 2, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '내경(I.D)', code: 'QI-DIM-002', type: '계량', usl: '12.02', lsl: '11.98', spec: '12.00 ±0.02 mm', method: '마이크로미터', sampling: '샘플링', sev: '주요', use: true },
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
    ] },
    { id: 'OP50', step: 50, name: '표면처리·도장', stage: 'PQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 2, re: 3, items: [
      { name: '도장 색상/광택', code: 'QI-AP-002', type: '계수', spec: '한도견본 대비 ΔE ≤ 1.5', method: '색차계', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP70', step: 70, name: '최종 출하검사', stage: 'OQC', aql: 0.65, level: 'II', lot: '501–1,200', n: 80, ac: 1, re: 2, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
      { name: '도장 색상/광택', code: 'QI-AP-002', type: '계수', spec: '한도견본 대비 ΔE ≤ 1.5', method: '색차계', sampling: '샘플링', sev: '주요', use: true },
    ] },
  ] },
  { code: 'P-1002', name: '커넥터 하우징 CN-12', cat: '사출품', procs: [
    { id: 'OP10', step: 10, name: '원자재 수입검사', stage: 'IQC', aql: 1.5, level: 'II', lot: '1,201–3,200', n: 125, ac: 5, re: 6, items: [
      { name: '인장강도', code: 'QI-PRP-001', type: '계량', usl: '—', lsl: '45.0', spec: '45.0 MPa 이상', method: '만능재료시험기', sampling: '샘플링', sev: '치명', use: true },
    ] },
    { id: 'OP20', step: 20, name: '사출 성형', stage: 'PQC', aql: 1.0, level: 'II', lot: '1,201–3,200', n: 125, ac: 3, re: 4, items: [
      { name: '사출 수지온도', code: 'QI-TMP-001', type: '계량', usl: '235', lsl: '225', spec: '230 ±5 ℃', method: '온도센서', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP60', step: 60, name: '전기 특성검사', stage: 'OQC', aql: 0, level: 'II', lot: '전수', n: 0, ac: 0, re: 1, items: [
      { name: '절연저항', code: 'QI-EL-001', type: '계량', usl: '—', lsl: '10', spec: '10 MΩ 이상', method: '절연저항계', sampling: '전수', sev: '치명', use: true },
    ] },
  ] },
  { code: 'P-2003', name: '기어박스 커버 GX-7', cat: '가공품', procs: [
    { id: 'OP10', step: 10, name: '소재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 1, re: 2, items: [
      { name: '표면 경도', code: 'QI-PRP-002', type: '계량', usl: '60', lsl: '56', spec: '58 ±2 HRC', method: '로크웰 경도계', sampling: '샘플링', sev: '주요', use: true },
    ] },
    { id: 'OP40', step: 40, name: '머시닝 가공', stage: 'PQC', aql: 0, level: '-', lot: '-', n: 0, ac: 0, re: 0, items: [] },
    { id: 'OP80', step: 80, name: '최종 출하검사', stage: 'OQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 2, re: 3, items: [
      { name: '내경(I.D)', code: 'QI-DIM-002', type: '계량', usl: '12.02', lsl: '11.98', spec: '12.00 ±0.02 mm', method: '마이크로미터', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
  ] },
  { code: 'P-3010', name: 'EV 배터리 트레이 BT-5', cat: '용접조립', procs: [
    { id: 'OP10', step: 10, name: '판재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '501–1,200', n: 80, ac: 2, re: 3, items: [
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
    ] },
    { id: 'OP55', step: 55, name: '로봇 용접', stage: 'PQC', aql: 1.5, level: 'II', lot: '501–1,200', n: 80, ac: 3, re: 4, items: [
      { name: '제품 중량', code: 'QI-WT-001', type: '계량', usl: '325.0', lsl: '315.0', spec: '320.0 ±5.0 g', method: '전자저울', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: false },
    ] },
  ] },
];
