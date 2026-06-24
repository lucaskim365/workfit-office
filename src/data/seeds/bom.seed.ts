import type { Bom } from '@/domain/bom/schema';

/** BOM 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 bom-view.jsx) */
export const BOM_SEED: Bom[] = [
  {
    code: 'CN-ASM-100', name: '커넥터 어셈블리', rev: 'C',
    items: [
      { lvl: 0, code: 'CN-ASM-100', name: '커넥터 어셈블리', kind: '제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '최종 조립', loss: 0 },
      { lvl: 1, code: 'CN-HSG-08P', name: '커넥터 하우징', kind: '반제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '사출 03호기', loss: 1.5 },
      { lvl: 2, code: 'PA66-GF30', name: 'PA66 강화수지', kind: '원자재', qty: 12, unit: 'g', ext: 12, price: 8, proc: '사출 투입', loss: 2.0 },
      { lvl: 2, code: 'MB-CLR-BK', name: '마스터배치(흑)', kind: '부자재', qty: 0.3, unit: 'g', ext: 0.3, price: 30, proc: '사출 투입', loss: 1.0 },
      { lvl: 1, code: 'TM-PIN-16', name: '터미널 핀', kind: '반제품', qty: 16, unit: 'EA', ext: 16, price: null, proc: '프레스 01호기', loss: 0.8 },
      { lvl: 2, code: 'CU-C2680', name: '동합금 스트립', kind: '원자재', qty: 4.2, unit: 'g', ext: 67.2, price: 22, proc: '프레스 투입', loss: 3.0 },
      { lvl: 1, code: 'SEAL-RING', name: '실링 O-Ring', kind: '원자재', qty: 1, unit: 'EA', ext: 1, price: 120, proc: '조립 투입', loss: 0.5 },
      { lvl: 1, code: 'LABEL-CN', name: '식별 라벨', kind: '부자재', qty: 1, unit: 'EA', ext: 1, price: 35, proc: '조립 투입', loss: 0.5 },
    ],
    revisions: [
      { rev: 'C', date: '2026-05-12', by: '김설계', note: '터미널 핀 사양 변경(TM-PIN-16) 적용', cur: true },
      { rev: 'B', date: '2025-11-03', by: '이생기', note: '실링 O-Ring 추가 (방수 등급 상향)' },
      { rev: 'A', date: '2025-06-20', by: '김설계', note: '최초 등록' },
    ],
  },
  {
    code: 'SN-MOD-200', name: '센서 모듈', rev: 'B',
    items: [
      { lvl: 0, code: 'SN-MOD-200', name: '센서 모듈', kind: '제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '최종 조립', loss: 0 },
      { lvl: 1, code: 'PCB-SN-4L', name: 'PCB 기판(4L)', kind: '반제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: 'SMT 라인', loss: 1.2 },
      { lvl: 2, code: 'IC-SEN-A1', name: '센서 IC', kind: '원자재', qty: 1, unit: 'EA', ext: 1, price: 2800, proc: 'SMT 실장', loss: 0.3 },
      { lvl: 2, code: 'CHIP-0402', name: '칩부품 0402', kind: '원자재', qty: 24, unit: 'EA', ext: 24, price: 12, proc: 'SMT 실장', loss: 2.0 },
      { lvl: 1, code: 'CASE-SN', name: '센서 케이스', kind: '원자재', qty: 1, unit: 'EA', ext: 1, price: 480, proc: '조립 투입', loss: 1.0 },
    ],
    revisions: [
      { rev: 'B', date: '2026-03-08', by: '이생기', note: '센서 IC 2nd 소스 추가', cur: true },
      { rev: 'A', date: '2025-09-15', by: '김설계', note: '최초 등록' },
    ],
  },
  {
    code: 'PWR-UNIT-50', name: '전원 유닛', rev: 'A',
    items: [
      { lvl: 0, code: 'PWR-UNIT-50', name: '전원 유닛', kind: '제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '최종 조립', loss: 0 },
      { lvl: 1, code: 'TR-50W', name: '트랜스포머 50W', kind: '원자재', qty: 1, unit: 'EA', ext: 1, price: 3200, proc: '조립 투입', loss: 0.5 },
      { lvl: 1, code: 'CAP-450V', name: '평활 콘덴서', kind: '원자재', qty: 2, unit: 'EA', ext: 2, price: 850, proc: '조립 투입', loss: 0.8 },
      { lvl: 1, code: 'HEATSINK-A', name: '방열판', kind: '원자재', qty: 1, unit: 'EA', ext: 1, price: 1100, proc: '조립 투입', loss: 0.5 },
    ],
    revisions: [{ rev: 'A', date: '2026-01-20', by: '김설계', note: '최초 등록', cur: true }],
  },
  {
    code: 'BR-KIT-2T', name: '브래킷 키트', rev: 'D',
    items: [
      { lvl: 0, code: 'BR-KIT-2T', name: '브래킷 키트', kind: '제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '최종 포장', loss: 0 },
      { lvl: 1, code: 'BR-MNT-2T', name: '브래킷 본체', kind: '반제품', qty: 1, unit: 'EA', ext: 1, price: null, proc: '프레스 01호기', loss: 1.0 },
      { lvl: 1, code: 'BOLT-M6', name: '체결 볼트 M6', kind: '부자재', qty: 4, unit: 'EA', ext: 4, price: 18, proc: '포장 투입', loss: 1.0 },
    ],
    revisions: [
      { rev: 'D', date: '2026-04-30', by: '박품질', note: '볼트 규격 M5→M6 변경', cur: true },
      { rev: 'C', date: '2025-12-11', by: '이생기', note: '표면처리 사양 변경' },
      { rev: 'B', date: '2025-08-02', by: '김설계', note: '브래킷 두께 보강' },
      { rev: 'A', date: '2025-03-19', by: '김설계', note: '최초 등록' },
    ],
  },
];
