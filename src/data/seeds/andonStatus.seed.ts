import type { AndonStatus } from '@/domain/andonStatus/schema';

/**
 * 설비 안돈 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-andon.jsx 의 인라인 BOARD 를 설비별 1행으로 평탄화)
 */
export const ANDON_STATUS_SEED: AndonStatus[] = [
  // A라인
  { line: 'A라인', code: 'CMP-02', name: 'CMP 02호기', st: 'RUN', lot: 'LOT-A2406-118', prod: 'AP-9 / 14nm', step: 'STEP 7/12', prog: 62, run: '04:12', cy: '120 WPH', oee: 88 },
  { line: 'A라인', code: 'ETCH-01', name: 'Etch 01호기', st: 'IDLE', lot: '—', prod: '대기 (레시피 대기)', step: 'STEP 0/9', prog: 0, run: '00:24', cy: '90 WPH', oee: 80 },
  { line: 'A라인', code: 'PHO-05', name: 'Photo 05호기', st: 'RUN', lot: 'LOT-A2406-117', prod: 'AP-9 / 14nm', step: 'STEP 3/8', prog: 41, run: '02:38', cy: '180 WPH', oee: 92 },
  { line: 'A라인', code: 'PHO-06', name: 'Photo 06호기', st: 'PM', lot: '—', prod: '정기 PM (광원 교체)', step: '—', prog: 35, run: '01:05', cy: '180 WPH', oee: 0 },
  { line: 'A라인', code: 'CMP-03', name: 'CMP 03호기', st: 'RUN', lot: 'LOT-A2406-120', prod: 'BX-2 / 28nm', step: 'STEP 9/12', prog: 78, run: '05:46', cy: '118 WPH', oee: 85 },
  { line: 'A라인', code: 'CLN-02', name: 'Clean 02호기', st: 'RUN', lot: 'LOT-A2406-119', prod: 'AP-9 / 14nm', step: 'STEP 2/4', prog: 55, run: '01:52', cy: '160 WPH', oee: 90 },
  // B라인
  { line: 'B라인', code: 'DEP-03', name: 'Depo 03호기', st: 'STOP', lot: '—', prod: '생산 정지 (계획)', step: '—', prog: 0, run: '01:30', cy: '110 WPH', oee: 0 },
  { line: 'B라인', code: 'IMP-02', name: 'Implant 02호기', st: 'RUN', lot: 'LOT-B2406-077', prod: 'CX-5 / 40nm', step: 'STEP 4/6', prog: 67, run: '03:21', cy: '200 WPH', oee: 86 },
  { line: 'B라인', code: 'DEP-04', name: 'Depo 04호기', st: 'RUN', lot: 'LOT-B2406-078', prod: 'CX-5 / 40nm', step: 'STEP 1/4', prog: 22, run: '00:48', cy: '110 WPH', oee: 83 },
  { line: 'B라인', code: 'IMP-03', name: 'Implant 03호기', st: 'IDLE', lot: '—', prod: '대기 (자재 입고 대기)', step: 'STEP 0/6', prog: 0, run: '00:12', cy: '200 WPH', oee: 84 },
  { line: 'B라인', code: 'ETCH-04', name: 'Etch 04호기', st: 'RUN', lot: 'LOT-B2406-079', prod: 'BX-2 / 28nm', step: 'STEP 6/9', prog: 71, run: '04:55', cy: '92 WPH', oee: 81 },
  { line: 'B라인', code: 'CMP-05', name: 'CMP 05호기', st: 'RUN', lot: 'LOT-B2406-080', prod: 'CX-5 / 40nm', step: 'STEP 5/12', prog: 48, run: '02:10', cy: '120 WPH', oee: 87 },
  // C라인
  { line: 'C라인', code: 'OVEN-05', name: 'Thermal 05호기', st: 'DOWN', lot: 'LOT-C2406-041', prod: '튜브 과승온', step: 'AL-6003', prog: 0, run: '00:42', cy: '150 WPH', oee: 0 },
  { line: 'C라인', code: 'CLN-04', name: 'Clean 04호기', st: 'RUN', lot: 'LOT-C2406-052', prod: 'DV-1 / 65nm', step: 'STEP 3/4', prog: 84, run: '06:18', cy: '160 WPH', oee: 88 },
  { line: 'C라인', code: 'OVEN-06', name: 'Thermal 06호기', st: 'RUN', lot: 'LOT-C2406-053', prod: 'DV-1 / 65nm', step: 'STEP 2/3', prog: 58, run: '03:40', cy: '150 WPH', oee: 85 },
  { line: 'C라인', code: 'CLN-05', name: 'Clean 05호기', st: 'IDLE', lot: '—', prod: '대기 (배스 안정화)', step: 'STEP 0/4', prog: 0, run: '00:08', cy: '160 WPH', oee: 86 },
  { line: 'C라인', code: 'ETCH-07', name: 'Etch 07호기', st: 'RUN', lot: 'LOT-C2406-054', prod: 'DV-1 / 65nm', step: 'STEP 8/9', prog: 91, run: '05:02', cy: '90 WPH', oee: 82 },
  { line: 'C라인', code: 'DEP-08', name: 'Depo 08호기', st: 'STOP', lot: '—', prod: '생산 정지 (Idle)', step: '—', prog: 0, run: '02:15', cy: '110 WPH', oee: 0 },
];
