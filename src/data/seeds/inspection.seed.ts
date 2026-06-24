import type { z } from 'zod';
import type { inspectionSchema } from '@/domain/inspection/schema';

/**
 * 검사 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-iqc-wait.jsx LOT 큐 + qual-iqc-result.jsx 측정 상세 이관)
 *
 * 608ZZ(GR-260620-031)는 '검사중' 상태로, result 화면의 측정 항목·시료값까지 포함한다.
 * 나머지 LOT은 규격 문구(spec)만 가진 대기/보류 상태.
 */
export const INSPECTION_SEED: z.input<typeof inspectionSchema>[] = [
  {
    recv: 'GR-260621-014', date: '06-21 08:20', stage: 'IQC', code: 'RM-AL6061', name: '알루미늄 빌렛 6061', mtype: '원자재', vendor: '대한금속', qty: 1200, unit: 'EA', lot: 'L2606-0021', insp: '샘플링', letter: 'J', n: 80, ac: 2, re: 3, level: 'II', aql: 1.0, prio: '긴급', wait: 5.2, due: 'D-Day', pic: '김검사', status: '대기', judgement: null, items: [
      { name: '외경(O.D)', type: '계량', unit: 'mm', spec: '25.00 ±0.05 mm', lsl: 24.95, usl: 25.05, values: [], defect: 0 },
      { name: '표면 경도', type: '계량', unit: 'HRC', spec: '58 ±2 HRC', lsl: 56, usl: 60, values: [], defect: 0 },
      { name: '버·이물', type: '계수', unit: '-', spec: '버·이물 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260621-013', date: '06-21 08:05', stage: 'IQC', code: 'RM-PA66', name: 'PA66 수지 (검정)', mtype: '원자재', vendor: '코리아폴리머', qty: 3200, unit: 'kg', lot: 'L2606-0020', insp: '샘플링', letter: 'K', n: 125, ac: 3, re: 4, level: 'II', aql: 1.5, prio: '일반', wait: 5.5, due: 'D-1', pic: '미지정', status: '대기', judgement: null, items: [
      { name: '인장강도', type: '계량', unit: 'MPa', spec: '45.0 MPa 이상', lsl: 45.0, usl: null, values: [], defect: 0 },
      { name: '함수율', type: '계량', unit: '%', spec: '0.20 % 이하', lsl: null, usl: 0.2, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260620-031', date: '06-20 16:40', stage: 'IQC', code: 'SP-BRG-608', name: '베어링 608ZZ', mtype: '부자재', vendor: '정밀베어링', qty: 500, unit: 'EA', lot: 'L2606-0019', insp: '샘플링', letter: 'H', n: 50, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', wait: 21.0, due: 'D-Day', pic: '이품질', status: '검사중', judgement: null, items: [
      { name: '내경(I.D)', type: '계량', unit: 'mm', spec: '8.00 ±0.01 mm', lsl: 7.99, usl: 8.01, values: ['8.001', '7.998', '8.004', '7.995', '8.000'], defect: 0 },
      { name: '회전 토크', type: '계량', unit: 'N·m', spec: '0.10 ~ 0.45 N·m', lsl: 0.1, usl: 0.45, values: ['0.21', '0.25', '0.19', '0.28', '0.23'], defect: 0 },
      { name: '외경(O.D)', type: '계량', unit: 'mm', spec: '22.00 ±0.02 mm', lsl: 21.98, usl: 22.02, values: ['22.00', '21.99', '22.01', '22.00', '21.985'], defect: 0 },
      { name: '외관 (녹·손상)', type: '계수', unit: '-', spec: '녹·손상 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '실링 압입 상태', type: '계수', unit: '-', spec: '압입 정상', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260620-028', date: '06-20 14:10', stage: 'IQC', code: 'RM-STS304', name: 'STS304 강판 t2.0', mtype: '원자재', vendor: '동방스틸', qty: 280, unit: 'SHT', lot: 'L2606-0018', insp: '샘플링', letter: 'G', n: 32, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '긴급', wait: 23.5, due: '지연', pic: '이품질', status: '보류', judgement: null, items: [
      { name: '두께', type: '계량', unit: 'mm', spec: '2.00 ±0.05 mm', lsl: 1.95, usl: 2.05, values: [], defect: 0 },
      { name: '인장강도', type: '계량', unit: 'MPa', spec: '520 MPa 이상', lsl: 520, usl: null, values: [], defect: 0 },
      { name: '표면 스크래치', type: '계수', unit: '-', spec: '0.5mm 초과 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260620-022', date: '06-20 11:30', stage: 'IQC', code: 'EL-CON-12P', name: '12P 커넥터 하우징', mtype: '부자재', vendor: '한일전자', qty: 5000, unit: 'EA', lot: 'L2606-0017', insp: '샘플링', letter: 'L', n: 200, ac: 5, re: 6, level: 'II', aql: 1.5, prio: '일반', wait: 26.0, due: 'D-Day', pic: '미지정', status: '대기', judgement: null, items: [
      { name: '핀 피치', type: '계량', unit: 'mm', spec: '2.54 ±0.05 mm', lsl: 2.49, usl: 2.59, values: [], defect: 0 },
      { name: '절연저항', type: '계량', unit: 'MΩ', spec: '10 MΩ 이상', lsl: 10, usl: null, values: [], defect: 0 },
      { name: '버·이물', type: '계수', unit: '-', spec: '버·이물 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260619-040', date: '06-19 17:50', stage: 'IQC', code: 'PK-BOX-A', name: '포장 박스 A형', mtype: '부자재', vendor: '한국팩', qty: 2000, unit: 'EA', lot: 'L2606-0016', insp: '전수', letter: '—', n: 2000, ac: 0, re: 1, level: '—', aql: 0, prio: '일반', wait: 39.0, due: 'D-Day', pic: '미지정', status: '대기', judgement: null, items: [
      { name: '인쇄 상태', type: '계수', unit: '-', spec: '오인쇄·번짐 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '치수', type: '계량', unit: 'mm', spec: '규격 내', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260619-035', date: '06-19 15:20', stage: 'IQC', code: 'RM-CU-T1', name: '동(Cu) 판재 t1.0', mtype: '원자재', vendor: '대한금속', qty: 90, unit: 'SHT', lot: 'L2606-0015', insp: '샘플링', letter: 'E', n: 13, ac: 0, re: 1, level: 'II', aql: 1.0, prio: '일반', wait: 41.5, due: '지연', pic: '김검사', status: '검사중', judgement: null, items: [
      { name: '두께', type: '계량', unit: 'mm', spec: '1.00 ±0.03 mm', lsl: 0.97, usl: 1.03, values: [], defect: 0 },
      { name: '전기 전도도', type: '계량', unit: '%IACS', spec: '규격 내', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'GR-260619-029', date: '06-19 10:05', stage: 'IQC', code: 'SP-SCR-M4', name: '육각 볼트 M4×10', mtype: '부자재', vendor: '삼화정공', qty: 10000, unit: 'EA', lot: 'L2606-0014', insp: '샘플링', letter: 'M', n: 315, ac: 7, re: 8, level: 'II', aql: 1.5, prio: '일반', wait: 46.0, due: 'D-Day', pic: '미지정', status: '대기', judgement: null, items: [
      { name: '나사부 외경', type: '계량', unit: 'mm', spec: '4.00 ±0.03 mm', lsl: 3.97, usl: 4.03, values: [], defect: 0 },
      { name: '체결 토크', type: '계량', unit: 'N·m', spec: '규격 내', lsl: null, usl: null, values: [], defect: 0 },
      { name: '도금 상태', type: '계수', unit: '-', spec: '박리·녹 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },

  // ── 출하검사(OQC) — recv=출하지시번호(SO). cust/dest/ship/coa/pqc/req 사용. ──
  {
    recv: 'SO-260621-018', date: '06-21 09:10', stage: 'OQC', code: 'FG-BRK-A', name: '브래킷 ASSY-A', mtype: '완제품', vendor: '', qty: 1200, unit: 'EA', lot: 'L2606-1013', insp: '샘플링', letter: 'J', n: 80, ac: 2, re: 3, level: 'II', aql: 1.0, prio: '긴급', wait: 4.1, due: 'D-1', pic: '미지정', status: '대기', judgement: null, cust: '현대모비스', dest: '아산 1공장', ship: '06-22 14:00', coa: true, pqc: '합격', req: ['전수 외관검사', 'COA 동봉', '고객 라벨 양식'], items: [
      { name: '외관 (전수)', type: '계수', unit: '-', spec: '스크래치·이물 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '외경(O.D)', type: '계량', unit: 'mm', spec: '25.00 ±0.05 mm', lsl: 24.95, usl: 25.05, values: [], defect: 0 },
      { name: '체결 토크', type: '계량', unit: 'N·m', spec: '12.0 ±1.5 N·m', lsl: 10.5, usl: 13.5, values: [], defect: 0 },
    ],
  },
  {
    recv: 'SO-260621-015', date: '06-21 08:40', stage: 'OQC', code: 'FG-HSG-C', name: '하우징 C-Type', mtype: '완제품', vendor: '', qty: 5000, unit: 'EA', lot: 'L2606-1008', insp: '샘플링', letter: 'L', n: 200, ac: 5, re: 6, level: 'II', aql: 1.5, prio: '일반', wait: 4.6, due: 'D-2', pic: '미지정', status: '대기', judgement: null, cust: 'LG전자', dest: '창원 물류', ship: '06-23 10:00', coa: true, pqc: '합격', req: ['COA 동봉', 'RoHS 성적서'], items: [
      { name: '중량', type: '계량', unit: 'g', spec: '50.0 ±2.0 g', lsl: 48.0, usl: 52.0, values: [], defect: 0 },
      { name: '외관', type: '계수', unit: '-', spec: '웰드라인·변형 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '색상', type: '계수', unit: '-', spec: '한계견본 내', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'SO-260620-031', date: '06-20 16:20', stage: 'OQC', code: 'FG-GER-22', name: '기어 G-22T', mtype: '완제품', vendor: '', qty: 1500, unit: 'EA', lot: 'L2606-0931', insp: '샘플링', letter: 'H', n: 50, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', wait: 21.5, due: 'D-Day', pic: '이검사', status: '검사중', judgement: null, cust: '한국델파이', dest: '대구공장', ship: '06-21 16:00', coa: true, pqc: '합격', req: ['전수 외관검사', '초·중·종물 성적서', 'COA 동봉'], items: [
      { name: '치형(M)', type: '계량', unit: 'mm', spec: '1.50 ±0.01 mm', lsl: 1.49, usl: 1.51, values: ['1.500', '1.501', '1.498', '1.502', '1.499'], defect: 0 },
      { name: 'PCD', type: '계량', unit: 'mm', spec: '33.00 ±0.05 mm', lsl: 32.95, usl: 33.05, values: ['33.00', '33.01', '32.99', '33.02', '33.00'], defect: 0 },
      { name: '백래시', type: '계량', unit: 'mm', spec: '0.05 ~ 0.15 mm', lsl: 0.05, usl: 0.15, values: ['0.09', '0.10', '0.08', '0.11', '0.10'], defect: 0 },
      { name: '치면 손상', type: '계수', unit: '-', spec: '손상 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '외관·버', type: '계수', unit: '-', spec: '버·이물 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'SO-260620-028', date: '06-20 14:05', stage: 'OQC', code: 'FG-CVR-B', name: '커버 플레이트 B', mtype: '완제품', vendor: '', qty: 3000, unit: 'EA', lot: 'L2606-1011', insp: '전수', letter: '—', n: 3000, ac: 0, re: 1, level: '—', aql: 0, prio: '긴급', wait: 23.0, due: '지연', pic: '이검사', status: '보류', judgement: null, cust: '만도', dest: '평택공장', ship: '06-21 13:00', coa: false, pqc: '조건부', req: ['전수검사', '고객 입회검사 요청'], items: [
      { name: '두께(t)', type: '계량', unit: 'mm', spec: '2.00 ±0.05 mm', lsl: 1.95, usl: 2.05, values: [], defect: 0 },
      { name: '평면도', type: '계량', unit: 'mm', spec: '≤0.10 mm', lsl: null, usl: 0.1, values: [], defect: 0 },
      { name: '버·크랙', type: '계수', unit: '-', spec: '버·크랙 無', lsl: null, usl: null, values: [], defect: 0 },
    ],
  },
  {
    recv: 'SO-260620-022', date: '06-20 11:15', stage: 'OQC', code: 'FG-SFT-D', name: '샤프트 D-40', mtype: '완제품', vendor: '', qty: 800, unit: 'EA', lot: 'L2606-1006', insp: '샘플링', letter: 'G', n: 32, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', wait: 26.0, due: 'D-1', pic: '미지정', status: '대기', judgement: null, cust: '현대모비스', dest: '아산 2공장', ship: '06-22 09:00', coa: true, pqc: '합격', req: ['COA 동봉', '재질성적서(밀시트)'], items: [
      { name: '축경(Ø)', type: '계량', unit: 'mm', spec: '40.00 ±0.03 mm', lsl: 39.97, usl: 40.03, values: [], defect: 0 },
      { name: '진원도', type: '계량', unit: 'mm', spec: '≤0.02 mm', lsl: null, usl: 0.02, values: [], defect: 0 },
      { name: '표면 거칠기', type: '계량', unit: 'Ra', spec: '≤1.6 Ra', lsl: null, usl: 1.6, values: [], defect: 0 },
    ],
  },
  {
    recv: 'SO-260619-040', date: '06-19 17:30', stage: 'OQC', code: 'FG-BRK-A', name: '브래킷 ASSY-A', mtype: '완제품', vendor: '', qty: 600, unit: 'EA', lot: 'L2606-0939', insp: '샘플링', letter: 'F', n: 20, ac: 0, re: 1, level: 'II', aql: 0.65, prio: '일반', wait: 39.5, due: 'D-3', pic: '미지정', status: '대기', judgement: null, cust: 'LG마그나', dest: '인천공장', ship: '06-24 10:00', coa: true, pqc: '합격', req: ['COA 동봉', 'PPAP 레벨3'], items: [
      { name: '외관', type: '계수', unit: '-', spec: '스크래치 無', lsl: null, usl: null, values: [], defect: 0 },
      { name: '외경(O.D)', type: '계량', unit: 'mm', spec: '25.00 ±0.05 mm', lsl: 24.95, usl: 25.05, values: [], defect: 0 },
    ],
  },
];
